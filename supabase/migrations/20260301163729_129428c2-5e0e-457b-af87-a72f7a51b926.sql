
DROP FUNCTION IF EXISTS public.rpc_raiox_clientes_overview_v1(text, text, text, text, integer, text, boolean, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.rpc_raiox_clientes_overview_v1(
  p_org_id text DEFAULT NULL,
  p_unit_id text DEFAULT NULL,
  p_inicio text DEFAULT NULL,
  p_fim text DEFAULT NULL,
  p_janela_dias int DEFAULT 60,
  p_colaborador_id text DEFAULT NULL,
  p_excluir_sem_cadastro boolean DEFAULT true,
  p_cliente_key_mode text DEFAULT 'CLIENTE_ID',
  p_base_mode text DEFAULT 'TOTAL_COM_CORTE',
  p_base_corte_meses int DEFAULT 24,
  p_status12m_meses int DEFAULT 12
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_inicio date;
  v_fim date;
  v_ref date;
  v_risco_min int := 45;
  v_risco_max int := 90;
  v_churn_dias int := 90;
  v_result json;
BEGIN
  v_inicio := COALESCE(p_inicio::date, (date_trunc('year', now()))::date);
  v_fim := COALESCE(p_fim::date, now()::date);
  v_ref := v_fim;

  WITH
  vendas_periodo AS (
    SELECT DISTINCT cliente_id, venda_data_ts::date AS venda_dia
    FROM vendas_api_raw
    WHERE venda_data_ts IS NOT NULL
      AND venda_data_ts::date BETWEEN v_inicio AND v_fim
      AND (NOT p_excluir_sem_cadastro OR (cliente_id IS NOT NULL AND cliente_id <> ''))
      AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
  ),
  clientes_periodo AS (
    SELECT cliente_id, COUNT(DISTINCT venda_dia) AS visitas_periodo
    FROM vendas_periodo
    GROUP BY cliente_id
  ),
  base_completa AS (
    SELECT
      dc.cliente_id,
      dc.first_seen,
      dc.last_seen,
      (v_ref - dc.last_seen)::int AS dias_sem_vir
    FROM dimensao_clientes dc
    WHERE dc.last_seen IS NOT NULL
      AND dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''
      AND (NOT p_excluir_sem_cadastro OR dc.cliente_nome NOT ILIKE '%sem cadastro%')
      AND (p_colaborador_id IS NULL OR dc.ultimo_colaborador_id = p_colaborador_id)
      AND (
        CASE p_base_mode
          WHEN 'TOTAL' THEN true
          WHEN 'TOTAL_COM_CORTE' THEN dc.last_seen >= (v_ref - (p_base_corte_meses * 30))
          WHEN 'PERIODO_FILTRADO' THEN dc.last_seen BETWEEN v_inicio AND v_fim
          WHEN 'JANELA' THEN (v_ref - dc.last_seen)::int <= p_janela_dias
          ELSE dc.last_seen >= (v_ref - (p_base_corte_meses * 30))
        END
      )
  ),
  total_visits AS (
    SELECT cliente_id, COUNT(DISTINCT venda_data_ts::date) AS visitas_total
    FROM vendas_api_raw
    WHERE venda_data_ts IS NOT NULL
      AND (cliente_id IS NOT NULL AND cliente_id <> '')
      AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    GROUP BY cliente_id
  ),
  cx AS (
    SELECT
      bc.cliente_id,
      bc.first_seen,
      bc.last_seen,
      bc.dias_sem_vir,
      COALESCE(tv.visitas_total, 0)::int AS visitas_total
    FROM base_completa bc
    LEFT JOIN total_visits tv ON tv.cliente_id = bc.cliente_id
  ),
  -- base_distribuicao: INDEPENDENTE de cx/base_completa
  base_distribuicao AS (
    SELECT
      dc.cliente_id,
      dc.first_seen,
      dc.last_seen,
      (v_ref - dc.last_seen)::int AS dias_sem_vir,
      COALESCE(tv.visitas_total, 0)::int AS visitas_total
    FROM dimensao_clientes dc
    LEFT JOIN total_visits tv ON tv.cliente_id = dc.cliente_id
    WHERE dc.last_seen IS NOT NULL
      AND dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''
      AND (NOT p_excluir_sem_cadastro OR dc.cliente_nome NOT ILIKE '%sem cadastro%')
      AND (p_colaborador_id IS NULL OR dc.ultimo_colaborador_id = p_colaborador_id)
      AND dc.last_seen >= (v_ref - (p_status12m_meses * 30))
  ),
  pre_period AS (
    SELECT v.cliente_id, MAX(v.venda_data_ts::date) AS last_before
    FROM vendas_api_raw v
    WHERE v.venda_data_ts IS NOT NULL
      AND v.venda_data_ts::date < v_inicio
      AND (v.cliente_id IS NOT NULL AND v.cliente_id <> '')
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
    GROUP BY v.cliente_id
  ),
  kpis AS (
    SELECT json_build_object(
      'clientes_unicos_periodo', (SELECT COUNT(*) FROM clientes_periodo),
      'novos_clientes_periodo', (SELECT COUNT(*) FROM cx WHERE first_seen IS NOT NULL AND first_seen BETWEEN v_inicio AND v_fim),
      'clientes_ativos_janela', (SELECT COUNT(*) FROM cx WHERE dias_sem_vir <= p_janela_dias),
      'clientes_em_risco_macro', (SELECT COUNT(*) FROM base_distribuicao WHERE dias_sem_vir > v_risco_min AND dias_sem_vir <= v_risco_max AND visitas_total > 1),
      'clientes_perdidos_macro', (SELECT COUNT(*) FROM base_distribuicao WHERE dias_sem_vir > v_churn_dias AND visitas_total > 1),
      'clientes_resgatados_periodo', (
        SELECT COUNT(*) FROM clientes_periodo cp
        JOIN cx ON cx.cliente_id = cp.cliente_id
        JOIN pre_period pp ON pp.cliente_id = cp.cliente_id
        WHERE cx.visitas_total > 1
          AND cx.first_seen IS NOT NULL AND cx.first_seen < v_inicio
          AND pp.last_before < (v_inicio - v_churn_dias)
      ),
      'one_shot_em_risco', (SELECT COUNT(*) FROM base_distribuicao WHERE visitas_total = 1 AND dias_sem_vir > v_risco_min AND dias_sem_vir <= v_risco_max),
      'one_shot_perdido', (SELECT COUNT(*) FROM base_distribuicao WHERE visitas_total = 1 AND dias_sem_vir > v_churn_dias)
    ) AS val
  ),

  -- PERFIL: volume + recência (FIEL, RECORRENTE, REGULAR, OCASIONAL, ONE_SHOT, INATIVO)
  dist_perfil AS (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) AS val
    FROM (
      SELECT perfil, COUNT(*) AS qtd FROM (
        SELECT CASE
          WHEN visitas_total >= 12 AND dias_sem_vir <= 45 THEN 'FIEL'
          WHEN visitas_total >= 6  AND dias_sem_vir <= 60 THEN 'RECORRENTE'
          WHEN visitas_total >= 3  AND dias_sem_vir <= 90 THEN 'REGULAR'
          WHEN visitas_total >= 2 THEN 'OCASIONAL'
          WHEN visitas_total = 1 THEN 'ONE_SHOT'
          ELSE 'INATIVO'
        END AS perfil
        FROM base_distribuicao
      ) sub GROUP BY perfil ORDER BY qtd DESC
    ) t
  ),

  -- CADÊNCIA: recorrentes vs one-shots
  dist_cadencia AS (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) AS val
    FROM (
      SELECT status, COUNT(*) AS qtd FROM (
        SELECT CASE
          WHEN visitas_total = 1 AND dias_sem_vir <= 45 THEN 'ONE_SHOT_AGUARDANDO'
          WHEN visitas_total = 1 AND dias_sem_vir <= 90 THEN 'ONE_SHOT_RISCO'
          WHEN visitas_total = 1 THEN 'ONE_SHOT_PERDIDO'
          WHEN dias_sem_vir <= 30 THEN 'MUITO_FREQUENTE'
          WHEN dias_sem_vir <= 45 THEN 'REGULAR'
          WHEN dias_sem_vir <= 60 THEN 'ESPACANDO'
          WHEN dias_sem_vir <= 90 THEN 'EM_RISCO'
          ELSE 'PERDIDO'
        END AS status
        FROM base_distribuicao
      ) sub GROUP BY status ORDER BY qtd DESC
    ) t
  ),

  -- STATUS 12M (macro): puramente recência (SAUDAVEL, EM_RISCO, PERDIDO)
  dist_macro AS (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) AS val
    FROM (
      SELECT macro, COUNT(*) AS qtd FROM (
        SELECT CASE
          WHEN dias_sem_vir <= 45 THEN 'SAUDAVEL'
          WHEN dias_sem_vir <= 90 THEN 'EM_RISCO'
          ELSE 'PERDIDO'
        END AS macro
        FROM base_distribuicao
      ) sub GROUP BY macro ORDER BY qtd DESC
    ) t
  ),

  trend_unicos AS (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.ano, t.mes), '[]'::json) AS val
    FROM (
      SELECT
        EXTRACT(YEAR FROM venda_data_ts)::int AS ano,
        EXTRACT(MONTH FROM venda_data_ts)::int AS mes,
        COUNT(DISTINCT cliente_id) AS qtd
      FROM vendas_api_raw
      WHERE venda_data_ts IS NOT NULL
        AND venda_data_ts::date BETWEEN v_inicio AND v_fim
        AND (cliente_id IS NOT NULL AND cliente_id <> '')
        AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
      GROUP BY 1, 2
    ) t
  ),
  trend_novos AS (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.ano, t.mes), '[]'::json) AS val
    FROM (
      SELECT
        EXTRACT(YEAR FROM dc.first_seen)::int AS ano,
        EXTRACT(MONTH FROM dc.first_seen)::int AS mes,
        COUNT(*) AS qtd
      FROM dimensao_clientes dc
      WHERE dc.first_seen IS NOT NULL
        AND dc.first_seen BETWEEN v_inicio AND v_fim
        AND dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''
        AND (NOT p_excluir_sem_cadastro OR dc.cliente_nome NOT ILIKE '%sem cadastro%')
        AND (p_colaborador_id IS NULL OR dc.ultimo_colaborador_id = p_colaborador_id)
      GROUP BY 1, 2
    ) t
  ),
  alerts AS (
    SELECT json_build_object(
      'registros_sem_cliente_id', (
        SELECT COUNT(*) FROM vendas_api_raw
        WHERE venda_data_ts::date BETWEEN v_inicio AND v_fim
          AND (cliente_id IS NULL OR cliente_id = '')
      ),
      'pct_registros_sem_cliente_id', (
        SELECT ROUND(
          COALESCE(
            COUNT(*) FILTER (WHERE cliente_id IS NULL OR cliente_id = '')::numeric
            / NULLIF(COUNT(*)::numeric, 0) * 100,
          0), 1)
        FROM vendas_api_raw
        WHERE venda_data_ts::date BETWEEN v_inicio AND v_fim
      )
    ) AS val
  )
  SELECT json_build_object(
    'meta', json_build_object(
      'inicio', v_inicio,
      'fim', v_fim,
      'janela_dias', p_janela_dias,
      'base_total', (SELECT COUNT(*) FROM cx),
      'base_distribuicao_total', (SELECT COUNT(*) FROM base_distribuicao),
      'base_mode', p_base_mode,
      'base_corte_meses', p_base_corte_meses,
      'status12m_meses', p_status12m_meses
    ),
    'kpis', kpis.val,
    'distribuicoes', json_build_object(
      'por_perfil_tipo', dist_perfil.val,
      'por_cadencia_momento', dist_cadencia.val,
      'por_macro', dist_macro.val
    ),
    'tendencias', json_build_object(
      'clientes_unicos_mensal', trend_unicos.val,
      'novos_clientes_mensal', trend_novos.val
    ),
    'alerts', alerts.val
  ) INTO v_result
  FROM kpis, dist_perfil, dist_cadencia, dist_macro, trend_unicos, trend_novos, alerts;

  RETURN v_result;
END;
$function$;

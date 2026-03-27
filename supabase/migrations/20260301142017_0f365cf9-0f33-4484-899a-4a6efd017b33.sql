
CREATE OR REPLACE FUNCTION public.rpc_raiox_clientes_overview_v1(
  p_org_id text DEFAULT NULL,
  p_unit_id text DEFAULT NULL,
  p_inicio text DEFAULT NULL,
  p_fim text DEFAULT NULL,
  p_janela_dias int DEFAULT 60,
  p_colaborador_id text DEFAULT NULL,
  p_excluir_sem_cadastro boolean DEFAULT true,
  p_cliente_key_mode text DEFAULT 'CLIENTE_ID'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio date;
  v_fim date;
  v_ref date;
  v_risco_min int := 45;
  v_risco_max int := 90;
  v_churn_dias int := 90;
  v_result json;
  v_kpis json;
  v_dist_perfil json;
  v_dist_cadencia json;
  v_dist_macro json;
  v_tend_unicos json;
  v_tend_novos json;
  v_alerts json;
  v_total_raw bigint;
  v_sem_cliente bigint;
BEGIN
  -- Parse dates
  v_inicio := COALESCE(p_inicio::date, (date_trunc('year', now()))::date);
  v_fim := COALESCE(p_fim::date, now()::date);
  v_ref := v_fim;

  -- ============================================================
  -- TEMP TABLE: client-level aggregates for the period
  -- ============================================================
  CREATE TEMP TABLE _cx ON COMMIT DROP AS
  WITH vendas_periodo AS (
    SELECT DISTINCT cliente_id, venda_data_ts::date AS venda_dia
    FROM vendas_api_raw
    WHERE venda_data_ts IS NOT NULL
      AND venda_data_ts::date BETWEEN v_inicio AND v_fim
      AND (NOT p_excluir_sem_cadastro OR (cliente_id IS NOT NULL AND cliente_id <> ''))
      AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
  ),
  client_visits AS (
    SELECT
      cliente_id,
      COUNT(DISTINCT venda_dia) AS visitas_periodo,
      MAX(venda_dia) AS ultima_periodo
    FROM vendas_periodo
    GROUP BY cliente_id
  )
  SELECT
    cv.cliente_id,
    cv.visitas_periodo,
    cv.ultima_periodo,
    dc.first_seen,
    dc.last_seen,
    -- total visits ever (approximate from dimensao or count)
    COALESCE((
      SELECT COUNT(DISTINCT v2.venda_data_ts::date)
      FROM vendas_api_raw v2
      WHERE v2.cliente_id = cv.cliente_id
        AND v2.venda_data_ts IS NOT NULL
        AND (p_colaborador_id IS NULL OR v2.colaborador_id = p_colaborador_id)
    ), 0)::int AS visitas_total,
    (v_ref - COALESCE(dc.last_seen, cv.ultima_periodo))::int AS dias_sem_vir
  FROM client_visits cv
  LEFT JOIN dimensao_clientes dc ON dc.cliente_id = cv.cliente_id;

  -- ============================================================
  -- KPIs
  -- ============================================================
  SELECT json_build_object(
    'clientes_unicos_periodo', (SELECT COUNT(*) FROM _cx),
    'novos_clientes_periodo', (
      SELECT COUNT(*) FROM _cx
      WHERE first_seen IS NOT NULL AND first_seen BETWEEN v_inicio AND v_fim
    ),
    'clientes_ativos_janela', (
      SELECT COUNT(*) FROM _cx WHERE dias_sem_vir <= p_janela_dias
    ),
    'clientes_em_risco_macro', (
      SELECT COUNT(*) FROM _cx
      WHERE dias_sem_vir > v_risco_min AND dias_sem_vir <= v_risco_max
        AND visitas_total > 1
    ),
    'clientes_perdidos_macro', (
      SELECT COUNT(*) FROM _cx
      WHERE dias_sem_vir > v_churn_dias AND visitas_total > 1
    ),
    'clientes_resgatados_periodo', (
      -- clients whose last_seen before period was > churn_dias ago but came back in period
      SELECT COUNT(*) FROM _cx
      WHERE visitas_total > 1
        AND first_seen IS NOT NULL
        AND first_seen < v_inicio
        AND EXISTS (
          SELECT 1 FROM vendas_api_raw v3
          WHERE v3.cliente_id = _cx.cliente_id
            AND v3.venda_data_ts IS NOT NULL
            AND v3.venda_data_ts::date BETWEEN v_inicio AND v_fim
            AND (p_colaborador_id IS NULL OR v3.colaborador_id = p_colaborador_id)
        )
        AND (
          SELECT MAX(v4.venda_data_ts::date)
          FROM vendas_api_raw v4
          WHERE v4.cliente_id = _cx.cliente_id
            AND v4.venda_data_ts IS NOT NULL
            AND v4.venda_data_ts::date < v_inicio
            AND (p_colaborador_id IS NULL OR v4.colaborador_id = p_colaborador_id)
        ) < (v_inicio - v_churn_dias)
    ),
    'one_shot_em_risco', (
      SELECT COUNT(*) FROM _cx
      WHERE visitas_total = 1
        AND dias_sem_vir > v_risco_min AND dias_sem_vir <= v_risco_max
    ),
    'one_shot_perdido', (
      SELECT COUNT(*) FROM _cx
      WHERE visitas_total = 1 AND dias_sem_vir > v_churn_dias
    )
  ) INTO v_kpis;

  -- ============================================================
  -- DISTRIBUIÇÕES
  -- ============================================================
  -- Por Perfil (based on total visits)
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_dist_perfil
  FROM (
    SELECT perfil, COUNT(*) AS qtd FROM (
      SELECT
        CASE
          WHEN visitas_total >= 12 THEN 'FIEL'
          WHEN visitas_total >= 6 THEN 'RECORRENTE'
          WHEN visitas_total >= 3 THEN 'IRREGULAR'
          WHEN visitas_total >= 2 THEN 'OCASIONAL'
          ELSE 'INATIVO'
        END AS perfil
      FROM _cx
    ) sub
    GROUP BY perfil ORDER BY qtd DESC
  ) t;

  -- Por Macro (days without visit)
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_dist_macro
  FROM (
    SELECT macro, COUNT(*) AS qtd FROM (
      SELECT
        CASE
          WHEN dias_sem_vir <= v_risco_min THEN 'OK'
          WHEN dias_sem_vir <= v_risco_max THEN 'EM_RISCO'
          ELSE 'PERDIDO'
        END AS macro
      FROM _cx
    ) sub
    GROUP BY macro ORDER BY qtd DESC
  ) t;

  -- Por Cadência (moment)
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_dist_cadencia
  FROM (
    SELECT status, COUNT(*) AS qtd FROM (
      SELECT
        CASE
          WHEN visitas_total = 1 AND dias_sem_vir <= v_risco_min THEN 'ONE_SHOT_AGUARDANDO'
          WHEN visitas_total = 1 AND dias_sem_vir <= v_risco_max THEN 'ONE_SHOT_RISCO'
          WHEN visitas_total = 1 THEN 'ONE_SHOT_PERDIDO'
          WHEN dias_sem_vir <= 30 THEN 'MUITO_FREQUENTE'
          WHEN dias_sem_vir <= v_risco_min THEN 'REGULAR'
          WHEN dias_sem_vir <= 60 THEN 'ESPACANDO'
          WHEN dias_sem_vir <= v_risco_max THEN 'EM_RISCO'
          ELSE 'PERDIDO'
        END AS status
      FROM _cx
    ) sub
    GROUP BY status ORDER BY qtd DESC
  ) t;

  -- ============================================================
  -- TENDÊNCIAS
  -- ============================================================
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.ano, t.mes), '[]'::json) INTO v_tend_unicos
  FROM (
    SELECT
      EXTRACT(YEAR FROM v.venda_data_ts)::int AS ano,
      EXTRACT(MONTH FROM v.venda_data_ts)::int AS mes,
      COUNT(DISTINCT v.cliente_id) AS qtd
    FROM vendas_api_raw v
    WHERE v.venda_data_ts IS NOT NULL
      AND v.venda_data_ts::date BETWEEN v_inicio AND v_fim
      AND (NOT p_excluir_sem_cadastro OR (v.cliente_id IS NOT NULL AND v.cliente_id <> ''))
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
    GROUP BY 1, 2
  ) t;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.ano, t.mes), '[]'::json) INTO v_tend_novos
  FROM (
    SELECT
      EXTRACT(YEAR FROM dc.first_seen)::int AS ano,
      EXTRACT(MONTH FROM dc.first_seen)::int AS mes,
      COUNT(*) AS qtd
    FROM dimensao_clientes dc
    WHERE dc.first_seen IS NOT NULL
      AND dc.first_seen BETWEEN v_inicio AND v_fim
      AND (NOT p_excluir_sem_cadastro OR (dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''))
      AND (p_colaborador_id IS NULL OR dc.ultimo_colaborador_id = p_colaborador_id)
    GROUP BY 1, 2
  ) t;

  -- ============================================================
  -- ALERTS
  -- ============================================================
  SELECT COUNT(*) INTO v_total_raw
  FROM vendas_api_raw
  WHERE venda_data_ts IS NOT NULL
    AND venda_data_ts::date BETWEEN v_inicio AND v_fim;

  SELECT COUNT(*) INTO v_sem_cliente
  FROM vendas_api_raw
  WHERE venda_data_ts IS NOT NULL
    AND venda_data_ts::date BETWEEN v_inicio AND v_fim
    AND (cliente_id IS NULL OR cliente_id = '');

  v_alerts := json_build_object(
    'registros_sem_cliente_id', v_sem_cliente,
    'pct_registros_sem_cliente_id', CASE WHEN v_total_raw > 0 THEN ROUND((v_sem_cliente::numeric / v_total_raw) * 100, 1) ELSE 0 END
  );

  -- ============================================================
  -- RESULT
  -- ============================================================
  v_result := json_build_object(
    'meta', json_build_object(
      'org_id', p_org_id,
      'unit_id', p_unit_id,
      'inicio', v_inicio,
      'fim', v_fim,
      'janela_dias', p_janela_dias,
      'colaborador_id', p_colaborador_id,
      'excluir_sem_cadastro', p_excluir_sem_cadastro,
      'refetched_at', now()
    ),
    'kpis', v_kpis,
    'distribuicoes', json_build_object(
      'por_perfil_tipo', v_dist_perfil,
      'por_cadencia_momento', v_dist_cadencia,
      'por_macro', v_dist_macro
    ),
    'tendencias', json_build_object(
      'clientes_unicos_mensal', v_tend_unicos,
      'novos_clientes_mensal', v_tend_novos
    ),
    'alerts', v_alerts
  );

  RETURN v_result;
END;
$$;


-- ============================================================
-- Rewrite rpc_raiox_clientes_churn_v1 using CTEs + vw_clientes_resumo
-- Fixes statement timeout caused by unbounded LATERAL joins
-- ============================================================

DROP FUNCTION IF EXISTS rpc_raiox_clientes_churn_v1(text, text, int, text, boolean, int, int, int, int, int, text, int, text, int, text);

CREATE OR REPLACE FUNCTION rpc_raiox_clientes_churn_v1(
  p_inicio text DEFAULT NULL,
  p_fim text DEFAULT NULL,
  p_janela_dias int DEFAULT 90,
  p_colaborador_id text DEFAULT NULL,
  p_excluir_sem_cadastro boolean DEFAULT false,
  p_churn_dias_sem_voltar int DEFAULT 90,
  p_risco_min_dias int DEFAULT 45,
  p_risco_max_dias int DEFAULT 90,
  p_cadencia_min_visitas int DEFAULT 3,
  p_resgate_dias_minimos int DEFAULT 60,
  p_atribuicao_modo text DEFAULT 'ultimo',
  p_atribuicao_janela_meses int DEFAULT 6,
  p_base_mode text DEFAULT 'TOTAL_COM_CORTE',
  p_base_corte_meses int DEFAULT 12,
  p_ref_mode text DEFAULT 'FIM_PERIODO'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
DECLARE
  v_ref date;
  v_inicio date;
  v_fim date;
  v_result jsonb;
BEGIN
  v_inicio := COALESCE(p_inicio::date, (date_trunc('year', now()))::date);
  v_fim := COALESCE(p_fim::date, now()::date);

  IF p_ref_mode = 'HOJE' THEN
    v_ref := current_date;
  ELSE
    v_ref := v_fim;
  END IF;

  WITH
  -- 1) Base universe: dimensao_clientes + vw_clientes_resumo (no LATERAL)
  base_universe AS (
    SELECT
      dc.cliente_id,
      dc.cliente_nome,
      dc.telefone,
      dc.last_seen,
      dc.ultimo_colaborador_id,
      dc.ultimo_colaborador_nome,
      (v_ref - dc.last_seen)::int AS dias_sem_vir,
      COALESCE(cr.atendimentos_total, 0)::int AS visitas_total,
      COALESCE(cr.valor_total, 0)::numeric AS valor_total
    FROM dimensao_clientes dc
    LEFT JOIN vw_clientes_resumo cr ON cr.cliente_id = dc.cliente_id
    WHERE dc.cliente_id IS NOT NULL
      AND dc.cliente_id <> ''
      AND dc.last_seen IS NOT NULL
      AND (NOT p_excluir_sem_cadastro OR (dc.cliente_nome IS NOT NULL AND dc.cliente_nome <> '' AND dc.cliente_nome NOT ILIKE '%sem cadastro%'))
      AND (p_colaborador_id IS NULL OR dc.ultimo_colaborador_id = p_colaborador_id)
      AND CASE
        WHEN p_base_mode = 'JANELA' THEN dc.last_seen >= (v_ref - p_janela_dias)
        WHEN p_base_mode = 'PERIODO_FILTRADO' THEN dc.last_seen BETWEEN v_inicio AND v_fim
        WHEN p_base_mode = 'TOTAL' THEN true
        WHEN p_base_mode = 'TOTAL_COM_CORTE' THEN dc.last_seen >= (v_ref - (p_base_corte_meses * 30))
        ELSE dc.last_seen >= (v_ref - (p_base_corte_meses * 30))
      END
  ),

  -- 2) Classify each client
  classified AS (
    SELECT
      bu.*,
      CASE
        WHEN bu.dias_sem_vir > p_churn_dias_sem_voltar THEN 'PERDIDO'
        WHEN bu.dias_sem_vir >= p_risco_min_dias AND bu.dias_sem_vir <= p_risco_max_dias THEN 'RISCO'
        WHEN bu.dias_sem_vir <= p_janela_dias THEN 'ATIVO'
        ELSE 'INATIVO'
      END AS status_churn,
      (bu.visitas_total >= p_cadencia_min_visitas) AS is_fidelizado,
      (bu.visitas_total = 1) AS is_oneshot
    FROM base_universe bu
  ),

  -- 3) Pre-period: last visit before v_inicio (for resgatados detection)
  pre_period AS (
    SELECT v.cliente_id, MAX(v.venda_data_ts::date) AS last_before
    FROM vendas_api_raw v
    WHERE v.venda_data_ts IS NOT NULL
      AND v.venda_data_ts::date < v_inicio
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
    GROUP BY v.cliente_id
  ),

  -- 4) Visits in period
  visits_in_period AS (
    SELECT DISTINCT v.cliente_id
    FROM vendas_api_raw v
    WHERE v.venda_data_ts IS NOT NULL
      AND v.venda_data_ts::date BETWEEN v_inicio AND v_fim
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
  ),

  -- 5) Resgatados: visited in period AND were "lost" before the period
  resgatados AS (
    SELECT c.cliente_id
    FROM classified c
    JOIN visits_in_period vip ON vip.cliente_id = c.cliente_id
    JOIN pre_period pp ON pp.cliente_id = c.cliente_id
    WHERE pp.last_before < (v_inicio - p_resgate_dias_minimos)
      AND c.visitas_total > 1
  ),

  -- 6) KPI counts
  kpi_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE status_churn = 'ATIVO') AS base_ativa,
      COUNT(*) FILTER (WHERE status_churn = 'PERDIDO') AS perdidos,
      COUNT(*) FILTER (WHERE status_churn = 'RISCO') AS em_risco,
      COUNT(*) FILTER (WHERE status_churn = 'ATIVO' AND is_fidelizado) AS base_fidelizados,
      COUNT(*) FILTER (WHERE status_churn = 'PERDIDO' AND is_fidelizado) AS perdidos_fidelizados,
      COUNT(*) FILTER (WHERE status_churn = 'ATIVO' AND is_oneshot) AS base_oneshot,
      COUNT(*) FILTER (WHERE status_churn = 'PERDIDO' AND is_oneshot) AS perdidos_oneshot,
      COUNT(*) AS total_universo
    FROM classified
  ),

  resgatados_count AS (
    SELECT COUNT(*) AS resgatados FROM resgatados
  ),

  -- 7) Por barbeiro: attribute via vendas in the attribution window
  barb_clients AS (
    SELECT
      va.colaborador_id,
      va.colaborador_nome,
      c.cliente_id,
      c.status_churn
    FROM classified c
    JOIN vendas_api_raw va ON va.cliente_id = c.cliente_id
      AND va.colaborador_id IS NOT NULL
      AND va.venda_data_ts IS NOT NULL
      AND va.venda_data_ts::date >= (v_ref - (p_atribuicao_janela_meses * 30))
    WHERE c.status_churn IN ('ATIVO', 'PERDIDO', 'RISCO')
      AND (p_colaborador_id IS NULL OR va.colaborador_id = p_colaborador_id)
  ),

  client_barber_count AS (
    SELECT cliente_id, COUNT(DISTINCT colaborador_id) AS n_barbeiros
    FROM barb_clients
    GROUP BY cliente_id
  ),

  por_barbeiro AS (
    SELECT
      bc.colaborador_id,
      bc.colaborador_nome,
      COUNT(DISTINCT bc.cliente_id) FILTER (WHERE bc.status_churn = 'ATIVO') AS base_ativa,
      COUNT(DISTINCT bc.cliente_id) FILTER (WHERE bc.status_churn = 'PERDIDO') AS perdidos,
      CASE
        WHEN COUNT(DISTINCT bc.cliente_id) FILTER (WHERE bc.status_churn IN ('ATIVO','PERDIDO')) > 0
        THEN ROUND(
          COUNT(DISTINCT bc.cliente_id) FILTER (WHERE bc.status_churn = 'PERDIDO') * 100.0
          / COUNT(DISTINCT bc.cliente_id) FILTER (WHERE bc.status_churn IN ('ATIVO','PERDIDO')),
          1
        )
        ELSE 0
      END AS churn_pct,
      ROUND(
        COUNT(DISTINCT bc.cliente_id) FILTER (WHERE bc.status_churn IN ('ATIVO','PERDIDO') AND cbc.n_barbeiros = 1) * 100.0
        / NULLIF(COUNT(DISTINCT bc.cliente_id) FILTER (WHERE bc.status_churn IN ('ATIVO','PERDIDO')), 0),
        1
      ) AS exclusivos_pct,
      ROUND(
        COUNT(DISTINCT bc.cliente_id) FILTER (WHERE bc.status_churn IN ('ATIVO','PERDIDO') AND cbc.n_barbeiros > 1) * 100.0
        / NULLIF(COUNT(DISTINCT bc.cliente_id) FILTER (WHERE bc.status_churn IN ('ATIVO','PERDIDO')), 0),
        1
      ) AS compartilhados_pct
    FROM barb_clients bc
    LEFT JOIN client_barber_count cbc ON cbc.cliente_id = bc.cliente_id
    GROUP BY bc.colaborador_id, bc.colaborador_nome
    HAVING COUNT(DISTINCT bc.cliente_id) FILTER (WHERE bc.status_churn IN ('ATIVO','PERDIDO')) > 0
    ORDER BY churn_pct DESC
  ),

  -- 8) Lista: top 50 perdidos/risco/resgatados
  lista AS (
    SELECT
      c.cliente_id,
      c.cliente_nome,
      c.telefone,
      c.ultimo_colaborador_nome AS colaborador_nome,
      c.last_seen::text AS ultima_visita,
      c.dias_sem_vir,
      c.visitas_total,
      c.valor_total,
      CASE
        WHEN r.cliente_id IS NOT NULL THEN 'RESGATADO'
        ELSE c.status_churn
      END AS status_churn
    FROM classified c
    LEFT JOIN resgatados r ON r.cliente_id = c.cliente_id
    WHERE c.status_churn IN ('PERDIDO', 'RISCO') OR r.cliente_id IS NOT NULL
    ORDER BY c.dias_sem_vir DESC
    LIMIT 50
  )

  SELECT jsonb_build_object(
    'meta', jsonb_build_object(
      'ref', v_ref::text,
      'base_ativa', k.base_ativa,
      'base_fidelizados', k.base_fidelizados,
      'base_oneshot', k.base_oneshot,
      'total_universo', k.total_universo
    ),
    'kpis', jsonb_build_object(
      'churn_geral_pct', CASE WHEN k.base_ativa + k.perdidos > 0 THEN ROUND(k.perdidos * 100.0 / (k.base_ativa + k.perdidos), 1) ELSE 0 END,
      'perdidos', k.perdidos,
      'base_ativa', k.base_ativa,
      'churn_fidelizados_pct', CASE WHEN k.base_fidelizados + k.perdidos_fidelizados > 0 THEN ROUND(k.perdidos_fidelizados * 100.0 / (k.base_fidelizados + k.perdidos_fidelizados), 1) ELSE 0 END,
      'perdidos_fidelizados', k.perdidos_fidelizados,
      'base_fidelizados', k.base_fidelizados,
      'churn_oneshot_pct', CASE WHEN k.base_oneshot + k.perdidos_oneshot > 0 THEN ROUND(k.perdidos_oneshot * 100.0 / (k.base_oneshot + k.perdidos_oneshot), 1) ELSE 0 END,
      'perdidos_oneshot', k.perdidos_oneshot,
      'base_oneshot', k.base_oneshot,
      'resgatados', rc.resgatados,
      'em_risco', k.em_risco
    ),
    'por_barbeiro', COALESCE((SELECT jsonb_agg(row_to_json(pb)::jsonb) FROM por_barbeiro pb), '[]'::jsonb),
    'lista_perdidos', COALESCE((SELECT jsonb_agg(row_to_json(l)::jsonb) FROM lista l), '[]'::jsonb)
  ) INTO v_result
  FROM kpi_counts k
  CROSS JOIN resgatados_count rc;

  RETURN v_result;
END;
$$;

-- ============================================================
-- Rewrite rpc_raiox_clientes_churn_drill_v1 using CTEs
-- ============================================================

DROP FUNCTION IF EXISTS rpc_raiox_clientes_churn_drill_v1(text, text, int, text, boolean, text, text, int, int, int, int, int, text, int, text, int, text);

CREATE OR REPLACE FUNCTION rpc_raiox_clientes_churn_drill_v1(
  p_inicio text DEFAULT NULL,
  p_fim text DEFAULT NULL,
  p_janela_dias int DEFAULT 90,
  p_colaborador_id text DEFAULT NULL,
  p_excluir_sem_cadastro boolean DEFAULT false,
  p_tipo text DEFAULT 'PERDIDOS',
  p_valor text DEFAULT '',
  p_limit int DEFAULT 500,
  p_churn_dias_sem_voltar int DEFAULT 90,
  p_risco_min_dias int DEFAULT 45,
  p_risco_max_dias int DEFAULT 90,
  p_cadencia_min_visitas int DEFAULT 3,
  p_atribuicao_modo text DEFAULT 'ultimo',
  p_atribuicao_janela_meses int DEFAULT 6,
  p_base_mode text DEFAULT 'TOTAL_COM_CORTE',
  p_base_corte_meses int DEFAULT 12,
  p_ref_mode text DEFAULT 'FIM_PERIODO'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
DECLARE
  v_ref date;
  v_inicio date;
  v_fim date;
  v_total int;
  v_rows jsonb;
BEGIN
  v_inicio := COALESCE(p_inicio::date, (date_trunc('year', now()))::date);
  v_fim := COALESCE(p_fim::date, now()::date);

  IF p_ref_mode = 'HOJE' THEN
    v_ref := current_date;
  ELSE
    v_ref := v_fim;
  END IF;

  WITH
  base_universe AS (
    SELECT
      dc.cliente_id,
      dc.cliente_nome,
      dc.telefone,
      dc.last_seen,
      dc.ultimo_colaborador_id,
      dc.ultimo_colaborador_nome,
      (v_ref - dc.last_seen)::int AS dias_sem_vir,
      COALESCE(cr.atendimentos_total, 0)::int AS visitas_total,
      COALESCE(cr.valor_total, 0)::numeric AS valor_total
    FROM dimensao_clientes dc
    LEFT JOIN vw_clientes_resumo cr ON cr.cliente_id = dc.cliente_id
    WHERE dc.cliente_id IS NOT NULL
      AND dc.cliente_id <> ''
      AND dc.last_seen IS NOT NULL
      AND (NOT p_excluir_sem_cadastro OR (dc.cliente_nome IS NOT NULL AND dc.cliente_nome <> '' AND dc.cliente_nome NOT ILIKE '%sem cadastro%'))
      AND (p_colaborador_id IS NULL OR dc.ultimo_colaborador_id = p_colaborador_id)
      AND CASE
        WHEN p_base_mode = 'JANELA' THEN dc.last_seen >= (v_ref - p_janela_dias)
        WHEN p_base_mode = 'PERIODO_FILTRADO' THEN dc.last_seen BETWEEN v_inicio AND v_fim
        WHEN p_base_mode = 'TOTAL' THEN true
        WHEN p_base_mode = 'TOTAL_COM_CORTE' THEN dc.last_seen >= (v_ref - (p_base_corte_meses * 30))
        ELSE dc.last_seen >= (v_ref - (p_base_corte_meses * 30))
      END
  ),

  classified AS (
    SELECT
      bu.*,
      CASE
        WHEN bu.dias_sem_vir > p_churn_dias_sem_voltar THEN 'PERDIDO'
        WHEN bu.dias_sem_vir >= p_risco_min_dias AND bu.dias_sem_vir <= p_risco_max_dias THEN 'RISCO'
        WHEN bu.dias_sem_vir <= p_janela_dias THEN 'ATIVO'
        ELSE 'INATIVO'
      END AS status_churn,
      (bu.visitas_total >= p_cadencia_min_visitas) AS is_fidelizado,
      (bu.visitas_total = 1) AS is_oneshot
    FROM base_universe bu
  ),

  pre_period AS (
    SELECT v.cliente_id, MAX(v.venda_data_ts::date) AS last_before
    FROM vendas_api_raw v
    WHERE v.venda_data_ts IS NOT NULL
      AND v.venda_data_ts::date < v_inicio
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
    GROUP BY v.cliente_id
  ),

  visits_in_period AS (
    SELECT DISTINCT v.cliente_id
    FROM vendas_api_raw v
    WHERE v.venda_data_ts IS NOT NULL
      AND v.venda_data_ts::date BETWEEN v_inicio AND v_fim
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
  ),

  resgatados AS (
    SELECT c.cliente_id
    FROM classified c
    JOIN visits_in_period vip ON vip.cliente_id = c.cliente_id
    JOIN pre_period pp ON pp.cliente_id = c.cliente_id
    WHERE pp.last_before < (v_inicio - p_churn_dias_sem_voltar)
      AND c.visitas_total > 1
  ),

  filtered AS (
    SELECT
      c.cliente_id,
      c.cliente_nome,
      c.telefone,
      c.ultimo_colaborador_nome AS colaborador_nome,
      c.last_seen::text AS ultima_visita,
      c.dias_sem_vir,
      c.visitas_total,
      c.valor_total
    FROM classified c
    WHERE
      CASE p_tipo
        WHEN 'PERDIDOS' THEN c.status_churn = 'PERDIDO'
        WHEN 'RISCO' THEN c.status_churn = 'RISCO'
        WHEN 'RESGATADOS' THEN EXISTS (SELECT 1 FROM resgatados r WHERE r.cliente_id = c.cliente_id)
        WHEN 'PERDIDOS_FIDELIZADOS' THEN c.status_churn = 'PERDIDO' AND c.is_fidelizado
        WHEN 'PERDIDOS_ONESHOT' THEN c.status_churn = 'PERDIDO' AND c.is_oneshot
        WHEN 'BARBEIRO' THEN EXISTS (
          SELECT 1 FROM vendas_api_raw va2
          WHERE va2.cliente_id = c.cliente_id
            AND va2.colaborador_id = p_valor
            AND va2.venda_data_ts IS NOT NULL
            AND va2.venda_data_ts::date >= (v_ref - (p_atribuicao_janela_meses * 30))
        ) AND c.status_churn IN ('ATIVO','PERDIDO','RISCO')
        ELSE false
      END
  )

  SELECT COUNT(*) INTO v_total FROM filtered;

  WITH
  base_universe AS (
    SELECT
      dc.cliente_id,
      dc.cliente_nome,
      dc.telefone,
      dc.last_seen,
      dc.ultimo_colaborador_id,
      dc.ultimo_colaborador_nome,
      (v_ref - dc.last_seen)::int AS dias_sem_vir,
      COALESCE(cr.atendimentos_total, 0)::int AS visitas_total,
      COALESCE(cr.valor_total, 0)::numeric AS valor_total
    FROM dimensao_clientes dc
    LEFT JOIN vw_clientes_resumo cr ON cr.cliente_id = dc.cliente_id
    WHERE dc.cliente_id IS NOT NULL
      AND dc.cliente_id <> ''
      AND dc.last_seen IS NOT NULL
      AND (NOT p_excluir_sem_cadastro OR (dc.cliente_nome IS NOT NULL AND dc.cliente_nome <> '' AND dc.cliente_nome NOT ILIKE '%sem cadastro%'))
      AND (p_colaborador_id IS NULL OR dc.ultimo_colaborador_id = p_colaborador_id)
      AND CASE
        WHEN p_base_mode = 'JANELA' THEN dc.last_seen >= (v_ref - p_janela_dias)
        WHEN p_base_mode = 'PERIODO_FILTRADO' THEN dc.last_seen BETWEEN v_inicio AND v_fim
        WHEN p_base_mode = 'TOTAL' THEN true
        WHEN p_base_mode = 'TOTAL_COM_CORTE' THEN dc.last_seen >= (v_ref - (p_base_corte_meses * 30))
        ELSE dc.last_seen >= (v_ref - (p_base_corte_meses * 30))
      END
  ),

  classified AS (
    SELECT
      bu.*,
      CASE
        WHEN bu.dias_sem_vir > p_churn_dias_sem_voltar THEN 'PERDIDO'
        WHEN bu.dias_sem_vir >= p_risco_min_dias AND bu.dias_sem_vir <= p_risco_max_dias THEN 'RISCO'
        WHEN bu.dias_sem_vir <= p_janela_dias THEN 'ATIVO'
        ELSE 'INATIVO'
      END AS status_churn,
      (bu.visitas_total >= p_cadencia_min_visitas) AS is_fidelizado,
      (bu.visitas_total = 1) AS is_oneshot
    FROM base_universe bu
  ),

  pre_period AS (
    SELECT v.cliente_id, MAX(v.venda_data_ts::date) AS last_before
    FROM vendas_api_raw v
    WHERE v.venda_data_ts IS NOT NULL
      AND v.venda_data_ts::date < v_inicio
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
    GROUP BY v.cliente_id
  ),

  visits_in_period AS (
    SELECT DISTINCT v.cliente_id
    FROM vendas_api_raw v
    WHERE v.venda_data_ts IS NOT NULL
      AND v.venda_data_ts::date BETWEEN v_inicio AND v_fim
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
  ),

  resgatados AS (
    SELECT c.cliente_id
    FROM classified c
    JOIN visits_in_period vip ON vip.cliente_id = c.cliente_id
    JOIN pre_period pp ON pp.cliente_id = c.cliente_id
    WHERE pp.last_before < (v_inicio - p_churn_dias_sem_voltar)
      AND c.visitas_total > 1
  ),

  filtered AS (
    SELECT
      c.cliente_id,
      c.cliente_nome,
      c.telefone,
      c.ultimo_colaborador_nome AS colaborador_nome,
      c.last_seen::text AS ultima_visita,
      c.dias_sem_vir,
      c.visitas_total,
      c.valor_total
    FROM classified c
    WHERE
      CASE p_tipo
        WHEN 'PERDIDOS' THEN c.status_churn = 'PERDIDO'
        WHEN 'RISCO' THEN c.status_churn = 'RISCO'
        WHEN 'RESGATADOS' THEN EXISTS (SELECT 1 FROM resgatados r WHERE r.cliente_id = c.cliente_id)
        WHEN 'PERDIDOS_FIDELIZADOS' THEN c.status_churn = 'PERDIDO' AND c.is_fidelizado
        WHEN 'PERDIDOS_ONESHOT' THEN c.status_churn = 'PERDIDO' AND c.is_oneshot
        WHEN 'BARBEIRO' THEN EXISTS (
          SELECT 1 FROM vendas_api_raw va2
          WHERE va2.cliente_id = c.cliente_id
            AND va2.colaborador_id = p_valor
            AND va2.venda_data_ts IS NOT NULL
            AND va2.venda_data_ts::date >= (v_ref - (p_atribuicao_janela_meses * 30))
        ) AND c.status_churn IN ('ATIVO','PERDIDO','RISCO')
        ELSE false
      END
    ORDER BY c.dias_sem_vir DESC
    LIMIT p_limit
  )

  SELECT COALESCE(jsonb_agg(row_to_json(f)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM filtered f;

  RETURN jsonb_build_object(
    'total', v_total,
    'tipo', p_tipo,
    'valor', p_valor,
    'rows', v_rows
  );
END;
$$;


-- RPC: Churn evolution per barber (monthly series grouped by colaborador)
-- Uses MULTI attribution: a client can appear under multiple barbers
CREATE OR REPLACE FUNCTION public.rpc_raiox_clientes_churn_evolucao_barbeiro_v1(
  p_inicio text,
  p_fim text,
  p_janela_dias int DEFAULT 60,
  p_colaborador_id text DEFAULT NULL,
  p_excluir_sem_cadastro boolean DEFAULT false,
  p_churn_dias_sem_voltar int DEFAULT 90,
  p_risco_min_dias int DEFAULT 45,
  p_risco_max_dias int DEFAULT 90,
  p_cadencia_min_visitas int DEFAULT 3,
  p_resgate_dias_minimos int DEFAULT 90,
  p_atribuicao_modo text DEFAULT 'MULTI',
  p_atribuicao_janela_meses int DEFAULT 12,
  p_base_mode text DEFAULT 'TOTAL_COM_CORTE',
  p_base_corte_meses int DEFAULT 24,
  p_ref_mode text DEFAULT 'FIM_FILTRO'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio date := p_inicio::date;
  v_fim date := p_fim::date;
  v_result jsonb;
  v_series jsonb := '[]'::jsonb;
  v_mes_cursor date;
  v_ref date;
  v_base_start date;
  v_attr_start date;
BEGIN
  -- Generate monthly series
  v_mes_cursor := date_trunc('month', v_inicio)::date;

  WHILE v_mes_cursor <= v_fim LOOP
    -- Reference date for this month
    v_ref := (date_trunc('month', v_mes_cursor) + interval '1 month' - interval '1 day')::date;
    IF v_ref > v_fim THEN
      v_ref := v_fim;
    END IF;

    -- Base start based on mode
    IF p_base_mode = 'TOTAL_COM_CORTE' THEN
      v_base_start := (v_ref - (p_base_corte_meses || ' months')::interval)::date;
    ELSE
      v_base_start := '2000-01-01'::date;
    END IF;

    -- Attribution window
    v_attr_start := (v_ref - (p_atribuicao_janela_meses || ' months')::interval)::date;

    -- Build per-barber metrics for this month
    WITH
    -- All clients in base
    base_clientes AS (
      SELECT DISTINCT cliente_id, 
             dc.cliente_nome,
             dc.last_seen,
             dc.telefone
      FROM dimensao_clientes dc
      WHERE dc.last_seen >= v_base_start
        AND dc.first_seen <= v_ref
        AND (NOT p_excluir_sem_cadastro OR (dc.telefone IS NOT NULL AND dc.telefone <> ''))
    ),
    -- Count visits per client
    client_visits AS (
      SELECT v.cliente_id, COUNT(DISTINCT v.venda_id) AS visitas
      FROM vendas_api_raw v
      WHERE v.venda_data_ts >= v_base_start
        AND v.venda_data_ts <= (v_ref + interval '1 day')
        AND v.cliente_id IS NOT NULL
      GROUP BY v.cliente_id
    ),
    -- Attribution: assign clients to barbers (MULTI = all barbers who served them)
    client_barber AS (
      SELECT DISTINCT v.cliente_id, v.colaborador_id, v.colaborador_nome
      FROM vendas_api_raw v
      WHERE v.venda_data_ts >= v_attr_start
        AND v.venda_data_ts <= (v_ref + interval '1 day')
        AND v.cliente_id IS NOT NULL
        AND v.colaborador_id IS NOT NULL
        AND v.colaborador_id <> ''
    ),
    -- Classify each client
    client_status AS (
      SELECT
        bc.cliente_id,
        bc.last_seen,
        COALESCE(cv.visitas, 0) AS visitas,
        CASE
          WHEN (v_ref - bc.last_seen) <= p_janela_dias THEN 'ATIVO'
          WHEN (v_ref - bc.last_seen) > p_churn_dias_sem_voltar THEN 'PERDIDO'
          WHEN (v_ref - bc.last_seen) BETWEEN p_risco_min_dias AND p_risco_max_dias THEN 'RISCO'
          ELSE 'INATIVO'
        END AS status,
        CASE
          WHEN COALESCE(cv.visitas, 0) >= p_cadencia_min_visitas THEN 'FIDELIZADO'
          ELSE 'ONESHOT'
        END AS tipo_cliente
      FROM base_clientes bc
      LEFT JOIN client_visits cv ON cv.cliente_id = bc.cliente_id
    ),
    -- Check resgatados: clients who were away >= resgate_dias but came back this month
    resgatados AS (
      SELECT DISTINCT v.cliente_id
      FROM vendas_api_raw v
      JOIN base_clientes bc ON bc.cliente_id = v.cliente_id
      WHERE v.venda_data_ts >= date_trunc('month', v_mes_cursor)
        AND v.venda_data_ts <= (v_ref + interval '1 day')
        AND v.cliente_id IS NOT NULL
        AND EXISTS (
          -- Had a gap >= resgate_dias before this month
          SELECT 1 FROM vendas_api_raw v2
          WHERE v2.cliente_id = v.cliente_id
            AND v2.venda_data_ts < date_trunc('month', v_mes_cursor)
            AND v2.venda_data_ts >= v_base_start
          HAVING (date_trunc('month', v_mes_cursor)::date - MAX(v2.venda_data_ts::date)) >= p_resgate_dias_minimos
        )
    ),
    -- Atendidos no mês (per barber)
    atendidos_mes_barber AS (
      SELECT v.colaborador_id, COUNT(DISTINCT v.cliente_id) AS atendidos_mes
      FROM vendas_api_raw v
      WHERE v.venda_data_ts >= date_trunc('month', v_mes_cursor)
        AND v.venda_data_ts <= (v_ref + interval '1 day')
        AND v.cliente_id IS NOT NULL
        AND v.colaborador_id IS NOT NULL
        AND v.colaborador_id <> ''
      GROUP BY v.colaborador_id
    ),
    -- Aggregate per barber
    barber_metrics AS (
      SELECT
        cb.colaborador_id,
        cb.colaborador_nome,
        COUNT(*) FILTER (WHERE cs.status IN ('ATIVO', 'RISCO')) AS base_ativa,
        COUNT(*) FILTER (WHERE cs.status = 'PERDIDO') AS perdidos,
        COUNT(*) FILTER (WHERE cs.status = 'PERDIDO' AND cs.tipo_cliente = 'FIDELIZADO') AS perdidos_fidelizados,
        COUNT(*) FILTER (WHERE cs.status = 'PERDIDO' AND cs.tipo_cliente = 'ONESHOT') AS perdidos_oneshot,
        COUNT(*) FILTER (WHERE cs.status = 'RISCO') AS em_risco,
        COUNT(*) FILTER (WHERE cs.cliente_id IN (SELECT cliente_id FROM resgatados)) AS resgatados
      FROM client_barber cb
      JOIN client_status cs ON cs.cliente_id = cb.cliente_id
      WHERE (p_colaborador_id IS NULL OR cb.colaborador_id = p_colaborador_id)
      GROUP BY cb.colaborador_id, cb.colaborador_nome
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'ano_mes', to_char(v_mes_cursor, 'YYYY-MM'),
        'ano_mes_label', to_char(v_mes_cursor, 'Mon/YY'),
        'colaborador_id', bm.colaborador_id,
        'colaborador_nome', bm.colaborador_nome,
        'base_ativa', bm.base_ativa,
        'perdidos', bm.perdidos,
        'churn_pct', CASE WHEN (bm.base_ativa + bm.perdidos) > 0
          THEN ROUND(bm.perdidos * 100.0 / (bm.base_ativa + bm.perdidos), 1)
          ELSE 0 END,
        'perdidos_fidelizados', bm.perdidos_fidelizados,
        'churn_fidelizados_pct', CASE WHEN (bm.base_ativa + bm.perdidos_fidelizados) > 0
          THEN ROUND(bm.perdidos_fidelizados * 100.0 / (bm.base_ativa + bm.perdidos_fidelizados), 1)
          ELSE 0 END,
        'perdidos_oneshot', bm.perdidos_oneshot,
        'churn_oneshot_pct', CASE WHEN (bm.base_ativa + bm.perdidos_oneshot) > 0
          THEN ROUND(bm.perdidos_oneshot * 100.0 / (bm.base_ativa + bm.perdidos_oneshot), 1)
          ELSE 0 END,
        'resgatados', bm.resgatados,
        'em_risco', bm.em_risco,
        'atendidos_mes', COALESCE(amb.atendidos_mes, 0)
      )
    )
    INTO v_series
    FROM barber_metrics bm
    LEFT JOIN atendidos_mes_barber amb ON amb.colaborador_id = bm.colaborador_id;

    -- Append to result series
    IF v_series IS NOT NULL THEN
      v_result := COALESCE(v_result, '[]'::jsonb) || v_series;
    END IF;
    v_series := '[]'::jsonb;

    v_mes_cursor := (v_mes_cursor + interval '1 month')::date;
  END LOOP;

  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'inicio', v_inicio,
      'fim', v_fim,
      'base_mode', p_base_mode,
      'base_corte_meses', p_base_corte_meses,
      'atribuicao_modo', p_atribuicao_modo
    ),
    'series', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

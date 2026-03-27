
-- ============================================================
-- rpc_raiox_clientes_churn_evolucao_v1
-- Calculates churn metrics per month across the date range
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_raiox_clientes_churn_evolucao_v1(
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
  v_inicio date;
  v_fim date;
  v_month_start date;
  v_month_end date;
  v_ref date;
  v_row jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_base_ativa bigint;
  v_perdidos bigint;
  v_em_risco bigint;
  v_base_fidelizados bigint;
  v_perdidos_fidelizados bigint;
  v_base_oneshot bigint;
  v_perdidos_oneshot bigint;
  v_total_universo bigint;
  v_resgatados bigint;
BEGIN
  v_inicio := COALESCE(p_inicio::date, (date_trunc('year', now()))::date);
  v_fim := COALESCE(p_fim::date, now()::date);

  -- Iterate month-by-month
  v_month_start := date_trunc('month', v_inicio)::date;

  WHILE v_month_start <= v_fim LOOP
    v_month_end := (date_trunc('month', v_month_start) + interval '1 month' - interval '1 day')::date;
    IF v_month_end > v_fim THEN
      v_month_end := v_fim;
    END IF;

    -- ref = end of month (or v_fim if partial)
    v_ref := v_month_end;

    -- Count KPIs for this month snapshot
    SELECT
      COUNT(*) FILTER (WHERE (v_ref - dc.last_seen)::int <= p_churn_dias_sem_voltar AND NOT ((v_ref - dc.last_seen)::int >= p_risco_min_dias AND (v_ref - dc.last_seen)::int <= p_risco_max_dias)),
      COUNT(*) FILTER (WHERE (v_ref - dc.last_seen)::int > p_churn_dias_sem_voltar),
      COUNT(*) FILTER (WHERE (v_ref - dc.last_seen)::int >= p_risco_min_dias AND (v_ref - dc.last_seen)::int <= p_risco_max_dias),
      COUNT(*) FILTER (WHERE (v_ref - dc.last_seen)::int <= p_churn_dias_sem_voltar AND COALESCE(cr.atendimentos_total, 0) >= p_cadencia_min_visitas),
      COUNT(*) FILTER (WHERE (v_ref - dc.last_seen)::int > p_churn_dias_sem_voltar AND COALESCE(cr.atendimentos_total, 0) >= p_cadencia_min_visitas),
      COUNT(*) FILTER (WHERE (v_ref - dc.last_seen)::int <= p_churn_dias_sem_voltar AND COALESCE(cr.atendimentos_total, 0) = 1),
      COUNT(*) FILTER (WHERE (v_ref - dc.last_seen)::int > p_churn_dias_sem_voltar AND COALESCE(cr.atendimentos_total, 0) = 1),
      COUNT(*)
    INTO v_base_ativa, v_perdidos, v_em_risco,
         v_base_fidelizados, v_perdidos_fidelizados,
         v_base_oneshot, v_perdidos_oneshot,
         v_total_universo
    FROM dimensao_clientes dc
    LEFT JOIN vw_clientes_resumo cr ON cr.cliente_id = dc.cliente_id
    WHERE dc.cliente_id IS NOT NULL
      AND dc.cliente_id <> ''
      AND dc.last_seen IS NOT NULL
      AND dc.last_seen <= v_ref
      AND (NOT p_excluir_sem_cadastro OR (dc.cliente_nome IS NOT NULL AND dc.cliente_nome <> '' AND dc.cliente_nome NOT ILIKE '%sem cadastro%'))
      AND (p_colaborador_id IS NULL OR dc.ultimo_colaborador_id = p_colaborador_id)
      AND CASE
        WHEN p_base_mode = 'JANELA' THEN dc.last_seen >= (v_ref - p_janela_dias)
        WHEN p_base_mode = 'PERIODO_FILTRADO' THEN dc.last_seen BETWEEN v_inicio AND v_ref
        WHEN p_base_mode = 'TOTAL' THEN true
        WHEN p_base_mode = 'TOTAL_COM_CORTE' THEN dc.last_seen >= (v_ref - (p_base_corte_meses * 30))
        ELSE dc.last_seen >= (v_ref - (p_base_corte_meses * 30))
      END;

    -- Resgatados: clients that had last visit before month start minus resgate_dias,
    -- but visited during this month
    SELECT COUNT(DISTINCT v.cliente_id)
    INTO v_resgatados
    FROM vendas_api_raw v
    JOIN dimensao_clientes dc ON dc.cliente_id = v.cliente_id
    LEFT JOIN (
      SELECT va.cliente_id, MAX(va.venda_data_ts::date) AS last_before
      FROM vendas_api_raw va
      WHERE va.venda_data_ts IS NOT NULL
        AND va.venda_data_ts::date < v_month_start
        AND va.cliente_id IS NOT NULL AND va.cliente_id <> ''
      GROUP BY va.cliente_id
    ) pre ON pre.cliente_id = v.cliente_id
    WHERE v.venda_data_ts IS NOT NULL
      AND v.venda_data_ts::date BETWEEN v_month_start AND v_month_end
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND pre.last_before IS NOT NULL
      AND pre.last_before < (v_month_start - p_resgate_dias_minimos)
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id);

    v_row := jsonb_build_object(
      'ano_mes', to_char(v_month_start, 'YYYY-MM'),
      'ano_mes_label', to_char(v_month_start, 'Mon/YY'),
      'ref', v_ref::text,
      'base_ativa', v_base_ativa,
      'perdidos', v_perdidos,
      'churn_pct', CASE WHEN v_base_ativa + v_perdidos > 0 THEN ROUND(v_perdidos * 100.0 / (v_base_ativa + v_perdidos), 1) ELSE 0 END,
      'perdidos_fidelizados', v_perdidos_fidelizados,
      'churn_fidelizados_pct', CASE WHEN v_base_fidelizados + v_perdidos_fidelizados > 0 THEN ROUND(v_perdidos_fidelizados * 100.0 / (v_base_fidelizados + v_perdidos_fidelizados), 1) ELSE 0 END,
      'perdidos_oneshot', v_perdidos_oneshot,
      'churn_oneshot_pct', CASE WHEN v_base_oneshot + v_perdidos_oneshot > 0 THEN ROUND(v_perdidos_oneshot * 100.0 / (v_base_oneshot + v_perdidos_oneshot), 1) ELSE 0 END,
      'resgatados', v_resgatados,
      'em_risco', v_em_risco,
      'total_universo', v_total_universo
    );

    v_rows := v_rows || v_row;

    v_month_start := (v_month_start + interval '1 month')::date;
  END LOOP;

  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'inicio', v_inicio::text,
      'fim', v_fim::text,
      'base_mode', p_base_mode,
      'base_corte_meses', p_base_corte_meses,
      'meses', jsonb_array_length(v_rows)
    ),
    'series', v_rows
  );
END;
$$;

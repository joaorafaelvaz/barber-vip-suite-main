
-- ============================================================
-- 1) Rewrite barbeiro RPC using dimensao_clientes (fix timeout)
-- ============================================================
DROP FUNCTION IF EXISTS rpc_raiox_clientes_churn_evolucao_barbeiro_v1(text,text,int,text,boolean,int,int,int,int,int,text,int,text,int,text);

CREATE OR REPLACE FUNCTION rpc_raiox_clientes_churn_evolucao_barbeiro_v1(
  p_inicio text,
  p_fim text,
  p_janela_dias int DEFAULT 60,
  p_colaborador_id text DEFAULT NULL,
  p_excluir_sem_cadastro boolean DEFAULT true,
  p_churn_dias_sem_voltar int DEFAULT 90,
  p_risco_min_dias int DEFAULT 45,
  p_risco_max_dias int DEFAULT 90,
  p_cadencia_min_visitas int DEFAULT 3,
  p_resgate_dias_minimos int DEFAULT 90,
  p_atribuicao_modo text DEFAULT 'ULTIMO',
  p_atribuicao_janela_meses int DEFAULT 12,
  p_base_mode text DEFAULT 'TOTAL_COM_CORTE',
  p_base_corte_meses int DEFAULT 24,
  p_ref_mode text DEFAULT 'FIM_FILTRO'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
DECLARE
  v_inicio date := p_inicio::date;
  v_fim date := p_fim::date;
  v_result jsonb;
  v_series jsonb := '[]'::jsonb;
  v_mes_cursor date;
  v_ref date;
  v_base_start date;
BEGIN
  v_mes_cursor := date_trunc('month', v_inicio)::date;

  WHILE v_mes_cursor <= v_fim LOOP
    v_ref := (date_trunc('month', v_mes_cursor) + interval '1 month' - interval '1 day')::date;
    IF v_ref > v_fim THEN v_ref := v_fim; END IF;

    IF p_base_mode = 'TOTAL_COM_CORTE' THEN
      v_base_start := (v_ref - (p_base_corte_meses || ' months')::interval)::date;
    ELSE
      v_base_start := '2000-01-01'::date;
    END IF;

    WITH
    base_clientes AS (
      SELECT dc.cliente_id, dc.last_seen, dc.ultimo_colaborador_id, dc.ultimo_colaborador_nome
      FROM dimensao_clientes dc
      WHERE dc.last_seen >= v_base_start
        AND dc.first_seen <= v_ref
        AND dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''
        AND dc.last_seen IS NOT NULL
        AND (NOT p_excluir_sem_cadastro OR (dc.cliente_nome IS NOT NULL AND dc.cliente_nome <> '' AND dc.cliente_nome NOT ILIKE '%sem cadastro%'))
    ),
    client_visits AS (
      SELECT cr.cliente_id, COALESCE(cr.atendimentos_total, 0) AS visitas
      FROM vw_clientes_resumo cr
    ),
    client_status AS (
      SELECT
        bc.cliente_id,
        bc.ultimo_colaborador_id AS colaborador_id,
        bc.ultimo_colaborador_nome AS colaborador_nome,
        CASE WHEN (v_ref - bc.last_seen) > p_churn_dias_sem_voltar THEN 'PERDIDO'
             WHEN (v_ref - bc.last_seen) BETWEEN p_risco_min_dias AND p_risco_max_dias THEN 'RISCO'
             ELSE 'ATIVO' END AS status,
        CASE WHEN COALESCE(cv.visitas, 0) >= p_cadencia_min_visitas THEN 'FIDELIZADO' ELSE 'ONESHOT' END AS tipo_cliente
      FROM base_clientes bc
      LEFT JOIN client_visits cv ON cv.cliente_id = bc.cliente_id
      WHERE bc.ultimo_colaborador_id IS NOT NULL AND bc.ultimo_colaborador_id <> ''
        AND (p_colaborador_id IS NULL OR bc.ultimo_colaborador_id = p_colaborador_id)
    ),
    -- Resgatados: clients who came back this month after being away >= resgate_dias
    resgatados_mes AS (
      SELECT DISTINCT v.cliente_id, v.colaborador_id
      FROM vendas_api_raw v
      WHERE v.venda_data_ts IS NOT NULL
        AND v.venda_data_ts::date BETWEEN v_mes_cursor AND v_ref
        AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
        AND v.colaborador_id IS NOT NULL AND v.colaborador_id <> ''
        AND EXISTS (
          SELECT 1 FROM dimensao_clientes dc2
          WHERE dc2.cliente_id = v.cliente_id
            AND dc2.last_seen < v_mes_cursor
            AND (v_mes_cursor - dc2.last_seen) >= p_resgate_dias_minimos
        )
    ),
    -- Atendidos no mês per barber
    atendidos_barber AS (
      SELECT v.colaborador_id, COUNT(DISTINCT v.cliente_id) AS atendidos_mes
      FROM vendas_api_raw v
      WHERE v.venda_data_ts IS NOT NULL
        AND v.venda_data_ts::date BETWEEN v_mes_cursor AND v_ref
        AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
        AND v.colaborador_id IS NOT NULL AND v.colaborador_id <> ''
      GROUP BY v.colaborador_id
    ),
    barber_metrics AS (
      SELECT
        cs.colaborador_id,
        cs.colaborador_nome,
        COUNT(*) FILTER (WHERE cs.status IN ('ATIVO', 'RISCO')) AS base_ativa,
        COUNT(*) FILTER (WHERE cs.status = 'PERDIDO') AS perdidos,
        COUNT(*) FILTER (WHERE cs.status = 'PERDIDO' AND cs.tipo_cliente = 'FIDELIZADO') AS perdidos_fidelizados,
        COUNT(*) FILTER (WHERE cs.status = 'PERDIDO' AND cs.tipo_cliente = 'ONESHOT') AS perdidos_oneshot,
        COUNT(*) FILTER (WHERE cs.status = 'RISCO') AS em_risco
      FROM client_status cs
      GROUP BY cs.colaborador_id, cs.colaborador_nome
    )
    SELECT v_series || jsonb_agg(
      jsonb_build_object(
        'ano_mes', to_char(v_mes_cursor, 'YYYY-MM'),
        'ano_mes_label', to_char(v_mes_cursor, 'Mon/YY'),
        'colaborador_id', bm.colaborador_id,
        'colaborador_nome', bm.colaborador_nome,
        'base_ativa', bm.base_ativa,
        'perdidos', bm.perdidos,
        'churn_pct', CASE WHEN (bm.base_ativa + bm.perdidos) > 0 THEN ROUND(bm.perdidos * 100.0 / (bm.base_ativa + bm.perdidos), 1) ELSE 0 END,
        'perdidos_fidelizados', bm.perdidos_fidelizados,
        'churn_fidelizados_pct', CASE WHEN (bm.base_ativa + bm.perdidos) > 0 THEN ROUND(bm.perdidos_fidelizados * 100.0 / GREATEST(bm.base_ativa + bm.perdidos - bm.perdidos_oneshot, 1), 1) ELSE 0 END,
        'perdidos_oneshot', bm.perdidos_oneshot,
        'churn_oneshot_pct', CASE WHEN bm.perdidos_oneshot + (bm.base_ativa - bm.em_risco) > 0 THEN ROUND(bm.perdidos_oneshot * 100.0 / GREATEST(bm.perdidos_oneshot + bm.base_ativa, 1), 1) ELSE 0 END,
        'resgatados', COALESCE((SELECT COUNT(*) FROM resgatados_mes r WHERE r.colaborador_id = bm.colaborador_id), 0),
        'em_risco', bm.em_risco,
        'atendidos_mes', COALESCE((SELECT ab.atendidos_mes FROM atendidos_barber ab WHERE ab.colaborador_id = bm.colaborador_id), 0)
      )
    )
    INTO v_series
    FROM barber_metrics bm
    WHERE (bm.base_ativa + bm.perdidos) > 0;

    v_mes_cursor := (v_mes_cursor + interval '1 month')::date;
  END LOOP;

  v_result := jsonb_build_object(
    'meta', jsonb_build_object(
      'inicio', v_inicio,
      'fim', v_fim,
      'base_mode', p_base_mode,
      'base_corte_meses', p_base_corte_meses,
      'atribuicao_modo', p_atribuicao_modo
    ),
    'series', COALESCE(v_series, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;


-- ============================================================
-- 2) Create evolucao_v2 with resgatados breakdowns + atendidos breakdowns
-- ============================================================
DROP FUNCTION IF EXISTS rpc_raiox_clientes_churn_evolucao_v2(text,text,int,text,boolean,int,int,int,int,int,text,int,text,int,text);

CREATE OR REPLACE FUNCTION rpc_raiox_clientes_churn_evolucao_v2(
  p_inicio text,
  p_fim text,
  p_janela_dias int DEFAULT 60,
  p_colaborador_id text DEFAULT NULL,
  p_excluir_sem_cadastro boolean DEFAULT true,
  p_churn_dias_sem_voltar int DEFAULT 90,
  p_risco_min_dias int DEFAULT 45,
  p_risco_max_dias int DEFAULT 90,
  p_cadencia_min_visitas int DEFAULT 3,
  p_resgate_dias_minimos int DEFAULT 90,
  p_atribuicao_modo text DEFAULT 'ULTIMO',
  p_atribuicao_janela_meses int DEFAULT 12,
  p_base_mode text DEFAULT 'TOTAL_COM_CORTE',
  p_base_corte_meses int DEFAULT 24,
  p_ref_mode text DEFAULT 'FIM_FILTRO'
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
  v_atendidos_mes bigint;
  -- New breakdowns
  v_resg_91_120 bigint;
  v_resg_121_150 bigint;
  v_resg_151_180 bigint;
  v_resg_180_plus bigint;
  v_atend_recorrentes bigint;
  v_atend_primeira_vez bigint;
  v_atend_cad_30 bigint;
  v_atend_cad_45 bigint;
  v_atend_cad_60 bigint;
  v_atend_cad_90 bigint;
  v_atend_cad_90_plus bigint;
BEGIN
  v_inicio := COALESCE(p_inicio::date, (date_trunc('year', now()))::date);
  v_fim := COALESCE(p_fim::date, now()::date);

  v_month_start := date_trunc('month', v_inicio)::date;

  WHILE v_month_start <= v_fim LOOP
    v_month_end := (date_trunc('month', v_month_start) + interval '1 month' - interval '1 day')::date;
    IF v_month_end > v_fim THEN v_month_end := v_fim; END IF;
    v_ref := v_month_end;

    -- Atendidos no mês
    SELECT COUNT(DISTINCT v.cliente_id)
    INTO v_atendidos_mes
    FROM vendas_api_raw v
    WHERE v.venda_data_ts IS NOT NULL
      AND v.venda_data_ts::date BETWEEN v_month_start AND v_month_end
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND (NOT p_excluir_sem_cadastro OR (v.cliente_nome IS NOT NULL AND v.cliente_nome <> '' AND v.cliente_nome NOT ILIKE '%sem cadastro%'))
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id);

    IF v_atendidos_mes = 0 THEN
      v_month_start := (v_month_start + interval '1 month')::date;
      CONTINUE;
    END IF;

    -- Base ativa / perdidos / etc (same as v1)
    SELECT
      COUNT(*) FILTER (WHERE (v_ref - dc.last_seen)::int <= p_churn_dias_sem_voltar),
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
    WHERE dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''
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

    -- Resgatados with faixa breakdown
    SELECT
      COUNT(*) FILTER (WHERE true),
      COUNT(*) FILTER (WHERE dias_fora BETWEEN 91 AND 120),
      COUNT(*) FILTER (WHERE dias_fora BETWEEN 121 AND 150),
      COUNT(*) FILTER (WHERE dias_fora BETWEEN 151 AND 180),
      COUNT(*) FILTER (WHERE dias_fora > 180)
    INTO v_resgatados, v_resg_91_120, v_resg_121_150, v_resg_151_180, v_resg_180_plus
    FROM (
      SELECT DISTINCT ON (v.cliente_id)
        v.cliente_id,
        (v_month_start - pre.last_before)::int AS dias_fora
      FROM vendas_api_raw v
      JOIN dimensao_clientes dc ON dc.cliente_id = v.cliente_id
      JOIN LATERAL (
        SELECT MAX(va.venda_data_ts::date) AS last_before
        FROM vendas_api_raw va
        WHERE va.cliente_id = v.cliente_id
          AND va.venda_data_ts IS NOT NULL
          AND va.venda_data_ts::date < v_month_start
      ) pre ON pre.last_before IS NOT NULL
      WHERE v.venda_data_ts IS NOT NULL
        AND v.venda_data_ts::date BETWEEN v_month_start AND v_month_end
        AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
        AND (v_month_start - pre.last_before)::int >= p_resgate_dias_minimos
        AND (NOT p_excluir_sem_cadastro OR (dc.cliente_nome IS NOT NULL AND dc.cliente_nome <> '' AND dc.cliente_nome NOT ILIKE '%sem cadastro%'))
        AND (p_colaborador_id IS NULL OR dc.ultimo_colaborador_id = p_colaborador_id)
    ) resgatados_detail;

    -- Atendidos breakdown: by cadência
    SELECT
      COUNT(*) FILTER (WHERE visitas_total >= 2),
      COUNT(*) FILTER (WHERE visitas_total = 1),
      COUNT(*) FILTER (WHERE cadencia_dias IS NOT NULL AND cadencia_dias <= 30),
      COUNT(*) FILTER (WHERE cadencia_dias IS NOT NULL AND cadencia_dias BETWEEN 31 AND 45),
      COUNT(*) FILTER (WHERE cadencia_dias IS NOT NULL AND cadencia_dias BETWEEN 46 AND 60),
      COUNT(*) FILTER (WHERE cadencia_dias IS NOT NULL AND cadencia_dias BETWEEN 61 AND 90),
      COUNT(*) FILTER (WHERE cadencia_dias IS NOT NULL AND cadencia_dias > 90)
    INTO v_atend_recorrentes, v_atend_primeira_vez,
         v_atend_cad_30, v_atend_cad_45, v_atend_cad_60, v_atend_cad_90, v_atend_cad_90_plus
    FROM (
      SELECT DISTINCT v.cliente_id,
             COALESCE(cr.atendimentos_total, 0) AS visitas_total,
             CASE WHEN COALESCE(cr.atendimentos_total, 0) >= 2
                  THEN ROUND(
                    GREATEST((cr.ultima_visita - cr.primeira_visita)::numeric, 1) / GREATEST(cr.atendimentos_total - 1, 1)
                  , 0)
                  ELSE NULL END AS cadencia_dias
      FROM vendas_api_raw v
      LEFT JOIN vw_clientes_resumo cr ON cr.cliente_id = v.cliente_id
      WHERE v.venda_data_ts IS NOT NULL
        AND v.venda_data_ts::date BETWEEN v_month_start AND v_month_end
        AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
        AND v.produto IS NOT NULL AND v.produto <> ''
        AND (NOT p_excluir_sem_cadastro OR (v.cliente_nome IS NOT NULL AND v.cliente_nome <> '' AND v.cliente_nome NOT ILIKE '%sem cadastro%'))
        AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
    ) atend_detail;

    v_row := jsonb_build_object(
      'ano_mes', to_char(v_month_start, 'YYYY-MM'),
      'ano_mes_label', to_char(v_month_start, 'Mon/YY'),
      'ref', v_ref,
      'base_ativa', v_base_ativa,
      'perdidos', v_perdidos,
      'churn_pct', CASE WHEN (v_base_ativa + v_perdidos) > 0 THEN ROUND(v_perdidos * 100.0 / (v_base_ativa + v_perdidos), 1) ELSE 0 END,
      'perdidos_fidelizados', v_perdidos_fidelizados,
      'churn_fidelizados_pct', CASE WHEN (v_base_fidelizados + v_perdidos_fidelizados) > 0 THEN ROUND(v_perdidos_fidelizados * 100.0 / (v_base_fidelizados + v_perdidos_fidelizados), 1) ELSE 0 END,
      'perdidos_oneshot', v_perdidos_oneshot,
      'churn_oneshot_pct', CASE WHEN (v_base_oneshot + v_perdidos_oneshot) > 0 THEN ROUND(v_perdidos_oneshot * 100.0 / (v_base_oneshot + v_perdidos_oneshot), 1) ELSE 0 END,
      'resgatados', v_resgatados,
      'resgatados_91_120', v_resg_91_120,
      'resgatados_121_150', v_resg_121_150,
      'resgatados_151_180', v_resg_151_180,
      'resgatados_180_plus', v_resg_180_plus,
      'em_risco', v_em_risco,
      'total_universo', v_total_universo,
      'atendidos_mes', v_atendidos_mes,
      'atendidos_recorrentes', v_atend_recorrentes,
      'atendidos_primeira_vez', v_atend_primeira_vez,
      'atendidos_cadencia_30', v_atend_cad_30,
      'atendidos_cadencia_45', v_atend_cad_45,
      'atendidos_cadencia_60', v_atend_cad_60,
      'atendidos_cadencia_90', v_atend_cad_90,
      'atendidos_cadencia_90_plus', v_atend_cad_90_plus
    );

    v_rows := v_rows || v_row;
    v_month_start := (v_month_start + interval '1 month')::date;
  END LOOP;

  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'inicio', v_inicio,
      'fim', v_fim,
      'base_mode', p_base_mode,
      'base_corte_meses', p_base_corte_meses,
      'meses', jsonb_array_length(v_rows)
    ),
    'series', v_rows
  );
END;
$$;


-- ============================================================
-- 1) Fix cadência RPC: pre-compute cadência once, re-classify 12x
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_raiox_clientes_cadencia_v2(
  p_inicio text,
  p_fim text,
  p_janela_dias int DEFAULT 60,
  p_colaborador_id text DEFAULT NULL,
  p_excluir_sem_cadastro boolean DEFAULT true,
  p_base_mode text DEFAULT 'TOTAL_COM_CORTE',
  p_base_corte_meses int DEFAULT 24,
  p_ref_mode text DEFAULT 'FIM_FILTRO',
  p_cadencia_meses_analise int DEFAULT 12,
  p_cadencia_min_visitas int DEFAULT 3,
  p_ratio_muito_frequente_max numeric DEFAULT 0.8,
  p_ratio_regular_max numeric DEFAULT 1.2,
  p_ratio_espacando_max numeric DEFAULT 1.8,
  p_ratio_risco_max numeric DEFAULT 2.5,
  p_one_shot_aguardando_max_dias int DEFAULT 45,
  p_one_shot_risco_max_dias int DEFAULT 90,
  p_atribuicao_modo text DEFAULT 'ULTIMO',
  p_atribuicao_janela_meses int DEFAULT 12,
  p_grain text DEFAULT 'MENSAL',
  p_range_months int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
  v_ref date;
  v_inicio date := p_inicio::date;
  v_fim date := p_fim::date;
  v_cadencia_desde date;
  v_result jsonb;
  v_kpis jsonb;
  v_por_barbeiro jsonb;
  v_series jsonb := '[]'::jsonb;
  v_loop_ref date;
  v_loop_label text;
  v_loop_key text;
  v_month_data jsonb;
  v_prev_risco numeric := NULL;
  v_prev_perdido numeric := NULL;
  i int;
  v_meses_labels text[] := ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
BEGIN
  -- REF
  IF p_ref_mode = 'HOJE' THEN v_ref := CURRENT_DATE;
  ELSE v_ref := v_fim;
  END IF;

  v_cadencia_desde := v_ref - (p_cadencia_meses_analise || ' months')::interval;

  -- ============ SNAPSHOT (current period) ============
  WITH
  base_clientes AS (
    SELECT dc.cliente_id, dc.cliente_nome, dc.telefone
    FROM dimensao_clientes dc
    WHERE dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''
      AND (NOT p_excluir_sem_cadastro OR (dc.cliente_nome IS NOT NULL AND dc.cliente_nome <> ''))
      AND (
        CASE p_base_mode
          WHEN 'JANELA' THEN (dc.last_seen >= v_ref - p_janela_dias AND dc.last_seen <= v_ref)
          WHEN 'PERIODO_FILTRADO' THEN (dc.last_seen >= v_inicio AND dc.first_seen <= v_fim)
          WHEN 'TOTAL' THEN true
          WHEN 'TOTAL_COM_CORTE' THEN (dc.last_seen >= v_ref - (p_base_corte_meses || ' months')::interval)
          ELSE true
        END
      )
  ),
  atribuicao AS (
    SELECT dc.cliente_id,
           dc.ultimo_colaborador_nome AS colaborador_nome,
           dc.ultimo_colaborador_id AS colaborador_id
    FROM dimensao_clientes dc
    JOIN base_clientes bc ON bc.cliente_id = dc.cliente_id
  ),
  visitas AS (
    SELECT v.cliente_id, v.venda_data_ts::date AS dia
    FROM vendas_api_raw v
    JOIN base_clientes bc ON bc.cliente_id = v.cliente_id
    WHERE v.venda_data_ts IS NOT NULL
      AND v.venda_data_ts::date >= v_cadencia_desde
      AND v.venda_data_ts::date <= v_ref
    GROUP BY v.cliente_id, v.venda_data_ts::date
  ),
  intervalos AS (
    SELECT cliente_id, dia,
           dia - LAG(dia) OVER (PARTITION BY cliente_id ORDER BY dia) AS intervalo
    FROM visitas
  ),
  cadencia_calc AS (
    SELECT cliente_id,
           COUNT(*) FILTER (WHERE intervalo IS NOT NULL) AS num_intervalos,
           CASE
             WHEN COUNT(*) FILTER (WHERE intervalo IS NOT NULL) >= p_cadencia_min_visitas
               THEN PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY intervalo) FILTER (WHERE intervalo IS NOT NULL)
             WHEN COUNT(*) FILTER (WHERE intervalo IS NOT NULL) >= 1
               THEN AVG(intervalo) FILTER (WHERE intervalo IS NOT NULL)
             ELSE NULL
           END AS cadencia_dias,
           CASE
             WHEN COUNT(*) FILTER (WHERE intervalo IS NOT NULL) >= p_cadencia_min_visitas THEN 'mediana'
             WHEN COUNT(*) FILTER (WHERE intervalo IS NOT NULL) >= 1 THEN 'media'
             ELSE 'sem_dados'
           END AS cadencia_metodo
    FROM intervalos GROUP BY cliente_id
  ),
  cliente_resumo AS (
    SELECT bc.cliente_id, bc.cliente_nome, bc.telefone,
           a.colaborador_nome, a.colaborador_id,
           (SELECT MAX(vv.dia) FROM visitas vv WHERE vv.cliente_id = bc.cliente_id) AS ultima_visita,
           (SELECT COUNT(DISTINCT vv.dia) FROM visitas vv WHERE vv.cliente_id = bc.cliente_id) AS total_visitas,
           cc.cadencia_dias, cc.cadencia_metodo
    FROM base_clientes bc
    LEFT JOIN atribuicao a ON a.cliente_id = bc.cliente_id
    LEFT JOIN cadencia_calc cc ON cc.cliente_id = bc.cliente_id
  ),
  classificado AS (
    SELECT cr.*,
           v_ref - cr.ultima_visita AS dias_sem_vir,
           CASE
             WHEN cr.ultima_visita IS NULL THEN 'PERDIDO'
             WHEN cr.total_visitas = 1 THEN
               CASE WHEN (v_ref - cr.ultima_visita) <= p_one_shot_aguardando_max_dias THEN 'PRIMEIRA_VEZ'
                    WHEN (v_ref - cr.ultima_visita) <= p_one_shot_risco_max_dias THEN 'EM_RISCO'
                    ELSE 'PERDIDO' END
             WHEN cr.cadencia_dias IS NULL OR cr.cadencia_dias <= 0 THEN
               CASE WHEN (v_ref - cr.ultima_visita) <= p_one_shot_aguardando_max_dias THEN 'REGULAR'
                    WHEN (v_ref - cr.ultima_visita) <= p_one_shot_risco_max_dias THEN 'EM_RISCO'
                    ELSE 'PERDIDO' END
             WHEN ((v_ref - cr.ultima_visita)::numeric / cr.cadencia_dias) <= p_ratio_muito_frequente_max THEN 'ASSIDUO'
             WHEN ((v_ref - cr.ultima_visita)::numeric / cr.cadencia_dias) <= p_ratio_regular_max THEN 'REGULAR'
             WHEN ((v_ref - cr.ultima_visita)::numeric / cr.cadencia_dias) <= p_ratio_espacando_max THEN 'ESPACANDO'
             WHEN ((v_ref - cr.ultima_visita)::numeric / cr.cadencia_dias) <= p_ratio_risco_max THEN 'EM_RISCO'
             ELSE 'PERDIDO'
           END AS status_cadencia
    FROM cliente_resumo cr
  ),
  filtrado AS (
    SELECT c.* FROM classificado c
    WHERE (p_colaborador_id IS NULL OR c.colaborador_id = p_colaborador_id)
  ),
  kpis AS (
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status_cadencia = 'ASSIDUO') AS assiduo,
           COUNT(*) FILTER (WHERE status_cadencia = 'REGULAR') AS regular,
           COUNT(*) FILTER (WHERE status_cadencia = 'ESPACANDO') AS espacando,
           COUNT(*) FILTER (WHERE status_cadencia = 'PRIMEIRA_VEZ') AS primeira_vez,
           COUNT(*) FILTER (WHERE status_cadencia = 'EM_RISCO') AS em_risco,
           COUNT(*) FILTER (WHERE status_cadencia = 'PERDIDO') AS perdido
    FROM filtrado
  ),
  por_barbeiro AS (
    SELECT f.colaborador_nome, f.colaborador_id,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status_cadencia = 'ASSIDUO') AS assiduo,
           COUNT(*) FILTER (WHERE status_cadencia = 'REGULAR') AS regular,
           COUNT(*) FILTER (WHERE status_cadencia = 'ESPACANDO') AS espacando,
           COUNT(*) FILTER (WHERE status_cadencia = 'PRIMEIRA_VEZ') AS primeira_vez,
           COUNT(*) FILTER (WHERE status_cadencia = 'EM_RISCO') AS em_risco,
           COUNT(*) FILTER (WHERE status_cadencia = 'PERDIDO') AS perdido
    FROM filtrado f
    WHERE f.colaborador_nome IS NOT NULL
    GROUP BY f.colaborador_nome, f.colaborador_id
    ORDER BY total DESC
  )
  SELECT
    (SELECT row_to_json(k)::jsonb FROM kpis k),
    COALESCE((SELECT jsonb_agg(row_to_json(pb)::jsonb) FROM por_barbeiro pb), '[]'::jsonb)
  INTO v_kpis, v_por_barbeiro;

  -- ============ EVOLUTION SERIES (pre-computed) ============
  -- Strategy: compute cadência + ultima_visita ONCE, then re-classify 12x varying only v_loop_ref
  IF p_grain = 'MENSAL' THEN
    -- Pre-compute into temp table: one row per client with cadencia + ultima_visita + total_visitas
    CREATE TEMP TABLE _cad_precomp ON COMMIT DROP AS
    WITH
    ev_base AS (
      SELECT dc.cliente_id, dc.ultimo_colaborador_id
      FROM dimensao_clientes dc
      WHERE dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''
        AND (NOT p_excluir_sem_cadastro OR (dc.cliente_nome IS NOT NULL AND dc.cliente_nome <> ''))
        AND (
          CASE p_base_mode
            WHEN 'TOTAL' THEN true
            WHEN 'TOTAL_COM_CORTE' THEN (dc.last_seen >= v_ref - ((p_base_corte_meses + p_range_months) || ' months')::interval)
            ELSE (dc.last_seen >= v_ref - ((p_base_corte_meses + p_range_months) || ' months')::interval)
          END
        )
    ),
    ev_visitas AS (
      SELECT v.cliente_id, v.venda_data_ts::date AS dia
      FROM vendas_api_raw v
      JOIN ev_base eb ON eb.cliente_id = v.cliente_id
      WHERE v.venda_data_ts IS NOT NULL
        AND v.venda_data_ts::date >= (v_ref - ((p_cadencia_meses_analise + p_range_months) || ' months')::interval)
        AND v.venda_data_ts::date <= v_ref
      GROUP BY v.cliente_id, v.venda_data_ts::date
    ),
    ev_intervalos AS (
      SELECT cliente_id, dia,
             dia - LAG(dia) OVER (PARTITION BY cliente_id ORDER BY dia) AS intervalo
      FROM ev_visitas
    ),
    ev_cadencia AS (
      SELECT cliente_id,
             CASE
               WHEN COUNT(*) FILTER (WHERE intervalo IS NOT NULL) >= p_cadencia_min_visitas
                 THEN PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY intervalo) FILTER (WHERE intervalo IS NOT NULL)
               WHEN COUNT(*) FILTER (WHERE intervalo IS NOT NULL) >= 1
                 THEN AVG(intervalo) FILTER (WHERE intervalo IS NOT NULL)
               ELSE NULL
             END AS cadencia_dias,
             COUNT(DISTINCT dia) AS total_visitas,
             MAX(dia) AS ultima_visita
      FROM (
        SELECT ei.cliente_id, ei.dia, ei.intervalo FROM ev_intervalos ei
        UNION ALL
        -- Include clients with only 1 visit (no intervals)
        SELECT ev.cliente_id, ev.dia, NULL FROM ev_visitas ev
        WHERE NOT EXISTS (SELECT 1 FROM ev_intervalos ei WHERE ei.cliente_id = ev.cliente_id AND ei.intervalo IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM ev_intervalos ei WHERE ei.cliente_id = ev.cliente_id)
      ) combined
      GROUP BY cliente_id
    )
    SELECT
      eb.cliente_id,
      eb.ultimo_colaborador_id,
      COALESCE(ec.cadencia_dias, 0)::numeric AS cadencia_dias,
      COALESCE(ec.total_visitas, 0)::int AS total_visitas,
      ec.ultima_visita
    FROM ev_base eb
    LEFT JOIN ev_cadencia ec ON ec.cliente_id = eb.cliente_id;

    -- Now loop 12 months, re-classifying from temp table (no vendas_api_raw scan)
    FOR i IN REVERSE (p_range_months - 1)..0 LOOP
      v_loop_ref := (date_trunc('month', v_ref) - (i || ' months')::interval + interval '1 month' - interval '1 day')::date;
      IF v_loop_ref > v_ref THEN v_loop_ref := v_ref; END IF;

      v_loop_key := to_char(v_loop_ref, 'YYYY-MM');
      v_loop_label := v_meses_labels[EXTRACT(MONTH FROM v_loop_ref)::int] || '/' || to_char(v_loop_ref, 'YY');

      WITH
      ev_filtered AS (
        SELECT pc.*,
          CASE
            WHEN pc.ultima_visita IS NULL THEN 'PERDIDO'
            WHEN pc.total_visitas = 1 THEN
              CASE WHEN (v_loop_ref - pc.ultima_visita) <= p_one_shot_aguardando_max_dias THEN 'PRIMEIRA_VEZ'
                   WHEN (v_loop_ref - pc.ultima_visita) <= p_one_shot_risco_max_dias THEN 'EM_RISCO'
                   ELSE 'PERDIDO' END
            WHEN pc.cadencia_dias IS NULL OR pc.cadencia_dias <= 0 THEN
              CASE WHEN (v_loop_ref - pc.ultima_visita) <= p_one_shot_aguardando_max_dias THEN 'REGULAR'
                   WHEN (v_loop_ref - pc.ultima_visita) <= p_one_shot_risco_max_dias THEN 'EM_RISCO'
                   ELSE 'PERDIDO' END
            WHEN ((v_loop_ref - pc.ultima_visita)::numeric / pc.cadencia_dias) <= p_ratio_muito_frequente_max THEN 'ASSIDUO'
            WHEN ((v_loop_ref - pc.ultima_visita)::numeric / pc.cadencia_dias) <= p_ratio_regular_max THEN 'REGULAR'
            WHEN ((v_loop_ref - pc.ultima_visita)::numeric / pc.cadencia_dias) <= p_ratio_espacando_max THEN 'ESPACANDO'
            WHEN ((v_loop_ref - pc.ultima_visita)::numeric / pc.cadencia_dias) <= p_ratio_risco_max THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END AS status_cadencia
        FROM _cad_precomp pc
        WHERE pc.ultima_visita IS NOT NULL
          AND pc.ultima_visita <= v_loop_ref
          AND (p_colaborador_id IS NULL OR pc.ultimo_colaborador_id = p_colaborador_id)
          AND (
            CASE p_base_mode
              WHEN 'JANELA' THEN (pc.ultima_visita >= v_loop_ref - p_janela_dias)
              WHEN 'PERIODO_FILTRADO' THEN (pc.ultima_visita >= v_inicio AND pc.ultima_visita <= v_fim)
              WHEN 'TOTAL' THEN true
              WHEN 'TOTAL_COM_CORTE' THEN (pc.ultima_visita >= v_loop_ref - (p_base_corte_meses || ' months')::interval)
              ELSE true
            END
          )
      ),
      ev_agg AS (
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status_cadencia = 'ASSIDUO') AS assiduo,
               COUNT(*) FILTER (WHERE status_cadencia = 'REGULAR') AS regular,
               COUNT(*) FILTER (WHERE status_cadencia = 'ESPACANDO') AS espacando,
               COUNT(*) FILTER (WHERE status_cadencia = 'PRIMEIRA_VEZ') AS primeira_vez,
               COUNT(*) FILTER (WHERE status_cadencia = 'EM_RISCO') AS em_risco,
               COUNT(*) FILTER (WHERE status_cadencia = 'PERDIDO') AS perdido
        FROM ev_filtered
      )
      SELECT jsonb_build_object(
        'ano_mes', v_loop_key,
        'ano_mes_label', v_loop_label,
        'total', ea.total,
        'assiduo', ea.assiduo,
        'regular', ea.regular,
        'espacando', ea.espacando,
        'primeira_vez', ea.primeira_vez,
        'em_risco', ea.em_risco,
        'perdido', ea.perdido,
        'pct_em_risco', CASE WHEN ea.total > 0 THEN ROUND((ea.em_risco::numeric / ea.total * 100)::numeric, 1) ELSE 0 END,
        'pct_perdido', CASE WHEN ea.total > 0 THEN ROUND((ea.perdido::numeric / ea.total * 100)::numeric, 1) ELSE 0 END,
        'delta_mom_risco', CASE WHEN v_prev_risco IS NOT NULL AND ea.total > 0 THEN ROUND(((ea.em_risco::numeric / ea.total * 100) - v_prev_risco)::numeric, 1) ELSE NULL END,
        'delta_mom_perdido', CASE WHEN v_prev_perdido IS NOT NULL AND ea.total > 0 THEN ROUND(((ea.perdido::numeric / ea.total * 100) - v_prev_perdido)::numeric, 1) ELSE NULL END
      ) INTO v_month_data
      FROM ev_agg ea;

      v_series := v_series || v_month_data;

      v_prev_risco := (v_month_data->>'pct_em_risco')::numeric;
      v_prev_perdido := (v_month_data->>'pct_perdido')::numeric;
    END LOOP;
  END IF;

  -- ============ ASSEMBLE RESULT ============
  v_result := jsonb_build_object(
    'meta', jsonb_build_object(
      'ref', v_ref,
      'inicio', v_inicio,
      'fim', v_fim,
      'grain', p_grain,
      'range_months', p_range_months,
      'base_mode', p_base_mode,
      'base_corte_meses', p_base_corte_meses,
      'cadencia_meses_analise', p_cadencia_meses_analise,
      'cadencia_min_visitas', p_cadencia_min_visitas,
      'ratio_muito_frequente_max', p_ratio_muito_frequente_max,
      'ratio_regular_max', p_ratio_regular_max,
      'ratio_espacando_max', p_ratio_espacando_max,
      'ratio_risco_max', p_ratio_risco_max
    ),
    'kpis', v_kpis,
    'por_barbeiro', v_por_barbeiro,
    'series', v_series
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- 2) Fix barbeiro RPC: filter tipo_colaborador = 'barbeiro'
-- ============================================================
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
      -- FILTER: only barbers
      JOIN dimensao_colaboradores dcb ON dcb.colaborador_id = bc.ultimo_colaborador_id AND dcb.tipo_colaborador = 'barbeiro'
      WHERE bc.ultimo_colaborador_id IS NOT NULL AND bc.ultimo_colaborador_id <> ''
        AND (p_colaborador_id IS NULL OR bc.ultimo_colaborador_id = p_colaborador_id)
    ),
    resgatados_mes AS (
      SELECT DISTINCT v.cliente_id, v.colaborador_id
      FROM vendas_api_raw v
      -- FILTER: only barbers
      JOIN dimensao_colaboradores dcb ON dcb.colaborador_id = v.colaborador_id AND dcb.tipo_colaborador = 'barbeiro'
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
    atendidos_barber AS (
      SELECT v.colaborador_id, COUNT(DISTINCT v.cliente_id) AS atendidos_mes
      FROM vendas_api_raw v
      -- FILTER: only barbers
      JOIN dimensao_colaboradores dcb ON dcb.colaborador_id = v.colaborador_id AND dcb.tipo_colaborador = 'barbeiro'
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
        'churn_pct', CASE WHEN (bm.base_ativa + bm.perdidos) > 0 THEN ROUND((bm.perdidos * 100.0 / (bm.base_ativa + bm.perdidos))::numeric, 1) ELSE 0 END,
        'perdidos_fidelizados', bm.perdidos_fidelizados,
        'churn_fidelizados_pct', CASE WHEN (bm.base_ativa + bm.perdidos) > 0 THEN ROUND((bm.perdidos_fidelizados * 100.0 / GREATEST(bm.base_ativa + bm.perdidos - bm.perdidos_oneshot, 1))::numeric, 1) ELSE 0 END,
        'perdidos_oneshot', bm.perdidos_oneshot,
        'churn_oneshot_pct', CASE WHEN bm.perdidos_oneshot + (bm.base_ativa - bm.em_risco) > 0 THEN ROUND((bm.perdidos_oneshot * 100.0 / GREATEST(bm.perdidos_oneshot + bm.base_ativa, 1))::numeric, 1) ELSE 0 END,
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

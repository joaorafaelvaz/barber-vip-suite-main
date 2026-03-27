
-- ============================================================
-- RPC: rpc_raiox_clientes_cadencia_v2
-- Optimized cadência with monthly evolution series.
-- Uses dimensao_clientes + vw_clientes_resumo for base/atribuição (fast),
-- vendas_api_raw only for interval calculation (scoped).
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
STABLE
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
  v_loop_start date;
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

  -- ============ EVOLUTION SERIES (monthly) ============
  IF p_grain = 'MENSAL' THEN
    FOR i IN REVERSE (p_range_months - 1)..0 LOOP
      v_loop_ref := (date_trunc('month', v_ref) - (i || ' months')::interval + interval '1 month' - interval '1 day')::date;
      -- Cap to v_ref for current month
      IF v_loop_ref > v_ref THEN v_loop_ref := v_ref; END IF;

      v_loop_key := to_char(v_loop_ref, 'YYYY-MM');
      v_loop_label := v_meses_labels[EXTRACT(MONTH FROM v_loop_ref)::int] || '/' || to_char(v_loop_ref, 'YY');

      WITH
      ev_base AS (
        SELECT dc.cliente_id
        FROM dimensao_clientes dc
        WHERE dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''
          AND (NOT p_excluir_sem_cadastro OR (dc.cliente_nome IS NOT NULL AND dc.cliente_nome <> ''))
          AND (
            CASE p_base_mode
              WHEN 'JANELA' THEN (dc.last_seen >= v_loop_ref - p_janela_dias AND dc.last_seen <= v_loop_ref)
              WHEN 'PERIODO_FILTRADO' THEN (dc.last_seen >= v_inicio AND dc.first_seen <= v_fim)
              WHEN 'TOTAL' THEN true
              WHEN 'TOTAL_COM_CORTE' THEN (dc.last_seen >= v_loop_ref - (p_base_corte_meses || ' months')::interval)
              ELSE true
            END
          )
          AND (p_colaborador_id IS NULL OR dc.ultimo_colaborador_id = p_colaborador_id)
      ),
      ev_visitas AS (
        SELECT v.cliente_id, v.venda_data_ts::date AS dia
        FROM vendas_api_raw v
        JOIN ev_base eb ON eb.cliente_id = v.cliente_id
        WHERE v.venda_data_ts IS NOT NULL
          AND v.venda_data_ts::date >= (v_loop_ref - (p_cadencia_meses_analise || ' months')::interval)
          AND v.venda_data_ts::date <= v_loop_ref
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
               (SELECT COUNT(DISTINCT ev2.dia) FROM ev_visitas ev2 WHERE ev2.cliente_id = ev_intervalos.cliente_id) AS total_visitas
        FROM ev_intervalos GROUP BY cliente_id
      ),
      ev_status AS (
        SELECT eb.cliente_id,
               CASE
                 WHEN (SELECT MAX(ev.dia) FROM ev_visitas ev WHERE ev.cliente_id = eb.cliente_id) IS NULL THEN 'PERDIDO'
                 WHEN ec.total_visitas = 1 THEN
                   CASE WHEN (v_loop_ref - (SELECT MAX(ev.dia) FROM ev_visitas ev WHERE ev.cliente_id = eb.cliente_id)) <= p_one_shot_aguardando_max_dias THEN 'PRIMEIRA_VEZ'
                        WHEN (v_loop_ref - (SELECT MAX(ev.dia) FROM ev_visitas ev WHERE ev.cliente_id = eb.cliente_id)) <= p_one_shot_risco_max_dias THEN 'EM_RISCO'
                        ELSE 'PERDIDO' END
                 WHEN ec.cadencia_dias IS NULL OR ec.cadencia_dias <= 0 THEN
                   CASE WHEN (v_loop_ref - (SELECT MAX(ev.dia) FROM ev_visitas ev WHERE ev.cliente_id = eb.cliente_id)) <= p_one_shot_aguardando_max_dias THEN 'REGULAR'
                        WHEN (v_loop_ref - (SELECT MAX(ev.dia) FROM ev_visitas ev WHERE ev.cliente_id = eb.cliente_id)) <= p_one_shot_risco_max_dias THEN 'EM_RISCO'
                        ELSE 'PERDIDO' END
                 WHEN ((v_loop_ref - (SELECT MAX(ev.dia) FROM ev_visitas ev WHERE ev.cliente_id = eb.cliente_id))::numeric / ec.cadencia_dias) <= p_ratio_muito_frequente_max THEN 'ASSIDUO'
                 WHEN ((v_loop_ref - (SELECT MAX(ev.dia) FROM ev_visitas ev WHERE ev.cliente_id = eb.cliente_id))::numeric / ec.cadencia_dias) <= p_ratio_regular_max THEN 'REGULAR'
                 WHEN ((v_loop_ref - (SELECT MAX(ev.dia) FROM ev_visitas ev WHERE ev.cliente_id = eb.cliente_id))::numeric / ec.cadencia_dias) <= p_ratio_espacando_max THEN 'ESPACANDO'
                 WHEN ((v_loop_ref - (SELECT MAX(ev.dia) FROM ev_visitas ev WHERE ev.cliente_id = eb.cliente_id))::numeric / ec.cadencia_dias) <= p_ratio_risco_max THEN 'EM_RISCO'
                 ELSE 'PERDIDO'
               END AS status_cadencia
        FROM ev_base eb
        LEFT JOIN ev_cadencia ec ON ec.cliente_id = eb.cliente_id
      ),
      ev_agg AS (
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status_cadencia = 'ASSIDUO') AS assiduo,
               COUNT(*) FILTER (WHERE status_cadencia = 'REGULAR') AS regular,
               COUNT(*) FILTER (WHERE status_cadencia = 'ESPACANDO') AS espacando,
               COUNT(*) FILTER (WHERE status_cadencia = 'PRIMEIRA_VEZ') AS primeira_vez,
               COUNT(*) FILTER (WHERE status_cadencia = 'EM_RISCO') AS em_risco,
               COUNT(*) FILTER (WHERE status_cadencia = 'PERDIDO') AS perdido
        FROM ev_status
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
        'pct_em_risco', CASE WHEN ea.total > 0 THEN ROUND((ea.em_risco::numeric / ea.total * 100), 1) ELSE 0 END,
        'pct_perdido', CASE WHEN ea.total > 0 THEN ROUND((ea.perdido::numeric / ea.total * 100), 1) ELSE 0 END,
        'delta_mom_risco', CASE WHEN v_prev_risco IS NOT NULL AND ea.total > 0 THEN ROUND((ea.em_risco::numeric / ea.total * 100) - v_prev_risco, 1) ELSE NULL END,
        'delta_mom_perdido', CASE WHEN v_prev_perdido IS NOT NULL AND ea.total > 0 THEN ROUND((ea.perdido::numeric / ea.total * 100) - v_prev_perdido, 1) ELSE NULL END
      ) INTO v_month_data
      FROM ev_agg ea;

      v_series := v_series || v_month_data;

      -- Track previous for MoM delta
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

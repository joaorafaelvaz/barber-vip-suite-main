
-- ============================================================
-- RPC: rpc_raiox_clientes_cadencia_v1
-- Cadência individual: calcula frequência pessoal de cada cliente
-- usando mediana/média dos intervalos entre visitas, classifica
-- por ratio (dias_sem_vir / cadencia_individual).
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_raiox_clientes_cadencia_v1(
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
  p_atribuicao_janela_meses int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref date;
  v_inicio date := p_inicio::date;
  v_fim date := p_fim::date;
  v_cadencia_desde date;
  v_result jsonb;
BEGIN
  -- REF
  IF p_ref_mode = 'HOJE' THEN v_ref := CURRENT_DATE;
  ELSE v_ref := v_fim;
  END IF;

  v_cadencia_desde := v_ref - (p_cadencia_meses_analise || ' months')::interval;

  WITH
  -- 1) Base de clientes (mesmo padrão overview)
  base_clientes AS (
    SELECT DISTINCT v.cliente_id,
           v.cliente_nome,
           v.telefone
    FROM vendas_api_raw v
    WHERE v.venda_data_ts IS NOT NULL
      AND v.cliente_id IS NOT NULL
      AND v.cliente_id <> ''
      AND (NOT p_excluir_sem_cadastro OR (v.cliente_nome IS NOT NULL AND v.cliente_nome <> ''))
      AND (
        CASE p_base_mode
          WHEN 'JANELA' THEN (v.venda_data_ts::date >= v_ref - p_janela_dias AND v.venda_data_ts::date <= v_ref)
          WHEN 'PERIODO_FILTRADO' THEN (v.venda_data_ts::date >= v_inicio AND v.venda_data_ts::date <= v_fim)
          WHEN 'TOTAL' THEN true
          WHEN 'TOTAL_COM_CORTE' THEN (v.venda_data_ts::date >= v_ref - (p_base_corte_meses || ' months')::interval)
          ELSE true
        END
      )
  ),

  -- 2) Atribuição de barbeiro
  atribuicao AS (
    SELECT v.cliente_id,
           CASE p_atribuicao_modo
             WHEN 'ULTIMO' THEN (
               SELECT sub.colaborador_nome FROM vendas_api_raw sub
               WHERE sub.cliente_id = v.cliente_id
                 AND sub.colaborador_nome IS NOT NULL
                 AND sub.venda_data_ts IS NOT NULL
                 AND sub.venda_data_ts::date <= v_ref
               ORDER BY sub.venda_data_ts DESC LIMIT 1
             )
             ELSE (
               SELECT sub.colaborador_nome FROM vendas_api_raw sub
               WHERE sub.cliente_id = v.cliente_id
                 AND sub.colaborador_nome IS NOT NULL
                 AND sub.venda_data_ts IS NOT NULL
                 AND sub.venda_data_ts::date <= v_ref
               ORDER BY sub.venda_data_ts DESC LIMIT 1
             )
           END AS colaborador_nome,
           CASE p_atribuicao_modo
             WHEN 'ULTIMO' THEN (
               SELECT sub.colaborador_id FROM vendas_api_raw sub
               WHERE sub.cliente_id = v.cliente_id
                 AND sub.colaborador_id IS NOT NULL
                 AND sub.venda_data_ts IS NOT NULL
                 AND sub.venda_data_ts::date <= v_ref
               ORDER BY sub.venda_data_ts DESC LIMIT 1
             )
             ELSE (
               SELECT sub.colaborador_id FROM vendas_api_raw sub
               WHERE sub.cliente_id = v.cliente_id
                 AND sub.colaborador_id IS NOT NULL
                 AND sub.venda_data_ts IS NOT NULL
                 AND sub.venda_data_ts::date <= v_ref
               ORDER BY sub.venda_data_ts DESC LIMIT 1
             )
           END AS colaborador_id
    FROM base_clientes v
    GROUP BY v.cliente_id
  ),

  -- 3) Visitas históricas para cadência (distintas por dia)
  visitas AS (
    SELECT v.cliente_id,
           v.venda_data_ts::date AS dia
    FROM vendas_api_raw v
    JOIN base_clientes bc ON bc.cliente_id = v.cliente_id
    WHERE v.venda_data_ts IS NOT NULL
      AND v.venda_data_ts::date >= v_cadencia_desde
      AND v.venda_data_ts::date <= v_ref
    GROUP BY v.cliente_id, v.venda_data_ts::date
  ),

  -- 4) Intervalos entre visitas
  intervalos AS (
    SELECT cliente_id,
           dia,
           dia - LAG(dia) OVER (PARTITION BY cliente_id ORDER BY dia) AS intervalo
    FROM visitas
  ),

  -- 5) Cadência calculada
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
    FROM intervalos
    GROUP BY cliente_id
  ),

  -- 6) Resumo por cliente
  cliente_resumo AS (
    SELECT bc.cliente_id,
           bc.cliente_nome,
           bc.telefone,
           a.colaborador_nome,
           a.colaborador_id,
           (SELECT MAX(vv.dia) FROM visitas vv WHERE vv.cliente_id = bc.cliente_id) AS ultima_visita,
           (SELECT COUNT(DISTINCT vv.dia) FROM visitas vv WHERE vv.cliente_id = bc.cliente_id) AS total_visitas_periodo,
           cc.cadencia_dias,
           cc.cadencia_metodo,
           cc.num_intervalos
    FROM base_clientes bc
    LEFT JOIN atribuicao a ON a.cliente_id = bc.cliente_id
    LEFT JOIN cadencia_calc cc ON cc.cliente_id = bc.cliente_id
  ),

  -- 7) Classificação
  classificado AS (
    SELECT cr.*,
           v_ref - cr.ultima_visita AS dias_sem_vir,
           CASE
             WHEN cr.cadencia_dias IS NOT NULL AND cr.cadencia_dias > 0
               THEN ROUND(((v_ref - cr.ultima_visita)::numeric / cr.cadencia_dias), 2)
             ELSE NULL
           END AS ratio,
           CASE
             -- Sem visitas no período de análise
             WHEN cr.ultima_visita IS NULL THEN 'PERDIDO'
             -- One-shot (1 visita)
             WHEN cr.total_visitas_periodo = 1 THEN
               CASE
                 WHEN (v_ref - cr.ultima_visita) <= p_one_shot_aguardando_max_dias THEN 'PRIMEIRA_VEZ'
                 WHEN (v_ref - cr.ultima_visita) <= p_one_shot_risco_max_dias THEN 'EM_RISCO'
                 ELSE 'PERDIDO'
               END
             -- Sem cadência calculável (2 visitas no mesmo dia etc.)
             WHEN cr.cadencia_dias IS NULL OR cr.cadencia_dias <= 0 THEN
               CASE
                 WHEN (v_ref - cr.ultima_visita) <= p_one_shot_aguardando_max_dias THEN 'REGULAR'
                 WHEN (v_ref - cr.ultima_visita) <= p_one_shot_risco_max_dias THEN 'EM_RISCO'
                 ELSE 'PERDIDO'
               END
             -- Ratio-based
             WHEN ((v_ref - cr.ultima_visita)::numeric / cr.cadencia_dias) <= p_ratio_muito_frequente_max THEN 'ASSIDUO'
             WHEN ((v_ref - cr.ultima_visita)::numeric / cr.cadencia_dias) <= p_ratio_regular_max THEN 'REGULAR'
             WHEN ((v_ref - cr.ultima_visita)::numeric / cr.cadencia_dias) <= p_ratio_espacando_max THEN 'ESPACANDO'
             WHEN ((v_ref - cr.ultima_visita)::numeric / cr.cadencia_dias) <= p_ratio_risco_max THEN 'EM_RISCO'
             ELSE 'PERDIDO'
           END AS status_cadencia
    FROM cliente_resumo cr
  ),

  -- 8) Filtro de colaborador (opcional)
  filtrado AS (
    SELECT c.* FROM classificado c
    LEFT JOIN atribuicao a ON a.cliente_id = c.cliente_id
    WHERE (p_colaborador_id IS NULL OR a.colaborador_id = p_colaborador_id)
  ),

  -- 9) KPIs
  kpis AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status_cadencia = 'ASSIDUO') AS assiduo,
      COUNT(*) FILTER (WHERE status_cadencia = 'REGULAR') AS regular,
      COUNT(*) FILTER (WHERE status_cadencia = 'ESPACANDO') AS espacando,
      COUNT(*) FILTER (WHERE status_cadencia = 'PRIMEIRA_VEZ') AS primeira_vez,
      COUNT(*) FILTER (WHERE status_cadencia = 'EM_RISCO') AS em_risco,
      COUNT(*) FILTER (WHERE status_cadencia = 'PERDIDO') AS perdido
    FROM filtrado
  ),

  -- 10) Por barbeiro
  por_barbeiro AS (
    SELECT
      f.colaborador_nome,
      f.colaborador_id,
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

  SELECT jsonb_build_object(
    'meta', jsonb_build_object(
      'ref', v_ref,
      'inicio', v_inicio,
      'fim', v_fim,
      'base_mode', p_base_mode,
      'base_corte_meses', p_base_corte_meses,
      'cadencia_meses_analise', p_cadencia_meses_analise,
      'cadencia_min_visitas', p_cadencia_min_visitas,
      'ratio_muito_frequente_max', p_ratio_muito_frequente_max,
      'ratio_regular_max', p_ratio_regular_max,
      'ratio_espacando_max', p_ratio_espacando_max,
      'ratio_risco_max', p_ratio_risco_max
    ),
    'kpis', (SELECT row_to_json(k)::jsonb FROM kpis k),
    'por_barbeiro', COALESCE((SELECT jsonb_agg(row_to_json(pb)::jsonb) FROM por_barbeiro pb), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- RPC: rpc_raiox_clientes_cadencia_drill_v1
-- Drill-down: lista clientes de um status específico de cadência
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_raiox_clientes_cadencia_drill_v1(
  p_inicio text,
  p_fim text,
  p_janela_dias int DEFAULT 60,
  p_colaborador_id text DEFAULT NULL,
  p_excluir_sem_cadastro boolean DEFAULT true,
  p_tipo text DEFAULT 'ASSIDUO',
  p_valor text DEFAULT '',
  p_limit int DEFAULT 500,
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
  p_atribuicao_janela_meses int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref date;
  v_inicio date := p_inicio::date;
  v_fim date := p_fim::date;
  v_cadencia_desde date;
  v_result jsonb;
BEGIN
  IF p_ref_mode = 'HOJE' THEN v_ref := CURRENT_DATE;
  ELSE v_ref := v_fim;
  END IF;

  v_cadencia_desde := v_ref - (p_cadencia_meses_analise || ' months')::interval;

  WITH
  base_clientes AS (
    SELECT DISTINCT v.cliente_id, v.cliente_nome, v.telefone
    FROM vendas_api_raw v
    WHERE v.venda_data_ts IS NOT NULL
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND (NOT p_excluir_sem_cadastro OR (v.cliente_nome IS NOT NULL AND v.cliente_nome <> ''))
      AND (
        CASE p_base_mode
          WHEN 'JANELA' THEN (v.venda_data_ts::date >= v_ref - p_janela_dias AND v.venda_data_ts::date <= v_ref)
          WHEN 'PERIODO_FILTRADO' THEN (v.venda_data_ts::date >= v_inicio AND v.venda_data_ts::date <= v_fim)
          WHEN 'TOTAL' THEN true
          WHEN 'TOTAL_COM_CORTE' THEN (v.venda_data_ts::date >= v_ref - (p_base_corte_meses || ' months')::interval)
          ELSE true
        END
      )
  ),
  atribuicao AS (
    SELECT v.cliente_id,
           (SELECT sub.colaborador_nome FROM vendas_api_raw sub WHERE sub.cliente_id = v.cliente_id AND sub.colaborador_nome IS NOT NULL AND sub.venda_data_ts IS NOT NULL AND sub.venda_data_ts::date <= v_ref ORDER BY sub.venda_data_ts DESC LIMIT 1) AS colaborador_nome,
           (SELECT sub.colaborador_id FROM vendas_api_raw sub WHERE sub.cliente_id = v.cliente_id AND sub.colaborador_id IS NOT NULL AND sub.venda_data_ts IS NOT NULL AND sub.venda_data_ts::date <= v_ref ORDER BY sub.venda_data_ts DESC LIMIT 1) AS colaborador_id
    FROM base_clientes v GROUP BY v.cliente_id
  ),
  visitas AS (
    SELECT v.cliente_id, v.venda_data_ts::date AS dia
    FROM vendas_api_raw v JOIN base_clientes bc ON bc.cliente_id = v.cliente_id
    WHERE v.venda_data_ts IS NOT NULL AND v.venda_data_ts::date >= v_cadencia_desde AND v.venda_data_ts::date <= v_ref
    GROUP BY v.cliente_id, v.venda_data_ts::date
  ),
  intervalos AS (
    SELECT cliente_id, dia, dia - LAG(dia) OVER (PARTITION BY cliente_id ORDER BY dia) AS intervalo
    FROM visitas
  ),
  cadencia_calc AS (
    SELECT cliente_id,
           COUNT(*) FILTER (WHERE intervalo IS NOT NULL) AS num_intervalos,
           CASE WHEN COUNT(*) FILTER (WHERE intervalo IS NOT NULL) >= p_cadencia_min_visitas THEN PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY intervalo) FILTER (WHERE intervalo IS NOT NULL)
                WHEN COUNT(*) FILTER (WHERE intervalo IS NOT NULL) >= 1 THEN AVG(intervalo) FILTER (WHERE intervalo IS NOT NULL)
                ELSE NULL END AS cadencia_dias,
           CASE WHEN COUNT(*) FILTER (WHERE intervalo IS NOT NULL) >= p_cadencia_min_visitas THEN 'mediana'
                WHEN COUNT(*) FILTER (WHERE intervalo IS NOT NULL) >= 1 THEN 'media'
                ELSE 'sem_dados' END AS cadencia_metodo
    FROM intervalos GROUP BY cliente_id
  ),
  cliente_resumo AS (
    SELECT bc.cliente_id, bc.cliente_nome, bc.telefone, a.colaborador_nome, a.colaborador_id,
           (SELECT MAX(vv.dia) FROM visitas vv WHERE vv.cliente_id = bc.cliente_id) AS ultima_visita,
           (SELECT COUNT(DISTINCT vv.dia) FROM visitas vv WHERE vv.cliente_id = bc.cliente_id) AS total_visitas_periodo,
           cc.cadencia_dias, cc.cadencia_metodo
    FROM base_clientes bc
    LEFT JOIN atribuicao a ON a.cliente_id = bc.cliente_id
    LEFT JOIN cadencia_calc cc ON cc.cliente_id = bc.cliente_id
  ),
  classificado AS (
    SELECT cr.*,
           v_ref - cr.ultima_visita AS dias_sem_vir,
           CASE WHEN cr.cadencia_dias IS NOT NULL AND cr.cadencia_dias > 0
                  THEN ROUND(((v_ref - cr.ultima_visita)::numeric / cr.cadencia_dias), 2) ELSE NULL END AS ratio,
           CASE
             WHEN cr.ultima_visita IS NULL THEN 'PERDIDO'
             WHEN cr.total_visitas_periodo = 1 THEN
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
    LEFT JOIN atribuicao a ON a.cliente_id = c.cliente_id
    WHERE (p_colaborador_id IS NULL OR a.colaborador_id = p_colaborador_id)
      AND c.status_cadencia = p_tipo
  ),
  total_count AS (
    SELECT COUNT(*) AS total FROM filtrado
  ),
  limited AS (
    SELECT * FROM filtrado ORDER BY dias_sem_vir DESC LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'total', (SELECT total FROM total_count),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'cliente_id', l.cliente_id,
        'cliente_nome', l.cliente_nome,
        'telefone', l.telefone,
        'colaborador_nome', l.colaborador_nome,
        'ultima_visita', l.ultima_visita,
        'dias_sem_vir', l.dias_sem_vir,
        'cadencia_dias', ROUND(l.cadencia_dias::numeric, 1),
        'ratio', l.ratio,
        'visitas_total', l.total_visitas_periodo,
        'valor_total', 0
      ))
      FROM limited l
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

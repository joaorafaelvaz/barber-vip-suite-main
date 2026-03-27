
CREATE OR REPLACE FUNCTION public.rpc_raiox_overview_drill_v1(
  p_inicio text DEFAULT NULL::text,
  p_fim text DEFAULT NULL::text,
  p_janela_dias integer DEFAULT 60,
  p_colaborador_id text DEFAULT NULL::text,
  p_excluir_sem_cadastro boolean DEFAULT true,
  p_tipo text DEFAULT 'MACRO'::text,
  p_valor text DEFAULT 'SAUDAVEL'::text,
  p_limit integer DEFAULT 500
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ref date;
  v_inicio date;
  v_risco_min int := 45;
  v_risco_max int := 90;
  v_result json;
  v_faixa_min int := 0;
  v_faixa_max int := 99999;
BEGIN
  v_ref := COALESCE(p_fim::date, now()::date);
  v_inicio := COALESCE(p_inicio::date, (v_ref - 30));

  IF p_tipo = 'CADENCIA_FIXA' AND p_valor IS NOT NULL AND p_valor <> '' THEN
    IF position('+' in p_valor) > 0 THEN
      v_faixa_min := split_part(p_valor, '+', 1)::int;
      v_faixa_max := 99999;
    ELSIF position('-' in p_valor) > 0 THEN
      v_faixa_min := split_part(p_valor, '-', 1)::int;
      v_faixa_max := split_part(p_valor, '-', 2)::int;
    END IF;
  END IF;

  WITH total_visits AS (
    -- All-time: used ONLY for classification (seg_perfil, seg_cadencia) and RESGATADOS filter
    SELECT cliente_id,
           COUNT(DISTINCT venda_data_ts::date) AS visitas_total
    FROM vendas_api_raw
    WHERE venda_data_ts IS NOT NULL
      AND (cliente_id IS NOT NULL AND cliente_id <> '')
      AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    GROUP BY cliente_id
  ),
  period_stats AS (
    -- Period-filtered: used for display columns visitas_total and valor_total in rows
    SELECT cliente_id,
           COUNT(DISTINCT venda_data_ts::date) AS visitas_periodo,
           SUM(COALESCE(valor_bruto, 0)) AS valor_periodo
    FROM vendas_api_raw
    WHERE venda_data_ts IS NOT NULL
      AND (cliente_id IS NOT NULL AND cliente_id <> '')
      AND venda_data_ts::date BETWEEN v_inicio AND v_ref
      AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    GROUP BY cliente_id
  ),
  period_visits AS (
    SELECT DISTINCT cliente_id
    FROM vendas_api_raw
    WHERE venda_data_ts IS NOT NULL
      AND cliente_id IS NOT NULL AND cliente_id <> ''
      AND venda_data_ts::date BETWEEN v_inicio AND v_ref
  ),
  prev_visits AS (
    SELECT v.cliente_id, MAX(v.venda_data_ts::date) AS penultima
    FROM vendas_api_raw v
    JOIN dimensao_clientes dc ON dc.cliente_id = v.cliente_id
    WHERE v.venda_data_ts IS NOT NULL
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.venda_data_ts::date < dc.last_seen
      AND p_tipo = 'RESGATADOS'
    GROUP BY v.cliente_id
  ),
  cx AS (
    SELECT
      dc.cliente_id, dc.cliente_nome, dc.telefone,
      dc.last_seen AS ultima_visita,
      dc.first_seen,
      dc.ultimo_colaborador_nome AS colaborador_nome,
      dc.ultimo_colaborador_id AS colaborador_id,
      (v_ref - dc.last_seen)::int AS dias_sem_vir,
      -- visitas_historico: all-time count used for RESGATADOS filter
      COALESCE(tv.visitas_total, 0)::int AS visitas_historico,
      -- visitas_total and valor_total: PERIOD-SPECIFIC for display in the rows
      COALESCE(ps.visitas_periodo, 0)::int AS visitas_total,
      COALESCE(ps.valor_periodo, 0)::numeric AS valor_total,
      pv.cliente_id IS NOT NULL AS visited_in_period,
      CASE WHEN pv2.penultima IS NOT NULL THEN (dc.last_seen - pv2.penultima)::int ELSE 0 END AS gap_resgate,
      CASE
        WHEN COALESCE(tv.visitas_total, 0) >= 12 THEN 'FIEL'
        WHEN COALESCE(tv.visitas_total, 0) >= 6 THEN 'RECORRENTE'
        WHEN COALESCE(tv.visitas_total, 0) >= 3 THEN 'IRREGULAR'
        WHEN COALESCE(tv.visitas_total, 0) >= 2 THEN 'OCASIONAL'
        ELSE 'INATIVO'
      END AS seg_perfil,
      CASE
        WHEN COALESCE(tv.visitas_total, 0) = 1 AND (v_ref - dc.last_seen)::int <= v_risco_min THEN 'ONE_SHOT_AGUARDANDO'
        WHEN COALESCE(tv.visitas_total, 0) = 1 AND (v_ref - dc.last_seen)::int <= v_risco_max THEN 'ONE_SHOT_RISCO'
        WHEN COALESCE(tv.visitas_total, 0) = 1 THEN 'ONE_SHOT_PERDIDO'
        WHEN (v_ref - dc.last_seen)::int <= 30 THEN 'MUITO_FREQUENTE'
        WHEN (v_ref - dc.last_seen)::int <= v_risco_min THEN 'REGULAR'
        WHEN (v_ref - dc.last_seen)::int <= 60 THEN 'ESPACANDO'
        WHEN (v_ref - dc.last_seen)::int <= v_risco_max THEN 'EM_RISCO'
        ELSE 'PERDIDO'
      END AS seg_cadencia,
      CASE
        WHEN (v_ref - dc.last_seen)::int <= v_risco_min THEN 'SAUDAVEL'
        WHEN (v_ref - dc.last_seen)::int <= v_risco_max THEN 'EM_RISCO'
        ELSE 'PERDIDO'
      END AS seg_macro
    FROM dimensao_clientes dc
    LEFT JOIN total_visits tv ON tv.cliente_id = dc.cliente_id
    LEFT JOIN period_stats ps ON ps.cliente_id = dc.cliente_id
    LEFT JOIN period_visits pv ON pv.cliente_id = dc.cliente_id
    LEFT JOIN prev_visits pv2 ON pv2.cliente_id = dc.cliente_id
    WHERE dc.last_seen IS NOT NULL
      AND dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''
      AND dc.last_seen >= (v_ref - 365)
      AND (NOT p_excluir_sem_cadastro OR dc.cliente_nome NOT ILIKE '%sem cadastro%')
      AND (p_colaborador_id IS NULL OR dc.ultimo_colaborador_id = p_colaborador_id)
  ),
  match_filter AS (
    SELECT * FROM cx
    WHERE
      (p_tipo = 'PERFIL' AND seg_perfil = p_valor)
      OR (p_tipo = 'CADENCIA' AND seg_cadencia = p_valor)
      OR (p_tipo = 'MACRO' AND seg_macro = p_valor)
      OR (p_tipo = 'CADENCIA_FIXA' AND dias_sem_vir >= v_faixa_min AND dias_sem_vir <= v_faixa_max)
      OR (p_tipo = 'ATIVOS' AND dias_sem_vir <= p_janela_dias)
      OR (p_tipo = 'NOVOS' AND first_seen IS NOT NULL AND first_seen >= v_inicio AND first_seen <= v_ref)
      OR (p_tipo = 'UNICOS' AND visited_in_period)
      OR (p_tipo = 'RESGATADOS' AND visited_in_period AND visitas_historico >= 2 AND gap_resgate > v_risco_max)
  ),
  filtered AS (
    SELECT * FROM match_filter
    ORDER BY dias_sem_vir ASC
    LIMIT p_limit
  )
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM match_filter),
    'tipo', p_tipo,
    'valor', p_valor,
    'rows', COALESCE((SELECT json_agg(row_to_json(f)) FROM filtered f), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

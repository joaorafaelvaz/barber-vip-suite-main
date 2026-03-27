
-- RPC: rpc_clientes_comparativo_barbeiros
-- Returns per-barber status distribution, ticket medio, and pct_vip_forte
CREATE OR REPLACE FUNCTION public.rpc_clientes_comparativo_barbeiros(
  p_data_inicio text,
  p_data_fim text,
  p_ref_date text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio date := p_data_inicio::date;
  v_fim    date := p_data_fim::date;
  v_ref    date := COALESCE(p_ref_date::date, CURRENT_DATE);
  v_result jsonb;
BEGIN
  WITH
  vendas AS (
    SELECT v.cliente_id, v.cliente_nome, v.colaborador_id, v.colaborador_nome,
           v.venda_dia, v.valor_faturamento, v.telefone
    FROM vw_vendas_kpi_base v
    WHERE v.venda_dia BETWEEN v_inicio AND v_fim
      AND v.is_credito = false
      AND v.cliente_id IS NOT NULL
      AND v.cliente_nome IS NOT NULL
      AND v.cliente_nome NOT ILIKE '%sem cadastro%'
      AND v.produto IS NOT NULL
      AND v.produto <> ''
  ),

  -- Per-barber client aggregation
  clientes_por_barb AS (
    SELECT
      colaborador_id,
      MIN(colaborador_nome) AS colaborador_nome,
      cliente_id,
      MIN(cliente_nome) AS cliente_nome,
      COUNT(DISTINCT venda_dia) AS atendimentos,
      SUM(valor_faturamento) AS valor_total,
      MAX(venda_dia) AS ultima_visita
    FROM vendas
    WHERE colaborador_id IS NOT NULL
    GROUP BY colaborador_id, cliente_id
  ),

  -- Global cadence per client
  cadencia AS (
    SELECT
      cliente_id,
      CASE
        WHEN COUNT(DISTINCT venda_dia) < 2 THEN NULL
        ELSE ROUND(
          (MAX(venda_dia) - MIN(venda_dia))::numeric / NULLIF(COUNT(DISTINCT venda_dia) - 1, 0), 1
        )
      END AS cadencia_dias
    FROM vendas
    GROUP BY cliente_id
  ),

  -- Status per client per barber
  status_calc AS (
    SELECT
      cpb.colaborador_id,
      cpb.colaborador_nome,
      cpb.cliente_id,
      cpb.atendimentos,
      cpb.valor_total,
      cpb.ultima_visita,
      (v_ref - cpb.ultima_visita) AS dias_sem_vir,
      c.cadencia_dias,
      CASE
        WHEN c.cadencia_dias IS NULL OR c.cadencia_dias = 0 THEN
          CASE
            WHEN (v_ref - cpb.ultima_visita) <= 30 THEN 'ATIVO_LEVE'
            WHEN (v_ref - cpb.ultima_visita) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        WHEN (v_ref - cpb.ultima_visita) <= (c.cadencia_dias * 0.8) THEN 'ATIVO_VIP'
        WHEN (v_ref - cpb.ultima_visita) <= (c.cadencia_dias * 1.2) THEN 'ATIVO_FORTE'
        WHEN (v_ref - cpb.ultima_visita) <= (c.cadencia_dias * 1.8) THEN 'ATIVO_LEVE'
        WHEN (v_ref - cpb.ultima_visita) <= (c.cadencia_dias * 2.5) THEN 'EM_RISCO'
        ELSE 'PERDIDO'
      END AS status_cliente
    FROM clientes_por_barb cpb
    LEFT JOIN cadencia c ON c.cliente_id = cpb.cliente_id
  ),

  -- Status distribution per barber
  status_dist_barb AS (
    SELECT
      colaborador_id,
      status_cliente AS status,
      COUNT(*)::int AS count
    FROM status_calc
    GROUP BY colaborador_id, status_cliente
  ),

  -- Per-barber aggregations
  barb_agg AS (
    SELECT
      sc.colaborador_id,
      MIN(sc.colaborador_nome) AS colaborador_nome,
      COUNT(DISTINCT sc.cliente_id)::int AS total_clientes,
      ROUND(COALESCE(AVG(sc.valor_total), 0), 2)::numeric AS ticket_medio,
      ROUND(COALESCE(SUM(sc.valor_total), 0), 2)::numeric AS valor_total,
      COALESCE(
        ROUND(
          COUNT(DISTINCT sc.cliente_id) FILTER (WHERE sc.status_cliente IN ('ATIVO_VIP', 'ATIVO_FORTE'))::numeric
          / NULLIF(COUNT(DISTINCT sc.cliente_id), 0) * 100, 1
        ), 0
      )::numeric AS pct_vip_forte
    FROM status_calc sc
    GROUP BY sc.colaborador_id
  )

  SELECT jsonb_agg(
    jsonb_build_object(
      'colaborador_id', ba.colaborador_id,
      'colaborador_nome', ba.colaborador_nome,
      'total_clientes', ba.total_clientes,
      'ticket_medio', ba.ticket_medio,
      'valor_total', ba.valor_total,
      'pct_vip_forte', ba.pct_vip_forte,
      'status_distribuicao', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('status', sdb.status, 'count', sdb.count))
         FROM status_dist_barb sdb WHERE sdb.colaborador_id = ba.colaborador_id),
        '[]'::jsonb
      )
    )
    ORDER BY ba.valor_total DESC
  )
  INTO v_result
  FROM barb_agg ba;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;

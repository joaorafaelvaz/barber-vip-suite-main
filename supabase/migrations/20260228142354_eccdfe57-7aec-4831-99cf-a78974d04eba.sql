
-- ============================================================
-- RPC: rpc_clientes_barbeiro_detalhe
-- Retorna JSONB com detalhamento completo da carteira do barbeiro
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_clientes_barbeiro_detalhe(
  p_data_inicio text,
  p_data_fim text,
  p_ref_date text DEFAULT NULL,
  p_colaborador_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio date := p_data_inicio::date;
  v_fim    date := p_data_fim::date;
  v_ref    date := COALESCE(p_ref_date::date, CURRENT_DATE);
  v_result jsonb;
BEGIN
  IF p_colaborador_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  WITH
  -- Vendas filtradas (excluindo crédito, sem cadastro, produtos nulos)
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

  -- Vendas deste barbeiro
  vendas_barb AS (
    SELECT * FROM vendas WHERE colaborador_id = p_colaborador_id
  ),

  -- Clientes deste barbeiro (agregados)
  clientes_barb AS (
    SELECT
      cliente_id,
      MIN(cliente_nome) AS cliente_nome,
      MIN(telefone) AS telefone,
      COUNT(DISTINCT venda_dia) AS atendimentos,
      SUM(valor_faturamento) AS valor_total,
      MAX(venda_dia) AS ultima_visita
    FROM vendas_barb
    GROUP BY cliente_id
  ),

  -- Cadência individual de cada cliente (global)
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

  -- Status de cada cliente do barbeiro
  status_calc AS (
    SELECT
      cb.cliente_id,
      cb.cliente_nome,
      cb.telefone,
      cb.atendimentos,
      cb.valor_total,
      cb.ultima_visita,
      (v_ref - cb.ultima_visita) AS dias_sem_vir,
      c.cadencia_dias,
      CASE
        WHEN c.cadencia_dias IS NULL OR c.cadencia_dias = 0 THEN
          CASE
            WHEN (v_ref - cb.ultima_visita) <= 30 THEN 'ATIVO_LEVE'
            WHEN (v_ref - cb.ultima_visita) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 0.8) THEN 'ATIVO_VIP'
        WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 1.2) THEN 'ATIVO_FORTE'
        WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 1.8) THEN 'ATIVO_LEVE'
        WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 2.5) THEN 'EM_RISCO'
        ELSE 'PERDIDO'
      END AS status_cliente
    FROM clientes_barb cb
    LEFT JOIN cadencia c ON c.cliente_id = cb.cliente_id
  ),

  -- Status distribuição
  status_dist AS (
    SELECT status_cliente AS status, COUNT(*)::int AS count
    FROM status_calc
    GROUP BY status_cliente
  ),

  -- Perdidos: verificar última visita global
  perdidos_detail AS (
    SELECT
      sc.cliente_id,
      sc.status_cliente,
      -- Última visita global do cliente (qualquer barbeiro)
      (SELECT MAX(v2.venda_dia) FROM vendas v2 WHERE v2.cliente_id = sc.cliente_id) AS ultima_global,
      (SELECT v3.colaborador_id FROM vendas v3 WHERE v3.cliente_id = sc.cliente_id ORDER BY v3.venda_dia DESC LIMIT 1) AS ultimo_barb_global
    FROM status_calc sc
    WHERE sc.status_cliente = 'PERDIDO'
  ),

  perdidos_agg AS (
    SELECT
      COUNT(*) FILTER (WHERE ultimo_barb_global = p_colaborador_id OR ultimo_barb_global IS NULL)::int AS perdidos_barbearia,
      COUNT(*) FILTER (WHERE ultimo_barb_global IS NOT NULL AND ultimo_barb_global <> p_colaborador_id)::int AS perdidos_para_outro
    FROM perdidos_detail
  ),

  -- Fiéis: 3+ visitas exclusivas com este barbeiro
  exclusivos_check AS (
    SELECT cliente_id, COUNT(DISTINCT colaborador_id) AS n_barbs
    FROM vendas
    WHERE cliente_id IN (SELECT cliente_id FROM clientes_barb)
    GROUP BY cliente_id
  ),

  fieis AS (
    SELECT COUNT(*)::int AS total
    FROM clientes_barb cb
    JOIN exclusivos_check ec ON ec.cliente_id = cb.cliente_id
    WHERE ec.n_barbs = 1 AND cb.atendimentos >= 3
  ),

  -- Novos no período (first_seen dentro do período)
  novos_periodo AS (
    SELECT COUNT(DISTINCT cb.cliente_id)::int AS total
    FROM clientes_barb cb
    JOIN dimensao_clientes dc ON dc.cliente_id = cb.cliente_id
    WHERE dc.first_seen BETWEEN v_inicio AND v_fim
  ),

  -- Retenção 30d dos novos captados por este barbeiro
  novos_ret AS (
    SELECT
      cb.cliente_id,
      dc.first_seen,
      CASE WHEN EXISTS (
        SELECT 1 FROM vendas v2
        WHERE v2.cliente_id = cb.cliente_id
          AND v2.venda_dia > dc.first_seen
          AND v2.venda_dia <= dc.first_seen + 30
      ) THEN 1 ELSE 0 END AS retornou_30d
    FROM clientes_barb cb
    JOIN dimensao_clientes dc ON dc.cliente_id = cb.cliente_id
    WHERE dc.first_seen BETWEEN v_inicio AND v_fim
  ),

  ret_30d_agg AS (
    SELECT
      CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(retornou_30d)::numeric / COUNT(*) * 100, 1) ELSE 0 END AS retencao_30d
    FROM novos_ret
  ),

  -- Evolução mensal
  evolucao AS (
    SELECT
      to_char(venda_dia, 'YYYY-MM') AS ano_mes,
      COUNT(DISTINCT cliente_id)::int AS clientes_unicos,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM dimensao_clientes dc2
          WHERE dc2.cliente_id = vendas_barb.cliente_id
            AND dc2.first_seen >= date_trunc('month', vendas_barb.venda_dia)::date
            AND dc2.first_seen < (date_trunc('month', vendas_barb.venda_dia) + interval '1 month')::date
        ) THEN vendas_barb.cliente_id END
      )::int AS novos,
      COUNT(*)::int AS atendimentos,
      ROUND(COALESCE(SUM(valor_faturamento), 0), 2)::numeric AS valor
    FROM vendas_barb
    GROUP BY to_char(venda_dia, 'YYYY-MM')
    ORDER BY ano_mes
  ),

  -- Frequência distribuição
  freq_dist AS (
    SELECT
      CASE
        WHEN atendimentos = 1 THEN '1 vez'
        WHEN atendimentos = 2 THEN '2x'
        WHEN atendimentos BETWEEN 3 AND 4 THEN '3-4x'
        WHEN atendimentos BETWEEN 5 AND 9 THEN '5-9x'
        ELSE '10+'
      END AS faixa,
      CASE
        WHEN atendimentos = 1 THEN 1
        WHEN atendimentos = 2 THEN 2
        WHEN atendimentos BETWEEN 3 AND 4 THEN 3
        WHEN atendimentos BETWEEN 5 AND 9 THEN 4
        ELSE 5
      END AS ordem,
      COUNT(*)::int AS count
    FROM clientes_barb
    GROUP BY 1, 2
    ORDER BY ordem
  ),

  -- Top 10 clientes por valor
  top_clientes AS (
    SELECT
      sc.cliente_id,
      sc.cliente_nome,
      sc.telefone,
      sc.atendimentos AS visitas,
      ROUND(sc.valor_total, 2)::numeric AS valor,
      sc.ultima_visita::text AS ultima_visita,
      sc.dias_sem_vir,
      sc.status_cliente AS status
    FROM status_calc sc
    ORDER BY sc.valor_total DESC
    LIMIT 10
  ),

  -- KPIs
  kpis AS (
    SELECT
      COUNT(*)::int AS total_clientes,
      ROUND(COALESCE(AVG(valor_total), 0), 2)::numeric AS valor_medio_cliente
    FROM clientes_barb
  )

  SELECT jsonb_build_object(
    'total_clientes', k.total_clientes,
    'valor_medio_cliente', k.valor_medio_cliente,
    'fieis', f.total,
    'novos_no_periodo', np.total,
    'retencao_30d', r.retencao_30d,
    'status_distribuicao', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', sd.status, 'count', sd.count)) FROM status_dist sd), '[]'::jsonb),
    'perdidos_barbearia', pa.perdidos_barbearia,
    'perdidos_para_outro', pa.perdidos_para_outro,
    'evolucao_mensal', COALESCE((SELECT jsonb_agg(jsonb_build_object('ano_mes', e.ano_mes, 'clientes_unicos', e.clientes_unicos, 'novos', e.novos, 'atendimentos', e.atendimentos, 'valor', e.valor) ORDER BY e.ano_mes) FROM evolucao e), '[]'::jsonb),
    'frequencia_dist', COALESCE((SELECT jsonb_agg(jsonb_build_object('faixa', fd.faixa, 'count', fd.count) ORDER BY fd.ordem) FROM freq_dist fd), '[]'::jsonb),
    'top_clientes_valor', COALESCE((SELECT jsonb_agg(jsonb_build_object('cliente_id', tc.cliente_id, 'cliente_nome', tc.cliente_nome, 'telefone', tc.telefone, 'visitas', tc.visitas, 'valor', tc.valor, 'ultima_visita', tc.ultima_visita, 'dias_sem_vir', tc.dias_sem_vir, 'status', tc.status)) FROM top_clientes tc), '[]'::jsonb)
  )
  INTO v_result
  FROM kpis k, fieis f, novos_periodo np, ret_30d_agg r, perdidos_agg pa;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

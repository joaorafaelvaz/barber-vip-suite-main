
CREATE OR REPLACE FUNCTION public.rpc_servicos_analise(
  p_data_inicio date,
  p_data_fim date,
  p_colaborador_id text DEFAULT NULL,
  p_tipo_servico text DEFAULT NULL,
  p_agrupamento text DEFAULT 'servico'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
  v_kpis JSON;
  v_items JSON;
  v_colaboradores JSON;
BEGIN
  IF p_agrupamento NOT IN ('servico', 'barbeiro', 'mes') THEN
    RAISE EXCEPTION 'Agrupamento inválido. Use: servico, barbeiro ou mes';
  END IF;

  -- KPIs (using vw_vendas_kpi_base with standard filters)
  SELECT json_build_object(
    'faturamento_total', COALESCE(SUM(v.valor_faturamento), 0),
    'quantidade_total', COUNT(*),
    'ticket_medio', CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(v.valor_faturamento), 0) / COUNT(*) ELSE 0 END,
    'top_servicos', (
      SELECT json_agg(
        json_build_object('nome', sub.produto, 'faturamento', sub.total_faturamento)
        ORDER BY sub.total_faturamento DESC
      )
      FROM (
        SELECT v2.produto, SUM(v2.valor_faturamento) AS total_faturamento
        FROM vw_vendas_kpi_base v2
        WHERE v2.venda_dia BETWEEN p_data_inicio AND p_data_fim
          AND v2.produto IS NOT NULL AND v2.produto != ''
          AND v2.is_credito = false
          AND v2.cliente_nome NOT ILIKE '%sem cadastro%'
          AND (p_colaborador_id IS NULL OR v2.colaborador_id = p_colaborador_id)
          AND (
            p_tipo_servico IS NULL
            OR (p_tipo_servico = 'Base'     AND v2.grupo_de_produto = 'Serviço Base')
            OR (p_tipo_servico = 'Extra'    AND v2.grupo_de_produto = 'Serviço Extra')
            OR (p_tipo_servico = 'Produtos' AND v2.servicos_ou_produtos = 'Produtos VIP')
          )
        GROUP BY v2.produto
        ORDER BY total_faturamento DESC
        LIMIT 3
      ) sub
    )
  ) INTO v_kpis
  FROM vw_vendas_kpi_base v
  WHERE v.venda_dia BETWEEN p_data_inicio AND p_data_fim
    AND v.produto IS NOT NULL AND v.produto != ''
    AND v.is_credito = false
    AND v.cliente_nome NOT ILIKE '%sem cadastro%'
    AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
    AND (
      p_tipo_servico IS NULL
      OR (p_tipo_servico = 'Base'     AND v.grupo_de_produto = 'Serviço Base')
      OR (p_tipo_servico = 'Extra'    AND v.grupo_de_produto = 'Serviço Extra')
      OR (p_tipo_servico = 'Produtos' AND v.servicos_ou_produtos = 'Produtos VIP')
    );

  -- Items by agrupamento
  IF p_agrupamento = 'servico' THEN
    SELECT json_agg(
      json_build_object(
        'nome',            produto,
        'categoria',       COALESCE(grupo_de_produto, servicos_ou_produtos, 'N/A'),
        'grupo_de_produto',grupo_de_produto,
        'faturamento',     total_faturamento,
        'quantidade',      quantidade,
        'ticket_medio',    ticket_medio,
        'participacao_pct',participacao_pct
      ) ORDER BY total_faturamento DESC
    ) INTO v_items
    FROM (
      SELECT
        v.produto,
        v.servicos_ou_produtos,
        v.grupo_de_produto,
        SUM(v.valor_faturamento)                                                   AS total_faturamento,
        COUNT(*)                                                                   AS quantidade,
        SUM(v.valor_faturamento) / COUNT(*)                                        AS ticket_medio,
        (SUM(v.valor_faturamento) * 100.0 / NULLIF(SUM(SUM(v.valor_faturamento)) OVER (), 0)) AS participacao_pct
      FROM vw_vendas_kpi_base v
      WHERE v.venda_dia BETWEEN p_data_inicio AND p_data_fim
        AND v.produto IS NOT NULL AND v.produto != ''
        AND v.is_credito = false
        AND v.cliente_nome NOT ILIKE '%sem cadastro%'
        AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
        AND (
          p_tipo_servico IS NULL
          OR (p_tipo_servico = 'Base'     AND v.grupo_de_produto = 'Serviço Base')
          OR (p_tipo_servico = 'Extra'    AND v.grupo_de_produto = 'Serviço Extra')
          OR (p_tipo_servico = 'Produtos' AND v.servicos_ou_produtos = 'Produtos VIP')
        )
      GROUP BY v.produto, v.servicos_ou_produtos, v.grupo_de_produto
      ORDER BY total_faturamento DESC
    ) grouped_data;

  ELSIF p_agrupamento = 'barbeiro' THEN
    SELECT json_agg(
      json_build_object(
        'nome',             colaborador_nome,
        'colaborador_nome', colaborador_nome,
        'categoria',        'Barbeiro',
        'grupo_de_produto', NULL,
        'faturamento',      total_faturamento,
        'quantidade',       quantidade,
        'ticket_medio',     ticket_medio,
        'participacao_pct', participacao_pct
      ) ORDER BY total_faturamento DESC
    ) INTO v_items
    FROM (
      SELECT
        COALESCE(v.colaborador_nome, 'N/A')                                        AS colaborador_nome,
        SUM(v.valor_faturamento)                                                   AS total_faturamento,
        COUNT(*)                                                                   AS quantidade,
        SUM(v.valor_faturamento) / COUNT(*)                                        AS ticket_medio,
        (SUM(v.valor_faturamento) * 100.0 / NULLIF(SUM(SUM(v.valor_faturamento)) OVER (), 0)) AS participacao_pct
      FROM vw_vendas_kpi_base v
      WHERE v.venda_dia BETWEEN p_data_inicio AND p_data_fim
        AND v.produto IS NOT NULL AND v.produto != ''
        AND v.is_credito = false
        AND v.cliente_nome NOT ILIKE '%sem cadastro%'
        AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
        AND (
          p_tipo_servico IS NULL
          OR (p_tipo_servico = 'Base'     AND v.grupo_de_produto = 'Serviço Base')
          OR (p_tipo_servico = 'Extra'    AND v.grupo_de_produto = 'Serviço Extra')
          OR (p_tipo_servico = 'Produtos' AND v.servicos_ou_produtos = 'Produtos VIP')
        )
      GROUP BY v.colaborador_nome
      ORDER BY total_faturamento DESC
    ) grouped_data;

  ELSIF p_agrupamento = 'mes' THEN
    SELECT json_agg(
      json_build_object(
        'nome',             mes_ano,
        'mes_ano',          mes_ano,
        'categoria',        'Mês',
        'grupo_de_produto', NULL,
        'faturamento',      total_faturamento,
        'quantidade',       quantidade,
        'ticket_medio',     ticket_medio,
        'participacao_pct', participacao_pct
      ) ORDER BY mes_order ASC
    ) INTO v_items
    FROM (
      SELECT
        TO_CHAR(DATE_TRUNC('month', v.venda_dia), 'Mon/YY')                        AS mes_ano,
        DATE_TRUNC('month', v.venda_dia)                                           AS mes_order,
        SUM(v.valor_faturamento)                                                   AS total_faturamento,
        COUNT(*)                                                                   AS quantidade,
        SUM(v.valor_faturamento) / COUNT(*)                                        AS ticket_medio,
        (SUM(v.valor_faturamento) * 100.0 / NULLIF(SUM(SUM(v.valor_faturamento)) OVER (), 0)) AS participacao_pct
      FROM vw_vendas_kpi_base v
      WHERE v.venda_dia BETWEEN p_data_inicio AND p_data_fim
        AND v.produto IS NOT NULL AND v.produto != ''
        AND v.is_credito = false
        AND v.cliente_nome NOT ILIKE '%sem cadastro%'
        AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
        AND (
          p_tipo_servico IS NULL
          OR (p_tipo_servico = 'Base'     AND v.grupo_de_produto = 'Serviço Base')
          OR (p_tipo_servico = 'Extra'    AND v.grupo_de_produto = 'Serviço Extra')
          OR (p_tipo_servico = 'Produtos' AND v.servicos_ou_produtos = 'Produtos VIP')
        )
      GROUP BY DATE_TRUNC('month', v.venda_dia)
      ORDER BY mes_order ASC
    ) grouped_data;
  END IF;

  -- Active colaboradores in period
  SELECT json_agg(
    json_build_object('colaborador_id', dc.colaborador_id, 'colaborador_nome', dc.colaborador_nome)
    ORDER BY dc.colaborador_nome ASC
  ) INTO v_colaboradores
  FROM dimensao_colaboradores dc
  WHERE dc.ativo = true
    AND dc.tipo_colaborador = 'barbeiro'
    AND EXISTS (
      SELECT 1 FROM vw_vendas_kpi_base v
      WHERE v.colaborador_id = dc.colaborador_id
        AND v.venda_dia BETWEEN p_data_inicio AND p_data_fim
        AND v.is_credito = false
    );

  v_result := json_build_object(
    'periodo',               json_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
    'filtros',               json_build_object('colaborador_id', p_colaborador_id, 'tipo_servico', p_tipo_servico, 'agrupamento', p_agrupamento),
    'kpis',                  v_kpis,
    'items',                 COALESCE(v_items, '[]'::json),
    'colaboradores_periodo', COALESCE(v_colaboradores, '[]'::json)
  );

  RETURN v_result;
END;
$function$;

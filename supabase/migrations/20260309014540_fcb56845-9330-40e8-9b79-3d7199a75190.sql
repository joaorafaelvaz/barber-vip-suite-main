CREATE OR REPLACE FUNCTION public.rpc_servicos_analise(
  p_data_inicio date,
  p_data_fim date,
  p_colaborador_id text DEFAULT NULL::text,
  p_tipo_servico text DEFAULT NULL::text,
  p_agrupamento text DEFAULT 'servico'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_kpis JSON;
  v_items JSON;
  v_colaboradores JSON;
BEGIN
  IF p_agrupamento NOT IN ('servico', 'barbeiro', 'mes') THEN
    RAISE EXCEPTION 'Agrupamento inválido. Use: servico, barbeiro ou mes';
  END IF;

  -- Helper macro: maps p_tipo_servico frontend values to DB filters
  -- 'Base'     -> grupo_de_produto = 'Serviço Base'
  -- 'Extra'    -> grupo_de_produto = 'Serviço Extra'
  -- 'Produtos' -> servicos_ou_produtos = 'Produtos VIP'

  -- KPIs
  SELECT json_build_object(
    'faturamento_total', COALESCE(SUM(v.valor_bruto), 0),
    'quantidade_total', COUNT(*),
    'ticket_medio', CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(v.valor_bruto), 0) / COUNT(*) ELSE 0 END,
    'top_servicos', (
      SELECT json_agg(
        json_build_object('nome', sub.produto, 'faturamento', sub.total_faturamento)
        ORDER BY sub.total_faturamento DESC
      )
      FROM (
        SELECT v2.produto, SUM(v2.valor_bruto) AS total_faturamento
        FROM vendas_api_raw v2
        LEFT JOIN dimensao_produtos dp2 ON v2.produto = dp2.produto
        WHERE v2.venda_data_ts::date BETWEEN p_data_inicio AND p_data_fim
          AND v2.produto IS NOT NULL AND v2.produto != ''
          AND (p_colaborador_id IS NULL OR v2.colaborador_id = p_colaborador_id)
          AND (
            p_tipo_servico IS NULL
            OR (p_tipo_servico = 'Base'     AND dp2.grupo_de_produto = 'Serviço Base')
            OR (p_tipo_servico = 'Extra'    AND dp2.grupo_de_produto = 'Serviço Extra')
            OR (p_tipo_servico = 'Produtos' AND dp2.servicos_ou_produtos = 'Produtos VIP')
          )
        GROUP BY v2.produto
        ORDER BY total_faturamento DESC
        LIMIT 3
      ) sub
    )
  ) INTO v_kpis
  FROM vendas_api_raw v
  LEFT JOIN dimensao_produtos dp ON v.produto = dp.produto
  WHERE v.venda_data_ts::date BETWEEN p_data_inicio AND p_data_fim
    AND v.produto IS NOT NULL AND v.produto != ''
    AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
    AND (
      p_tipo_servico IS NULL
      OR (p_tipo_servico = 'Base'     AND dp.grupo_de_produto = 'Serviço Base')
      OR (p_tipo_servico = 'Extra'    AND dp.grupo_de_produto = 'Serviço Extra')
      OR (p_tipo_servico = 'Produtos' AND dp.servicos_ou_produtos = 'Produtos VIP')
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
        dp.servicos_ou_produtos,
        dp.grupo_de_produto,
        SUM(v.valor_bruto)                                                         AS total_faturamento,
        COUNT(*)                                                                   AS quantidade,
        SUM(v.valor_bruto) / COUNT(*)                                              AS ticket_medio,
        (SUM(v.valor_bruto) * 100.0 / SUM(SUM(v.valor_bruto)) OVER ())           AS participacao_pct
      FROM vendas_api_raw v
      LEFT JOIN dimensao_produtos dp ON v.produto = dp.produto
      WHERE v.venda_data_ts::date BETWEEN p_data_inicio AND p_data_fim
        AND v.produto IS NOT NULL AND v.produto != ''
        AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
        AND (
          p_tipo_servico IS NULL
          OR (p_tipo_servico = 'Base'     AND dp.grupo_de_produto = 'Serviço Base')
          OR (p_tipo_servico = 'Extra'    AND dp.grupo_de_produto = 'Serviço Extra')
          OR (p_tipo_servico = 'Produtos' AND dp.servicos_ou_produtos = 'Produtos VIP')
        )
      GROUP BY v.produto, dp.servicos_ou_produtos, dp.grupo_de_produto
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
        SUM(v.valor_bruto)                                                         AS total_faturamento,
        COUNT(*)                                                                   AS quantidade,
        SUM(v.valor_bruto) / COUNT(*)                                              AS ticket_medio,
        (SUM(v.valor_bruto) * 100.0 / SUM(SUM(v.valor_bruto)) OVER ())           AS participacao_pct
      FROM vendas_api_raw v
      LEFT JOIN dimensao_produtos dp ON v.produto = dp.produto
      WHERE v.venda_data_ts::date BETWEEN p_data_inicio AND p_data_fim
        AND v.produto IS NOT NULL AND v.produto != ''
        AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
        AND (
          p_tipo_servico IS NULL
          OR (p_tipo_servico = 'Base'     AND dp.grupo_de_produto = 'Serviço Base')
          OR (p_tipo_servico = 'Extra'    AND dp.grupo_de_produto = 'Serviço Extra')
          OR (p_tipo_servico = 'Produtos' AND dp.servicos_ou_produtos = 'Produtos VIP')
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
        TO_CHAR(DATE_TRUNC('month', v.venda_data_ts::date), 'Mon/YY')              AS mes_ano,
        DATE_TRUNC('month', v.venda_data_ts::date)                                 AS mes_order,
        SUM(v.valor_bruto)                                                         AS total_faturamento,
        COUNT(*)                                                                   AS quantidade,
        SUM(v.valor_bruto) / COUNT(*)                                              AS ticket_medio,
        (SUM(v.valor_bruto) * 100.0 / SUM(SUM(v.valor_bruto)) OVER ())           AS participacao_pct
      FROM vendas_api_raw v
      LEFT JOIN dimensao_produtos dp ON v.produto = dp.produto
      WHERE v.venda_data_ts::date BETWEEN p_data_inicio AND p_data_fim
        AND v.produto IS NOT NULL AND v.produto != ''
        AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
        AND (
          p_tipo_servico IS NULL
          OR (p_tipo_servico = 'Base'     AND dp.grupo_de_produto = 'Serviço Base')
          OR (p_tipo_servico = 'Extra'    AND dp.grupo_de_produto = 'Serviço Extra')
          OR (p_tipo_servico = 'Produtos' AND dp.servicos_ou_produtos = 'Produtos VIP')
        )
      GROUP BY DATE_TRUNC('month', v.venda_data_ts::date)
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
      SELECT 1 FROM vendas_api_raw v
      WHERE v.colaborador_id = dc.colaborador_id
        AND v.venda_data_ts::date BETWEEN p_data_inicio AND p_data_fim
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
$$;
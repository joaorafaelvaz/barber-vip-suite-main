DROP FUNCTION IF EXISTS rpc_servicos_analise(DATE, DATE, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION rpc_servicos_analise(
  p_data_inicio DATE,
  p_data_fim DATE,
  p_colaborador_id TEXT DEFAULT NULL,
  p_tipo_servico TEXT DEFAULT NULL,
  p_agrupamento TEXT DEFAULT 'servico'
)
RETURNS JSON
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

  -- Get KPIs (fixed: qualify all column refs with v. to avoid ambiguity with dp)
  SELECT json_build_object(
    'faturamento_total', COALESCE(SUM(v.valor_bruto), 0),
    'quantidade_total', COUNT(*),
    'ticket_medio', CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(v.valor_bruto), 0) / COUNT(*) ELSE 0 END,
    'top_servicos', (
      SELECT json_agg(
        json_build_object(
          'nome', sub.produto,
          'faturamento', sub.total_faturamento
        ) ORDER BY sub.total_faturamento DESC
      )
      FROM (
        SELECT
          v2.produto,
          SUM(v2.valor_bruto) as total_faturamento
        FROM vendas_api_raw v2
        LEFT JOIN dimensao_produtos dp2 ON v2.produto = dp2.produto
        WHERE v2.venda_data_ts::date BETWEEN p_data_inicio AND p_data_fim
          AND v2.produto IS NOT NULL AND v2.produto != ''
          AND (p_colaborador_id IS NULL OR v2.colaborador_id = p_colaborador_id)
          AND (p_tipo_servico IS NULL OR dp2.servicos_ou_produtos = p_tipo_servico)
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
    AND (p_tipo_servico IS NULL OR dp.servicos_ou_produtos = p_tipo_servico);

  -- Get items based on agrupamento
  IF p_agrupamento = 'servico' THEN
    SELECT json_agg(
      json_build_object(
        'nome', produto,
        'categoria', COALESCE(servicos_ou_produtos, 'N/A'),
        'faturamento', total_faturamento,
        'quantidade', quantidade,
        'ticket_medio', ticket_medio,
        'participacao_pct', participacao_pct
      ) ORDER BY total_faturamento DESC
    ) INTO v_items
    FROM (
      SELECT
        v.produto,
        dp.servicos_ou_produtos,
        SUM(v.valor_bruto) as total_faturamento,
        COUNT(*) as quantidade,
        SUM(v.valor_bruto) / COUNT(*) as ticket_medio,
        (SUM(v.valor_bruto) * 100.0 / SUM(SUM(v.valor_bruto)) OVER ()) as participacao_pct
      FROM vendas_api_raw v
      LEFT JOIN dimensao_produtos dp ON v.produto = dp.produto
      WHERE v.venda_data_ts::date BETWEEN p_data_inicio AND p_data_fim
        AND v.produto IS NOT NULL AND v.produto != ''
        AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
        AND (p_tipo_servico IS NULL OR dp.servicos_ou_produtos = p_tipo_servico)
      GROUP BY v.produto, dp.servicos_ou_produtos
      ORDER BY total_faturamento DESC
    ) grouped_data;

  ELSIF p_agrupamento = 'barbeiro' THEN
    SELECT json_agg(
      json_build_object(
        'nome', colaborador_nome,
        'colaborador_nome', colaborador_nome,
        'categoria', 'Barbeiro',
        'faturamento', total_faturamento,
        'quantidade', quantidade,
        'ticket_medio', ticket_medio,
        'participacao_pct', participacao_pct
      ) ORDER BY total_faturamento DESC
    ) INTO v_items
    FROM (
      SELECT
        COALESCE(v.colaborador_nome, 'N/A') as colaborador_nome,
        SUM(v.valor_bruto) as total_faturamento,
        COUNT(*) as quantidade,
        SUM(v.valor_bruto) / COUNT(*) as ticket_medio,
        (SUM(v.valor_bruto) * 100.0 / SUM(SUM(v.valor_bruto)) OVER ()) as participacao_pct
      FROM vendas_api_raw v
      LEFT JOIN dimensao_produtos dp ON v.produto = dp.produto
      WHERE v.venda_data_ts::date BETWEEN p_data_inicio AND p_data_fim
        AND v.produto IS NOT NULL AND v.produto != ''
        AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
        AND (p_tipo_servico IS NULL OR dp.servicos_ou_produtos = p_tipo_servico)
      GROUP BY v.colaborador_nome
      ORDER BY total_faturamento DESC
    ) grouped_data;

  ELSIF p_agrupamento = 'mes' THEN
    SELECT json_agg(
      json_build_object(
        'nome', mes_ano,
        'mes_ano', mes_ano,
        'categoria', 'Período',
        'faturamento', total_faturamento,
        'quantidade', quantidade,
        'ticket_medio', ticket_medio,
        'participacao_pct', participacao_pct
      ) ORDER BY mes_ano
    ) INTO v_items
    FROM (
      SELECT
        TO_CHAR(v.venda_data_ts, 'MM/YYYY') as mes_ano,
        SUM(v.valor_bruto) as total_faturamento,
        COUNT(*) as quantidade,
        SUM(v.valor_bruto) / COUNT(*) as ticket_medio,
        (SUM(v.valor_bruto) * 100.0 / SUM(SUM(v.valor_bruto)) OVER ()) as participacao_pct
      FROM vendas_api_raw v
      LEFT JOIN dimensao_produtos dp ON v.produto = dp.produto
      WHERE v.venda_data_ts::date BETWEEN p_data_inicio AND p_data_fim
        AND v.produto IS NOT NULL AND v.produto != ''
        AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
        AND (p_tipo_servico IS NULL OR dp.servicos_ou_produtos = p_tipo_servico)
      GROUP BY TO_CHAR(v.venda_data_ts, 'MM/YYYY')
      ORDER BY TO_CHAR(v.venda_data_ts, 'MM/YYYY')
    ) grouped_data;
  END IF;

  -- Get colaboradores who worked in the period
  SELECT json_agg(
    json_build_object(
      'colaborador_id', colaborador_id,
      'colaborador_nome', colaborador_nome
    )
  ) INTO v_colaboradores
  FROM (
    SELECT DISTINCT
      v.colaborador_id,
      v.colaborador_nome
    FROM vendas_api_raw v
    WHERE v.venda_data_ts::date BETWEEN p_data_inicio AND p_data_fim
      AND v.colaborador_id IS NOT NULL
      AND v.produto IS NOT NULL AND v.produto != ''
    ORDER BY v.colaborador_nome
  ) period_colaboradores;

  -- Build final result
  SELECT json_build_object(
    'periodo', json_build_object(
      'inicio', p_data_inicio::text,
      'fim', p_data_fim::text
    ),
    'filtros', json_build_object(
      'colaborador_id', p_colaborador_id,
      'tipo_servico', p_tipo_servico,
      'agrupamento', p_agrupamento
    ),
    'kpis', v_kpis,
    'items', COALESCE(v_items, '[]'::json),
    'colaboradores_periodo', COALESCE(v_colaboradores, '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
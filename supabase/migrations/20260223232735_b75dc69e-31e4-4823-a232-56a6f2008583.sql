
CREATE OR REPLACE FUNCTION public.rpc_faturamento_comparacoes(
  p_inicio date,
  p_fim date,
  p_colaborador_id text DEFAULT NULL,
  p_grupo_de_produto text DEFAULT NULL,
  p_servicos_ou_produtos text DEFAULT NULL,
  p_forma_pagamento text DEFAULT NULL,
  p_produto text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_interval_days integer;
  v_sply_inicio date;
  v_sply_fim date;
  v_mom_inicio date;
  v_mom_fim date;
  v_atual numeric;
  v_sply numeric;
  v_mom numeric;
  v_avg_6m numeric;
  v_avg_12m numeric;
  v_6m_fim date;
  v_6m_inicio date;
  v_12m_fim date;
  v_12m_inicio date;
BEGIN
  -- Período atual
  SELECT COALESCE(SUM(valor_faturamento), 0)
  INTO v_atual
  FROM vw_vendas_kpi_base
  WHERE venda_dia::date BETWEEN p_inicio AND p_fim
    AND produto IS NOT NULL AND produto <> ''
    AND is_credito = false
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_grupo_de_produto IS NULL OR grupo_de_produto = p_grupo_de_produto)
    AND (p_servicos_ou_produtos IS NULL OR servicos_ou_produtos = p_servicos_ou_produtos)
    AND (p_forma_pagamento IS NULL OR forma_pagamento = p_forma_pagamento)
    AND (p_produto IS NULL OR produto = p_produto);

  -- SPLY
  v_sply_inicio := p_inicio - INTERVAL '1 year';
  v_sply_fim := p_fim - INTERVAL '1 year';

  SELECT COALESCE(SUM(valor_faturamento), 0)
  INTO v_sply
  FROM vw_vendas_kpi_base
  WHERE venda_dia::date BETWEEN v_sply_inicio AND v_sply_fim
    AND produto IS NOT NULL AND produto <> ''
    AND is_credito = false
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_grupo_de_produto IS NULL OR grupo_de_produto = p_grupo_de_produto)
    AND (p_servicos_ou_produtos IS NULL OR servicos_ou_produtos = p_servicos_ou_produtos)
    AND (p_forma_pagamento IS NULL OR forma_pagamento = p_forma_pagamento)
    AND (p_produto IS NULL OR produto = p_produto);

  -- MoM
  v_interval_days := p_fim - p_inicio;
  v_mom_fim := p_inicio - 1;
  v_mom_inicio := v_mom_fim - v_interval_days;

  SELECT COALESCE(SUM(valor_faturamento), 0)
  INTO v_mom
  FROM vw_vendas_kpi_base
  WHERE venda_dia::date BETWEEN v_mom_inicio AND v_mom_fim
    AND produto IS NOT NULL AND produto <> ''
    AND is_credito = false
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_grupo_de_produto IS NULL OR grupo_de_produto = p_grupo_de_produto)
    AND (p_servicos_ou_produtos IS NULL OR servicos_ou_produtos = p_servicos_ou_produtos)
    AND (p_forma_pagamento IS NULL OR forma_pagamento = p_forma_pagamento)
    AND (p_produto IS NULL OR produto = p_produto);

  -- Média 6 meses (6 meses completos antes do p_inicio)
  v_6m_fim := (date_trunc('month', p_inicio) - INTERVAL '1 day')::date;
  v_6m_inicio := (date_trunc('month', p_inicio) - INTERVAL '6 months')::date;

  SELECT COALESCE(SUM(valor_faturamento), 0) / GREATEST(
    EXTRACT(MONTH FROM age(v_6m_fim + 1, v_6m_inicio))::numeric, 1
  )
  INTO v_avg_6m
  FROM vw_vendas_kpi_base
  WHERE venda_dia::date BETWEEN v_6m_inicio AND v_6m_fim
    AND produto IS NOT NULL AND produto <> ''
    AND is_credito = false
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_grupo_de_produto IS NULL OR grupo_de_produto = p_grupo_de_produto)
    AND (p_servicos_ou_produtos IS NULL OR servicos_ou_produtos = p_servicos_ou_produtos)
    AND (p_forma_pagamento IS NULL OR forma_pagamento = p_forma_pagamento)
    AND (p_produto IS NULL OR produto = p_produto);

  -- Média 12 meses (12 meses completos antes do p_inicio)
  v_12m_fim := v_6m_fim;
  v_12m_inicio := (date_trunc('month', p_inicio) - INTERVAL '12 months')::date;

  SELECT COALESCE(SUM(valor_faturamento), 0) / GREATEST(
    EXTRACT(MONTH FROM age(v_12m_fim + 1, v_12m_inicio))::numeric, 1
  )
  INTO v_avg_12m
  FROM vw_vendas_kpi_base
  WHERE venda_dia::date BETWEEN v_12m_inicio AND v_12m_fim
    AND produto IS NOT NULL AND produto <> ''
    AND is_credito = false
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_grupo_de_produto IS NULL OR grupo_de_produto = p_grupo_de_produto)
    AND (p_servicos_ou_produtos IS NULL OR servicos_ou_produtos = p_servicos_ou_produtos)
    AND (p_forma_pagamento IS NULL OR forma_pagamento = p_forma_pagamento)
    AND (p_produto IS NULL OR produto = p_produto);

  RETURN jsonb_build_object(
    'atual', ROUND(v_atual::numeric, 2),
    'sply_total', ROUND(v_sply::numeric, 2),
    'sply_var_pct', CASE WHEN v_sply > 0 THEN ROUND(((v_atual - v_sply) / v_sply * 100)::numeric, 1) ELSE NULL END,
    'sply_periodo', jsonb_build_object('inicio', v_sply_inicio::text, 'fim', v_sply_fim::text),
    'mom_total', ROUND(v_mom::numeric, 2),
    'mom_var_pct', CASE WHEN v_mom > 0 THEN ROUND(((v_atual - v_mom) / v_mom * 100)::numeric, 1) ELSE NULL END,
    'mom_periodo', jsonb_build_object('inicio', v_mom_inicio::text, 'fim', v_mom_fim::text),
    'avg_6m', ROUND(v_avg_6m::numeric, 2),
    'avg_6m_periodo', jsonb_build_object('inicio', v_6m_inicio::text, 'fim', v_6m_fim::text),
    'avg_12m', ROUND(v_avg_12m::numeric, 2),
    'avg_12m_periodo', jsonb_build_object('inicio', v_12m_inicio::text, 'fim', v_12m_fim::text)
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.rpc_faturamento_comparacoes(
  p_inicio text,
  p_fim text,
  p_colaborador_id text DEFAULT NULL,
  p_forma_pagamento text DEFAULT NULL,
  p_grupo_de_produto text DEFAULT NULL,
  p_servicos_ou_produtos text DEFAULT NULL,
  p_produto text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio date := p_inicio::date;
  v_fim date := p_fim::date;
  v_dias int;
  v_sply_inicio date;
  v_sply_fim date;
  v_sply_dias int;
  v_mom_inicio date;
  v_mom_fim date;
  v_mom_dias int;
  v_avg6_inicio date;
  v_avg6_fim date;
  v_avg12_inicio date;
  v_avg12_fim date;
  v_avg6_meses int;
  v_avg12_meses int;
  v_atual numeric := 0;
  v_atual_base numeric := 0;
  v_atual_extras numeric := 0;
  v_atual_produtos numeric := 0;
  v_sply numeric := 0;
  v_sply_base numeric := 0;
  v_sply_extras numeric := 0;
  v_sply_produtos numeric := 0;
  v_mom numeric := 0;
  v_mom_base numeric := 0;
  v_mom_extras numeric := 0;
  v_mom_produtos numeric := 0;
  v_avg6 numeric := 0;
  v_avg6_base numeric := 0;
  v_avg6_extras numeric := 0;
  v_avg6_produtos numeric := 0;
  v_avg12 numeric := 0;
  v_avg12_base numeric := 0;
  v_avg12_extras numeric := 0;
  v_avg12_produtos numeric := 0;
  v_sply_var numeric;
  v_mom_var numeric;
BEGIN
  v_dias := (v_fim - v_inicio) + 1;

  -- SPLY: same dates, previous year
  v_sply_inicio := (v_inicio - interval '1 year')::date;
  v_sply_fim := (v_fim - interval '1 year')::date;
  v_sply_dias := (v_sply_fim - v_sply_inicio) + 1;

  -- MoM: same dates, previous month
  v_mom_inicio := (v_inicio - interval '1 month')::date;
  v_mom_fim := (v_fim - interval '1 month')::date;
  v_mom_dias := (v_mom_fim - v_mom_inicio) + 1;

  -- Avg 6m / 12m
  v_avg6_fim := (date_trunc('month', v_inicio) - interval '1 day')::date;
  v_avg6_inicio := (date_trunc('month', v_inicio) - interval '6 months')::date;
  v_avg12_fim := v_avg6_fim;
  v_avg12_inicio := (date_trunc('month', v_inicio) - interval '12 months')::date;

  -- Calculate exact number of months for divisors
  v_avg6_meses := GREATEST(
    (EXTRACT(YEAR FROM age(v_avg6_fim + 1, v_avg6_inicio)) * 12
     + EXTRACT(MONTH FROM age(v_avg6_fim + 1, v_avg6_inicio)))::int,
    1
  );
  v_avg12_meses := GREATEST(
    (EXTRACT(YEAR FROM age(v_avg12_fim + 1, v_avg12_inicio)) * 12
     + EXTRACT(MONTH FROM age(v_avg12_fim + 1, v_avg12_inicio)))::int,
    1
  );

  -- ATUAL
  SELECT
    COALESCE(SUM(valor_faturamento), 0),
    COALESCE(SUM(CASE WHEN is_base THEN valor_faturamento ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN is_extra THEN valor_faturamento ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN is_produto THEN valor_faturamento ELSE 0 END), 0)
  INTO v_atual, v_atual_base, v_atual_extras, v_atual_produtos
  FROM vw_vendas_kpi_base
  WHERE venda_dia BETWEEN v_inicio AND v_fim
    AND NOT COALESCE(is_credito, false)
    AND produto IS NOT NULL AND produto <> ''
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_forma_pagamento IS NULL OR forma_pagamento = p_forma_pagamento)
    AND (p_grupo_de_produto IS NULL OR grupo_de_produto = p_grupo_de_produto)
    AND (p_servicos_ou_produtos IS NULL OR servicos_ou_produtos = p_servicos_ou_produtos)
    AND (p_produto IS NULL OR produto = p_produto);

  -- SPLY
  SELECT
    COALESCE(SUM(valor_faturamento), 0),
    COALESCE(SUM(CASE WHEN is_base THEN valor_faturamento ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN is_extra THEN valor_faturamento ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN is_produto THEN valor_faturamento ELSE 0 END), 0)
  INTO v_sply, v_sply_base, v_sply_extras, v_sply_produtos
  FROM vw_vendas_kpi_base
  WHERE venda_dia BETWEEN v_sply_inicio AND v_sply_fim
    AND NOT COALESCE(is_credito, false)
    AND produto IS NOT NULL AND produto <> ''
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_forma_pagamento IS NULL OR forma_pagamento = p_forma_pagamento)
    AND (p_grupo_de_produto IS NULL OR grupo_de_produto = p_grupo_de_produto)
    AND (p_servicos_ou_produtos IS NULL OR servicos_ou_produtos = p_servicos_ou_produtos)
    AND (p_produto IS NULL OR produto = p_produto);

  -- MoM
  SELECT
    COALESCE(SUM(valor_faturamento), 0),
    COALESCE(SUM(CASE WHEN is_base THEN valor_faturamento ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN is_extra THEN valor_faturamento ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN is_produto THEN valor_faturamento ELSE 0 END), 0)
  INTO v_mom, v_mom_base, v_mom_extras, v_mom_produtos
  FROM vw_vendas_kpi_base
  WHERE venda_dia BETWEEN v_mom_inicio AND v_mom_fim
    AND NOT COALESCE(is_credito, false)
    AND produto IS NOT NULL AND produto <> ''
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_forma_pagamento IS NULL OR forma_pagamento = p_forma_pagamento)
    AND (p_grupo_de_produto IS NULL OR grupo_de_produto = p_grupo_de_produto)
    AND (p_servicos_ou_produtos IS NULL OR servicos_ou_produtos = p_servicos_ou_produtos)
    AND (p_produto IS NULL OR produto = p_produto);

  -- Avg 6m (divisor = numero real de meses)
  SELECT
    COALESCE(SUM(valor_faturamento), 0) / v_avg6_meses,
    COALESCE(SUM(CASE WHEN is_base THEN valor_faturamento ELSE 0 END), 0) / v_avg6_meses,
    COALESCE(SUM(CASE WHEN is_extra THEN valor_faturamento ELSE 0 END), 0) / v_avg6_meses,
    COALESCE(SUM(CASE WHEN is_produto THEN valor_faturamento ELSE 0 END), 0) / v_avg6_meses
  INTO v_avg6, v_avg6_base, v_avg6_extras, v_avg6_produtos
  FROM vw_vendas_kpi_base
  WHERE venda_dia BETWEEN v_avg6_inicio AND v_avg6_fim
    AND NOT COALESCE(is_credito, false)
    AND produto IS NOT NULL AND produto <> ''
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_forma_pagamento IS NULL OR forma_pagamento = p_forma_pagamento)
    AND (p_grupo_de_produto IS NULL OR grupo_de_produto = p_grupo_de_produto)
    AND (p_servicos_ou_produtos IS NULL OR servicos_ou_produtos = p_servicos_ou_produtos)
    AND (p_produto IS NULL OR produto = p_produto);

  -- Avg 12m (divisor = numero real de meses)
  SELECT
    COALESCE(SUM(valor_faturamento), 0) / v_avg12_meses,
    COALESCE(SUM(CASE WHEN is_base THEN valor_faturamento ELSE 0 END), 0) / v_avg12_meses,
    COALESCE(SUM(CASE WHEN is_extra THEN valor_faturamento ELSE 0 END), 0) / v_avg12_meses,
    COALESCE(SUM(CASE WHEN is_produto THEN valor_faturamento ELSE 0 END), 0) / v_avg12_meses
  INTO v_avg12, v_avg12_base, v_avg12_extras, v_avg12_produtos
  FROM vw_vendas_kpi_base
  WHERE venda_dia BETWEEN v_avg12_inicio AND v_avg12_fim
    AND NOT COALESCE(is_credito, false)
    AND produto IS NOT NULL AND produto <> ''
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_forma_pagamento IS NULL OR forma_pagamento = p_forma_pagamento)
    AND (p_grupo_de_produto IS NULL OR grupo_de_produto = p_grupo_de_produto)
    AND (p_servicos_ou_produtos IS NULL OR servicos_ou_produtos = p_servicos_ou_produtos)
    AND (p_produto IS NULL OR produto = p_produto);

  -- Variações
  IF v_sply > 0 THEN v_sply_var := ((v_atual - v_sply) / v_sply) * 100; ELSE v_sply_var := NULL; END IF;
  IF v_mom > 0 THEN v_mom_var := ((v_atual - v_mom) / v_mom) * 100; ELSE v_mom_var := NULL; END IF;

  RETURN json_build_object(
    'atual', v_atual,
    'atual_base', v_atual_base,
    'atual_extras', v_atual_extras,
    'atual_produtos', v_atual_produtos,
    'atual_dias', v_dias,
    'sply_total', v_sply,
    'sply_base', v_sply_base,
    'sply_extras', v_sply_extras,
    'sply_produtos', v_sply_produtos,
    'sply_var_pct', v_sply_var,
    'sply_dias', v_sply_dias,
    'sply_periodo', json_build_object('inicio', v_sply_inicio, 'fim', v_sply_fim),
    'mom_total', v_mom,
    'mom_base', v_mom_base,
    'mom_extras', v_mom_extras,
    'mom_produtos', v_mom_produtos,
    'mom_var_pct', v_mom_var,
    'mom_dias', v_mom_dias,
    'mom_periodo', json_build_object('inicio', v_mom_inicio, 'fim', v_mom_fim),
    'avg_6m', v_avg6,
    'avg_6m_base', v_avg6_base,
    'avg_6m_extras', v_avg6_extras,
    'avg_6m_produtos', v_avg6_produtos,
    'avg_6m_periodo', json_build_object('inicio', v_avg6_inicio, 'fim', v_avg6_fim),
    'avg_12m', v_avg12,
    'avg_12m_base', v_avg12_base,
    'avg_12m_extras', v_avg12_extras,
    'avg_12m_produtos', v_avg12_produtos,
    'avg_12m_periodo', json_build_object('inicio', v_avg12_inicio, 'fim', v_avg12_fim)
  );
END;
$function$;

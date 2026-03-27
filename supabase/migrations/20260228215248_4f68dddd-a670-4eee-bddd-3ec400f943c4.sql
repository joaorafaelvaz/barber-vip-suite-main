
-- =============================================================
-- Recria rpc_dashboard_period com detecção de mês fechado
-- para comparações MOM/SPLY mês-contra-mês
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_dashboard_period(
  p_inicio text,
  p_fim text,
  p_colaborador_id text DEFAULT NULL,
  p_tipo_colaborador text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_kpis jsonb;
  v_daily jsonb;
  v_colaboradores jsonb;
  v_by_colaborador jsonb;
  v_comparacoes jsonb;
  v_result jsonb;
  
  -- Variáveis para cálculo de comparações
  v_is_full_year boolean;
  v_is_full_month boolean;
  v_sply_inicio date;
  v_sply_fim date;
  v_mom_inicio date;
  v_mom_fim date;
  v_interval_days integer;
  
  -- KPIs do período atual
  v_faturamento numeric;
  v_atendimentos bigint;
  v_clientes bigint;
  v_clientes_novos bigint;
  v_dias_trabalhados bigint;
  v_faturamento_por_dia numeric;
  
  -- KPIs SPLY
  v_sply_faturamento numeric;
  v_sply_atendimentos bigint;
  v_sply_clientes bigint;
  v_sply_dias_trabalhados bigint;
  v_sply_faturamento_por_dia numeric;
  
  -- KPIs MOM
  v_mom_faturamento numeric;
  v_mom_atendimentos bigint;
  v_mom_clientes bigint;
  v_mom_dias_trabalhados bigint;
  v_mom_faturamento_por_dia numeric;
BEGIN
  -- ===========================================
  -- CALCULAR PERÍODOS DE COMPARAÇÃO
  -- ===========================================
  
  -- Detecta se é ano fechado (01/01 a 31/12)
  v_is_full_year := (
    EXTRACT(MONTH FROM p_inicio::date) = 1 AND EXTRACT(DAY FROM p_inicio::date) = 1 AND
    EXTRACT(MONTH FROM p_fim::date) = 12 AND EXTRACT(DAY FROM p_fim::date) = 31
  );
  
  -- Detecta se é mês fechado (dia 1 até último dia do mês)
  v_is_full_month := (
    EXTRACT(DAY FROM p_inicio::date) = 1
    AND p_fim::date = (date_trunc('month', p_fim::date) + INTERVAL '1 month - 1 day')::date
    AND date_trunc('month', p_inicio::date) = date_trunc('month', p_fim::date)
  );

  IF v_is_full_month THEN
    -- SPLY: mesmo mês do ano anterior (mês completo)
    v_sply_inicio := (date_trunc('month', p_inicio::date) - INTERVAL '1 year')::date;
    v_sply_fim := (v_sply_inicio + INTERVAL '1 month - 1 day')::date;
    
    -- MOM: mês anterior completo
    v_mom_inicio := (date_trunc('month', p_inicio::date) - INTERVAL '1 month')::date;
    v_mom_fim := (p_inicio::date - INTERVAL '1 day')::date;
  ELSE
    -- Lógica atual (dia-a-dia)
    v_sply_inicio := p_inicio::date - INTERVAL '1 year';
    v_sply_fim := p_fim::date - INTERVAL '1 year';
    v_interval_days := p_fim::date - p_inicio::date;
    v_mom_fim := p_inicio::date - INTERVAL '1 day';
    v_mom_inicio := v_mom_fim - v_interval_days;
  END IF;

  -- ===========================================
  -- KPIs AGREGADOS DO PERÍODO ATUAL
  -- ===========================================
  SELECT 
    COALESCE(SUM(valor_faturamento), 0),
    COUNT(DISTINCT venda_id),
    COUNT(DISTINCT cliente_id),
    COUNT(DISTINCT cliente_id) FILTER (WHERE venda_dia::date = (
      SELECT MIN(v2.venda_dia::date) 
      FROM vw_vendas_kpi_base v2 
      WHERE v2.cliente_id = vw_vendas_kpi_base.cliente_id
        AND v2.produto IS NOT NULL AND v2.produto <> ''
    )),
    COUNT(DISTINCT venda_dia::date) FILTER (WHERE valor_faturamento > 0)
  INTO v_faturamento, v_atendimentos, v_clientes, v_clientes_novos, v_dias_trabalhados
  FROM vw_vendas_kpi_base
  WHERE venda_dia::date BETWEEN p_inicio::date AND p_fim::date
    AND produto IS NOT NULL AND produto <> ''
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_tipo_colaborador IS NULL OR tipo_colaborador = p_tipo_colaborador);
  
  -- Calcula faturamento por dia
  v_faturamento_por_dia := CASE 
    WHEN v_dias_trabalhados > 0 THEN ROUND(v_faturamento / v_dias_trabalhados::numeric, 2)
    ELSE 0 
  END;

  -- ===========================================
  -- KPIs SPLY (Same Period Last Year)
  -- ===========================================
  SELECT 
    COALESCE(SUM(valor_faturamento), 0),
    COUNT(DISTINCT venda_id),
    COUNT(DISTINCT cliente_id),
    COUNT(DISTINCT venda_dia::date) FILTER (WHERE valor_faturamento > 0)
  INTO v_sply_faturamento, v_sply_atendimentos, v_sply_clientes, v_sply_dias_trabalhados
  FROM vw_vendas_kpi_base
  WHERE venda_dia::date BETWEEN v_sply_inicio AND v_sply_fim
    AND produto IS NOT NULL AND produto <> ''
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_tipo_colaborador IS NULL OR tipo_colaborador = p_tipo_colaborador);
  
  v_sply_faturamento_por_dia := CASE 
    WHEN v_sply_dias_trabalhados > 0 THEN ROUND(v_sply_faturamento / v_sply_dias_trabalhados::numeric, 2)
    ELSE 0 
  END;

  -- ===========================================
  -- KPIs MOM (Month over Month / Período anterior)
  -- ===========================================
  SELECT 
    COALESCE(SUM(valor_faturamento), 0),
    COUNT(DISTINCT venda_id),
    COUNT(DISTINCT cliente_id),
    COUNT(DISTINCT venda_dia::date) FILTER (WHERE valor_faturamento > 0)
  INTO v_mom_faturamento, v_mom_atendimentos, v_mom_clientes, v_mom_dias_trabalhados
  FROM vw_vendas_kpi_base
  WHERE venda_dia::date BETWEEN v_mom_inicio AND v_mom_fim
    AND produto IS NOT NULL AND produto <> ''
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_tipo_colaborador IS NULL OR tipo_colaborador = p_tipo_colaborador);
  
  v_mom_faturamento_por_dia := CASE 
    WHEN v_mom_dias_trabalhados > 0 THEN ROUND(v_mom_faturamento / v_mom_dias_trabalhados::numeric, 2)
    ELSE 0 
  END;

  -- ===========================================
  -- MONTAR KPIs
  -- ===========================================
  v_kpis := jsonb_build_object(
    'faturamento', v_faturamento,
    'atendimentos', v_atendimentos,
    'ticket_medio', CASE WHEN v_atendimentos > 0 THEN ROUND(v_faturamento / v_atendimentos::numeric, 2) ELSE 0 END,
    'clientes', v_clientes,
    'clientes_novos', v_clientes_novos,
    'extras_qtd', (
      SELECT COUNT(*) FROM vw_vendas_kpi_base
      WHERE venda_dia::date BETWEEN p_inicio::date AND p_fim::date
        AND is_extra = true
        AND produto IS NOT NULL AND produto <> ''
        AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
        AND (p_tipo_colaborador IS NULL OR tipo_colaborador = p_tipo_colaborador)
    ),
    'extras_valor', (
      SELECT COALESCE(SUM(valor_faturamento), 0) FROM vw_vendas_kpi_base
      WHERE venda_dia::date BETWEEN p_inicio::date AND p_fim::date
        AND is_extra = true
        AND produto IS NOT NULL AND produto <> ''
        AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
        AND (p_tipo_colaborador IS NULL OR tipo_colaborador = p_tipo_colaborador)
    ),
    'servicos_totais', (
      SELECT COUNT(*) FROM vw_vendas_kpi_base
      WHERE venda_dia::date BETWEEN p_inicio::date AND p_fim::date
        AND is_servico = true
        AND produto IS NOT NULL AND produto <> ''
        AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
        AND (p_tipo_colaborador IS NULL OR tipo_colaborador = p_tipo_colaborador)
    ),
    'dias_trabalhados', v_dias_trabalhados,
    'faturamento_por_dia', v_faturamento_por_dia
  );

  -- ===========================================
  -- DAILY (dados diários)
  -- ===========================================
  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.dia), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT 
      venda_dia::date AS dia,
      COALESCE(SUM(valor_faturamento), 0) AS faturamento,
      COUNT(DISTINCT venda_id) AS atendimentos,
      CASE WHEN COUNT(DISTINCT venda_id) > 0 
        THEN ROUND(SUM(valor_faturamento) / COUNT(DISTINCT venda_id)::numeric, 2) 
        ELSE 0 END AS ticket_medio,
      COUNT(DISTINCT cliente_id) AS clientes,
      COUNT(DISTINCT cliente_id) FILTER (WHERE venda_dia::date = (
        SELECT MIN(v2.venda_dia::date) FROM vw_vendas_kpi_base v2 
        WHERE v2.cliente_id = vw_vendas_kpi_base.cliente_id
          AND v2.produto IS NOT NULL AND v2.produto <> ''
      )) AS clientes_novos,
      COUNT(*) FILTER (WHERE is_extra = true) AS extras_qtd,
      COALESCE(SUM(valor_faturamento) FILTER (WHERE is_extra = true), 0) AS extras_valor,
      COUNT(*) FILTER (WHERE is_servico = true) AS servicos_totais
    FROM vw_vendas_kpi_base
    WHERE venda_dia::date BETWEEN p_inicio::date AND p_fim::date
      AND produto IS NOT NULL AND produto <> ''
      AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
      AND (p_tipo_colaborador IS NULL OR tipo_colaborador = p_tipo_colaborador)
    GROUP BY venda_dia::date
  ) d;

  -- ===========================================
  -- COLABORADORES COM FATURAMENTO NO PERÍODO
  -- ===========================================
  SELECT COALESCE(jsonb_agg(row_to_json(c)::jsonb ORDER BY c.colaborador_nome), '[]'::jsonb)
  INTO v_colaboradores
  FROM (
    SELECT DISTINCT 
      colaborador_id,
      colaborador_nome
    FROM vw_vendas_kpi_base
    WHERE venda_dia::date BETWEEN p_inicio::date AND p_fim::date
      AND produto IS NOT NULL AND produto <> ''
      AND colaborador_id IS NOT NULL
      AND (p_tipo_colaborador IS NULL OR tipo_colaborador = p_tipo_colaborador)
  ) c;

  -- ===========================================
  -- BY_COLABORADOR (breakdown)
  -- ===========================================
  SELECT COALESCE(jsonb_agg(row_to_json(bc)::jsonb ORDER BY bc.faturamento DESC), '[]'::jsonb)
  INTO v_by_colaborador
  FROM (
    SELECT
      colaborador_id,
      colaborador_nome,
      COALESCE(SUM(valor_faturamento), 0) AS faturamento,
      COUNT(DISTINCT venda_id) AS atendimentos,
      CASE WHEN COUNT(DISTINCT venda_id) > 0 
        THEN ROUND(SUM(valor_faturamento) / COUNT(DISTINCT venda_id)::numeric, 2) 
        ELSE 0 END AS ticket_medio,
      COUNT(*) FILTER (WHERE is_extra = true) AS extras_qtd,
      COALESCE(SUM(valor_faturamento) FILTER (WHERE is_extra = true), 0) AS extras_valor,
      COUNT(DISTINCT venda_dia::date) FILTER (WHERE valor_faturamento > 0) AS dias_trabalhados,
      COUNT(*) FILTER (WHERE is_servico = true) AS servicos_totais,
      COUNT(DISTINCT cliente_id) AS clientes,
      COUNT(DISTINCT cliente_id) FILTER (WHERE venda_dia::date = (
        SELECT MIN(v2.venda_dia::date) FROM vw_vendas_kpi_base v2 
        WHERE v2.cliente_id = vw_vendas_kpi_base.cliente_id
          AND v2.produto IS NOT NULL AND v2.produto <> ''
      )) AS clientes_novos,
      CASE WHEN COUNT(DISTINCT venda_dia::date) FILTER (WHERE valor_faturamento > 0) > 0 
        THEN ROUND(SUM(valor_faturamento) / COUNT(DISTINCT venda_dia::date) FILTER (WHERE valor_faturamento > 0)::numeric, 2)
        ELSE 0 END AS faturamento_por_dia_trabalhado
    FROM vw_vendas_kpi_base
    WHERE venda_dia::date BETWEEN p_inicio::date AND p_fim::date
      AND produto IS NOT NULL AND produto <> ''
      AND colaborador_id IS NOT NULL
      AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
      AND (p_tipo_colaborador IS NULL OR tipo_colaborador = p_tipo_colaborador)
    GROUP BY colaborador_id, colaborador_nome
  ) bc;

  -- ===========================================
  -- COMPARAÇÕES
  -- ===========================================
  v_comparacoes := jsonb_build_object(
    'sply', jsonb_build_object(
      'periodo', jsonb_build_object('inicio', v_sply_inicio, 'fim', v_sply_fim),
      'faturamento', v_sply_faturamento,
      'faturamento_var_pct', CASE WHEN v_sply_faturamento > 0 THEN ROUND(((v_faturamento - v_sply_faturamento) / v_sply_faturamento::numeric) * 100, 1) ELSE NULL END,
      'atendimentos', v_sply_atendimentos,
      'atendimentos_var_pct', CASE WHEN v_sply_atendimentos > 0 THEN ROUND(((v_atendimentos - v_sply_atendimentos) / v_sply_atendimentos::numeric) * 100, 1) ELSE NULL END,
      'clientes', v_sply_clientes,
      'clientes_var_pct', CASE WHEN v_sply_clientes > 0 THEN ROUND(((v_clientes - v_sply_clientes) / v_sply_clientes::numeric) * 100, 1) ELSE NULL END,
      'dias_trabalhados', v_sply_dias_trabalhados,
      'faturamento_por_dia', v_sply_faturamento_por_dia,
      'faturamento_por_dia_var_pct', CASE WHEN v_sply_faturamento_por_dia > 0 THEN ROUND(((v_faturamento_por_dia - v_sply_faturamento_por_dia) / v_sply_faturamento_por_dia::numeric) * 100, 1) ELSE NULL END
    ),
    'mom', jsonb_build_object(
      'periodo', jsonb_build_object('inicio', v_mom_inicio, 'fim', v_mom_fim),
      'faturamento', v_mom_faturamento,
      'faturamento_var_pct', CASE WHEN v_mom_faturamento > 0 THEN ROUND(((v_faturamento - v_mom_faturamento) / v_mom_faturamento::numeric) * 100, 1) ELSE NULL END,
      'atendimentos', v_mom_atendimentos,
      'atendimentos_var_pct', CASE WHEN v_mom_atendimentos > 0 THEN ROUND(((v_atendimentos - v_mom_atendimentos) / v_mom_atendimentos::numeric) * 100, 1) ELSE NULL END,
      'clientes', v_mom_clientes,
      'clientes_var_pct', CASE WHEN v_mom_clientes > 0 THEN ROUND(((v_clientes - v_mom_clientes) / v_mom_clientes::numeric) * 100, 1) ELSE NULL END,
      'dias_trabalhados', v_mom_dias_trabalhados,
      'faturamento_por_dia', v_mom_faturamento_por_dia,
      'faturamento_por_dia_var_pct', CASE WHEN v_mom_faturamento_por_dia > 0 THEN ROUND(((v_faturamento_por_dia - v_mom_faturamento_por_dia) / v_mom_faturamento_por_dia::numeric) * 100, 1) ELSE NULL END
    )
  );

  -- ===========================================
  -- MONTAR RESULTADO FINAL
  -- ===========================================
  v_result := jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'filtros', jsonb_build_object(
      'colaborador_id', p_colaborador_id,
      'tipo_colaborador', p_tipo_colaborador
    ),
    'kpis', v_kpis,
    'daily', v_daily,
    'colaboradores_periodo', v_colaboradores,
    'by_colaborador', v_by_colaborador,
    'comparacoes', v_comparacoes
  );

  RETURN v_result;
END;
$function$;

-- Drop and recreate rpc_dashboard_period to add new fields to by_colaborador
DROP FUNCTION IF EXISTS public.rpc_dashboard_period(date, date, text, text);

CREATE OR REPLACE FUNCTION public.rpc_dashboard_period(
  p_inicio date, 
  p_fim date, 
  p_colaborador_id text DEFAULT NULL::text, 
  p_tipo_colaborador text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_kpis jsonb;
  v_daily jsonb;
  v_colaboradores jsonb;
  v_by_colaborador jsonb;
  v_result jsonb;
BEGIN
  -- ===========================================
  -- KPIs AGREGADOS DO PERÍODO
  -- ===========================================
  SELECT jsonb_build_object(
    'faturamento', COALESCE(SUM(valor_faturamento), 0),
    'atendimentos', COUNT(DISTINCT venda_id),
    'ticket_medio', CASE 
      WHEN COUNT(DISTINCT venda_id) > 0 
      THEN ROUND(COALESCE(SUM(valor_faturamento), 0) / COUNT(DISTINCT venda_id)::numeric, 2)
      ELSE 0 
    END,
    'clientes', COUNT(DISTINCT cliente_id),
    'clientes_novos', COUNT(DISTINCT cliente_id) FILTER (WHERE venda_dia::date = (
      SELECT MIN(v2.venda_dia::date) 
      FROM vw_vendas_kpi_base v2 
      WHERE v2.cliente_id = vw_vendas_kpi_base.cliente_id
        AND v2.produto IS NOT NULL AND v2.produto <> ''
    )),
    'extras_qtd', COUNT(*) FILTER (WHERE is_extra = true),
    'extras_valor', COALESCE(SUM(valor_faturamento) FILTER (WHERE is_extra = true), 0),
    'servicos_totais', COUNT(*) FILTER (WHERE is_servico = true OR is_extra = true),
    'dias_trabalhados', COUNT(DISTINCT venda_dia::date) FILTER (WHERE valor_faturamento > 0)
  )
  INTO v_kpis
  FROM vw_vendas_kpi_base
  WHERE venda_dia::date BETWEEN p_inicio AND p_fim
    AND produto IS NOT NULL AND produto <> ''
    AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
    AND (p_tipo_colaborador IS NULL OR tipo_colaborador = p_tipo_colaborador);

  -- ===========================================
  -- DADOS DIÁRIOS PARA GRÁFICOS
  -- ===========================================
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'dia', dia,
      'faturamento', faturamento,
      'atendimentos', atendimentos,
      'ticket_medio', ticket_medio,
      'clientes', clientes,
      'clientes_novos', clientes_novos,
      'extras_qtd', extras_qtd,
      'extras_valor', extras_valor,
      'servicos_totais', servicos_totais
    ) ORDER BY dia
  ), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT 
      venda_dia::date::text as dia,
      COALESCE(SUM(valor_faturamento), 0) as faturamento,
      COUNT(DISTINCT venda_id) as atendimentos,
      CASE 
        WHEN COUNT(DISTINCT venda_id) > 0 
        THEN ROUND(COALESCE(SUM(valor_faturamento), 0) / COUNT(DISTINCT venda_id)::numeric, 2)
        ELSE 0 
      END as ticket_medio,
      COUNT(DISTINCT cliente_id) as clientes,
      COUNT(DISTINCT cliente_id) FILTER (WHERE venda_dia::date = (
        SELECT MIN(v2.venda_dia::date) 
        FROM vw_vendas_kpi_base v2 
        WHERE v2.cliente_id = vw_vendas_kpi_base.cliente_id
          AND v2.produto IS NOT NULL AND v2.produto <> ''
      )) as clientes_novos,
      COUNT(*) FILTER (WHERE is_extra = true) as extras_qtd,
      COALESCE(SUM(valor_faturamento) FILTER (WHERE is_extra = true), 0) as extras_valor,
      COUNT(*) FILTER (WHERE is_servico = true OR is_extra = true) as servicos_totais
    FROM vw_vendas_kpi_base
    WHERE venda_dia::date BETWEEN p_inicio AND p_fim
      AND produto IS NOT NULL AND produto <> ''
      AND (p_colaborador_id IS NULL OR colaborador_id = p_colaborador_id)
      AND (p_tipo_colaborador IS NULL OR tipo_colaborador = p_tipo_colaborador)
    GROUP BY venda_dia::date
  ) daily_data;

  -- ===========================================
  -- COLABORADORES COM FATURAMENTO NO PERÍODO
  -- ===========================================
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'colaborador_id', dc.colaborador_id,
      'colaborador_nome', dc.colaborador_nome
    ) ORDER BY dc.colaborador_nome
  ), '[]'::jsonb)
  INTO v_colaboradores
  FROM public.dimensao_colaboradores dc
  WHERE dc.ativo = true
    AND (p_tipo_colaborador IS NULL OR dc.tipo_colaborador = p_tipo_colaborador)
    AND EXISTS (
      SELECT 1 
      FROM vw_vendas_kpi_base vkb
      WHERE vkb.colaborador_id = dc.colaborador_id
        AND vkb.venda_dia::date BETWEEN p_inicio AND p_fim
        AND vkb.valor_faturamento > 0
        AND vkb.produto IS NOT NULL AND vkb.produto <> ''
    );

  -- ===========================================
  -- BREAKDOWN POR COLABORADOR (COM TODOS OS CAMPOS)
  -- ===========================================
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'colaborador_id', colaborador_id,
      'colaborador_nome', colaborador_nome,
      'faturamento', faturamento,
      'atendimentos', atendimentos,
      'ticket_medio', ticket_medio,
      'extras_qtd', extras_qtd,
      'extras_valor', extras_valor,
      'dias_trabalhados', dias_trabalhados,
      'servicos_totais', servicos_totais,
      'clientes', clientes,
      'clientes_novos', clientes_novos
    ) ORDER BY faturamento DESC
  ), '[]'::jsonb)
  INTO v_by_colaborador
  FROM (
    SELECT 
      v.colaborador_id,
      dc.colaborador_nome,
      COALESCE(SUM(v.valor_faturamento), 0) as faturamento,
      COUNT(DISTINCT v.venda_id) as atendimentos,
      CASE 
        WHEN COUNT(DISTINCT v.venda_id) > 0 
        THEN ROUND(COALESCE(SUM(v.valor_faturamento), 0) / COUNT(DISTINCT v.venda_id)::numeric, 2)
        ELSE 0 
      END as ticket_medio,
      COUNT(*) FILTER (WHERE v.is_extra = true) as extras_qtd,
      COALESCE(SUM(v.valor_faturamento) FILTER (WHERE v.is_extra = true), 0) as extras_valor,
      COUNT(DISTINCT v.venda_dia::date) FILTER (WHERE v.valor_faturamento > 0) as dias_trabalhados,
      COUNT(*) FILTER (WHERE v.is_servico = true OR v.is_extra = true) as servicos_totais,
      COUNT(DISTINCT v.cliente_id) as clientes,
      COUNT(DISTINCT v.cliente_id) FILTER (WHERE v.venda_dia::date = (
        SELECT MIN(v2.venda_dia::date) 
        FROM vw_vendas_kpi_base v2 
        WHERE v2.cliente_id = v.cliente_id
          AND v2.produto IS NOT NULL AND v2.produto <> ''
      )) as clientes_novos
    FROM vw_vendas_kpi_base v
    JOIN dimensao_colaboradores dc ON dc.colaborador_id = v.colaborador_id
    WHERE v.venda_dia::date BETWEEN p_inicio AND p_fim
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
      AND (p_tipo_colaborador IS NULL OR dc.tipo_colaborador = p_tipo_colaborador)
    GROUP BY v.colaborador_id, dc.colaborador_nome
  ) breakdown;

  -- ===========================================
  -- MONTA RESULTADO FINAL
  -- ===========================================
  v_result := jsonb_build_object(
    'periodo', jsonb_build_object(
      'inicio', p_inicio::text,
      'fim', p_fim::text
    ),
    'filtros', jsonb_build_object(
      'colaborador_id', p_colaborador_id,
      'tipo_colaborador', p_tipo_colaborador
    ),
    'kpis', v_kpis,
    'daily', v_daily,
    'colaboradores_periodo', v_colaboradores,
    'by_colaborador', v_by_colaborador
  );

  RETURN v_result;
END;
$function$;
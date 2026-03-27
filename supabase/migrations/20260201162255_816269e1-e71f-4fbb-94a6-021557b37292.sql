-- ============================================================
-- RPC: public.rpc_dashboard_period
-- PROPÓSITO: Retorna dados consolidados do dashboard em uma única chamada
-- PARÂMETROS:
--   p_inicio (date) - Data inicial do período
--   p_fim (date) - Data final do período
--   p_colaborador_id (text | null) - Filtrar por colaborador específico
--   p_tipo_colaborador (text | null) - Filtrar por tipo (barbeiro, recepcao)
-- RETORNO: JSON com kpis, daily array, e lista de colaboradores
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_dashboard_period(
  p_inicio date,
  p_fim date,
  p_colaborador_id text DEFAULT NULL,
  p_tipo_colaborador text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kpis jsonb;
  v_daily jsonb;
  v_colaboradores jsonb;
BEGIN
  -- ============================================================
  -- STEP 1: Busca KPIs agregados do período
  -- FONTE: public.rpc_dashboard_kpis (RPC existente)
  -- ============================================================
  SELECT public.rpc_dashboard_kpis(
    p_inicio := p_inicio,
    p_fim := p_fim,
    p_colaborador_id := p_colaborador_id,
    p_tipo_colaborador := p_tipo_colaborador
  )
  INTO v_kpis;
  
  -- ============================================================
  -- STEP 2: Busca série diária do período
  -- FONTE: public.rpc_dashboard_daily (RPC existente)
  -- ============================================================
  SELECT public.rpc_dashboard_daily(
    p_inicio := p_inicio,
    p_fim := p_fim,
    p_colaborador_id := p_colaborador_id,
    p_tipo_colaborador := p_tipo_colaborador
  )
  INTO v_daily;
  
  -- ============================================================
  -- STEP 3: Lista colaboradores ativos (filtrados por tipo se informado)
  -- FONTE: public.dimensao_colaboradores
  -- ============================================================
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'colaborador_id', colaborador_id,
      'colaborador_nome', colaborador_nome
    ) ORDER BY colaborador_nome
  ), '[]'::jsonb)
  INTO v_colaboradores
  FROM public.dimensao_colaboradores
  WHERE ativo = true
    AND (p_tipo_colaborador IS NULL OR tipo_colaborador = p_tipo_colaborador);
  
  -- ============================================================
  -- STEP 4: Monta e retorna objeto consolidado
  -- ============================================================
  RETURN jsonb_build_object(
    'periodo', jsonb_build_object(
      'inicio', p_inicio,
      'fim', p_fim
    ),
    'filtros', jsonb_build_object(
      'colaborador_id', p_colaborador_id,
      'tipo_colaborador', p_tipo_colaborador
    ),
    'kpis', jsonb_build_object(
      'faturamento', COALESCE((v_kpis->>'faturamento')::numeric, 0),
      'atendimentos', COALESCE((v_kpis->>'atendimentos')::integer, 0),
      'ticket_medio', COALESCE((v_kpis->>'ticket_medio')::numeric, 0),
      'clientes', COALESCE((v_kpis->>'clientes')::integer, 0),
      'clientes_novos', COALESCE((v_kpis->>'clientes_novos')::integer, 0),
      'extras_qtd', COALESCE((v_kpis->>'extras_qtd')::integer, 0),
      'extras_valor', COALESCE((v_kpis->>'extras_valor')::numeric, 0),
      'servicos_totais', COALESCE((v_kpis->>'servicos_totais')::integer, 0),
      'dias_trabalhados', COALESCE((v_kpis->>'dias_trabalhados')::integer, 0)
    ),
    'daily', COALESCE(v_daily, '[]'::jsonb),
    'colaboradores_periodo', v_colaboradores
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.rpc_dashboard_period(date, date, text, text) TO authenticated;
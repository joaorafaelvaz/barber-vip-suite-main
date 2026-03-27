// ============================================================
// FILE: src/hooks/useFaturamentoDrill.ts
// PROPÓSITO: Hook para gerenciar chamadas RPCs de faturamento drilldown
// FONTE: 8 RPCs rpc_faturamento_*
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// ============================================================
// TIPOS
// ============================================================

export type DrillMeta = {
  inicio: string;
  fim: string;
  total: number;
  granularidade?: string;
  tipo_colaborador?: string;
  filtros?: Record<string, any>;
};

export type DrillSeriesPoint = { bucket: string; valor: number; qtd?: number; ticket?: number };

export type DrillResponse = {
  meta: DrillMeta;
  series: DrillSeriesPoint[];
  table: any;
  insights: string[];
};

export type DrillComparacoes = {
  atual: number;
  atual_base: number;
  atual_extras: number;
  atual_produtos: number;
  atual_dias: number;
  atual_dias_trabalhados?: number;
  sply_total: number;
  sply_base: number;
  sply_extras: number;
  sply_produtos: number;
  sply_var_pct: number | null;
  sply_dias: number;
  sply_dias_trabalhados?: number;
  sply_periodo: { inicio: string; fim: string };
  mom_total: number;
  mom_base: number;
  mom_extras: number;
  mom_produtos: number;
  mom_var_pct: number | null;
  mom_dias: number;
  mom_dias_trabalhados?: number;
  mom_periodo: { inicio: string; fim: string };
  avg_6m: number;
  avg_6m_base: number;
  avg_6m_extras: number;
  avg_6m_produtos: number;
  avg_6m_dias_trabalhados?: number;
  avg_6m_periodo: { inicio: string; fim: string };
  avg_12m: number;
  avg_12m_base: number;
  avg_12m_extras: number;
  avg_12m_produtos: number;
  avg_12m_dias_trabalhados?: number;
  avg_12m_periodo: { inicio: string; fim: string };
};

export type ViewId =
  | 'periodo'
  | 'colaborador'
  | 'grupo'
  | 'item'
  | 'dia_semana'
  | 'pagamento'
  | 'faixa_horaria';

export type Granularidade = 'day' | 'week' | 'month';

export const VIEW_CONFIG: Record<
  ViewId,
  {
    title: string;
    rpc: string;
    description: string;
    needs?: { granularidade?: boolean; topLimit?: boolean };
  }
> = {
  periodo: {
    title: 'Por período',
    rpc: 'rpc_faturamento_periodo',
    description: 'Detalha por dia, semana ou mês.',
    needs: { granularidade: true },
  },
  colaborador: {
    title: 'Por barbeiro',
    rpc: 'rpc_faturamento_por_colaborador',
    description: 'Ranking e participação por colaborador.',
  },
  grupo: {
    title: 'Por grupo',
    rpc: 'rpc_faturamento_por_grupo_de_produto',
    description: 'Composição por grupo_de_produto.',
  },
  item: {
    title: 'Por item',
    rpc: 'rpc_faturamento_por_item',
    description: 'Ranking por produto/serviço (Top N).',
    needs: { topLimit: true },
  },
  dia_semana: {
    title: 'Dia da semana',
    rpc: 'rpc_faturamento_por_dia_semana',
    description: 'Distribuição Dom…Sáb.',
  },
  pagamento: {
    title: 'Pagamento',
    rpc: 'rpc_faturamento_por_pagamento',
    description: 'Distribuição por forma de pagamento.',
  },
  faixa_horaria: {
    title: 'Faixa horária',
    rpc: 'rpc_faturamento_por_faixa_horaria',
    description: 'Picos e ociosidade ao longo do dia.',
  },
};

// ============================================================
// HOOK
// ============================================================

export function useFaturamentoDrill() {
  const [params] = useSearchParams();

  // Filtros da URL
  const inicio = params.get('inicio') || '2025-10-01';
  const fim = params.get('fim') || '2025-10-31';
  const colaborador_id = params.get('colaborador_id') || null;
  const grupo_de_produto = params.get('grupo_de_produto') || null;
  const servicos_ou_produtos = params.get('servicos_ou_produtos') || null;
  const forma_pagamento = params.get('forma_pagamento') || null;
  const produto = params.get('produto') || null;

  // Estado
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [resumo, setResumo] = useState<DrillResponse | null>(null);
  const [errorResumo, setErrorResumo] = useState<string | null>(null);

  const [selectedView, setSelectedView] = useState<ViewId>('periodo');
  const [loadingView, setLoadingView] = useState(false);
  const [viewData, setViewData] = useState<DrillResponse | null>(null);
  const [errorView, setErrorView] = useState<string | null>(null);

  const [granularidade, setGranularidade] = useState<Granularidade>('day');
  const [topLimit, setTopLimit] = useState(20);

  // Comparações
  const [comparacoes, setComparacoes] = useState<DrillComparacoes | null>(null);
  const [loadingComparacoes, setLoadingComparacoes] = useState(false);

  const filters = useMemo(() => ({
    inicio, fim, colaborador_id, grupo_de_produto,
    servicos_ou_produtos, forma_pagamento, produto,
  }), [inicio, fim, colaborador_id, grupo_de_produto, servicos_ou_produtos, forma_pagamento, produto]);

  // ---- Resumo ----
  const loadResumo = useCallback(async () => {
    setLoadingResumo(true);
    setErrorResumo(null);
    setResumo(null);

    const { data, error } = await supabase.rpc('rpc_faturamento_resumo', {
      p_inicio: filters.inicio,
      p_fim: filters.fim,
      p_colaborador_id: filters.colaborador_id,
      p_grupo_de_produto: filters.grupo_de_produto,
      p_servicos_ou_produtos: filters.servicos_ou_produtos,
      p_forma_pagamento: filters.forma_pagamento,
      p_produto: filters.produto,
    });

    if (error) {
      console.error('rpc_faturamento_resumo error:', error);
      setErrorResumo(error.message);
    } else {
      setResumo(data as unknown as DrillResponse);
    }
    setLoadingResumo(false);
  }, [filters]);

  // ---- Comparações ----
  const loadComparacoes = useCallback(async () => {
    setLoadingComparacoes(true);
    setComparacoes(null);

    const { data, error } = await supabase.rpc('rpc_faturamento_comparacoes' as any, {
      p_inicio: filters.inicio,
      p_fim: filters.fim,
      p_colaborador_id: filters.colaborador_id,
      p_grupo_de_produto: filters.grupo_de_produto,
      p_servicos_ou_produtos: filters.servicos_ou_produtos,
      p_forma_pagamento: filters.forma_pagamento,
      p_produto: filters.produto,
    });

    if (error) {
      console.error('rpc_faturamento_comparacoes error:', error);
    } else {
      setComparacoes(data as unknown as DrillComparacoes);
    }
    setLoadingComparacoes(false);
  }, [filters]);

  // ---- View ----
  const loadView = useCallback(async (view: ViewId) => {
    setLoadingView(true);
    setErrorView(null);
    setViewData(null);

    const cfg = VIEW_CONFIG[view];
    let args: Record<string, any> = { p_inicio: filters.inicio, p_fim: filters.fim };

    if (view === 'periodo') {
      args.p_granularidade = granularidade;
      args.p_colaborador_id = filters.colaborador_id;
      args.p_grupo_de_produto = filters.grupo_de_produto;
      args.p_servicos_ou_produtos = filters.servicos_ou_produtos;
      args.p_forma_pagamento = filters.forma_pagamento;
      args.p_produto = filters.produto;
    } else if (view === 'colaborador') {
      args.p_tipo_colaborador = 'barbeiro';
      args.p_grupo_de_produto = filters.grupo_de_produto;
      args.p_servicos_ou_produtos = filters.servicos_ou_produtos;
      args.p_forma_pagamento = filters.forma_pagamento;
      args.p_produto = filters.produto;
    } else if (view === 'grupo') {
      args.p_colaborador_id = filters.colaborador_id;
      args.p_servicos_ou_produtos = filters.servicos_ou_produtos;
      args.p_forma_pagamento = filters.forma_pagamento;
    } else if (view === 'item') {
      args.p_limit = topLimit || undefined;
      args.p_colaborador_id = filters.colaborador_id;
      args.p_grupo_de_produto = filters.grupo_de_produto;
      args.p_servicos_ou_produtos = filters.servicos_ou_produtos;
      args.p_forma_pagamento = filters.forma_pagamento;
    } else if (view === 'dia_semana' || view === 'pagamento' || view === 'faixa_horaria') {
      args.p_colaborador_id = filters.colaborador_id;
      args.p_grupo_de_produto = filters.grupo_de_produto;
      args.p_servicos_ou_produtos = filters.servicos_ou_produtos;
    }

    const { data, error } = await supabase.rpc(cfg.rpc as any, args);

    if (error) {
      console.error(cfg.rpc, 'error:', error);
      setErrorView(error.message);
    } else {
      setViewData(data as unknown as DrillResponse);
    }
    setLoadingView(false);
  }, [filters, granularidade, topLimit]);

  // Auto-load resumo + comparações when filters change
  useEffect(() => { loadResumo(); loadComparacoes(); }, [loadResumo, loadComparacoes]);

  // Auto-load view when view changes
  useEffect(() => { loadView(selectedView); }, [selectedView, loadView]);

  return {
    filters,
    // resumo
    resumo, loadingResumo, errorResumo, loadResumo,
    // comparações
    comparacoes, loadingComparacoes,
    // view
    selectedView, setSelectedView,
    viewData, loadingView, errorView, loadView,
    // controls
    granularidade, setGranularidade,
    topLimit, setTopLimit,
  };
}

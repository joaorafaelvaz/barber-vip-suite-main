// ============================================================
// Hook: useClientesNovos
// Gerencia estado e dados do módulo Cliente Novo
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toCsv, downloadCsv, calcPeriodoLabel } from '@/hooks/useClientes';

// ---- Types ----

export type ClienteNovoScreen = 'RESUMO' | 'LISTA' | 'COHORT' | 'DRILL_RETENCAO';

export type ListaModo = 'TODOS' | 'NAO_VOLTARAM' | 'TROCARAM_BARBEIRO' | 'FIEIS';

export type StatusNovo = 'NOVO_1X' | 'NOVO_RECORRENTE' | 'NOVO_VOLTOU_TARDE' | 'NOVO_COMPARTILHADO' | 'NOVO_FIEL';

export interface NovosKpis {
  novos_total: number;
  pct_novos_sobre_unicos: number;
  retencao_30d: number;
  retencao_60d: number;
  retencao_90d: number;
  pct_recorrente_60d: number;
  tempo_mediano_2a_visita: number | null;
  tempo_medio_2a_visita: number | null;
  pct_voltou_ate_21d: number;
  ticket_primeira_visita: number;
  ticket_medio_recorrente: number | null;
  novos_exclusivos: number;
  novos_compartilhados: number;
  pct_novos_exclusivos: number;
}

export interface BarbeiroAquisicaoItem {
  colaborador_id: string;
  colaborador_nome: string;
  novos: number;
  retencao_30d: number;
  retencao_60d: number;
  pct_recorrente_60d: number;
  pct_fieis: number;
  ticket_medio_novo: number;
}

export interface TendenciaSemanalItem {
  semana_inicio: string;
  novos: number;
}

export interface CohortMensalItem {
  mes: string;
  novos: number;
  ret_30d: number;
  ret_60d: number;
  ret_90d: number;
  pct_ret_30d: number;
  pct_ret_60d: number;
  pct_ret_90d: number;
}

export interface RetencaoDistItem {
  faixa: string;
  count: number;
  pct: number;
}

export interface NovosResumo {
  kpis: NovosKpis;
  por_barbeiro_aquisicao: BarbeiroAquisicaoItem[];
  tendencia_semanal: TendenciaSemanalItem[];
  cohort_mensal: CohortMensalItem[];
  retencao_distribuicao: RetencaoDistItem[];
}

export interface NovoListaRow {
  cliente_id: string;
  cliente_nome: string;
  telefone: string | null;
  first_seen: string;
  barbeiro_aquisicao_id: string;
  barbeiro_aquisicao_nome: string;
  status_novo: StatusNovo;
  total_visitas_60d: number;
  gasto_60d: number;
  dias_desde_first_seen: number;
  barbeiros_visitados_60d: string[];
  qtd_barbeiros_60d: number;
  barbeiro_2a_visita_nome: string | null;
  dias_ate_2a_visita: number | null;
}

export interface NovosLista {
  total: number;
  rows: NovoListaRow[];
}

// ---- Default period (last 90 days) ----

function getDefaultPeriod() {
  const now = new Date();
  const fim = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const d90 = new Date(now);
  d90.setUTCDate(d90.getUTCDate() - 89);
  const inicio = `${d90.getUTCFullYear()}-${String(d90.getUTCMonth() + 1).padStart(2, '0')}-${String(d90.getUTCDate()).padStart(2, '0')}`;
  return { inicio, fim };
}

const PAGE_SIZE = 50;

// ============================================================
// HOOK
// ============================================================

export function useClientesNovos() {
  const defaults = getDefaultPeriod();

  // Period
  const [dataInicio, setDataInicio] = useState(defaults.inicio);
  const [dataFim, setDataFim] = useState(defaults.fim);

  // Navigation
  const [screen, setScreen] = useState<ClienteNovoScreen>('RESUMO');

  // Filters
  const [janelaConversao, setJanelaConversao] = useState(60);
  const [listaModo, setListaModo] = useState<ListaModo>('TODOS');
  const [filtroBarbeiroId, setFiltroBarbeiroId] = useState<string | null>(null);
  const [filtroBarbeiroNome, setFiltroBarbeiroNome] = useState('');
  const [filtroStatusNovo, setFiltroStatusNovo] = useState<string | null>(null);

  // Data
  const [resumo, setResumo] = useState<NovosResumo | null>(null);
  const [lista, setLista] = useState<NovosLista | null>(null);
  const [listaPage, setListaPage] = useState(0);

  // Drill retencao
  const [drillRetencaoData, setDrillRetencaoData] = useState<any>(null);
  const [drillRetencaoFaixa, setDrillRetencaoFaixa] = useState('');
  const [drillRetencaoLabel, setDrillRetencaoLabel] = useState('');

  // Loading
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodoLabel = calcPeriodoLabel(dataInicio, dataFim);

  // ---- Load Resumo ----
  const loadResumo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('rpc_clientes_novos_resumo' as any, {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_ref_date: dataFim,
        p_janela_conversao: janelaConversao,
        p_excluir_sem_cadastro: true,
      });
      if (err) throw err;
      setResumo(data as unknown as NovosResumo);
    } catch (e: any) {
      console.error('useClientesNovos loadResumo error:', e);
      setError(e?.message ?? 'Erro ao carregar resumo.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, janelaConversao]);

  // ---- Load Lista ----
  const loadLista = useCallback(async (params?: {
    modo?: ListaModo;
    page?: number;
    barbeiroId?: string | null;
    statusNovo?: string | null;
  }) => {
    const modo = params?.modo ?? listaModo;
    const page = params?.page ?? listaPage;
    const barbId = params?.barbeiroId !== undefined ? params.barbeiroId : filtroBarbeiroId;
    const statusN = params?.statusNovo !== undefined ? params.statusNovo : filtroStatusNovo;

    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('rpc_clientes_novos_lista' as any, {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_ref_date: dataFim,
        p_modo: modo,
        p_barbeiro_aquisicao: barbId,
        p_status_novo: statusN,
        p_janela_conversao: janelaConversao,
        p_excluir_sem_cadastro: true,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        p_export: false,
      });
      if (err) throw err;
      setLista(data as unknown as NovosLista);
    } catch (e: any) {
      console.error('useClientesNovos loadLista error:', e);
      setError(e?.message ?? 'Erro ao carregar lista.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, janelaConversao, listaModo, listaPage, filtroBarbeiroId, filtroStatusNovo]);

  // ---- Export CSV ----
  const exportListaCsv = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase.rpc('rpc_clientes_novos_lista' as any, {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_ref_date: dataFim,
        p_modo: listaModo,
        p_barbeiro_aquisicao: filtroBarbeiroId,
        p_status_novo: filtroStatusNovo,
        p_janela_conversao: janelaConversao,
        p_excluir_sem_cadastro: true,
        p_export: true,
      });
      if (err) throw err;
      const result = data as unknown as NovosLista;
      const csv = toCsv(result.rows as any[]);
      downloadCsv(csv, `clientes_novos_${listaModo}_${dataInicio}_${dataFim}.csv`);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao exportar.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, janelaConversao, listaModo, filtroBarbeiroId, filtroStatusNovo]);

  // Navigate to lista filtered by barbeiro
  const openListaPorBarbeiro = useCallback((barbeiroId: string, barbeiroNome: string) => {
    setFiltroBarbeiroId(barbeiroId);
    setFiltroBarbeiroNome(barbeiroNome);
    setListaPage(0);
    setScreen('LISTA');
    // Call loadLista explicitly with correct params to avoid race condition
    loadLista({ barbeiroId, page: 0 });
  }, [loadLista]);

  // ---- Load Drill Retencao ----
  const loadDrillRetencao = useCallback(async (faixa: string, label: string) => {
    setDrillRetencaoFaixa(faixa);
    setDrillRetencaoLabel(label);
    setScreen('DRILL_RETENCAO' as any);
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('rpc_clientes_novos_drill_retencao' as any, {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_faixa: faixa,
        p_ref_date: dataFim,
        p_janela_conversao: janelaConversao,
        p_excluir_sem_cadastro: true,
      });
      if (err) throw err;
      setDrillRetencaoData(data);
    } catch (e: any) {
      console.error('loadDrillRetencao error:', e);
      setError(e?.message ?? 'Erro ao carregar drill de retenção.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, janelaConversao]);

  // Auto-load resumo on mount and period change
  useEffect(() => { loadResumo(); }, [loadResumo]);

  // Auto-load lista when screen = LISTA
  useEffect(() => {
    if (screen === 'LISTA') {
      loadLista();
    }
  }, [screen, listaModo, listaPage, filtroBarbeiroId, filtroStatusNovo]);

  const listaTotalPages = lista ? Math.ceil(lista.total / PAGE_SIZE) : 0;

  return {
    // Period
    dataInicio, setDataInicio,
    dataFim, setDataFim,
    periodoLabel,
    // Navigation
    screen, setScreen,
    // Filters
    janelaConversao, setJanelaConversao,
    listaModo, setListaModo,
    filtroBarbeiroId, setFiltroBarbeiroId,
    filtroBarbeiroNome, setFiltroBarbeiroNome,
    filtroStatusNovo, setFiltroStatusNovo,
    // Data
    resumo,
    lista,
    listaPage, setListaPage,
    listaTotalPages,
    drillRetencaoData,
    drillRetencaoFaixa,
    drillRetencaoLabel,
    // Actions
    loadResumo,
    loadLista,
    exportListaCsv,
    openListaPorBarbeiro,
    loadDrillRetencao,
    // State
    loading, error,
  };
}

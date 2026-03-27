// ============================================================
// FILE: src/hooks/useClientes.ts
// PROPÓSITO: Hook para o painel completo de clientes
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============================================================
// TIPOS
// ============================================================

export interface PainelKpis {
  total_clientes: number;
  clientes_novos: number;
  clientes_novos_retornaram: number;
  total_atendimentos: number;
  ticket_medio: number;
  valor_total: number;
}

export interface StatusDistItem {
  status: string;
  count: number;
}

export interface EvolucaoMensalItem {
  ano_mes: string;
  clientes_unicos: number;
  clientes_novos: number;
  atendimentos: number;
  valor: number;
}

export interface PorBarbeiroItem {
  colaborador_id: string;
  colaborador_nome: string;
  clientes_unicos: number;
  clientes_novos: number;
  clientes_exclusivos: number;
  valor_total: number;
}

export interface FaixasDias {
  ate_20d: number;
  '21_30d': number;
  '31_45d': number;
  '46_75d': number;
  mais_75d: number;
}

export interface FaixasFrequencia {
  uma_vez: number;
  uma_vez_aguardando: number;
  uma_vez_30d: number;
  uma_vez_60d: number;
  duas_vezes: number;
  tres_quatro: number;
  cinco_nove: number;
  dez_doze: number;
  treze_quinze: number;
  dezesseis_vinte: number;
  vinte_um_trinta: number;
  trinta_mais: number;
}

export interface PainelCompleto {
  kpis: PainelKpis;
  status_distribuicao: StatusDistItem[];
  evolucao_mensal: EvolucaoMensalItem[];
  por_barbeiro: PorBarbeiroItem[];
  faixas_dias: FaixasDias;
  faixas_frequencia: FaixasFrequencia;
  periodo: { data_inicio: string; data_fim: string; ref_date: string };
}

// Keep legacy types for drilldown compatibility
// Legacy types kept for backward compatibility with old components
export type ChartBarberItem = {
  nome: string;
  colaborador_id: string;
  atual: number;
  anterior: number;
  delta_abs: number;
  delta_pct: number | null;
};

export type UnicosCardsItem = {
  janela_dias: number;
  barbearia_atual: number;
  barbearia_anterior: number;
  delta_abs: number;
  delta_pct: number | null;
};

export type DrillModo = 'COMPARTILHADOS' | 'EXCLUSIVOS';
export type Janela = 30 | 60;

export type DrillRow = {
  cliente_id: string;
  cliente_nome: string;
  telefone: string | null;
  ultima_visita: string;
  itens_no_periodo: number;
  dias_com_presenca: number;
  gasto_no_periodo: number;
  qtd_barbeiros: number;
  barbeiros: string[];
};

export type RpcClientesListaCarteira = {
  meta: any;
  total: number;
  rows: DrillRow[];
};

export type CarteiraItem = {
  janela_dias: number;
  colaborador_id: string;
  colaborador_nome: string;
  unicos_total: number;
  unicos_exclusivos: number;
  unicos_compartilhados: number;
  pct_compartilhados: number | null;
};

export type UnicosTableItem = {
  janela_dias: number;
  colaborador_id: string;
  colaborador_nome: string;
  unicos_atual: number;
  unicos_anterior: number;
  delta_abs: number;
  delta_pct: number | null;
};

export type Screen = 'PAINEL' | 'BARBEIRO' | 'DRILLDOWN' | 'DRILL_FAIXA' | 'LISTA_NOVOS' | 'DRILL_RETENCAO_NOVOS';

export type ActiveTab = 'geral' | 'barbeiros' | 'novos' | 'perdas' | 'churn' | 'cohort' | 'acoes' | 'listas';

// ============================================================
// HELPERS DE FORMATAÇÃO
// ============================================================

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n);
}

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number(n));
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const v = Number(n);
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

export function fmtDelta(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${fmtInt(delta)}`;
}

// ============================================================
// CSV EXPORT
// ============================================================

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows?.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const line = (obj: Record<string, unknown>) =>
    headers.map(h => {
      const v = obj[h];
      return Array.isArray(v) ? esc(v.join(' | ')) : esc(v);
    }).join(',');
  return [headers.map(esc).join(','), ...rows.map(line)].join('\n');
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// PERÍODO HELPERS
// ============================================================

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function fmtDatePt(d: Date): string {
  const dd = d.getUTCDate();
  const mm = MESES_PT[d.getUTCMonth()];
  const yy = d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

export function fmtMesAno(anoMes: string): string {
  const [ano, mes] = anoMes.split('-');
  const idx = parseInt(mes, 10) - 1;
  return `${MESES_PT[idx]}/${ano.slice(2)}`;
}

export function fmtMesAnoFull(anoMes: string): string {
  const [ano, mes] = anoMes.split('-');
  const idx = parseInt(mes, 10) - 1;
  return `${MESES_FULL[idx]}/${ano}`;
}

export interface PeriodoInfo {
  atual: { de: string; ate: string };
  anterior: { de: string; ate: string };
}

export function calcPeriodo(refDate: string, janela: number): PeriodoInfo {
  const ref = new Date(refDate + 'T00:00:00Z');
  const atualAte = new Date(ref);
  const atualDe = new Date(ref);
  atualDe.setUTCDate(atualDe.getUTCDate() - janela + 1);

  const anteriorAte = new Date(atualDe);
  anteriorAte.setUTCDate(anteriorAte.getUTCDate() - 1);
  const anteriorDe = new Date(anteriorAte);
  anteriorDe.setUTCDate(anteriorDe.getUTCDate() - janela + 1);

  return {
    atual: { de: fmtDatePt(atualDe), ate: fmtDatePt(atualAte) },
    anterior: { de: fmtDatePt(anteriorDe), ate: fmtDatePt(anteriorAte) },
  };
}

export function calcPeriodoLabel(dataInicio: string, dataFim: string): string {
  const di = new Date(dataInicio + 'T00:00:00Z');
  const df = new Date(dataFim + 'T00:00:00Z');
  return `${fmtDatePt(di)} – ${fmtDatePt(df)}`;
}

// ============================================================
// STATUS HELPERS
// ============================================================

export const STATUS_CONFIG: Record<string, { label: string; subtitle: string; color: string; bgClass: string; description: string; shortDesc: string }> = {
  ATIVO_VIP: {
    label: 'Assíduo',
    subtitle: 'Dias sem vir ≤ 80% da cadência',
    color: 'hsl(142, 71%, 45%)',
    bgClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    description: 'Cliente fidelizado com 2+ visitas, vem antes do esperado. Dias sem vir ≤ 80% da cadência habitual.',
    shortDesc: 'Vem antes do esperado',
  },
  ATIVO_FORTE: {
    label: 'Regular',
    subtitle: '80%–120% da cadência',
    color: 'hsl(217, 91%, 60%)',
    bgClass: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    description: 'Cliente regular com 2+ visitas, vem no ritmo normal. Dias sem vir entre 80% e 120% da cadência.',
    shortDesc: 'No ritmo normal de retorno',
  },
  ATIVO_LEVE: {
    label: 'Espaçando',
    subtitle: '120%–180% da cadência',
    color: 'hsl(45, 93%, 47%)',
    bgClass: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
    description: 'Cliente com 2+ visitas espaçando as visitas. Dias sem vir entre 120% e 180% da cadência.',
    shortDesc: 'Espaçando as visitas',
  },
  AGUARDANDO_RETORNO: {
    label: '1ª Vez',
    subtitle: '1 visita, última há ≤ 30 dias',
    color: 'hsl(220, 50%, 65%)',
    bgClass: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
    description: 'Cliente com apenas 1 visita no período e última visita há ≤30 dias. Ainda dentro da janela normal de retorno.',
    shortDesc: '1 visita, aguardando retorno',
  },
  EM_RISCO: {
    label: 'Em Risco',
    subtitle: '2+: 180%–250% · 1 vis: 31–75 dias',
    color: 'hsl(25, 95%, 53%)',
    bgClass: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
    description: 'Cliente sumindo. Com 2+ visitas: dias sem vir entre 180% e 250% da cadência. Com 1 visita: 31-75 dias sem retornar.',
    shortDesc: 'Ultrapassou cadência de retorno',
  },
  PERDIDO: {
    label: 'Perdido',
    subtitle: '2+: > 250% · 1 vis: > 75 dias',
    color: 'hsl(0, 84%, 60%)',
    bgClass: 'bg-red-500/10 text-red-600 border-red-500/30',
    description: 'Cliente não retornou há muito tempo. Com 2+ visitas: > 250% da cadência. Com 1 visita: > 75 dias.',
    shortDesc: 'Sem retorno há muito tempo',
  },
};

// ============================================================
// DEFAULT PERIOD (last 12 months)
// ============================================================

function getDefaultPeriod() {
  const now = new Date();
  const mesAtual = now.getUTCMonth();
  const anoAtual = now.getUTCFullYear();
  const mesInicio = mesAtual; // 12 months ago (same month last year)
  const anoInicio = anoAtual - 1;

  const dataInicio = `${anoInicio}-${String(mesInicio + 1).padStart(2, '0')}-01`;
  // Last day of current month
  const lastDay = new Date(Date.UTC(anoAtual, mesAtual + 1, 0)).getUTCDate();
  const dataFim = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return { dataInicio, dataFim };
}

function todayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const DRILL_PAGE_SIZE = 30;

// ============================================================
// HOOK
// ============================================================

export function useClientes() {
  const defaults = getDefaultPeriod();

  // Period selection
  const [dataInicio, setDataInicio] = useState(defaults.dataInicio);
  const [dataFim, setDataFim] = useState(defaults.dataFim);

  // Navigation
  const [screen, setScreen] = useState<Screen>('PAINEL');
  const [activeTab, setActiveTab] = useState<ActiveTab>('geral');

  // Barbeiro filter (optional, filters everything)
  const [filtroColaboradorId, setFiltroColaboradorId] = useState<string | null>(null);
  const [filtroColaboradorNome, setFiltroColaboradorNome] = useState<string>('');

  // Loading & error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Main data
  const [painel, setPainel] = useState<PainelCompleto | null>(null);
  const [barbeariadetalhe, setBarbeariadetalhe] = useState<any>(null);
  const [perdasData, setPerdasData] = useState<any>(null);
  const [umaVezData, setUmaVezData] = useState<any>(null);
  const [perdasLoading, setPerdasLoading] = useState(false);

  // Drilldown state (for barbeiro detail view)
  const [drillBarbeiroId, setDrillBarbeiroId] = useState('');
  const [drillBarbeiroNome, setDrillBarbeiroNome] = useState('');
  const [drillModo, setDrillModo] = useState<DrillModo>('COMPARTILHADOS');
  const [drillPage, setDrillPage] = useState(0);
  const [drill, setDrill] = useState<RpcClientesListaCarteira | null>(null);

  // Carteira data for barbeiro view
  const [carteira, setCarteira] = useState<CarteiraItem | null>(null);

  // Drill faixa state
  const [drillFaixaTipo, setDrillFaixaTipo] = useState('');
  const [drillFaixaValor, setDrillFaixaValor] = useState('');
  const [drillFaixaLabel, setDrillFaixaLabel] = useState('');
  const [drillFaixaData, setDrillFaixaData] = useState<any>(null);
  const [drillFaixaColaboradorId, setDrillFaixaColaboradorId] = useState<string | null>(null);
  const [screenBeforeDrill, setScreenBeforeDrill] = useState<Screen>('PAINEL');

  // ---- Load Panel + barbearia detalhe ----
  const loadPainel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [painelRes, detalheRes] = await Promise.all([
        supabase.rpc('rpc_clientes_painel_completo' as any, {
          p_data_inicio: dataInicio,
          p_data_fim: dataFim,
          p_ref_date: dataFim,
          p_colaborador_id: filtroColaboradorId,
        }),
        supabase.rpc('rpc_clientes_barbearia_detalhe' as any, {
          p_data_inicio: dataInicio,
          p_data_fim: dataFim,
          p_ref_date: dataFim,
        }),
      ]);

      if (painelRes.error) throw painelRes.error;
      setPainel(painelRes.data as unknown as PainelCompleto);
      if (detalheRes.data) setBarbeariadetalhe(detalheRes.data);
    } catch (e: any) {
      console.error('useClientes loadPainel error:', e);
      setError(e?.message ?? 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, filtroColaboradorId]);

  // ---- Load Perdas Analysis (on demand) ----
  const loadPerdasAnalise = useCallback(async () => {
    setPerdasLoading(true);
    try {
      const transformDrillResult = (raw: any) => {
        if (!raw || !Array.isArray(raw.rows)) return raw;
        const rows = raw.rows as any[];
        const groups: Record<string, any> = {};
        for (const r of rows) {
          const key = r.colaborador_id || '__sem_barbeiro__';
          if (!groups[key]) {
            groups[key] = {
              colaborador_id: r.colaborador_id || '',
              colaborador_nome: r.colaborador_nome || 'Sem barbeiro',
              total_clientes: 0,
              clientes: [],
            };
          }
          groups[key].total_clientes++;
          groups[key].clientes.push(r);
        }
        return {
          total: raw.total ?? rows.length,
          rows,
          por_barbeiro: Object.values(groups).sort((a: any, b: any) => b.total_clientes - a.total_clientes),
        };
      };

      const [perdidosRes, umaVezRes] = await Promise.all([
        supabase.rpc('rpc_clientes_drill_faixa' as any, {
          p_data_inicio: dataInicio,
          p_data_fim: dataFim,
          p_ref_date: dataFim,
          p_tipo: 'STATUS',
          p_valor: 'PERDIDO',
          p_colaborador_id: null,
        }),
        supabase.rpc('rpc_clientes_drill_faixa' as any, {
          p_data_inicio: dataInicio,
          p_data_fim: dataFim,
          p_ref_date: dataFim,
          p_tipo: 'FAIXA_FREQ',
          p_valor: 'uma_vez_novo',
          p_colaborador_id: null,
        }),
      ]);

      if (perdidosRes.data) setPerdasData(transformDrillResult(perdidosRes.data));
      if (umaVezRes.data) setUmaVezData(transformDrillResult(umaVezRes.data));
    } catch (e: any) {
      console.error('useClientes loadPerdasAnalise error:', e);
    } finally {
      setPerdasLoading(false);
    }
  }, [dataInicio, dataFim]);

  // ---- Load Drilldown (for barbeiro detail) ----
  const loadDrilldown = useCallback(async (params?: {
    barbeiroId?: string;
    modo?: DrillModo;
    page?: number;
  }) => {
    const bId = params?.barbeiroId ?? drillBarbeiroId;
    const modo = params?.modo ?? drillModo;
    const page = params?.page ?? drillPage;

    if (!bId) return;

    setLoading(true);
    setError(null);
    try {
      // Calculate janela from period for drilldown compatibility
      const di = new Date(dataInicio);
      const df = new Date(dataFim);
      const diffDays = Math.round((df.getTime() - di.getTime()) / (1000 * 60 * 60 * 24));
      const janelaDias = Math.max(30, diffDays);

      const { data, error: err } = await supabase.rpc('rpc_clientes_lista_carteira' as any, {
        p_ref: dataFim,
        p_janela_dias: janelaDias,
        p_colaborador_id: bId,
        p_modo: modo,
        p_limit: DRILL_PAGE_SIZE,
        p_offset: page * DRILL_PAGE_SIZE,
        p_export: false,
        p_excluir_sem_cadastro: true,
      });

      if (err) throw err;
      setDrill(data as unknown as RpcClientesListaCarteira);
    } catch (e: any) {
      console.error('useClientes loadDrilldown error:', e);
      setError(e?.message ?? 'Erro ao carregar drilldown.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, drillBarbeiroId, drillModo, drillPage]);

  // ---- Export CSV ----
  const exportDrilldownCsv = useCallback(async () => {
    if (!drillBarbeiroId) return;
    setLoading(true);
    setError(null);
    try {
      const di = new Date(dataInicio);
      const df = new Date(dataFim);
      const diffDays = Math.round((df.getTime() - di.getTime()) / (1000 * 60 * 60 * 24));
      const janelaDias = Math.max(30, diffDays);

      const { data, error: err } = await supabase.rpc('rpc_clientes_lista_carteira' as any, {
        p_ref: dataFim,
        p_janela_dias: janelaDias,
        p_colaborador_id: drillBarbeiroId,
        p_modo: drillModo,
        p_export: true,
        p_excluir_sem_cadastro: true,
      });

      if (err) throw err;
      const result = data as unknown as RpcClientesListaCarteira;
      const rows = result?.rows ?? [];
      const csv = toCsv(rows as any[]);
      const safeName = drillBarbeiroNome?.replace(/\s+/g, '_') || drillBarbeiroId;
      downloadCsv(csv, `clientes_${safeName}_${drillModo}.csv`);
    } catch (e: any) {
      console.error('useClientes exportCsv error:', e);
      setError(e?.message ?? 'Erro ao exportar CSV.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, drillBarbeiroId, drillBarbeiroNome, drillModo]);

  // Barbeiro detalhe state
  const [barbeiroDetalhe, setBarbeiroDetalhe] = useState<any>(null);

  // ---- Select barbeiro (from ranking → barbeiro view) ----
  const selectBarbeiro = useCallback((id: string, nome: string) => {
    setDrillBarbeiroId(id);
    setDrillBarbeiroNome(nome);
    setScreen('BARBEIRO');
    setBarbeiroDetalhe(null);

    // Load carteira + barbeiro detalhe in parallel
    (async () => {
      try {
        const di = new Date(dataInicio);
        const df = new Date(dataFim);
        const diffDays = Math.round((df.getTime() - di.getTime()) / (1000 * 60 * 60 * 24));
        const janelaDias = Math.max(30, diffDays);

        const [carteiraRes, detalheRes] = await Promise.all([
          supabase.rpc('rpc_clientes_carteira_compartilhada' as any, {
            p_ref: dataFim,
            p_janelas: [janelaDias],
          }),
          supabase.rpc('rpc_clientes_barbeiro_detalhe' as any, {
            p_data_inicio: dataInicio,
            p_data_fim: dataFim,
            p_ref_date: dataFim,
            p_colaborador_id: id,
          }),
        ]);

        const carteiraData = carteiraRes.data as any;
        const row = (carteiraData?.table ?? []).find((x: any) => x.colaborador_id === id);
        setCarteira(row ?? null);

        if (detalheRes.data) {
          setBarbeiroDetalhe(detalheRes.data);
        }
      } catch { /* ignore */ }
    })();
  }, [dataInicio, dataFim]);

  // ---- Open Drilldown ----
  const openDrilldown = useCallback((barbeiroId: string, barbeiroNome: string, modo: DrillModo) => {
    setDrillBarbeiroId(barbeiroId);
    setDrillBarbeiroNome(barbeiroNome);
    setDrillModo(modo);
    setDrillPage(0);
    setDrill(null);
    setScreen('DRILLDOWN');
  }, []);

  // When screen changes to DRILLDOWN, load
  useEffect(() => {
    if (screen === 'DRILLDOWN' && drillBarbeiroId) {
      loadDrilldown({ barbeiroId: drillBarbeiroId, modo: drillModo, page: drillPage });
    }
  }, [screen, drillBarbeiroId]);

  // Auto-load on mount and when period changes
  useEffect(() => { loadPainel(); }, [loadPainel]);

  // Filter barbeiro inline (from geral tab)
  const filterByBarbeiro = useCallback((id: string | null, nome?: string) => {
    setFiltroColaboradorId(id);
    setFiltroColaboradorNome(nome ?? '');
  }, []);

  // ---- Open Drill Faixa ----
  const openDrillFaixa = useCallback(async (tipo: string, valor: string, label: string, overrideColaboradorId?: string | null) => {
    setDrillFaixaTipo(tipo);
    setDrillFaixaValor(valor);
    setDrillFaixaLabel(label);
    setDrillFaixaData(null);
    setDrillFaixaColaboradorId(overrideColaboradorId !== undefined ? overrideColaboradorId : filtroColaboradorId);
    setScreenBeforeDrill(screen);
    setScreen('DRILL_FAIXA');
    setLoading(true);
    setError(null);
    try {
      const colaboradorToUse = overrideColaboradorId !== undefined ? overrideColaboradorId : filtroColaboradorId;
      const { data, error: err } = await supabase.rpc('rpc_clientes_drill_faixa' as any, {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_ref_date: dataFim,
        p_tipo: tipo,
        p_valor: valor,
        p_colaborador_id: colaboradorToUse,
      });
      if (err) throw err;
      // Transform flat {total, rows} into grouped {total, por_barbeiro, resumo}
      const raw = data as any;
      if (raw && Array.isArray(raw.rows)) {
        const rows = raw.rows as any[];
        const groups: Record<string, any> = {};
        let sumDias = 0, sumFreq = 0, sumValor = 0, count = rows.length;
        for (const r of rows) {
          const key = r.colaborador_id || '__sem_barbeiro__';
          if (!groups[key]) {
            groups[key] = {
              colaborador_id: r.colaborador_id || '',
              colaborador_nome: r.colaborador_nome || 'Sem barbeiro',
              total_clientes: 0,
              clientes: [],
            };
          }
          groups[key].total_clientes++;
          groups[key].clientes.push({
            cliente_id: r.cliente_id,
            cliente_nome: r.cliente_nome,
            telefone: r.telefone,
            ultima_visita: r.ultima_visita,
            dias_sem_vir: r.dias_sem_vir ?? 0,
            dias_distintos: r.dias_distintos ?? r.qtd_visitas ?? 0,
            valor_total: r.valor_total ?? 0,
            status_cliente: r.status_cliente ?? '',
          });
          sumDias += (r.dias_sem_vir ?? 0);
          sumFreq += (r.dias_distintos ?? r.qtd_visitas ?? 0);
          sumValor += (r.valor_total ?? 0);
        }
        const por_barbeiro = Object.values(groups).sort((a: any, b: any) => b.total_clientes - a.total_clientes);
        const transformed = {
          total: raw.total ?? count,
          por_barbeiro,
          resumo: {
            media_dias_sem_vir: count > 0 ? sumDias / count : 0,
            media_frequencia: count > 0 ? sumFreq / count : 0,
            valor_total: sumValor,
            ticket_medio: count > 0 ? sumValor / count : 0,
          },
        };
        setDrillFaixaData(transformed);
      } else {
        setDrillFaixaData(raw);
      }
    } catch (e: any) {
      console.error('useClientes openDrillFaixa error:', e);
      setError(e?.message ?? 'Erro ao carregar drill.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, filtroColaboradorId, screen]);

  // Computed
  const drillTotalPages = useMemo(() => {
    const total = drill?.total ?? 0;
    return Math.max(1, Math.ceil(total / DRILL_PAGE_SIZE));
  }, [drill]);

  const periodoLabel = useMemo(() => calcPeriodoLabel(dataInicio, dataFim), [dataInicio, dataFim]);

  return {
    // Period
    dataInicio, setDataInicio,
    dataFim, setDataFim,
    refDate: dataFim, setRefDate: setDataFim,
    periodoLabel,
    // Navigation
    screen, setScreen,
    activeTab, setActiveTab,
    // Barbeiro filter
    filtroColaboradorId, filtroColaboradorNome, filterByBarbeiro,
    // Loading
    loading, error,
    // Main data
    painel,
    barbeariadetalhe,
    // Perdas tab
    perdasData, umaVezData, perdasLoading, loadPerdasAnalise,
    // Barbeiro detail
    carteira, barbeiroDetalhe,
    drillBarbeiroId, drillBarbeiroNome,
    drillModo, setDrillModo,
    drillPage, setDrillPage,
    drill, drillTotalPages,
    // Drill faixa
    drillFaixaTipo, drillFaixaValor, drillFaixaLabel, drillFaixaData,
    drillFaixaColaboradorId, screenBeforeDrill,
    openDrillFaixa,
    // Actions
    loadPainel, loadDrilldown, selectBarbeiro, openDrilldown, exportDrilldownCsv,
    filterByBarbeiro2: filterByBarbeiro,
    DRILL_PAGE_SIZE,
  };
}

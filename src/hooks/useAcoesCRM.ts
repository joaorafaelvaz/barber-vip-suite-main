import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RaioXComputedFilters } from '@/pages/app/raiox-clientes/raioxTypes';
import type { RaioxConfigInstance } from '@/pages/app/raiox-clientes/RaioXClientesTabs';
import { defaultRaioxClientesConfig, type RaioxClientesConfigJson } from '@/pages/app/raiox-clientes/config/defaultConfig';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Max concurrent values per dimension (to avoid timeouts)            */
/* ------------------------------------------------------------------ */
const MAX_VALUES: Record<string, number> = {
  cadencia_individual: 2, // RPC pesado — limita seleção simultânea, mas carrega sequencialmente
};
const DEFAULT_MAX_VALUES = 3;

/* Row limits por dimensão — retornar menos linhas alivia o banco */
const ROW_LIMITS: Record<string, number> = {
  cadencia_individual: 200,
};
const DEFAULT_ROW_LIMIT = 300;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CrmDimension = 'cadencia_individual' | 'perfil' | 'cadencia_fixa' | 'status_12m' | 'one_shot' | 'sinais' | 'atividade';

export interface CrmValueMeta { key: string; label: string; color: string }
export interface CrmDimensionMeta { key: CrmDimension; label: string; values: CrmValueMeta[] }

export interface CrmClient {
  cliente_id: string;
  cliente_nome: string | null;
  telefone: string | null;
  colaborador_nome: string | null;
  colaborador_id: string | null;
  ultima_visita: string | null;
  dias_sem_vir: number;
  visitas_total: number;
  valor_total: number;
  cadencia_dias?: number | null;
  ratio?: number | null;
  seg_cadencia?: string | null;
  seg_perfil?: string | null;
  seg_macro?: string | null;
  _dimension_value: string;
}

export interface CrmTemplate { id: string; categoria: string; codigo: string; titulo: string; corpo: string }
export interface CrmEnvio {
  id: string; cliente_id: string; cliente_nome: string | null; categoria: string;
  status_cliente: string; mensagem_final: string | null; enviado: boolean;
  enviado_em: string | null; enviado_por: string | null; ref_date: string;
  created_at: string; observacao: string | null; colaborador_nome: string | null; telefone: string | null;
}

/* ------------------------------------------------------------------ */
/*  Dimension definitions                                              */
/* ------------------------------------------------------------------ */

const STATIC_DIMENSIONS: CrmDimensionMeta[] = [
  {
    key: 'cadencia_individual', label: 'Cadência Individual',
    values: [
      { key: 'EM_RISCO', label: 'Em Risco', color: 'text-orange-400' },
      { key: 'PERDIDO', label: 'Perdido', color: 'text-rose-400' },
      { key: 'ESPACANDO', label: 'Espaçando', color: 'text-amber-400' },
      { key: 'PRIMEIRA_VEZ', label: '1ª Vez', color: 'text-sky-400' },
      { key: 'REGULAR', label: 'Regular', color: 'text-emerald-400' },
      { key: 'ASSIDUO', label: 'Assíduo', color: 'text-emerald-300' },
    ],
  },
  {
    key: 'perfil', label: 'Perfil',
    values: [
      { key: 'FIEL', label: 'Fiel', color: 'text-emerald-400' },
      { key: 'RECORRENTE', label: 'Recorrente', color: 'text-emerald-300' },
      { key: 'IRREGULAR', label: 'Regular', color: 'text-amber-400' },
      { key: 'OCASIONAL', label: 'Ocasional', color: 'text-orange-400' },
      { key: 'INATIVO', label: 'Inativo', color: 'text-rose-400' },
    ],
  },
  {
    key: 'status_12m', label: 'Status 12m',
    values: [
      { key: 'SAUDAVEL', label: 'Saudável', color: 'text-emerald-400' },
      { key: 'EM_RISCO', label: 'Em Risco', color: 'text-orange-400' },
      { key: 'PERDIDO', label: 'Perdido', color: 'text-rose-400' },
    ],
  },
  {
    key: 'one_shot', label: 'One-Shot',
    values: [
      { key: 'ONE_SHOT_AGUARDANDO', label: 'Aguardando', color: 'text-sky-400' },
      { key: 'ONE_SHOT_RISCO', label: 'Em Risco', color: 'text-orange-400' },
      { key: 'ONE_SHOT_PERDIDO', label: 'Perdido', color: 'text-rose-400' },
    ],
  },
  {
    key: 'sinais', label: 'Sinais da Base',
    values: [
      { key: 'ATIVOS', label: 'Ativos na janela', color: 'text-emerald-400' },
      { key: 'MACRO_EM_RISCO', label: 'Em Risco (macro)', color: 'text-orange-400' },
      { key: 'MACRO_PERDIDO', label: 'Perdidos (macro)', color: 'text-rose-400' },
      { key: 'RESGATADOS', label: 'Resgatados', color: 'text-sky-400' },
    ],
  },
  {
    key: 'atividade', label: 'Atividade do Período',
    values: [
      { key: 'UNICOS', label: 'Clientes únicos', color: 'text-foreground' },
      { key: 'NOVOS', label: 'Novos clientes', color: 'text-sky-400' },
    ],
  },
];

export function buildDimensions(cfg: Partial<RaioxClientesConfigJson>): CrmDimensionMeta[] {
  const d = defaultRaioxClientesConfig;
  const faixas = cfg.cadencia_fixa_faixas ?? d.cadencia_fixa_faixas;
  const cadenciaFixa: CrmDimensionMeta = {
    key: 'cadencia_fixa', label: 'Cadência Fixa',
    values: faixas.map(f => ({
      key: f.max != null ? `${f.min}-${f.max}` : `${f.min}+`,
      label: f.label,
      color: f.min <= 30 ? 'text-emerald-400' : f.min <= 60 ? 'text-amber-400' : f.min <= 90 ? 'text-orange-400' : 'text-rose-400',
    })),
  };
  const result = [...STATIC_DIMENSIONS];
  const idx = result.findIndex(d => d.key === 'cadencia_individual');
  result.splice(idx + 1, 0, cadenciaFixa);
  return result;
}

/* ------------------------------------------------------------------ */
/*  Strategy Presets                                                   */
/* ------------------------------------------------------------------ */

export interface CrmPreset {
  key: string;
  label: string;
  description: string;
  dimension: CrmDimension;
  values: string[];
  urgency: 'high' | 'medium' | 'low';
}

export const CRM_PRESETS: CrmPreset[] = [
  {
    key: 'one_shot_all',
    label: '1ª Visita — todos',
    description: 'Vieram 1x (ever): aguardando, em risco e perdidos. Ordena do mais urgente.',
    dimension: 'one_shot',
    values: ['ONE_SHOT_RISCO', 'ONE_SHOT_PERDIDO', 'ONE_SHOT_AGUARDANDO'],
    urgency: 'high',
  },
  {
    key: 'em_risco',
    label: 'Em Risco',
    description: 'Demorando além do normal para voltar (ratio alto). Momento certo de agir.',
    dimension: 'cadencia_individual',
    values: ['EM_RISCO'],
    urgency: 'high',
  },
  {
    key: 'perdidos',
    label: 'Perdidos',
    description: 'Clientes com muito tempo sem aparecer. Mensagem de resgate.',
    dimension: 'cadencia_individual',
    values: ['PERDIDO'],
    urgency: 'high',
  },
  {
    key: 'espacando',
    label: 'Espaçando',
    description: 'Voltam ainda, mas com intervalos maiores que o habitual.',
    dimension: 'cadencia_individual',
    values: ['ESPACANDO'],
    urgency: 'medium',
  },
  {
    key: 'one_shot_fresh',
    label: '1ª Visita — recentes',
    description: 'Vieram 1x há menos de 45 dias. Mensagem de boas-vindas e convite.',
    dimension: 'one_shot',
    values: ['ONE_SHOT_AGUARDANDO'],
    urgency: 'low',
  },
  {
    key: 'macro_risco',
    label: 'Status 12m em risco',
    description: 'Não voltam há 46-90 dias (qualquer histórico de visitas).',
    dimension: 'status_12m',
    values: ['EM_RISCO'],
    urgency: 'medium',
  },
];

/* ------------------------------------------------------------------ */
/*  RPC routing                                                        */
/* ------------------------------------------------------------------ */

function getRpcCall(
  dimension: CrmDimension, valueKey: string,
  filters: RaioXComputedFilters, cfg: Partial<RaioxClientesConfigJson>,
): { rpc: string; params: Record<string, any> } {
  const base = {
    p_inicio: filters.dataInicioISO, p_fim: filters.dataFimISO,
    p_janela_dias: filters.janelaDias,
    p_colaborador_id: filters.filtroColaborador.id || null,
    p_excluir_sem_cadastro: filters.excluirSemCadastro,
    p_limit: ROW_LIMITS[dimension] ?? DEFAULT_ROW_LIMIT,
  };
  const d = defaultRaioxClientesConfig;

  switch (dimension) {
    case 'perfil':
      return { rpc: 'rpc_raiox_overview_drill_v1', params: { ...base, p_tipo: 'PERFIL', p_valor: valueKey } };
    case 'status_12m':
      return { rpc: 'rpc_raiox_overview_drill_v1', params: { ...base, p_tipo: 'MACRO', p_valor: valueKey } };
    case 'one_shot':
      return { rpc: 'rpc_raiox_overview_drill_v1', params: { ...base, p_tipo: 'CADENCIA', p_valor: valueKey } };
    case 'cadencia_fixa':
      return { rpc: 'rpc_raiox_overview_drill_v1', params: { ...base, p_tipo: 'CADENCIA_FIXA', p_valor: valueKey } };
    case 'sinais': {
      if (valueKey === 'MACRO_EM_RISCO') return { rpc: 'rpc_raiox_overview_drill_v1', params: { ...base, p_tipo: 'MACRO', p_valor: 'EM_RISCO' } };
      if (valueKey === 'MACRO_PERDIDO') return { rpc: 'rpc_raiox_overview_drill_v1', params: { ...base, p_tipo: 'MACRO', p_valor: 'PERDIDO' } };
      return { rpc: 'rpc_raiox_overview_drill_v1', params: { ...base, p_tipo: valueKey, p_valor: '' } };
    }
    case 'atividade':
      return { rpc: 'rpc_raiox_overview_drill_v1', params: { ...base, p_tipo: valueKey, p_valor: '' } };
    case 'cadencia_individual':
      return {
        rpc: 'rpc_raiox_clientes_cadencia_drill_v1',
        params: {
          ...base, p_tipo: valueKey, p_valor: '',
          p_base_mode: cfg.base_mode ?? d.base_mode,
          p_base_corte_meses: cfg.base_corte_meses ?? d.base_corte_meses,
          p_ref_mode: cfg.ref_mode ?? d.ref_mode,
          p_cadencia_meses_analise: cfg.cadencia_meses_analise ?? d.cadencia_meses_analise,
          p_cadencia_min_visitas: cfg.cadencia_min_visitas ?? d.cadencia_min_visitas,
          p_ratio_muito_frequente_max: cfg.ratio_muito_frequente_max ?? d.ratio_muito_frequente_max,
          p_ratio_regular_max: cfg.ratio_regular_max ?? d.ratio_regular_max,
          p_ratio_espacando_max: cfg.ratio_espacando_max ?? d.ratio_espacando_max,
          p_ratio_risco_max: cfg.ratio_risco_max ?? d.ratio_risco_max,
          p_one_shot_aguardando_max_dias: cfg.one_shot_aguardando_max_dias ?? d.one_shot_aguardando_max_dias,
          p_one_shot_risco_max_dias: cfg.one_shot_risco_max_dias ?? d.one_shot_risco_max_dias,
          p_atribuicao_modo: cfg.atribuicao_modo ?? d.atribuicao_modo,
          p_atribuicao_janela_meses: cfg.atribuicao_janela_meses ?? d.atribuicao_janela_meses,
        },
      };
    default:
      return { rpc: 'rpc_raiox_overview_drill_v1', params: { ...base, p_tipo: 'MACRO', p_valor: 'SAUDAVEL' } };
  }
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useAcoesCRM(filters: RaioXComputedFilters, raioxConfig: RaioxConfigInstance) {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [templates, setTemplates] = useState<CrmTemplate[]>([]);
  const [envios, setEnvios] = useState<CrmEnvio[]>([]);
  const [loading, setLoading] = useState(false);
  const [enviosLoading, setEnviosLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dimension, setDimension] = useState<CrmDimension>('status_12m');
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set(['EM_RISCO']));
  const [totals, setTotals] = useState<Record<string, number>>({});
  const abortRef = useRef(0);

  const cfg = raioxConfig.config;
  const dimensions = useMemo(() => buildDimensions(cfg), [cfg]);
  const currentDimension = dimensions.find(d => d.key === dimension) || dimensions[0];

  /* Load clients -------------------------------------------------- */
  const loadClients = useCallback(async () => {
    const values = Array.from(selectedValues);
    if (!values.length) { setClients([]); return; }
    const token = ++abortRef.current;
    setLoading(true);
    setError(null);
    try {
      // Sequential loading to avoid parallel heavy RPCs causing statement timeouts
      const all: any[][] = [];
      const newTotals: Record<string, number> = {};
      for (const val of values) {
        if (token !== abortRef.current) return; // abort if filters changed
        const { rpc, params } = getRpcCall(dimension, val, filters, cfg);
        const { data, error: rpcErr } = await supabase.rpc(rpc as any, params);
        if (rpcErr) throw new Error(`${val}: ${rpcErr.message}`);
        const rows = (data as any)?.rows || [];
        const total = (data as any)?.total ?? rows.length;
        newTotals[val] = total;
        all.push(rows.map((r: any) => ({ ...r, _dimension_value: val })));
      }
      if (token !== abortRef.current) return;
      const seen = new Set<string>();
      const merged: CrmClient[] = [];
      all.flat().forEach((r: any) => {
        if (!seen.has(r.cliente_id)) { seen.add(r.cliente_id); merged.push(r); }
      });
      setClients(merged);
      setTotals(newTotals);
    } catch (err: any) {
      if (token !== abortRef.current) return;
      const msg = err.message || '';
      if (msg.includes('statement timeout') || msg.includes('canceling statement')) {
        setError('Consulta muito pesada — tente filtrar por um barbeiro específico ou use uma dimensão mais leve (Status 12m, Perfil).');
      } else {
        setError(msg);
      }
    } finally {
      if (token === abortRef.current) setLoading(false);
    }
  }, [dimension, selectedValues, filters.dataInicioISO, filters.dataFimISO, filters.janelaDias, filters.filtroColaborador.id, filters.excluirSemCadastro, cfg]);

  /* Templates & envios -------------------------------------------- */
  const loadTemplates = useCallback(async () => {
    const { data } = await supabase.from('mensagem_templates').select('id, categoria, codigo, titulo, corpo').eq('ativo', true);
    if (data) setTemplates(data as CrmTemplate[]);
  }, []);

  const loadEnvios = useCallback(async () => {
    setEnviosLoading(true);
    const { data } = await supabase.from('mensagem_envios').select('*')
      .eq('enviado', true)
      .gte('ref_date', filters.dataInicioISO).lte('ref_date', filters.dataFimISO)
      .order('created_at', { ascending: false });
    if (data) setEnvios(data as CrmEnvio[]);
    setEnviosLoading(false);
  }, [filters.dataInicioISO, filters.dataFimISO]);

  const markAsSent = useCallback(async (params: {
    cliente_id: string; cliente_nome: string | null; categoria: string; status_cliente: string;
    colaborador_id: string | null; colaborador_nome: string | null; telefone: string | null;
    mensagem_sugerida: string; mensagem_final: string; observacao?: string; template_id?: string;
  }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error: insertErr } = await supabase.from('mensagem_envios').insert({
      ...params, observacao: params.observacao || null, template_id: params.template_id || null,
      ref_date: today, enviado: true, enviado_em: new Date().toISOString(), canal: 'whatsapp_manual',
    });
    if (insertErr) throw insertErr;
    await loadEnvios();
  }, [loadEnvios]);

  const deleteEnvio = useCallback(async (envioId: string) => {
    const { error: delErr } = await supabase.from('mensagem_envios').delete().eq('id', envioId);
    if (delErr) throw delErr;
    setEnvios(prev => prev.filter(e => e.id !== envioId));
  }, []);

  /* Dimension controls -------------------------------------------- */
  const changeDimension = useCallback((dim: CrmDimension) => {
    setDimension(dim);
    const meta = dimensions.find(d => d.key === dim);
    if (meta) {
      const maxVal = MAX_VALUES[dim] ?? DEFAULT_MAX_VALUES;
      const defaults = meta.values.length <= maxVal
        ? meta.values.map(v => v.key)
        : meta.values.slice(0, maxVal).map(v => v.key);
      setSelectedValues(new Set(defaults));
    }
  }, [dimensions]);

  const applyPreset = useCallback((preset: CrmPreset) => {
    setDimension(preset.dimension);
    setSelectedValues(new Set(preset.values));
  }, []);

  const maxForDimension = MAX_VALUES[dimension] ?? DEFAULT_MAX_VALUES;

  const toggleValue = useCallback((key: string) => {
    setSelectedValues(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= maxForDimension) {
          toast.warning(`Máximo de ${maxForDimension} valores simultâneos para "${currentDimension.label}". Desmarque um antes de adicionar outro.`);
          return prev;
        }
        next.add(key);
      }
      return next;
    });
  }, [maxForDimension, currentDimension.label]);

  const selectAllValues = useCallback(() => {
    const allKeys = currentDimension.values.map(v => v.key);
    if (allKeys.length > maxForDimension) {
      const limited = allKeys.slice(0, maxForDimension);
      setSelectedValues(new Set(limited));
      toast.info(`Selecionados os ${maxForDimension} primeiros valores. "${currentDimension.label}" é pesada — evite selecionar todos.`);
    } else {
      setSelectedValues(new Set(allKeys));
    }
  }, [currentDimension, maxForDimension]);

  const selectNoneValues = useCallback(() => { setSelectedValues(new Set()); }, []);

  /* Auto-load com debounce — evita disparar RPC a cada toggle rápido */
  useEffect(() => {
    const timer = setTimeout(() => { loadClients(); }, 500);
    return () => clearTimeout(timer);
  }, [loadClients]);
  useEffect(() => { loadTemplates(); loadEnvios(); }, [loadTemplates, loadEnvios]);

  /* Template helpers ----------------------------------------------- */
  const getTemplate = useCallback((status: string): CrmTemplate | null => {
    const catMap: Record<string, string> = {
      EM_RISCO: 'RISCO', PERDIDO: 'PERDIDO', ESPACANDO: 'ESPACANDO',
      PRIMEIRA_VEZ: 'PRIMEIRA_VEZ', REGULAR: 'REGULAR', ASSIDUO: 'ASSIDUO',
      ONE_SHOT_AGUARDANDO: 'PRIMEIRA_VEZ', ONE_SHOT_RISCO: 'RISCO', ONE_SHOT_PERDIDO: 'PERDIDO',
    };
    return templates.find(t => t.categoria === (catMap[status] || status)) || templates[0] || null;
  }, [templates]);

  const fillTemplate = useCallback((template: string, client: CrmClient): string => {
    return template
      .replace(/\{\{nome\}\}/g, client.cliente_nome?.split(' ')[0] || 'Cliente')
      .replace(/\{\{dias\}\}/g, String(client.dias_sem_vir ?? ''))
      .replace(/\{\{barbeiro\}\}/g, client.colaborador_nome || 'seu barbeiro');
  }, []);

  /* CSV export ---------------------------------------------------- */
  const exportCsv = useCallback((filteredClients: CrmClient[]) => {
    const contactedMap = new Map(envios.filter(e => e.enviado).map(e => [e.cliente_id, e]));
    const headers = ['Nome', 'Telefone', 'Barbeiro', 'Dias sem vir', 'Última visita', 'Visitas', 'Valor total', 'Filtro', 'Contactado', 'Data contato', 'Categoria contato', 'Observação'];
    const rows = filteredClients.map(c => {
      const envio = contactedMap.get(c.cliente_id);
      return [
        c.cliente_nome || '', c.telefone || '', c.colaborador_nome || '',
        c.dias_sem_vir, c.ultima_visita || '', c.visitas_total, (c.valor_total || 0).toFixed(2),
        c._dimension_value || '', envio ? 'Sim' : 'Não',
        envio?.enviado_em ? new Date(envio.enviado_em).toLocaleDateString('pt-BR') : '',
        envio?.categoria || '', envio?.observacao || '',
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `crm_${dimension}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [envios, dimension]);

  /* Stats --------------------------------------------------------- */
  const contactedIds = useMemo(() => new Set(envios.filter(e => e.enviado).map(e => e.cliente_id)), [envios]);
  const grandTotal = useMemo(() => Object.values(totals).reduce((s, n) => s + n, 0), [totals]);
  const stats = useMemo(() => ({
    total: clients.length,
    grandTotal,
    contacted: clients.filter(c => contactedIds.has(c.cliente_id)).length,
    pending: clients.filter(c => !contactedIds.has(c.cliente_id)).length,
    withPhone: clients.filter(c => c.telefone).length,
    byValue: currentDimension.values.reduce((acc, v) => {
      acc[v.key] = clients.filter(c => c._dimension_value === v.key).length;
      return acc;
    }, {} as Record<string, number>),
  }), [clients, contactedIds, currentDimension, grandTotal]);

  return {
    clients, templates, envios, loading, enviosLoading, error, stats, contactedIds,
    dimension, selectedValues, dimensions, currentDimension, totals,
    changeDimension, toggleValue, selectAllValues, selectNoneValues, applyPreset,
    reload: loadClients, reloadEnvios: loadEnvios, markAsSent, deleteEnvio,
    getTemplate, fillTemplate, exportCsv,
  };
}

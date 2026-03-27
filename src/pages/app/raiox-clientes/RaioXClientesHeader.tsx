import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RaioXComputedFilters, RaioXPeriodo } from './raioxTypes';
import { MONTHS, getYears } from './raioxUtils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RefreshCw, Download, X, SlidersHorizontal, Info, Clock, BookOpen, ChevronRight, ChevronDown, Settings, AlertTriangle, CheckCircle2, TrendingDown, Shield, Database, Users } from 'lucide-react';
import { BaseBadge } from '@/components/raiox-shared';
import type { BaseType } from '@/components/raiox-shared';
import type { RaioxConfigInstance } from './RaioXClientesTabs';
import type { RaioXTab } from './raioxTypes';
import type { OverviewData } from '@/hooks/raiox-clientes/useRaioXClientesOverview';
import type { CadenciaData } from '@/hooks/raiox-clientes/useRaioXClientesCadencia';
import type { ChurnEvolucaoData } from '@/hooks/raiox-clientes/useRaioXClientesChurnEvolucao';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

interface Props {
  filters: RaioXComputedFilters;
  onSetInicio: (p: RaioXPeriodo) => void;
  onSetFim: (p: RaioXPeriodo) => void;
  onSetJanelaDias: (v: number) => void;
  onSetExcluirSemCadastro: (v: boolean) => void;
  onSetFiltroColaborador: (id: string | null, nome: string) => void;
  onClearColaborador: () => void;
  onRefetch: () => void;
  onSetAutoAtualizar: (v: boolean) => void;
  onExport?: () => void;
  onTabChange?: (tab: RaioXTab) => void;
  raioxConfig?: RaioxConfigInstance;
  overviewData?: OverviewData | null;
  overviewLoading?: boolean;
  cadenciaData?: CadenciaData | null;
  cadenciaLoading?: boolean;
  churnEvolucaoData?: ChurnEvolucaoData | null;
}

import {
  computeScore, computeDimensionScore, scoreLabel, pct,
  SCORE_RANGES_ATIVOS, SCORE_RANGES_PERDIDOS, SCORE_RANGES_RISCO, SCORE_RANGES_CADENCIA,
  type ScoreRange,
} from './raioxScoreUtils';

interface Alerta { id: string; tipo: 'negativo' | 'positivo' | 'neutro'; titulo: string; detalhe: string; tab?: RaioXTab; }

function computeAlertas(kpis: OverviewData['kpis'] | undefined, serie: ChurnEvolucaoData['series'] | undefined, baseTotal: number, cfg: any): Alerta[] {
  const alertas: Alerta[] = [];
  if (!kpis) return alertas;
  const pPerd = baseTotal > 0 ? Math.round((kpis.clientes_perdidos_macro ?? 0) / baseTotal * 100) : 0;
  const pRisco = baseTotal > 0 ? Math.round((kpis.clientes_em_risco_macro ?? 0) / baseTotal * 100) : 0;
  const osRisco = (kpis.one_shot_em_risco ?? 0) + (kpis.one_shot_perdido ?? 0);

  if (pPerd > 35) alertas.push({ id: 'perd_crit', tipo: 'negativo', titulo: `${pPerd}% da base está perdida`, detalhe: 'Acima de 35% — campanhas de resgate urgentes.', tab: 'churn' });
  else if (pPerd > 20) alertas.push({ id: 'perd_alto', tipo: 'negativo', titulo: `${pPerd}% da base perdida`, detalhe: 'Acima de 20% — acompanhe tendência e acione CRM.', tab: 'churn' });

  if (pRisco > 25) alertas.push({ id: 'risco_crit', tipo: 'negativo', titulo: `${pRisco}% em risco`, detalhe: `Mais de 1 em 4 clientes sem vir. Ação urgente.`, tab: 'acoes' });
  else if (pRisco > 15) alertas.push({ id: 'risco_medio', tipo: 'neutro', titulo: `${pRisco}% em risco`, detalhe: 'Faixa de atenção. Acompanhe na aba Ações.', tab: 'acoes' });

  if (osRisco > 0) {
    const pOs = baseTotal > 0 ? Math.round(osRisco / baseTotal * 100) : 0;
    alertas.push({ id: 'oneshot', tipo: pOs > 10 ? 'negativo' : 'neutro', titulo: `${osRisco.toLocaleString('pt-BR')} one-shots passaram do prazo`, detalhe: 'Contato proativo pode converter. Aba One-Shot.', tab: 'oneshot' });
  }

  if (serie && serie.length >= 6) {
    const ult = serie.slice(-3);
    const ant = serie.slice(-6, -3);
    const mediaUltRisco = ult.reduce((s, m) => s + (m.em_risco ?? 0), 0) / 3;
    const mediaAntRisco = ant.reduce((s, m) => s + (m.em_risco ?? 0), 0) / 3;
    if (mediaAntRisco > 0 && (mediaUltRisco - mediaAntRisco) / mediaAntRisco > 0.15)
      alertas.push({ id: 'risco_acel', tipo: 'negativo', titulo: 'Em risco acelerando', detalhe: `+${Math.round((mediaUltRisco - mediaAntRisco) / mediaAntRisco * 100)}% vs 3 meses anteriores.`, tab: 'churn' });

    const mediaUltBase = ult.reduce((s, m) => s + (m.base_ativa ?? 0), 0) / 3;
    const mediaAntBase = ant.reduce((s, m) => s + (m.base_ativa ?? 0), 0) / 3;
    if (mediaAntBase > 0 && (mediaAntBase - mediaUltBase) / mediaAntBase > 0.08)
      alertas.push({ id: 'base_caindo', tipo: 'negativo', titulo: 'Retidos em queda', detalhe: `Queda de ${Math.round((mediaAntBase - mediaUltBase) / mediaAntBase * 100)}% vs 3 meses anteriores.`, tab: 'churn' });

    const mediaUltResg = ult.reduce((s, m) => s + (m.resgatados ?? 0), 0) / 3;
    const mediaAntResg = ant.reduce((s, m) => s + (m.resgatados ?? 0), 0) / 3;
    if (mediaAntResg > 0 && (mediaUltResg - mediaAntResg) / mediaAntResg > 0.2)
      alertas.push({ id: 'resgates', tipo: 'positivo', titulo: 'Resgates crescendo', detalhe: `+${Math.round((mediaUltResg - mediaAntResg) / mediaAntResg * 100)}% — ações de recuperação funcionando.`, tab: 'churn' });

    const mediaUltRiscoB = ult.reduce((s, m) => s + (m.em_risco ?? 0), 0) / 3;
    const mediaAntRiscoB = ant.reduce((s, m) => s + (m.em_risco ?? 0), 0) / 3;
    if (mediaAntRiscoB > 0 && (mediaAntRiscoB - mediaUltRiscoB) / mediaAntRiscoB > 0.1)
      alertas.push({ id: 'risco_caindo', tipo: 'positivo', titulo: 'Em risco reduzindo', detalhe: `Queda de ${Math.round((mediaAntRiscoB - mediaUltRiscoB) / mediaAntRiscoB * 100)}% — tendência positiva.`, tab: 'churn' });
  }

  const novos = kpis.novos_clientes_periodo ?? 0;
  const resgatados = kpis.clientes_resgatados_periodo ?? 0;
  if (resgatados > 0) alertas.push({ id: 'resg_atual', tipo: 'positivo', titulo: `${resgatados.toLocaleString('pt-BR')} clientes resgatados no período`, detalhe: 'Ações de recuperação tiveram resultado.', tab: 'churn' });
  if (novos > 0 && baseTotal > 0 && Math.round(novos / baseTotal * 100) >= 10)
    alertas.push({ id: 'novos_ok', tipo: 'positivo', titulo: `${Math.round(novos / baseTotal * 100)}% de novos no período`, detalhe: 'Boa aquisição de clientes.', tab: 'cohort' });

  if (alertas.filter(a => a.tipo === 'negativo').length === 0)
    alertas.push({ id: 'ok', tipo: 'positivo', titulo: 'Base sem alertas críticos', detalhe: 'Indicadores dentro dos parâmetros normais.' });

  return alertas.sort((a, b) => ({ negativo: 0, neutro: 1, positivo: 2 }[a.tipo] - ({ negativo: 0, neutro: 1, positivo: 2 }[b.tipo])));
}

function fmtPeriodoCompacto(filters: RaioXComputedFilters): string {
  const { inicio, fim } = filters.periodo;
  const i = `${MONTH_SHORT[inicio.month - 1]}/${String(inicio.year).slice(2)}`;
  const f = `${MONTH_SHORT[fim.month - 1]}/${String(fim.year).slice(2)}`;
  return inicio.month === fim.month && inicio.year === fim.year ? i : `${i} → ${f}`;
}

const MONTH_LONG = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function fmtPeriodoLongo(filters: RaioXComputedFilters): string {
  const { inicio, fim } = filters.periodo;
  const i = `${MONTH_LONG[inicio.month - 1]} ${inicio.year}`;
  const f = `${MONTH_LONG[fim.month - 1]} ${fim.year}`;
  return inicio.month === fim.month && inicio.year === fim.year ? i : `${i} → ${f}`;
}

function fmtRef(fim: RaioXPeriodo): string {
  const lastDays = [31,28,31,30,31,30,31,31,30,31,30,31];
  const d = lastDays[fim.month - 1];
  return `${String(d).padStart(2,'0')}/${String(fim.month).padStart(2,'0')}/${fim.year}`;
}

function fmtDateISO(p: RaioXPeriodo, type: 'start' | 'end'): string {
  if (type === 'start') return `01/${String(p.month).padStart(2,'0')}/${p.year}`;
  const lastDays = [31,28,31,30,31,30,31,31,30,31,30,31];
  return `${lastDays[p.month - 1]}/${String(p.month).padStart(2,'0')}/${p.year}`;
}
function BarbeiroFilter({ filtroColaborador, onSetFiltroColaborador, onClearColaborador, dataInicioISO, dataFimISO }: {
  filtroColaborador: { id: string | null; nome: string };
  onSetFiltroColaborador: (id: string | null, nome: string) => void;
  onClearColaborador: () => void;
  dataInicioISO: string;
  dataFimISO: string;
}) {
  const { data: barbeiros } = useQuery({
    queryKey: ['barbeiros-periodo-raiox', dataInicioISO, dataFimISO],
    queryFn: async () => {
      // 1. Barbeiros (tipo_colaborador = 'barbeiro') da dimensão
      const { data: dimBarbeiros, error: e1 } = await supabase
        .from('dimensao_colaboradores')
        .select('colaborador_id, colaborador_nome')
        .eq('tipo_colaborador', 'barbeiro')
        .eq('ativo', true);
      if (e1) throw e1;

      // 2. Colaborador_ids distintos com vendas no período
      const { data: vendasIds, error: e2 } = await supabase
        .from('vendas_api_raw')
        .select('colaborador_id')
        .gte('venda_data_ts', dataInicioISO)
        .lte('venda_data_ts', dataFimISO)
        .not('colaborador_id', 'is', null);
      if (e2) throw e2;

      const idsComVenda = new Set((vendasIds || []).map(v => v.colaborador_id));
      return (dimBarbeiros || [])
        .filter(b => idsComVenda.has(b.colaborador_id))
        .sort((a, b) => (a.colaborador_nome ?? '').localeCompare(b.colaborador_nome ?? ''));
    },
    staleTime: 3 * 60 * 1000,
  });

  // Auto-clear se barbeiro selecionado não existe mais na lista filtrada
  useEffect(() => {
    if (filtroColaborador.id && barbeiros && !barbeiros.some(b => b.colaborador_id === filtroColaborador.id)) {
      onClearColaborador();
    }
  }, [barbeiros, filtroColaborador.id, onClearColaborador]);

  return (
    <div className="space-y-1">
      <label className="text-[10px] text-muted-foreground">Barbeiro</label>
      <Select
        value={filtroColaborador.id ?? '__todos__'}
        onValueChange={(v) => {
          if (v === '__todos__') {
            onClearColaborador();
          } else {
            const b = barbeiros?.find((b) => b.colaborador_id === v);
            onSetFiltroColaborador(v, b?.colaborador_nome ?? '');
          }
        }}
      >
        <SelectTrigger className="w-[180px] h-8 text-xs">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent className="max-h-[200px] overflow-y-auto">
          <SelectItem value="__todos__" className="text-xs">Todos</SelectItem>
          {barbeiros?.map((b) => (
            <SelectItem key={b.colaborador_id} value={b.colaborador_id} className="text-xs">
              {b.colaborador_nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}


export function RaioXClientesHeader({
  filters, onSetInicio, onSetFim, onSetJanelaDias, onSetExcluirSemCadastro,
  onSetFiltroColaborador, onClearColaborador, onRefetch, onSetAutoAtualizar, onExport, onTabChange, raioxConfig,
  overviewData, overviewLoading, cadenciaData, cadenciaLoading, churnEvolucaoData,
}: Props) {
  const years = getYears(5);
  const { inicio, fim } = filters.periodo;
  const [open, setOpen] = useState(false);
  const [comoLerOpen, setComoLerOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [customJanela, setCustomJanela] = useState(false);
  const [customValue, setCustomValue] = useState('');

  // Score de saúde
  const kpis = overviewData?.kpis;
  const basePrincipalTotal = (overviewData?.meta?.base_total as number) ?? 0;
  const baseDistTotal = (overviewData?.meta?.base_distribuicao_total as number) ?? 0;
  const cfg = raioxConfig?.config;
  const scoreStale = !!(overviewLoading || cadenciaLoading);
  const score = kpis ? computeScore(kpis, cadenciaData?.kpis, baseDistTotal) : null;
  const sl = score !== null ? scoreLabel(score) : null;
  const alertas = kpis ? computeAlertas(kpis, churnEvolucaoData?.series, baseDistTotal, cfg) : [];
  const alertasNegativos = alertas.filter(a => a.tipo === 'negativo');
  const alertasPositivos = alertas.filter(a => a.tipo === 'positivo');

  const lastUpdate = filters.lastRefetchAt
    ? new Date(filters.lastRefetchAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const periodoCompacto = fmtPeriodoCompacto(filters);
  const refDate = fmtRef(fim); // fim do período selecionado (para informação de período)

  const baseModeLabel = cfg
    ? ({ JANELA: 'Janela', PERIODO_FILTRADO: 'Período', TOTAL: 'Total', TOTAL_COM_CORTE: `Corte ${cfg.base_corte_meses}m` }[cfg.base_mode] ?? cfg.base_mode)
    : null;
  const baseBadgeType: BaseType = cfg
    ? ({ JANELA: 'J', PERIODO_FILTRADO: 'P', TOTAL: 'T', TOTAL_COM_CORTE: 'P' }[cfg.base_mode] ?? 'P') as BaseType
    : 'P';
  const statusMeses = cfg?.status12m_meses ?? 12;

  const resumoFiltros = [
    periodoCompacto,
    `janela ${filters.janelaDias}d`,
    filters.excluirSemCadastro ? 'excl. s/ cadastro' : null,
    filters.autoAtualizar ? 'auto' : null,
    filters.filtroColaborador.id ? filters.filtroColaborador.nome : null,
  ].filter(Boolean).join(' · ');

  const handleJanelaChange = (v: string) => {
    if (v === 'custom') { setCustomJanela(true); }
    else { setCustomJanela(false); onSetJanelaDias(Number(v)); }
  };
  const handleCustomConfirm = () => {
    const num = Number(customValue);
    if (num > 0) { onSetJanelaDias(num); setCustomJanela(false); setCustomValue(''); }
  };

  // Helper: compute dynamic dates for context popover
  // refDateObj = fim do período selecionado (para título e info de período)
  const refDateObj = new Date(fim.year, fim.month - 1, new Date(fim.year, fim.month, 0).getDate());
  const corteMeses = cfg?.base_corte_meses ?? 24;
  // Mirror DB exactly: uses *30 per month (not calendar months) for cutoff windows
  const basePrincipalInicio = cfg?.base_mode === 'TOTAL_COM_CORTE'
    ? new Date(refDateObj.getTime() - corteMeses * 30 * 86400000)
    : new Date(inicio.year, inicio.month - 1, 1);
  const fmtDMY = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

  // refDateBase: driven by config REF setting (same logic as the RPC)
  // FIM_FILTRO (default) = last day of selected filter period; HOJE = today
  const refDateBase = cfg?.ref_mode === 'HOJE' ? new Date() : refDateObj;
  const refLabel = cfg?.ref_mode === 'HOJE' ? 'hoje' : 'fim do período';

  // Mirror DB exactly: status12m uses v_ref - (meses * 30) days; janela uses v_ref - janelaDias days
  const status12mInicio = new Date(refDateBase.getTime() - statusMeses * 30 * 86400000);
  const janelaInicio = new Date(refDateBase.getTime() - filters.janelaDias * 86400000);
  const refHoje = fmtDMY(refDateBase);

  // Contagens para contexto
  // statusBaseTotal from por_macro sum (or fallback to baseDistTotal)
  const statusBaseTotal = baseDistTotal > 0 ? baseDistTotal : (overviewData?.distribuicoes?.por_macro
    ? overviewData.distribuicoes.por_macro.reduce((s, m) => s + (m.qtd ?? 0), 0) : null);
  const janelaAtivos = kpis?.clientes_ativos_janela ?? null;
  // Unique clients who actually visited in the filter period — the "how many" context number
  const clientesUnicos = kpis?.clientes_unicos_periodo ?? null;

  // Score composition items for Sheet — using interpolation
  const pAtivosVal = pct(kpis?.clientes_ativos_janela ?? 0, baseDistTotal);
  const pPerdVal = pct(kpis?.clientes_perdidos_macro ?? 0, baseDistTotal);
  const pRiscoVal = pct(kpis?.clientes_em_risco_macro ?? 0, baseDistTotal);
  const pCadSaude = cadenciaData?.kpis && cadenciaData.kpis.total > 0
    ? pct((cadenciaData.kpis.assiduo ?? 0) + (cadenciaData.kpis.regular ?? 0), cadenciaData.kpis.total) : null;

  // Helper: returns which range band a value falls in and the interpolation details
  function findActiveRange(value: number, ranges: ScoreRange, ascending: boolean) {
    if (ascending) {
      for (let i = ranges.length - 1; i >= 0; i--) {
        if (value >= ranges[i].min) {
          const r = ranges[i];
          const span = r.max - r.min;
          const progress = span > 0 ? Math.min((value - r.min) / span, 1) : 1;
          const fromPts = i > 0 ? ranges[i - 1].pts : 0;
          return { min: r.min, max: r.max, fromPts, toPts: r.pts, progress };
        }
      }
    } else {
      for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i];
        if (value < r.max || i === ranges.length - 1) {
          const span = r.max - r.min;
          const progress = span > 0 ? Math.min((value - r.min) / span, 1) : 1;
          const nextPts = i < ranges.length - 1 ? ranges[i + 1].pts : 0;
          return { min: r.min, max: r.max, fromPts: r.pts, toPts: nextPts, progress };
        }
      }
    }
    return null;
  }

  const cadTotal = cadenciaData?.kpis?.total ?? 0;
  const cadSaudeCount = pCadSaude !== null
    ? (cadenciaData?.kpis?.assiduo ?? 0) + (cadenciaData?.kpis?.regular ?? 0)
    : null;

  const cadMinVisitas = cfg?.cadencia_min_visitas ?? 3;
  const cadMesesAnalise = cfg?.cadencia_meses_analise ?? 12;

  const scoreItems = [
    {
      label: `Ativos (janela ${filters.janelaDias}d)`,
      max: 30,
      pctVal: pAtivosVal,
      ranges: SCORE_RANGES_ATIVOS,
      ascending: true,
      valor: Math.round(computeDimensionScore(pAtivosVal, SCORE_RANGES_ATIVOS, true) * 10) / 10,
      benchmark: 'Típica barbearia: 25–45% · Boa atividade: ≥50% · Excelente: ≥60%',
      periodoDesc: `${fmtDMY(janelaInicio)} – ${refHoje}`,
      totalBase: baseDistTotal,
      clientesCount: (kpis?.clientes_ativos_janela ?? null) as number | null,
      explanation: `Mede a fração da Base S cuja ÚLTIMA visita foi nos últimos ${filters.janelaDias} dias até o ${refLabel} (${refHoje}). Captura a "temperatura atual" da base — quanto mais alto, mais clientes estão em ciclo ativo de retorno.`,
      contextNote: `Universo: Base S (últimos ${statusMeses}m) → ${baseDistTotal.toLocaleString('pt-BR')} clientes. Mesmo denominador de Perdidos e Em risco, garantindo comparabilidade entre dimensões. "Ativos" ≠ clientes atendidos no período analisado — é quem tem a ÚLTIMA visita dentro do prazo a partir do ${refLabel}.`,
      tabRef: `Aba Visão Geral → distribuição de status · Aba Churn → tendência de base ativa`,
    },
    {
      label: 'Perdidos',
      max: 25,
      pctVal: pPerdVal,
      ranges: SCORE_RANGES_PERDIDOS,
      ascending: false,
      valor: Math.round(computeDimensionScore(pPerdVal, SCORE_RANGES_PERDIDOS, false) * 10) / 10,
      benchmark: 'Ótimo: <15% · Normal: 15–30% · Preocupante: 30–45% · Crítico: >45%',
      periodoDesc: `${fmtDMY(status12mInicio)} – ${refHoje}`,
      totalBase: baseDistTotal,
      clientesCount: (kpis?.clientes_perdidos_macro ?? null) as number | null,
      explanation: `Clientes da Base S com última visita há mais de 90 dias e ao menos 2 visitas no histórico. Representa churn real — clientes que tinham um padrão de retorno e pararam de vir. One-shots (1 visita) são excluídos pois têm critério próprio.`,
      contextNote: `Universo: Base S (últimos ${statusMeses}m) → ${baseDistTotal.toLocaleString('pt-BR')} clientes. Quanto maior o % de perdidos, maior o "rombo" na base. Multiplique pelo ticket médio para estimar receita em risco. Thresholds fixos: >90 dias = perdido (configurável na aba Config).`,
      tabRef: `Aba Churn → evolução de perdidos · Aba Ações → campanhas de resgate`,
    },
    {
      label: 'Em risco',
      max: 20,
      pctVal: pRiscoVal,
      ranges: SCORE_RANGES_RISCO,
      ascending: false,
      valor: Math.round(computeDimensionScore(pRiscoVal, SCORE_RANGES_RISCO, false) * 10) / 10,
      benchmark: 'Ótimo: <10% · Normal: 10–20% · Atenção: 20–30% · Crítico: >30%',
      periodoDesc: `${fmtDMY(status12mInicio)} – ${refHoje}`,
      totalBase: baseDistTotal,
      clientesCount: (kpis?.clientes_em_risco_macro ?? null) as number | null,
      explanation: `Clientes da Base S com última visita entre 46 e 90 dias atrás e ao menos 2 visitas. São clientes em "zona de alerta" — ainda não perdidos, mas com risco alto de churn se não contactados. É a janela de intervenção mais eficiente: o custo de resgatar aqui é muito menor que resgatar perdidos.`,
      contextNote: `Universo: Base S (últimos ${statusMeses}m) → ${baseDistTotal.toLocaleString('pt-BR')} clientes. Denominador = Base S total (mesmo de Perdidos e Ativos) — mantém comparabilidade entre dimensões. "Em risco ÷ janelaAtivos" não seria correto pois são populações parcialmente sobrepostas (clientes de 46-60d estão em ambos os grupos com janela=${filters.janelaDias}d). O valor absoluto de em risco importa: ${(kpis?.clientes_em_risco_macro ?? 0).toLocaleString('pt-BR')} clientes precisam de contato proativo.`,
      tabRef: `Aba Churn → curva de em risco · Aba Ações → segmento "Em risco" para CRM`,
    },
    {
      label: 'Cadência saudável',
      max: 25,
      pctVal: pCadSaude ?? 0,
      ranges: SCORE_RANGES_CADENCIA,
      ascending: true,
      valor: pCadSaude !== null
        ? Math.round(computeDimensionScore(pCadSaude, SCORE_RANGES_CADENCIA, true) * 10) / 10
        : 12,
      benchmark: 'Típica: 20–40% · Boa: 40–55% · Excelente: ≥55%',
      periodoDesc: cadTotal > 0 ? `${cadTotal.toLocaleString('pt-BR')} clientes com cadência calculável (≥${cadMinVisitas} visitas)` : `${fmtDMY(status12mInicio)} – ${refHoje}`,
      totalBase: cadTotal > 0 ? cadTotal : baseDistTotal,
      clientesCount: cadSaudeCount,
      noData: pCadSaude === null,
      explanation: `Mede clientes com ritmo de visita previsível e saudável. Para cada cliente com ≥${cadMinVisitas} visitas, calcula-se a cadência habitual (intervalo médio entre visitas) e depois o ratio = dias desde última visita ÷ cadência habitual. Assíduo (ratio ≤0,8) + Regular (0,8–1,2) = "saudável". Espaçando (1,2–1,8), Em risco (1,8–2,5), Perdido (>2,5) = em desvio. Exemplo: cliente com cadência de 30 dias → após 33 dias sem vir, ratio=1,1 (Regular ✓) → após 50 dias, ratio=1,67 (Espaçando ⚠️) → após 70 dias, ratio=2,33 (Em risco 🔴).`,
      contextNote: `⚠️ Universo MENOR que as outras dimensões: apenas clientes com ≥${cadMinVisitas} visitas nos últimos ${cadMesesAnalise} meses (${cadTotal > 0 ? cadTotal.toLocaleString('pt-BR') : '?'} de ${baseDistTotal.toLocaleString('pt-BR')} da Base S). Excluídos: one-shots, ocasionais e primeiras visitas — sem visitas suficientes para calcular ritmo habitual. Por isso este % é sobre um universo menor e não deve ser comparado diretamente com as outras dimensões. Ver detalhes completos na aba Cadência.`,
      tabRef: `Aba Cadência → análise individual de cadência · perfis Assíduo, Regular, Espaçando, Em risco, Perdido`,
    },
  ];

  return (
    <TooltipProvider>
      <Card className="border-border/50 overflow-hidden">

        {/* ── TÍTULO FIXO ── */}
        <div className="px-4 pt-3 pb-2.5 space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground leading-tight">Raio X – Clientes</h1>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onRefetch} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar dados</TooltipContent>
            </Tooltip>
            {onExport && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={onExport} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hidden sm:flex">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exportar</TooltipContent>
              </Tooltip>
            )}
            {lastUpdate && (
              <span className="text-[9px] text-muted-foreground/40 flex items-center gap-1 ml-1">
                <Clock className="h-2.5 w-2.5" />{lastUpdate}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{fmtPeriodoLongo(filters)} <span className="text-muted-foreground/50 text-xs tabular-nums">· {fmtDMY(new Date(inicio.year, inicio.month - 1, 1))} – {fmtDMY(refDateObj)}</span></p>

        </div>

        {/* ── BARRA DE RESUMO — clique para expandir ── */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-full flex flex-col gap-0.5 px-4 py-2.5 border-t border-border/20 hover:bg-muted/10 transition-colors text-left group"
        >
          {/* Linha 1: chips principais */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 w-full">
            {/* Score chip */}
            {sl && score !== null && (
              <span className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold shrink-0 transition-opacity ${sl.bg} ${sl.border} ${sl.color} ${scoreStale ? 'opacity-50' : ''}`}>
                <Shield className="h-3 w-3 shrink-0" />
                {score} · {sl.label}
              </span>
            )}
            <span className="w-px h-3 bg-border/30 shrink-0 hidden sm:block" />
            {/* Período */}
            <span className="inline-flex items-center gap-1 shrink-0">
              <span className="text-xs text-muted-foreground/80 font-medium">{periodoCompacto}</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors leading-none">
                    <Info className="h-2.5 w-2.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-64 p-3 space-y-2 text-xs">
                  <p className="font-semibold text-foreground text-sm">Período analisado</p>
                  <p className="text-muted-foreground tabular-nums">{fmtDMY(new Date(inicio.year, inicio.month - 1, 1))} – {fmtDMY(refDateObj)}</p>
                  <p className="text-muted-foreground/80 text-[10px]">REF = <strong className="text-foreground/70">{refHoje}</strong> ({refLabel}) — dias sem vir e bases calculados a partir dessa data. O período ({fmtDMY(new Date(inicio.year, inicio.month - 1, 1))} – {fmtDMY(refDateObj)}) define quais visitas entram na análise.</p>
                </PopoverContent>
              </Popover>
            </span>
            {(() => {
              const [y1, m1] = filters.dataInicioISO.split('-').map(Number);
              const [y2, m2] = filters.dataFimISO.split('-').map(Number);
              const diff = (y2 - y1) * 12 + (m2 - m1);
              return diff > 6 ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 text-amber-400 px-1 text-[10px] font-medium shrink-0">
                  <AlertTriangle className="h-2.5 w-2.5 shrink-0" />longo
                </span>
              ) : null;
            })()}
            <span className="text-muted-foreground/25 text-xs">·</span>
            {/* Janela */}
            <span className="text-xs text-muted-foreground/70">
              <span className="font-medium text-foreground/70">{filters.janelaDias}d</span> janela
            </span>
            {/* Clientes únicos no período + Base S */}
            {(clientesUnicos != null || baseDistTotal > 0) && (
              <>
                <span className="text-muted-foreground/25 text-xs">·</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground/80 shrink-0 tabular-nums">
                  {clientesUnicos != null && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <strong className="text-foreground/80">{clientesUnicos.toLocaleString('pt-BR')}</strong>
                      <span className="text-muted-foreground/60">no período</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors leading-none">
                            <Info className="h-2.5 w-2.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" align="start" className="w-72 p-3 space-y-2 text-xs">
                          <p className="font-semibold text-foreground text-sm">Clientes únicos no período</p>
                          <p className="text-muted-foreground">Total de <strong className="text-foreground/80">clientes distintos</strong> que realizaram pelo menos 1 visita dentro do intervalo selecionado.</p>
                          <p className="text-muted-foreground tabular-nums">Período: {fmtDMY(new Date(inicio.year, inicio.month - 1, 1))} – {fmtDMY(refDateObj)}</p>
                          <p className="text-muted-foreground/70 text-[10px]">Este número é o contexto do intervalo filtrado. Difere dos "ativos na janela" (Score de Saúde), que contam quem tem a última visita dentro do prazo da janela configurada ({filters.janelaDias}d).</p>
                          {clientesUnicos != null && <p className="font-semibold text-foreground tabular-nums">{clientesUnicos.toLocaleString('pt-BR')} clientes</p>}
                        </PopoverContent>
                      </Popover>
                    </span>
                  )}
                  {clientesUnicos != null && baseDistTotal > 0 && (
                    <span className="text-muted-foreground/30 mx-0.5">/</span>
                  )}
                  {baseDistTotal > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <BaseBadge type="S" meses={statusMeses} />
                      <strong className="text-foreground/80">{baseDistTotal.toLocaleString('pt-BR')}</strong>
                      <span className="text-muted-foreground/60">base</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors leading-none">
                            <Info className="h-2.5 w-2.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" align="end" className="w-72 p-3 space-y-2 text-xs">
                          <p className="font-semibold text-foreground text-sm">Base S · {statusMeses}m</p>
                          <p className="text-muted-foreground">Clientes com pelo menos 1 visita nos últimos <strong className="text-foreground/80">{statusMeses} meses</strong> a partir do {refLabel}. Universo principal para Perdidos, Em risco, Cadência e Score de saúde.</p>
                          <p className="text-muted-foreground tabular-nums">Base S: {fmtDMY(status12mInicio)} – {refHoje}</p>
                          {baseDistTotal > 0 && <p className="font-semibold text-foreground tabular-nums">{baseDistTotal.toLocaleString('pt-BR')} clientes</p>}
                        </PopoverContent>
                      </Popover>
                    </span>
                  )}
                </span>
              </>
            )}
            {/* Alertas negativos */}
            {alertasNegativos.length > 0 && (
              <>
                <span className="text-muted-foreground/25 text-xs">·</span>
                <span className="flex items-center gap-0.5 text-xs text-rose-400 shrink-0">
                  <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                  {alertasNegativos.length} alerta{alertasNegativos.length > 1 ? 's' : ''}
                </span>
              </>
            )}
            {/* Barbeiro ativo */}
            {filters.filtroColaborador.id && (
              <>
                <span className="text-muted-foreground/25 text-xs">·</span>
                <span className="flex items-center gap-1 text-xs text-foreground/70 font-medium shrink-0">
                  {filters.filtroColaborador.nome}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClearColaborador(); }}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              </>
            )}
            {/* Excluindo s/cadastro */}
            {filters.excluirSemCadastro && (
              <>
                <span className="text-muted-foreground/25 text-xs">·</span>
                <span className="text-xs text-muted-foreground/50">excl. s/cadastro</span>
              </>
            )}
            {/* Chevron hint */}
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-all ml-auto shrink-0 ${open ? 'rotate-180' : ''}`} />
          </div>

        </button>

        {/* Sheet: Score de saúde */}
        {sl && score !== null && (
          <Sheet open={scoreOpen} onOpenChange={setScoreOpen}>
            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0 overflow-y-auto">
              <SheetHeader className={`px-5 py-4 border-b border-border/40 shrink-0 ${sl.bg} ${sl.border}`}>
                <SheetTitle className={`text-sm font-semibold flex items-center gap-2 ${sl.color}`}>
                  <Shield className="h-4 w-4" />
                  Score de Saúde da Base
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nota agregada de 0 a 100 que mede a saúde da base de clientes.
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <div className={`h-12 w-12 rounded-xl border ${sl.bg} ${sl.border} flex flex-col items-center justify-center shrink-0`}>
                    <p className={`text-xl font-bold tabular-nums ${sl.color}`}>{score}</p>
                    <p className="text-[10px] text-muted-foreground">/ 100</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${sl.color}`}>{sl.label}</p>
                    <p className="text-xs text-muted-foreground">{`${alertasNegativos.length} ponto${alertasNegativos.length !== 1 ? 's' : ''} de atenção · ${alertasPositivos.length} ponto${alertasPositivos.length !== 1 ? 's' : ''} positivo${alertasPositivos.length !== 1 ? 's' : ''}`}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                {/* Sobre a base analisada */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-primary/60" /> Sobre a base analisada
                  </p>
                  <div className="rounded-xl border border-border/30 bg-muted/5 px-3 py-3 space-y-2.5 text-xs">
                    {/* Universos usados */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <BaseBadge type="S" meses={statusMeses} /> Base S · {statusMeses}m
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">{baseDistTotal.toLocaleString('pt-BR')} clientes</span>
                      </div>
                      <p className="text-muted-foreground/70 pl-0.5 tabular-nums">{fmtDMY(status12mInicio)} – {refHoje}</p>
                      <p className="text-muted-foreground/60 pl-0.5 text-[10px]">Usada em: Perdidos (25pts) · Em risco (20pts) · Ativos (30pts)</p>
                    </div>
                    <div className="space-y-1 border-t border-border/20 pt-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <BaseBadge type="J" dias={filters.janelaDias} /> Janela · {filters.janelaDias}d
                        </span>
                        {janelaAtivos != null && (
                          <span className="font-semibold text-foreground tabular-nums">{janelaAtivos.toLocaleString('pt-BR')} ativos</span>
                        )}
                      </div>
                      <p className="text-muted-foreground/70 pl-0.5 tabular-nums">{fmtDMY(janelaInicio)} – {refHoje}</p>
                      <p className="text-muted-foreground/60 pl-0.5 text-[10px]">Usada no filtro de "dias sem vir ≤ janela" para Ativos</p>
                    </div>
                    {cadTotal > 0 && (
                      <div className="space-y-1 border-t border-border/20 pt-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="text-[9px] font-bold bg-muted/40 rounded px-1 py-0.5 text-foreground/60">CAD</span> Cadência individual
                          </span>
                          <span className="font-semibold text-foreground tabular-nums">{cadTotal.toLocaleString('pt-BR')} clientes</span>
                        </div>
                        <p className="text-muted-foreground/60 pl-0.5 text-[10px]">Subconjunto de Base S com ≥{cadMinVisitas} visitas — menor universo. Usada em: Cadência (25pts)</p>
                      </div>
                    )}
                    <div className="border-t border-border/20 pt-2">
                      <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-foreground/80">REF = {refHoje} ({refLabel}):</strong> todos os "dias sem vir" são calculados a partir dessa data. Configurável na aba Config → REF (FIM_FILTRO usa o fim do período; HOJE usa a data atual).
                      </p>
                    </div>
                    <p className="text-muted-foreground leading-relaxed border-t border-border/20 pt-2">
                      O score combina <strong className="text-foreground/80">4 dimensões</strong> (total 100pts) com <strong className="text-foreground/80">interpolação linear</strong> — sem saltos bruscos. Ativos 30pts + Perdidos 25pts + Cadência 25pts + Em risco 20pts.
                    </p>
                  </div>
                </div>



                {/* Leitura da base — análise concentrada */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-primary/60" /> Leitura da base
                  </p>
                  <div className="rounded-xl border border-border/30 bg-muted/5 px-3 py-3 space-y-2 text-xs">
                    {(() => {
                      if (!kpis || !baseDistTotal) return <p className="text-muted-foreground">Dados insuficientes.</p>;
                      const pAtivos = Math.round(pct(kpis.clientes_ativos_janela ?? 0, baseDistTotal));
                      const pPerd = Math.round(pct(kpis.clientes_perdidos_macro ?? 0, baseDistTotal));
                      const pRisco = Math.round(pct(kpis.clientes_em_risco_macro ?? 0, baseDistTotal));
                      const novos = kpis.novos_clientes_periodo ?? 0;
                      const resgatados = kpis.clientes_resgatados_periodo ?? 0;
                      const insights: { text: string; severity: 'critical' | 'warning' | 'ok' | 'info' }[] = [];

                      // Ativos
                      if (pAtivos >= 50) insights.push({ text: `${pAtivos}% de ativos na janela — base com boa atividade.`, severity: 'ok' });
                      else if (pAtivos >= 30) insights.push({ text: `${pAtivos}% de ativos — base com atividade moderada. Abaixo de 50% ideal.`, severity: 'warning' });
                      else insights.push({ text: `Apenas ${pAtivos}% de ativos — base com baixa atividade. Ação urgente.`, severity: 'critical' });

                      // Perdidos
                      if (pPerd > 35) insights.push({ text: `${pPerd}% da base está perdida — acima de 35%, campanhas de resgate urgentes.`, severity: 'critical' });
                      else if (pPerd > 20) insights.push({ text: `${pPerd}% da base perdida — acima de 20%, acompanhe tendência e acione CRM.`, severity: 'warning' });
                      else insights.push({ text: `${pPerd}% perdidos — dentro do esperado.`, severity: 'ok' });

                      // Risco
                      if (pRisco > 25) insights.push({ text: `${pRisco}% em risco — mais de 1 em 4 clientes sem vir. Ação urgente.`, severity: 'critical' });
                      else if (pRisco > 15) insights.push({ text: `${pRisco}% em risco — faixa de atenção, acompanhe na aba Ações.`, severity: 'warning' });
                      else insights.push({ text: `${pRisco}% em risco — controlado.`, severity: 'ok' });

                      // Cadência
                      if (pCadSaude !== null) {
                        if (pCadSaude >= 60) insights.push({ text: `${Math.round(pCadSaude)}% com cadência saudável (assíduos + regulares) — ritmo consistente.`, severity: 'ok' });
                        else if (pCadSaude >= 40) insights.push({ text: `${Math.round(pCadSaude)}% com cadência saudável — moderado, muitos espaçando.`, severity: 'warning' });
                        else insights.push({ text: `Apenas ${Math.round(pCadSaude)}% com cadência saudável — base fora de ritmo.`, severity: 'critical' });
                      }

                      // Resgatados e novos
                      if (resgatados > 0) insights.push({ text: `${resgatados.toLocaleString('pt-BR')} resgatados no período — ações de recuperação com resultado.`, severity: 'ok' });
                      if (novos > 0 && baseDistTotal > 0) {
                        const pNovos = Math.round(novos / baseDistTotal * 100);
                        if (pNovos >= 10) insights.push({ text: `${pNovos}% de novos — boa aquisição.`, severity: 'info' });
                      }

                      const severityColor = { critical: 'text-rose-400', warning: 'text-amber-500', ok: 'text-emerald-400', info: 'text-blue-400' };
                      const severityDot = { critical: 'bg-rose-400', warning: 'bg-amber-500', ok: 'bg-emerald-400', info: 'bg-blue-400' };

                      return (
                        <div className="space-y-1.5">
                          {insights.map((ins, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 ${severityDot[ins.severity]}`} />
                              <p className={`leading-relaxed ${severityColor[ins.severity]}`}>{ins.text}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Análise detalhada por dimensão */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Como estamos hoje — por dimensão</p>
                  <div className="rounded-xl border border-border/30 overflow-hidden">
                    {scoreItems.map((item, i, arr) => {
                      const pctFilled = item.max > 0 ? (item.valor / item.max) * 100 : 0;
                      const status = pctFilled >= 70 ? 'ok' : pctFilled >= 40 ? 'atenção' : 'crítico';
                      const statusColor = status === 'ok' ? 'text-emerald-400' : status === 'atenção' ? 'text-amber-500' : 'text-rose-400';
                      const statusBg = status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/25' : status === 'atenção' ? 'bg-amber-500/10 border-amber-500/25' : 'bg-rose-500/10 border-rose-500/25';
                      const barColor = status === 'ok' ? 'bg-emerald-500' : status === 'atenção' ? 'bg-amber-500' : 'bg-rose-500';
                      const activeRange = item.noData ? null : findActiveRange(item.pctVal, item.ranges, item.ascending);
                      return (
                        <div key={i} className={`px-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-border/20' : ''}`}>
                          {/* Header: label + pts */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{item.label}</p>
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${statusBg} ${statusColor}`}>{status}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="tabular-nums font-bold text-foreground leading-none">
                                <span className="text-xl">{item.valor}</span>
                                <span className="text-sm text-muted-foreground font-normal">/{item.max}</span>
                              </p>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden mb-3">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pctFilled}%` }} />
                          </div>

                          {/* Calculation explanation */}
                          <div className="rounded-lg bg-muted/15 border border-border/20 px-3 py-2.5 space-y-2">
                            {/* Count + period */}
                            <div>
                              <p className="text-xs text-foreground/90">
                                {item.clientesCount != null && item.totalBase > 0 ? (
                                  <><strong>{item.clientesCount.toLocaleString('pt-BR')}</strong> de <strong>{item.totalBase.toLocaleString('pt-BR')}</strong> clientes <span className="text-muted-foreground">({Math.round(item.pctVal * 10) / 10}%)</span></>
                                ) : (
                                  <>{Math.round(item.pctVal * 10) / 10}% da base</>
                                )}
                              </p>
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5 tabular-nums">Período: {item.periodoDesc}</p>
                            </div>

                            {item.noData ? (
                              <p className="text-xs text-muted-foreground border-t border-border/20 pt-1.5">Sem dados de cadência — pontuação padrão aplicada (12 pts)</p>
                            ) : activeRange ? (() => {
                              const pctRaw = Math.round(item.pctVal * 10) / 10;
                              const diff = Math.abs(activeRange.toPts - activeRange.fromPts);
                              const op = item.ascending ? '+' : '–';
                              const progressDec = Math.round(activeRange.progress * 100) / 100;
                              const partial = Math.round(diff * activeRange.progress * 10) / 10;
                              return (
                                <div className="space-y-1.5 border-t border-border/20 pt-1.5">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cálculo passo a passo</p>
                                  <p className="text-xs text-muted-foreground">
                                    Faixa ativa: <span className="font-mono text-foreground/80 bg-muted/40 rounded px-1">{activeRange.min}–{activeRange.max}%</span>
                                    {' · '}pontos nessa faixa: <span className="font-mono text-foreground/80">{activeRange.fromPts}→{activeRange.toPts}</span>
                                  </p>
                                  <p className="text-xs font-mono text-foreground/75 leading-relaxed bg-muted/20 rounded px-2 py-1.5">
                                    {activeRange.fromPts} {op} {diff} × ({pctRaw}–{activeRange.min})÷({activeRange.max}–{activeRange.min})<br />
                                    = {activeRange.fromPts} {op} {diff} × {progressDec}<br />
                                    = {activeRange.fromPts} {op} {partial} = <strong className={statusColor}>{item.valor} pts</strong>
                                  </p>
                                </div>
                              );
                            })() : null}

                            {/* Benchmark */}
                            <p className="text-xs text-muted-foreground/80 italic border-t border-border/20 pt-1.5">
                              <span className="font-semibold not-italic text-muted-foreground">Referência: </span>{item.benchmark}
                            </p>

                            {/* Explanation */}
                            {'explanation' in item && item.explanation && (
                              <div className="border-t border-border/20 pt-1.5 space-y-1">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">O que mede e por quê</p>
                                <p className="text-xs text-muted-foreground leading-relaxed">{item.explanation}</p>
                              </div>
                            )}

                            {/* Context / universe note */}
                            {'contextNote' in item && item.contextNote && (
                              <div className="border-t border-border/20 pt-1.5 space-y-1">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contexto e universo</p>
                                <p className="text-xs text-muted-foreground/80 leading-relaxed">{item.contextNote}</p>
                              </div>
                            )}

                            {/* Tab reference */}
                            {'tabRef' in item && item.tabRef && (
                              <p className="text-[10px] text-primary/70 border-t border-border/20 pt-1.5 flex items-start gap-1">
                                <ChevronRight className="h-2.5 w-2.5 shrink-0 mt-0.5" />
                                <span>{item.tabRef}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pontos de atenção */}
                {alertasNegativos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-400" /> Pontos de atenção
                    </p>
                    <div className="space-y-1.5">
                      {alertasNegativos.map((a) => (
                        <div key={a.id}
                          className={`rounded-lg border px-3 py-2.5 ${a.tipo === 'negativo' ? 'bg-rose-500/8 border-rose-500/20' : 'bg-amber-500/8 border-amber-500/20'} ${a.tab ? 'cursor-pointer hover:opacity-80' : ''}`}
                          onClick={() => a.tab && (setScoreOpen(false), onTabChange?.(a.tab))}>
                          <p className={`text-xs font-semibold ${a.tipo === 'negativo' ? 'text-rose-400' : 'text-amber-500'}`}>{a.titulo}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{a.detalhe}</p>
                          {a.tab && <p className="text-xs text-primary/80 mt-1 flex items-center gap-0.5">Ver análise <ChevronRight className="h-3 w-3" /></p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* O que está bem */}
                {alertasPositivos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> O que está bem
                    </p>
                    <div className="space-y-1.5">
                      {alertasPositivos.map((a) => (
                        <div key={a.id}
                          className={`rounded-lg border bg-emerald-500/8 border-emerald-500/20 px-3 py-2.5 ${a.tab ? 'cursor-pointer hover:opacity-80' : ''}`}
                          onClick={() => a.tab && (setScoreOpen(false), onTabChange?.(a.tab))}>
                          <p className="text-xs font-semibold text-emerald-400">{a.titulo}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{a.detalhe}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Como é calculado */}
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Settings className="h-3.5 w-3.5 text-primary/60" /> Como é calculado
                  </p>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Score = soma de <strong className="text-foreground/80">4 dimensões independentes</strong> com <strong className="text-foreground/80">interpolação linear</strong>. Cada dimensão tem breakpoints calibrados para o contexto de barbearia. Uma mudança de 1 cliente gera uma mudança proporcional na nota — sem saltos bruscos entre faixas.
                  </p>

                  {/* Pesos */}
                  <div className="rounded-xl border border-border/30 overflow-hidden text-xs">
                    <div className="bg-muted/20 px-3 py-2 border-b border-border/20 grid grid-cols-[1fr_auto_2fr] gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dimensão</span>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Peso</span>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Por que importa</span>
                    </div>
                    {[
                      { dim: `Ativos (janela ${filters.janelaDias}d)`, peso: '30', why: 'Engajamento real — clientes que voltaram recentemente.' },
                      { dim: 'Perdidos', peso: '25', why: 'Churn acumulado — clientes além do prazo de resgate.' },
                      { dim: 'Em risco', peso: '20', why: 'Clientes no limite — prestes a virar perdidos.' },
                      { dim: 'Cadência saudável', peso: '25', why: 'Ritmo e frequência — assiduidade da base ativa.' },
                    ].map((row, i, arr) => (
                      <div key={i} className={`px-3 py-2.5 grid grid-cols-[1fr_auto_2fr] gap-2 ${i < arr.length - 1 ? 'border-b border-border/15' : ''}`}>
                        <span className="font-medium text-foreground">{row.dim}</span>
                        <span className="font-bold text-primary tabular-nums text-right">{row.peso}pts</span>
                        <span className="text-muted-foreground leading-relaxed">{row.why}</span>
                      </div>
                    ))}
                    <div className="px-3 py-2 bg-muted/10 border-t border-border/20 flex justify-between">
                      <span className="text-muted-foreground font-medium">Total máximo</span>
                      <span className="font-bold text-foreground">100 pts</span>
                    </div>
                  </div>

                  {/* Breakpoints detalhados */}
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Breakpoints por dimensão</p>
                  <div className="space-y-2">
                    {[
                      {
                        label: `Ativos na janela · max 30pts`,
                        steps: ['0–10%: 0pts', '10–30%: 0→10pts', '30–50%: 10→22pts', '50–100%: 22→30pts'],
                        ref: 'Típica: 25–45% · Boa: 50%+',
                        note: 'Crescente — quanto mais ativos, melhor.',
                      },
                      {
                        label: 'Perdidos · max 25pts',
                        steps: ['0–15%: 25pts', '15–30%: 25→15pts', '30–50%: 15→5pts', '50%+: 0pts'],
                        ref: 'Normal: 20–35% · Preocupante: 35–50% · Crítico: 50%+',
                        note: 'Decrescente — base com histórico longo sempre terá algum % perdido; thresholds calibrados para a realidade.',
                      },
                      {
                        label: 'Em risco · max 20pts',
                        steps: ['0–10%: 20pts', '10–20%: 20→12pts', '20–35%: 12→4pts', '35%+: 0pts'],
                        ref: 'Normal: 10–20% · Preocupante: 20–35% · Crítico: 35%+',
                        note: 'Decrescente — em risco é sinal de alerta precoce antes de se tornarem perdidos.',
                      },
                      {
                        label: 'Cadência saudável · max 25pts',
                        steps: ['0–15%: 0pts', '15–35%: 0→10pts', '35–55%: 10→18pts', '55–100%: 18→25pts'],
                        ref: 'Típica: 20–40% · Boa: 40–55% · Excelente: 55%+',
                        note: 'Crescente — % de assíduos + regulares (cadência individual). One-shots e inativos ficam fora.',
                      },
                    ].map((d, i) => (
                      <div key={i} className="rounded-lg border border-border/25 bg-muted/5 px-3 py-2.5 space-y-1.5">
                        <p className="text-xs font-semibold text-foreground">{d.label}</p>
                        <div className="flex flex-wrap gap-1">
                          {d.steps.map((s, j) => (
                            <span key={j} className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border/20">{s}</span>
                          ))}
                        </div>
                        <p className="text-[10px] text-amber-400 italic">{d.ref}</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{d.note}</p>
                      </div>
                    ))}
                  </div>

                  {/* Classificação final */}
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Classificação final</p>
                  <div className="rounded-xl border border-border/30 overflow-hidden text-xs">
                    {[
                      { range: '≥ 75', label: 'Saudável', color: 'text-emerald-400', note: 'Base ativa e com boa cadência — manter estratégia.' },
                      { range: '50–74', label: 'Atenção', color: 'text-amber-500', note: 'Alguma dimensão fraca — monitorar e acionar plano.' },
                      { range: '25–49', label: 'Em risco', color: 'text-orange-400', note: 'Múltiplas dimensões comprometidas — ação necessária.' },
                      { range: '< 25', label: 'Crítico', color: 'text-rose-400', note: 'Base em colapso — resgate urgente em todas as frentes.' },
                    ].map((row, i, arr) => (
                      <div key={i} className={`px-3 py-2 flex items-start gap-3 ${i < arr.length - 1 ? 'border-b border-border/15' : ''}`}>
                        <span className="font-mono font-bold text-foreground/70 w-10 shrink-0 mt-px">{row.range}</span>
                        <span className={`font-bold ${row.color} w-16 shrink-0`}>{row.label}</span>
                        <span className="text-muted-foreground leading-relaxed">{row.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-border/40 px-5 py-3 shrink-0 flex gap-2">
                <button type="button" onClick={() => { setScoreOpen(false); onTabChange?.('relatorio'); }}
                  className="flex-1 text-xs text-primary border border-primary/30 rounded-lg py-2 hover:bg-primary/5 transition-colors">
                  Ver Relatório completo
                </button>
                <button type="button" onClick={() => setScoreOpen(false)}
                  className="text-xs text-muted-foreground border border-border/40 rounded-lg py-2 px-3 hover:bg-muted/20 transition-colors">
                  Fechar
                </button>
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Sheet: Explicação: Raio X Clientes */}
        <Sheet open={comoLerOpen} onOpenChange={setComoLerOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0 overflow-y-auto">
            <SheetHeader className="px-5 py-4 border-b border-border/40 bg-muted/10 shrink-0">
              <SheetTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Explicação: Raio X Clientes
              </SheetTitle>
              <p className="text-[10px] text-muted-foreground mt-1">
                Guia completo do módulo · {periodoCompacto}
              </p>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">O que é o Raio X Clientes</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Módulo de análise do comportamento e estrutura da base de clientes.
                  Foco exclusivo em frequência, retenção, risco e perfil — sem faturamento ou indicadores financeiros.
                  Use as abas para aprofundar em cada dimensão.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Universo analisado</p>
                <div className="space-y-1.5 text-[10px]">
                  {cfg && (
                    <>
                      <div className="flex items-start gap-2">
                        <BaseBadge type={baseBadgeType} />
                        <span className="text-muted-foreground">
                          Base Principal — {baseModeLabel}. Universo dos KPIs principais e distribuições.
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <BaseBadge type="S" meses={statusMeses} />
                        <span className="text-muted-foreground">
                          Base Status {statusMeses}m — clientes com visita nos últimos {statusMeses} meses. Usada em Em Risco e Perdidos.
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-start gap-2">
                    <span className="text-[9px] bg-muted rounded px-1 py-0.5 font-mono shrink-0">REF</span>
                    <span className="text-muted-foreground">Data âncora = fim do período ({refDate}). Todos os "dias sem vir" são contados a partir daqui.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Regras ativas</p>
                <div className="rounded-xl border border-border/30 overflow-hidden text-[10px]">
                  {[
                    { label: 'Período', valor: periodoCompacto },
                    { label: 'Janela de ativo', valor: `${filters.janelaDias} dias`, onde: 'Filtros ↑' },
                    { label: 'Em risco', valor: cfg ? `${cfg.risco_min_dias + 1}–${cfg.risco_max_dias}d sem vir` : '—', onde: 'Config → Seção 5' },
                    { label: 'Perdido', valor: cfg ? `>${cfg.risco_max_dias}d sem vir` : '—', onde: 'Config → Seção 5' },
                    { label: 'One-shot aguard.', valor: cfg ? `≤${cfg.one_shot_aguardando_max_dias}d` : '—', onde: 'Config → Seção 5' },
                    { label: 'Resgate', valor: cfg ? `>${cfg.churn_dias_sem_voltar}d ausência` : '—', onde: 'Config → Seção 7' },
                    { label: 'Atribuição', valor: cfg ? (cfg.atribuicao_modo === 'MAIS_FREQUENTE' ? 'Mais frequente' : cfg.atribuicao_modo === 'ULTIMO' ? 'Último atend.' : cfg.atribuicao_modo) : '—', onde: 'Config → Seção 8' },
                    { label: 'Excluir s/ cadastro', valor: filters.excluirSemCadastro ? 'Ativo' : 'Inativo', onde: 'Filtros ↑' },
                  ].map((r, i, arr) => (
                    <div key={i} className={`flex items-center justify-between gap-2 px-3 py-2 ${i < arr.length - 1 ? 'border-b border-border/20' : ''}`}>
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="font-medium text-foreground text-right">{r.valor}</span>
                      {r.onde && (
                        <button
                          type="button"
                          onClick={() => { setComoLerOpen(false); onTabChange?.('config'); }}
                          className="text-[9px] text-primary/60 hover:text-primary transition-colors shrink-0 flex items-center gap-0.5"
                        >
                          <Settings className="h-2.5 w-2.5" /> {r.onde}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Abas disponíveis</p>
                <div className="space-y-1.5 text-[10px]">
                  {[
                    { tab: 'geral' as RaioXTab, label: 'Visão Geral', desc: 'Panorama da base — KPIs, distribuições, tendências e alertas.' },
                    { tab: 'relatorio' as RaioXTab, label: 'Relatório', desc: 'Grupos de ação priorizados e diagnóstico por barbeiro.' },
                    { tab: 'oneshot' as RaioXTab, label: 'One-Shot', desc: 'Clientes com 1 visita: funil Aguardando → Risco → Perdido.' },
                    { tab: 'cadencia' as RaioXTab, label: 'Cadência', desc: 'Análise individual do ritmo de cada cliente vs histórico.' },
                    { tab: 'churn' as RaioXTab, label: 'Churn', desc: 'Evolução mensal de perdas e resgates.' },
                    { tab: 'cohort' as RaioXTab, label: 'Cohort', desc: 'Retenção de novos clientes por coorte de entrada.' },
                    { tab: 'barbeiros' as RaioXTab, label: 'Barbeiros', desc: 'Base por colaborador com drill de clientes.' },
                    { tab: 'acoes' as RaioXTab, label: 'Ações CRM', desc: 'Fila de contato priorizada para hoje.' },
                  ].map((item) => (
                    <button key={item.tab} type="button"
                      onClick={() => { setComoLerOpen(false); onTabChange?.(item.tab); }}
                      className="w-full flex items-center gap-2 text-left rounded-lg px-2.5 py-2 hover:bg-muted/30 transition-colors">
                      <ChevronRight className="h-3 w-3 text-primary/60 shrink-0" />
                      <span>
                        <strong className="text-foreground">{item.label}:</strong>{' '}
                        <span className="text-muted-foreground">{item.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Glossário rápido</p>
                <div className="space-y-1.5 text-[10px]">
                  {[
                    { t: 'REF', d: 'Data âncora dos cálculos — fim do período. Tudo é contado a partir daqui.' },
                    { t: 'One-shot', d: 'Cliente com exatamente 1 visita em todo o histórico. Sem cadência calculável.' },
                    { t: 'Ratio', d: 'Dias sem vir ÷ cadência habitual. Ratio > 1 = está atrasado em relação ao ritmo.' },
                    { t: 'Resgatado', d: `Voltou após mais de ${cfg?.churn_dias_sem_voltar ?? 90} dias de ausência.` },
                    { t: 'Drill / Mergulho', d: 'Clicar em qualquer número para ver a lista exata dos clientes.' },
                  ].map((item, i) => (
                    <div key={i} className="rounded-lg bg-muted/20 px-2.5 py-2">
                      <p className="font-medium text-foreground">{item.t}</p>
                      <p className="text-muted-foreground mt-0.5">{item.d}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-border/40 px-5 py-3 shrink-0">
              <button type="button"
                className="w-full text-[10px] text-muted-foreground hover:text-foreground border border-border/40 rounded-lg py-1.5 transition-colors"
                onClick={() => setComoLerOpen(false)}>
                Fechar
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* ── PAINEL EXPANDIDO ── */}
        {open && (
          <div className="border-t border-border/20 bg-muted/5 px-4 py-4 grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* ─── Coluna 1: Saúde da base ─── */}
            <div className="space-y-3">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Shield className="h-3 w-3" /> Saúde da base
              </p>

              {sl && score !== null ? (
                <>
                  {/* Score visual */}
                  <div className={`rounded-xl border p-3 space-y-2.5 ${sl.bg} ${sl.border}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-lg border ${sl.bg} ${sl.border} flex flex-col items-center justify-center shrink-0`}>
                        <p className={`text-xl font-bold tabular-nums leading-none ${sl.color}`}>{score}</p>
                        <p className="text-[7px] text-muted-foreground mt-0.5">/ 100</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${sl.color}`}>{sl.label}</p>
                        <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden mt-1.5">
                          <div className={`h-full ${sl.dot} rounded-full transition-all`} style={{ width: `${score}%` }} />
                        </div>
                        {scoreStale && <p className="text-[9px] text-muted-foreground animate-pulse mt-1">atualizando…</p>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScoreOpen(true)}
                      className={`text-[9px] font-medium ${sl.color} opacity-60 hover:opacity-100 flex items-center gap-1 transition-opacity`}
                    >
                      Ver análise completa <ChevronRight className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  {/* Alertas negativos */}
                  {alertasNegativos.length > 0 && (
                    <div className="space-y-1.5">
                      {alertasNegativos.map(a => (
                        <button key={a.id} type="button"
                          onClick={() => a.tab && (setOpen(false), onTabChange?.(a.tab))}
                          className="w-full flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 px-2.5 py-2 text-left transition-colors">
                          <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-medium text-rose-400 leading-tight">{a.titulo}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">{a.detalhe}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Pontos positivos */}
                  {alertasPositivos.length > 0 && (
                    <div className="space-y-1">
                      {alertasPositivos.map(a => (
                        <div key={a.id} className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-medium text-emerald-400 leading-tight">{a.titulo}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">{a.detalhe}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground italic">Carregando dados de saúde…</p>
              )}
            </div>

            {/* ─── Coluna 2: Contexto & bases ─── */}
            <div className="space-y-3">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Info className="h-3 w-3" /> Contexto & bases
              </p>

              <div className="rounded-xl border border-border/30 overflow-hidden divide-y divide-border/20 text-[10px]">
                {/* Período */}
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3 shrink-0 text-primary/40" /> Período
                    </span>
                    <span className="font-medium text-foreground">{periodoCompacto}</span>
                  </div>
                  <p className="text-muted-foreground/60 mt-0.5 tabular-nums pl-4.5">
                    {fmtDMY(new Date(inicio.year, inicio.month - 1, 1))} – {fmtDMY(refDateObj)}
                  </p>
                </div>

                {/* REF */}
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="text-[8px] bg-muted rounded px-1 font-mono shrink-0">REF</span> Referência
                  </span>
                  <span className="font-medium text-foreground font-mono">{refDate}</span>
                </div>

                {/* Base P */}
                {cfg && (
                  <div className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <BaseBadge type={baseBadgeType} dias={filters.janelaDias} /> Base P · {baseModeLabel}
                      </span>
                      {basePrincipalTotal > 0 && (
                        <span className="font-semibold text-foreground tabular-nums">{basePrincipalTotal.toLocaleString('pt-BR')} cli</span>
                      )}
                    </div>
                    <p className="text-muted-foreground/60 mt-0.5 tabular-nums pl-0.5">
                      {fmtDMY(basePrincipalInicio)} – {refHoje}
                    </p>
                  </div>
                )}

                {/* Base S */}
                {cfg && (
                  <div className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <BaseBadge type="S" meses={statusMeses} /> Base S · Status {statusMeses}m
                      </span>
                      {baseDistTotal > 0 && (
                        <span className="font-semibold text-foreground tabular-nums">{baseDistTotal.toLocaleString('pt-BR')} cli</span>
                      )}
                    </div>
                    <p className="text-muted-foreground/60 mt-0.5 tabular-nums pl-0.5">
                      {fmtDMY(status12mInicio)} – {refHoje}
                    </p>
                  </div>
                )}

                {/* Janela */}
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                      <BaseBadge type="J" dias={filters.janelaDias} /> Janela · {filters.janelaDias}d
                    </span>
                    {janelaAtivos != null && (
                      <span className="font-semibold text-foreground tabular-nums">{janelaAtivos.toLocaleString('pt-BR')} ativos</span>
                    )}
                  </div>
                  <p className="text-muted-foreground/60 mt-0.5 tabular-nums pl-0.5">
                    {fmtDMY(janelaInicio)} – {refHoje}
                  </p>
                </div>

                {/* Barbeiro */}
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-muted-foreground">Barbeiro</span>
                  <span className="font-medium text-foreground">
                    {filters.filtroColaborador.id ? filters.filtroColaborador.nome : 'Todos'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setComoLerOpen(true)}
                className="flex items-center gap-1.5 text-[9px] text-primary/60 hover:text-primary transition-colors"
              >
                <BookOpen className="h-3 w-3" /> Como ler este módulo →
              </button>
            </div>

            {/* ─── Coluna 3: Filtros ─── */}
            <div className="space-y-3">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <SlidersHorizontal className="h-3 w-3" /> Filtros
              </p>

              {/* Período */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-medium">Período</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-muted-foreground/70">Início</label>
                    <div className="flex gap-1">
                      <Select value={String(inicio.month)} onValueChange={(v) => onSetInicio({ ...inicio, month: Number(v) })}>
                        <SelectTrigger className="flex-1 h-8 text-xs min-w-0"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-[140px] overflow-y-auto">
                          {MONTHS.map((m, i) => (
                            <SelectItem key={i} value={String(i + 1)} className="text-xs">{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={String(inicio.year)} onValueChange={(v) => onSetInicio({ ...inicio, year: Number(v) })}>
                        <SelectTrigger className="w-[80px] h-8 text-xs shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-[140px] overflow-y-auto">
                          {years.map((y) => (
                            <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-muted-foreground/70">Fim</label>
                    <div className="flex gap-1">
                      <Select value={String(fim.month)} onValueChange={(v) => onSetFim({ ...fim, month: Number(v) })}>
                        <SelectTrigger className="flex-1 h-8 text-xs min-w-0"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-[140px] overflow-y-auto">
                          {MONTHS.map((m, i) => (
                            <SelectItem key={i} value={String(i + 1)} className="text-xs">{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={String(fim.year)} onValueChange={(v) => onSetFim({ ...fim, year: Number(v) })}>
                        <SelectTrigger className="w-[80px] h-8 text-xs shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-[140px] overflow-y-auto">
                          {years.map((y) => (
                            <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Janela de ativo */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-muted-foreground font-medium">Janela de ativo</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="inline-flex items-center rounded p-0.5 hover:bg-muted/30 transition-colors">
                        <Info className="h-3 w-3 text-muted-foreground/60" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="left" align="start" className="w-72 p-4 space-y-3 text-xs">
                      <p className="font-semibold text-foreground text-sm">Janela de ativo</p>
                      <p className="text-muted-foreground leading-relaxed">
                        Define quantos dias sem visita um cliente pode ter antes de ser considerado <strong className="text-foreground">inativo</strong>. Ativos = voltaram dentro desse prazo.
                      </p>
                      <div className="rounded-lg bg-muted/20 px-3 py-2 space-y-1">
                        <p className="font-medium text-foreground">Configurado: {filters.janelaDias} dias</p>
                        <p className="text-muted-foreground">Ativos: última visita entre <strong className="text-foreground/80">{fmtDMY(janelaInicio)}</strong> e <strong className="text-foreground/80">{refHoje}</strong> ({refLabel})</p>
                        {janelaAtivos != null && <p className="text-muted-foreground">Total de ativos: <strong className="text-foreground">{janelaAtivos.toLocaleString('pt-BR')} clientes</strong></p>}
                      </div>
                      <div className="space-y-1 border-t border-border/20 pt-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Exemplos</p>
                        <p className="text-muted-foreground">Última visita há {filters.janelaDias - 15} dias → <span className="text-emerald-400 font-medium">ATIVO</span></p>
                        <p className="text-muted-foreground">Última visita há {filters.janelaDias + 20} dias → <span className="text-rose-400 font-medium">INATIVO</span></p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {customJanela ? (
                  <div className="flex gap-1">
                    <Input type="number" min={1} className="w-[64px] h-8 text-xs"
                      value={customValue} onChange={(e) => setCustomValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCustomConfirm()}
                      autoFocus placeholder="dias" />
                    <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={handleCustomConfirm}>Ok</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs px-1.5"
                      onClick={() => { setCustomJanela(false); setCustomValue(''); }}>✕</Button>
                  </div>
                ) : (
                  <Select
                    value={[30, 45, 60, 90, 120].includes(filters.janelaDias) ? String(filters.janelaDias) : 'custom'}
                    onValueChange={handleJanelaChange}
                  >
                    <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[30, 45, 60, 90, 120].map((d) => (
                        <SelectItem key={d} value={String(d)} className="text-xs">{d} dias</SelectItem>
                      ))}
                      <SelectItem value="custom" className="text-xs">Personalizar</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Barbeiro */}
              <BarbeiroFilter
                filtroColaborador={filters.filtroColaborador}
                onSetFiltroColaborador={onSetFiltroColaborador}
                onClearColaborador={onClearColaborador}
                dataInicioISO={filters.dataInicioISO}
                dataFimISO={filters.dataFimISO}
              />

              {/* Switches */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Switch checked={filters.excluirSemCadastro} onCheckedChange={onSetExcluirSemCadastro} className="h-5 w-9" />
                  <span className="text-[11px] text-muted-foreground">Excluir sem cadastro</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="inline-flex items-center rounded p-0.5 hover:bg-muted/30 transition-colors">
                        <Info className="h-3 w-3 text-muted-foreground/60" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="left" align="start" className="w-72 p-4 space-y-3 text-xs">
                      <p className="font-semibold text-foreground text-sm">Excluir sem cadastro</p>
                      <p className="text-muted-foreground leading-relaxed">
                        Remove da análise atendimentos em que o cliente não possui nome registrado no sistema.
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold shrink-0 w-6">ON</span>
                          <p className="text-muted-foreground leading-relaxed">Apenas clientes identificados. KPIs de retenção e cadência mais precisos.</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold shrink-0 w-6">OFF</span>
                          <p className="text-muted-foreground leading-relaxed">Inclui vendas sem cliente. Pode inflar contagens e distorcer frequência habitual.</p>
                        </div>
                      </div>
                      <p className="text-muted-foreground/80 italic border-t border-border/20 pt-2">Recomendado: ativo para análises de retenção e cadência.</p>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch checked={filters.autoAtualizar} onCheckedChange={onSetAutoAtualizar} className="h-5 w-9" />
                  <span className="text-[11px] text-muted-foreground">Auto-atualizar</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="inline-flex items-center rounded p-0.5 hover:bg-muted/30 transition-colors">
                        <Info className="h-3 w-3 text-muted-foreground/60" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="left" align="start" className="w-72 p-4 space-y-3 text-xs">
                      <p className="font-semibold text-foreground text-sm">Auto-atualizar</p>
                      <p className="text-muted-foreground leading-relaxed">
                        Recarrega os dados automaticamente a cada poucos minutos.
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold shrink-0 w-6">ON</span>
                          <p className="text-muted-foreground leading-relaxed">Útil para monitorar o dia atual em tempo real — dados sempre frescos.</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold shrink-0 w-6">OFF</span>
                          <p className="text-muted-foreground leading-relaxed">Recomendado ao analisar períodos históricos. Evita recargas desnecessárias.</p>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {onExport && (
                <Button variant="outline" size="sm" onClick={onExport} className="h-8 text-xs gap-1.5 sm:hidden">
                  <Download className="h-3.5 w-3.5" /> Exportar
                </Button>
              )}
            </div>

          </div>
        )}

      </Card>
    </TooltipProvider>
  );
}

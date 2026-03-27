import React, { useState, useMemo } from 'react';
import { KpiCard, SegmentedToggle, HelpBox, BaseBadge, EmptyState } from '@/components/raiox-shared';
import type { BaseType } from '@/components/raiox-shared';
import { HowToReadSection } from '@/components/help';
import { InfoIconTooltip } from '@/components/help/InfoIconTooltip';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Loader2, ChevronRight, Calendar, Database, Download, TrendingUp, TrendingDown, CheckCircle, AlertTriangle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RaioXDrillSheet } from '../components/RaioXDrillSheet';
import type { DrillRequest } from '../components/RaioXDrillSheet';
import type { RaioXComputedFilters } from '../raioxTypes';
import type { CadenciaData, CadenciaBarbeiroItem, CadenciaSeriesItem } from '@/hooks/raiox-clientes/useRaioXClientesCadencia';
import type { OverviewData } from '@/hooks/raiox-clientes/useRaioXClientesOverview';
import type { RaioxConfigInstance } from '../RaioXClientesTabs';
import { ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface Props {
  filters: RaioXComputedFilters;
  cadenciaData: CadenciaData | null;
  cadenciaLoading: boolean;
  cadenciaError: string | null;
  overviewData: OverviewData | null;
  overviewLoading: boolean;
  raioxConfig: RaioxConfigInstance;
}

const fmtNum = (n: number | undefined | null) => (n == null ? '0' : n.toLocaleString('pt-BR'));
const fmtDate = (d: string | null) => {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
};

const STATUS_KEYS = ['assiduo', 'regular', 'espacando', 'primeira_vez', 'em_risco', 'perdido'] as const;
type StatusKey = typeof STATUS_KEYS[number];

const STATUS_COLORS: Record<StatusKey, string> = {
  assiduo: 'text-emerald-500',
  regular: 'text-blue-500',
  espacando: 'text-yellow-500',
  primeira_vez: 'text-muted-foreground',
  em_risco: 'text-orange-500',
  perdido: 'text-destructive',
};

const STATUS_CHART_COLORS: Record<StatusKey, string> = {
  assiduo: 'hsl(var(--chart-2))',
  regular: 'hsl(var(--chart-1))',
  espacando: 'hsl(var(--chart-4))',
  primeira_vez: 'hsl(var(--muted-foreground))',
  em_risco: 'hsl(var(--chart-5))',
  perdido: 'hsl(var(--destructive))',
};

const STATUS_DRILL_TIPO: Record<StatusKey, DrillRequest['tipo']> = {
  assiduo: 'ASSIDUO',
  regular: 'REGULAR',
  espacando: 'ESPACANDO',
  primeira_vez: 'PRIMEIRA_VEZ',
  em_risco: 'EM_RISCO',
  perdido: 'PERDIDO',
};

function getStatusTooltip(key: StatusKey, cfg: any): { short: string; details: React.ReactNode } {
  const mesesAnalise = cfg.cadencia_meses_analise ?? 12;
  const minVis = cfg.cadencia_min_visitas ?? 3;
  const baseBlock = (
    <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 mt-1 space-y-0.5">
      <p className="text-muted-foreground font-medium text-[9px]">Fonte: <span className="text-foreground/80 font-medium">Cadência individual · {mesesAnalise}m · ≥{minVis} visitas</span></p>
    </div>
  );
  const tooltips: Record<StatusKey, { short: string; details: React.ReactNode }> = {
    assiduo: {
      short: `Ratio ≤ ${cfg.ratio_muito_frequente_max ?? 0.8} — volta antes do esperado.`,
      details: <div className="space-y-1 text-[10px]"><p>Dias sem vir ≤ {((cfg.ratio_muito_frequente_max ?? 0.8) * 100).toFixed(0)}% da cadência habitual.</p>{baseBlock}</div>,
    },
    regular: {
      short: `Ratio ${cfg.ratio_muito_frequente_max ?? 0.8}–${cfg.ratio_regular_max ?? 1.2} — ritmo normal.`,
      details: <div className="space-y-1 text-[10px]"><p>Dentro do ritmo esperado.</p>{baseBlock}</div>,
    },
    espacando: {
      short: `Ratio ${cfg.ratio_regular_max ?? 1.2}–${cfg.ratio_espacando_max ?? 1.8} — demorando mais.`,
      details: <div className="space-y-1 text-[10px]"><p>Sinal de alerta leve, cadência espaçando.</p>{baseBlock}</div>,
    },
    primeira_vez: {
      short: `1 visita, sem cadência calculável.`,
      details: <div className="space-y-1 text-[10px]"><p>Classificado por dias fixos: ≤{cfg.one_shot_aguardando_max_dias ?? 45}d = 1ª Vez, &gt;{cfg.one_shot_risco_max_dias ?? 90}d = Perdido.</p>{baseBlock}</div>,
    },
    em_risco: {
      short: `Ratio ${cfg.ratio_espacando_max ?? 1.8}–${cfg.ratio_risco_max ?? 2.5} — ação urgente.`,
      details: <div className="space-y-1 text-[10px]"><p>Alta probabilidade de abandono.</p>{baseBlock}</div>,
    },
    perdido: {
      short: `Ratio > ${cfg.ratio_risco_max ?? 2.5} — ultrapassou cadência.`,
      details: <div className="space-y-1 text-[10px]"><p>Considerado perdido.</p>{baseBlock}</div>,
    },
  };
  return tooltips[key];
}

// ─── Insights generator ────────────────────────────────────
interface InsightItem {
  icon: React.ReactNode;
  text: string;
  severity: 'positive' | 'negative' | 'warning' | 'neutral';
}

function generateCadenciaInsights(series: CadenciaSeriesItem[], labels: Record<string, string>): InsightItem[] {
  if (series.length < 2) return [];
  const insights: InsightItem[] = [];
  const first = series[0];
  const last = series[series.length - 1];

  // Trend: % em risco
  const riskDiff = +(last.pct_em_risco - first.pct_em_risco).toFixed(1);
  if (riskDiff > 2) {
    insights.push({ icon: <TrendingUp className="h-4 w-4 text-destructive shrink-0" />, text: `% ${labels.em_risco ?? 'Em Risco'} subiu de ${first.pct_em_risco}% para ${last.pct_em_risco}% (+${riskDiff}pp em ${series.length} meses). Tendência de piora.`, severity: 'negative' });
  } else if (riskDiff < -2) {
    insights.push({ icon: <TrendingDown className="h-4 w-4 text-primary shrink-0" />, text: `% ${labels.em_risco ?? 'Em Risco'} caiu de ${first.pct_em_risco}% para ${last.pct_em_risco}% (${riskDiff}pp). Melhoria na retenção.`, severity: 'positive' });
  } else {
    insights.push({ icon: <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />, text: `% ${labels.em_risco ?? 'Em Risco'} estável em ~${last.pct_em_risco}% (variação de ${riskDiff > 0 ? '+' : ''}${riskDiff}pp).`, severity: 'neutral' });
  }

  // Trend: % perdido
  const lostDiff = +(last.pct_perdido - first.pct_perdido).toFixed(1);
  if (lostDiff > 3) {
    insights.push({ icon: <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />, text: `% ${labels.perdido ?? 'Perdido'} cresceu de ${first.pct_perdido}% para ${last.pct_perdido}% (+${lostDiff}pp). Base de clientes encolhendo.`, severity: 'negative' });
  } else if (lostDiff < -3) {
    insights.push({ icon: <TrendingDown className="h-4 w-4 text-primary shrink-0" />, text: `% ${labels.perdido ?? 'Perdido'} caiu de ${first.pct_perdido}% para ${last.pct_perdido}% (${lostDiff}pp). Boa recuperação.`, severity: 'positive' });
  }

  // Best / worst month for risk
  const maxRisk = series.reduce((best, s) => s.pct_em_risco > best.pct_em_risco ? s : best, series[0]);
  const minRisk = series.reduce((best, s) => s.pct_em_risco < best.pct_em_risco ? s : best, series[0]);
  if (maxRisk.ano_mes !== minRisk.ano_mes) {
    insights.push({ icon: <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />, text: `Pior mês: ${maxRisk.ano_mes_label} (${maxRisk.pct_em_risco}% em risco). Melhor: ${minRisk.ano_mes_label} (${minRisk.pct_em_risco}%).`, severity: 'neutral' });
  }

  // Ratio assíduos vs perdidos (last month)
  if (last.total > 0) {
    const ratioAP = last.assiduo > 0 ? +(last.assiduo / Math.max(last.perdido, 1)).toFixed(1) : 0;
    if (ratioAP >= 2) {
      insights.push({ icon: <CheckCircle className="h-4 w-4 text-primary shrink-0" />, text: `Para cada ${labels.perdido ?? 'perdido'}, há ${ratioAP} ${labels.assiduo ?? 'assíduos'}. Base saudável.`, severity: 'positive' });
    } else if (ratioAP < 1 && last.perdido > 0) {
      insights.push({ icon: <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />, text: `Mais ${labels.perdido ?? 'perdidos'} (${last.perdido}) que ${labels.assiduo ?? 'assíduos'} (${last.assiduo}). Atenção na retenção.`, severity: 'negative' });
    }
  }

  return insights;
}

// ─── CSV Export ─────────────────────────────────────────────
function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportSeriesCsv(series: CadenciaSeriesItem[], labels: Record<string, string>) {
  const headers = ['Período', 'Total', labels.assiduo, labels.regular, labels.espacando, labels.primeira_vez, labels.em_risco, labels.perdido, '% Risco', '% Perdido', 'Δ Risco', 'Δ Perdido'];
  const rows = series.map(s => [s.ano_mes_label, String(s.total), String(s.assiduo), String(s.regular), String(s.espacando), String(s.primeira_vez), String(s.em_risco), String(s.perdido), String(s.pct_em_risco), String(s.pct_perdido), s.delta_mom_risco != null ? String(s.delta_mom_risco) : '', s.delta_mom_perdido != null ? String(s.delta_mom_perdido) : '']);
  exportCsv('cadencia_evolucao.csv', headers, rows);
}

function exportBarbeirosCsv(barbeiros: CadenciaBarbeiroItem[], labels: Record<string, string>) {
  const headers = ['Barbeiro', 'Total', labels.assiduo, labels.regular, labels.espacando, labels.primeira_vez, labels.em_risco, labels.perdido, '% Risco', '% Perdido'];
  const rows = barbeiros.map(b => {
    const pctR = b.total > 0 ? ((b.em_risco / b.total) * 100).toFixed(1) : '0';
    const pctP = b.total > 0 ? ((b.perdido / b.total) * 100).toFixed(1) : '0';
    return [b.colaborador_nome, String(b.total), String(b.assiduo), String(b.regular), String(b.espacando), String(b.primeira_vez), String(b.em_risco), String(b.perdido), pctR, pctP];
  });
  exportCsv('cadencia_barbeiros.csv', headers, rows);
}

// ─── Custom Tooltip ─────────────────────────────────────────
function CadenciaChartTooltip({ active, payload, label, labels }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-xl p-3 text-xs space-y-1 max-w-[220px]">
      <p className="font-semibold text-foreground">{data.ano_mes_label}</p>
      <p className="text-muted-foreground">Total: {fmtNum(data.total)}</p>
      <div className="border-t border-border/50 pt-1 mt-1 space-y-0.5">
        {STATUS_KEYS.map(k => (
          <div key={k} className="flex justify-between">
            <span className={STATUS_COLORS[k]}>{labels[k]}</span>
            <span className="text-foreground font-medium">{data[k]} ({data.total > 0 ? ((data[k] / data.total) * 100).toFixed(0) : 0}%)</span>
          </div>
        ))}
      </div>
      {(data.delta_mom_risco != null || data.delta_mom_perdido != null) && (
        <div className="border-t border-border/50 pt-1 mt-1">
          {data.delta_mom_risco != null && <p>Δ Risco: <span className={data.delta_mom_risco > 0 ? 'text-destructive' : 'text-primary'}>{data.delta_mom_risco > 0 ? '+' : ''}{data.delta_mom_risco}pp</span></p>}
          {data.delta_mom_perdido != null && <p>Δ Perdido: <span className={data.delta_mom_perdido > 0 ? 'text-destructive' : 'text-primary'}>{data.delta_mom_perdido > 0 ? '+' : ''}{data.delta_mom_perdido}pp</span></p>}
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────
export function TabCadenciaPerfil({ filters, cadenciaData, cadenciaLoading, cadenciaError, overviewData, overviewLoading, raioxConfig }: Props) {
  const [modo, setModo] = useState<'fixa' | 'individual'>('individual');
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillRequest, setDrillRequest] = useState<DrillRequest | null>(null);
  const [barbeirosOpen, setBarbeirosOpen] = useState(false);
  const [evolucaoOpen, setEvolucaoOpen] = useState(true);
  const [tabelaOpen, setTabelaOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(true);

  const cfg = raioxConfig.config;
  const labels: Record<string, string> = cfg.cadencia_individual_labels ?? {
    assiduo: 'Assíduo', regular: 'Regular', espacando: 'Espaçando',
    em_risco: 'Em Risco', perdido: 'Perdido', primeira_vez: '1ª Vez',
  };
  const fixaFaixas = cfg.cadencia_fixa_faixas ?? [
    { min: 0, max: 30, label: 'Muito frequente' },
    { min: 31, max: 45, label: 'Regular' },
    { min: 46, max: 60, label: 'Espaçando' },
    { min: 61, max: 90, label: 'Em risco' },
    { min: 91, max: null, label: 'Perdido' },
  ];

  const baseCadencia: BaseType = (cfg as any).base_cadencia ?? 'S';
  const meses = cfg.status12m_meses ?? 12;
  const meta = cadenciaData?.meta;
  const kpis = cadenciaData?.kpis;
  const porBarbeiro = cadenciaData?.por_barbeiro ?? [];
  const series = cadenciaData?.series ?? [];

  // Overview cadência fixa data
  const fixaDist = overviewData?.distribuicoes?.por_cadencia_momento ?? [];

  // Chart data — 100% stacked
  const chartData = useMemo(() => {
    return series.map(s => {
      const t = s.total || 1;
      return {
        ...s,
        pct_assiduo: +((s.assiduo / t) * 100).toFixed(1),
        pct_regular: +((s.regular / t) * 100).toFixed(1),
        pct_espacando: +((s.espacando / t) * 100).toFixed(1),
        pct_primeira_vez: +((s.primeira_vez / t) * 100).toFixed(1),
        pct_em_risco_chart: +((s.em_risco / t) * 100).toFixed(1),
        pct_perdido_chart: +((s.perdido / t) * 100).toFixed(1),
      };
    });
  }, [series]);

  // Insights
  const insights = useMemo(() => generateCadenciaInsights(series, labels), [series, labels]);

  // Delta vs last month for KPI badges
  const lastSeries = series.length > 0 ? series[series.length - 1] : null;
  const prevSeries = series.length > 1 ? series[series.length - 2] : null;

  const openDrill = (tipo: DrillRequest['tipo'], valor: string, label: string) => {
    setDrillRequest({ tipo, valor, label });
    setDrillOpen(true);
  };

  const cadenciaDrillExtraParams = {
    p_base_mode: cfg.base_mode ?? 'TOTAL_COM_CORTE',
    p_base_corte_meses: cfg.base_corte_meses ?? 24,
    p_ref_mode: cfg.ref_mode ?? 'FIM_FILTRO',
    p_cadencia_meses_analise: cfg.cadencia_meses_analise ?? 12,
    p_cadencia_min_visitas: cfg.cadencia_min_visitas ?? 3,
    p_ratio_muito_frequente_max: cfg.ratio_muito_frequente_max ?? 0.8,
    p_ratio_regular_max: cfg.ratio_regular_max ?? 1.2,
    p_ratio_espacando_max: cfg.ratio_espacando_max ?? 1.8,
    p_ratio_risco_max: cfg.ratio_risco_max ?? 2.5,
    p_one_shot_aguardando_max_dias: cfg.one_shot_aguardando_max_dias ?? 45,
    p_one_shot_risco_max_dias: cfg.one_shot_risco_max_dias ?? 90,
    p_atribuicao_modo: cfg.atribuicao_modo ?? 'ULTIMO',
    p_atribuicao_janela_meses: cfg.atribuicao_janela_meses ?? 12,
  };

  const loading = modo === 'individual' ? cadenciaLoading : overviewLoading;
  const error = modo === 'individual' ? cadenciaError : null;

  function getDelta(key: StatusKey): { val: number; positive: boolean } | null {
    if (!lastSeries || !prevSeries) return null;
    const curr = lastSeries[key] ?? 0;
    const prev = prevSeries[key] ?? 0;
    const d = curr - prev;
    if (d === 0) return null;
    const isGood = key === 'assiduo' || key === 'regular';
    return { val: d, positive: isGood ? d > 0 : d < 0 };
  }

  return (
    <div className="space-y-3 min-w-0 w-full overflow-x-hidden">
      {/* How to read */}
      <HowToReadSection
        bullets={[
          <span key="1"><strong>Fixa:</strong> Distribuição por faixas fixas de dias sem vir (configuráveis na Config).</span>,
          <span key="2"><strong>Individual:</strong> Calcula o ritmo pessoal de cada cliente. Ratio = dias sem vir ÷ cadência habitual.</span>,
          <span key="3">Ex: cliente vem a cada 25d, ausente há 30d → ratio 1.2 → "{labels.espacando}".</span>,
          <span key="4">Clique em qualquer card para ver a lista de clientes.</span>,
        ]}
      />

      {/* Toggle + Badge */}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedToggle
          value={modo}
          onValueChange={(v) => setModo(v as 'fixa' | 'individual')}
          options={[
            { value: 'fixa', label: 'Cadência Fixa' },
            { value: 'individual', label: 'Cadência Individual' },
          ]}
        />
        {modo === 'individual' && (
          <Badge variant="outline" className="text-[10px] h-5">
            {cfg.cadencia_evolution_range_months ?? 12}m · {(cfg.cadencia_evolution_grain ?? 'MENSAL') === 'MENSAL' ? 'Mensal' : 'Semanal'}
          </Badge>
        )}
      </div>

      {/* Universo banner — sempre visível quando há dados */}
      {!loading && (kpis?.total != null || overviewData?.meta?.base_distribuicao_total != null) && (
        <div className="rounded-xl border border-border/40 bg-muted/15 overflow-hidden">
          {/* Header do universo */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/30">
            <Database className="h-3 w-3 text-primary shrink-0" />
            <span className="text-[10px] font-semibold text-foreground">Universo analisado</span>
            <BaseBadge type={baseCadencia} meses={meses} dias={cfg.janela_dias_padrao} />
            <span className="text-[10px] text-muted-foreground ml-auto">
              {modo === 'individual' ? 'Cadência Individual' : 'Cadência Fixa'}
            </span>
          </div>
          {/* Métricas do universo */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-3 py-2">
            {modo === 'individual' && kpis?.total != null && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-foreground tabular-nums">{fmtNum(kpis.total)}</span>
                <span className="text-[10px] text-muted-foreground">clientes com cadência calculável</span>
              </div>
            )}
            {modo === 'fixa' && overviewData?.meta?.base_distribuicao_total != null && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-foreground tabular-nums">{fmtNum(overviewData.meta.base_distribuicao_total as number)}</span>
                <span className="text-[10px] text-muted-foreground">clientes na base</span>
              </div>
            )}
            {meta && modo === 'individual' && (
              <>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>REF: <span className="text-foreground font-medium">{fmtDate(meta.ref as string)}</span></span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span>Período: <span className="text-foreground font-medium">{fmtDate(meta.inicio as string)} – {fmtDate(meta.fim as string)}</span></span>
                </div>
              </>
            )}
          </div>
          {/* Thresholds — só individual */}
          {modo === 'individual' && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider shrink-0">Thresholds ratio:</span>
              {[
                { label: labels.assiduo ?? 'Assíduo', ratio: cfg.ratio_muito_frequente_max, color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
                { label: labels.regular ?? 'Regular', ratio: cfg.ratio_regular_max, color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
                { label: labels.espacando ?? 'Espaçando', ratio: cfg.ratio_espacando_max, color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
                { label: labels.em_risco ?? 'Em Risco', ratio: cfg.ratio_risco_max, color: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
              ].map((t) => (
                <span key={t.label} className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${t.color}`}>
                  {t.label} ≤{t.ratio}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <HelpBox variant="warning">Erro ao carregar: {error}</HelpBox>}

      {/* ===== MODO FIXA ===== */}
      {modo === 'fixa' && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground">Todos os clientes da base distribuídos por faixas fixas de dias sem vir. Inclui one-shots.</p>
          {overviewLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : fixaDist.length === 0 ? (
            <EmptyState description="Sem dados de cadência fixa." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {fixaFaixas.map((faixa, idx) => {
                // Map 5 UI faixas to the 8 backend statuses (including one-shot variants)
                const statusGroups: Record<number, string[]> = {
                  0: ['MUITO_FREQUENTE', 'ONE_SHOT_AGUARDANDO'], // 1ª faixa: muito frequente + one-shot aguardando
                  1: ['REGULAR'],
                  2: ['ESPACANDO'],
                  3: ['EM_RISCO', 'ONE_SHOT_RISCO'],             // Em risco + one-shot risco
                  4: ['PERDIDO', 'ONE_SHOT_PERDIDO'],            // Perdido + one-shot perdido
                };
                const matchStatuses = statusGroups[idx] ?? [];
                const qtd = matchStatuses.reduce((sum, key) => {
                  const item = fixaDist.find((d: any) => d.status === key);
                  return sum + (item?.qtd ?? 0);
                }, 0);
                const total = fixaDist.reduce((s: number, d: any) => s + d.qtd, 0);
                const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
                const rangeLabel = faixa.max != null ? `${faixa.min}–${faixa.max}d` : `${faixa.min}d+`;
                const drillKey = matchStatuses[0] || '';
                return (
                  <div key={idx} className="cursor-pointer" onClick={() => openDrill('CADENCIA', drillKey, `${faixa.label} (${rangeLabel})`)}>
                    <KpiCard label={faixa.label} value={String(qtd)} subtitle={`${pct}% · ${rangeLabel}`}
                      suffix={<InfoIconTooltip title={faixa.label} short={`Clientes com ${rangeLabel} sem vir.`} details={<p>Faixa fixa: {faixa.min} a {faixa.max ?? '∞'} dias. Total: {qtd} ({pct}%).</p>} />}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== MODO INDIVIDUAL ===== */}
      {modo === 'individual' && (
        <div className="space-y-3">
          {cadenciaLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !kpis ? (
            <EmptyState description="Sem dados de cadência individual." />
          ) : (
            <>
              {/* KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {STATUS_KEYS.map((key) => {
                  const val = kpis[key] ?? 0;
                  const pct = kpis.total > 0 ? Math.round((val / kpis.total) * 100) : 0;
                  const tooltip = getStatusTooltip(key, cfg);
                  const label = labels[key] || key;
                  const delta = getDelta(key);

                  return (
                    <div key={key} className="cursor-pointer" onClick={() => openDrill(STATUS_DRILL_TIPO[key], '', `${label} — ${val} clientes`)}>
                      <KpiCard
                        label={label}
                        value={String(val)}
                        subtitle={`${pct}% de ${fmtNum(kpis.total)}${delta ? ` ${delta.val > 0 ? '↑' : '↓'}${Math.abs(delta.val)}` : ''}`}
                        status={key === 'assiduo' ? 'positive' : key === 'perdido' || key === 'em_risco' ? 'negative' : key === 'espacando' ? 'warning' : 'neutral'}
                        suffix={<InfoIconTooltip title={label} short={tooltip.short} details={tooltip.details} />}
                      />
                    </div>
                  );
                })}
              </div>

              {/* ─── EVOLUÇÃO CHART (collapsible) ─── */}
              {series.length > 0 && (
                <Collapsible open={evolucaoOpen} onOpenChange={setEvolucaoOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="w-full flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${evolucaoOpen ? 'rotate-90' : ''}`} />
                      <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">Evolução por status</span>
                      <span className="text-[10px] text-muted-foreground">{series.length} períodos · composição %</span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pt-3 w-full overflow-hidden">
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={chartData} stackOffset="expand" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                          <XAxis dataKey="ano_mes_label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <RechartsTooltip content={<CadenciaChartTooltip labels={labels} />} />
                          {STATUS_KEYS.map((key) => (
                            <Area
                              key={key}
                              type="monotone"
                              dataKey={key}
                              stackId="1"
                              fill={STATUS_CHART_COLORS[key]}
                              stroke={STATUS_CHART_COLORS[key]}
                              fillOpacity={0.8}
                              name={labels[key]}
                            />
                          ))}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* ─── TABELA POR PERÍODO (collapsible) ─── */}
              {series.length > 0 && (
                <Collapsible open={tabelaOpen} onOpenChange={setTabelaOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="w-full flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${tabelaOpen ? 'rotate-90' : ''}`} />
                      <span className="text-xs font-semibold text-foreground">Tabela por período</span>
                      <span className="text-[10px] text-muted-foreground">{series.length} períodos</span>
                      <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-[10px]" onClick={(e) => { e.stopPropagation(); exportSeriesCsv(series, labels); }}>
                        <Download className="h-3 w-3 mr-1" />CSV
                      </Button>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pt-2 border border-border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] py-1">Período</TableHead>
                            <TableHead className="text-[10px] py-1 text-right">Total</TableHead>
                            {STATUS_KEYS.map(k => (
                              <TableHead key={k} className="text-[10px] py-1 text-right hidden sm:table-cell">{labels[k]}</TableHead>
                            ))}
                            <TableHead className="text-[10px] py-1 text-right">% Risco</TableHead>
                            <TableHead className="text-[10px] py-1 text-right">% Perdido</TableHead>
                            <TableHead className="text-[10px] py-1 text-right">Δ Risco</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {series.map((s) => (
                            <TableRow key={s.ano_mes} className="text-[11px] cursor-pointer hover:bg-muted/30" onClick={() => openDrill('EM_RISCO', '', `${labels.em_risco} — ${s.ano_mes_label}`)}>
                              <TableCell className="py-1 font-medium text-foreground">{s.ano_mes_label}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(s.total)}</TableCell>
                              {STATUS_KEYS.map(k => (
                                <TableCell key={k} className={`py-1 text-right hidden sm:table-cell ${STATUS_COLORS[k]}`}>{s[k]}</TableCell>
                              ))}
                              <TableCell className="py-1 text-right text-orange-500">{s.pct_em_risco}%</TableCell>
                              <TableCell className="py-1 text-right text-destructive">{s.pct_perdido}%</TableCell>
                              <TableCell className="py-1 text-right">
                                {s.delta_mom_risco != null && (
                                  <span className={s.delta_mom_risco > 0 ? 'text-destructive' : s.delta_mom_risco < 0 ? 'text-primary' : 'text-muted-foreground'}>
                                    {s.delta_mom_risco > 0 ? '+' : ''}{s.delta_mom_risco}pp
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* ─── INSIGHTS (collapsible) ─── */}
              {insights.length > 0 && (
                <Collapsible open={insightsOpen} onOpenChange={setInsightsOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="w-full flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${insightsOpen ? 'rotate-90' : ''}`} />
                      <span className="text-xs font-semibold text-foreground">Análises automáticas</span>
                      <span className="text-[10px] text-muted-foreground">{insights.length} insights</span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pt-2 space-y-2">
                      {insights.map((ins, idx) => (
                        <div key={idx} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                          ins.severity === 'positive' ? 'border-primary/30 bg-primary/5' :
                          ins.severity === 'negative' ? 'border-destructive/30 bg-destructive/5' :
                          ins.severity === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' :
                          'border-border bg-muted/20'
                        }`}>
                          {ins.icon}
                          <span className="text-foreground">{ins.text}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* ─── POR BARBEIRO (collapsible) ─── */}
              {porBarbeiro.length > 0 && (
                <Collapsible open={barbeirosOpen} onOpenChange={setBarbeirosOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="w-full flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${barbeirosOpen ? 'rotate-90' : ''}`} />
                      <span className="text-xs font-semibold text-foreground">Por barbeiro</span>
                      <span className="text-[10px] text-muted-foreground">{porBarbeiro.length} barbeiros</span>
                      <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-[10px]" onClick={(e) => { e.stopPropagation(); exportBarbeirosCsv(porBarbeiro, labels); }}>
                        <Download className="h-3 w-3 mr-1" />CSV
                      </Button>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {/* Nota: perdido por barbeiro ≠ perdido da barbearia */}
                    <div className="mt-2 mb-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 space-y-1">
                      <p className="text-[10px] font-semibold text-amber-300">Atenção: "Perdido" por barbeiro ≠ "Perdido" da barbearia</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Um cliente classificado como <span className="text-rose-400 font-medium">Perdido</span> ou <span className="text-orange-400 font-medium">Em Risco</span> para um barbeiro pode ter <strong className="text-foreground">retornado à barbearia com outro barbeiro</strong>. A cadência aqui reflete o relacionamento com este barbeiro específico, não com a barbearia.
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        Atribuição atual: <span className="text-foreground font-medium">{cfg.atribuicao_modo === 'MAIS_FREQUENTE' ? 'mais frequente' : cfg.atribuicao_modo === 'ULTIMO' ? 'último atendimento' : cfg.atribuicao_modo}</span>.
                        {kpis && (() => {
                          const totalBarbeiros = porBarbeiro.reduce((s, b) => s + b.total, 0);
                          const diff = totalBarbeiros - kpis.total;
                          if (diff > 0) return <span className="ml-1 text-blue-300">{fmtNum(diff)} clientes aparecem em mais de um barbeiro (atenderam com múltiplos).</span>;
                          return null;
                        })()}
                      </p>
                    </div>
                    <div className="border border-border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] py-1">Barbeiro</TableHead>
                            <TableHead className="text-[10px] py-1 text-right">Carteira</TableHead>
                            {STATUS_KEYS.map(k => (
                              <TableHead key={k} className="text-[10px] py-1 text-right hidden sm:table-cell">{labels[k]}</TableHead>
                            ))}
                            <TableHead className="text-[10px] py-1 text-right">% Risco</TableHead>
                            <TableHead className="text-[10px] py-1 text-right">% Perd.</TableHead>
                            <TableHead className="text-[10px] py-1 w-24 hidden sm:table-cell">Composição</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {porBarbeiro.map((b) => {
                            const pctR = b.total > 0 ? ((b.em_risco / b.total) * 100).toFixed(1) : '0';
                            const pctP = b.total > 0 ? ((b.perdido / b.total) * 100).toFixed(1) : '0';
                            return (
                              <TableRow key={b.colaborador_id} className="text-[11px]">
                                <TableCell className="py-1 font-medium text-foreground">{b.colaborador_nome}</TableCell>
                                <TableCell className="py-1 text-right text-foreground">
                                  {b.total}
                                  <span className="text-[9px] text-muted-foreground/50 ml-0.5">atrib.</span>
                                </TableCell>
                                {STATUS_KEYS.map(k => (
                                  <TableCell key={k} className={`py-1 text-right hidden sm:table-cell ${STATUS_COLORS[k]}`}>{(b as any)[k] ?? 0}</TableCell>
                                ))}
                                <TableCell className="py-1 text-right text-orange-500">{pctR}%</TableCell>
                                <TableCell className="py-1 text-right text-destructive">{pctP}%</TableCell>
                                <TableCell className="py-1 hidden sm:table-cell">
                                  {/* Mini composition bar */}
                                  <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                                    {STATUS_KEYS.map(k => {
                                      const w = b.total > 0 ? ((b as any)[k] / b.total) * 100 : 0;
                                      if (w === 0) return null;
                                      return <div key={k} style={{ width: `${w}%`, backgroundColor: STATUS_CHART_COLORS[k] }} />;
                                    })}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )}
        </div>
      )}

      {/* Drill Sheet */}
      <RaioXDrillSheet
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        request={drillRequest}
        filters={filters}
        rpcName={modo === 'individual' ? 'rpc_raiox_clientes_cadencia_drill_v1' : 'rpc_raiox_overview_drill_v1'}
        extraParams={modo === 'individual' ? cadenciaDrillExtraParams : undefined}
      />
    </div>
  );
}

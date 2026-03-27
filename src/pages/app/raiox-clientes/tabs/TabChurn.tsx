import React, { useState, useMemo } from 'react';
import { KpiCard, SegmentedToggle, HelpBox, MetricTypeBadge } from '@/components/raiox-shared';
import { BaseBadge } from '@/components/raiox-shared/BaseBadge';
import type { BaseType } from '@/components/raiox-shared/BaseBadge';
import { HowToReadSection } from '@/components/help';
import { InfoIconTooltip } from '@/components/help/InfoIconTooltip';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Download, ChevronRight, Calendar, Database, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, BarChart3, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRaioXClientesChurn } from '@/hooks/raiox-clientes/useRaioXClientesChurn';
import type { ChurnListaItem, ChurnBarbeiroItem } from '@/hooks/raiox-clientes/useRaioXClientesChurn';
import type { ChurnEvolucaoData, ChurnEvolucaoItem } from '@/hooks/raiox-clientes/useRaioXClientesChurnEvolucao';
import type { ChurnEvolucaoBarbeiroData, ChurnEvolucaoBarbeiroItem } from '@/hooks/raiox-clientes/useRaioXClientesChurnEvolucaoBarbeiro';
import { RaioXDrillSheet } from '../components/RaioXDrillSheet';
import type { DrillRequest } from '../components/RaioXDrillSheet';
import type { RaioXComputedFilters } from '../raioxTypes';
import type { RaioxConfigInstance } from '../RaioXClientesTabs';
import { ResponsiveContainer, ComposedChart, BarChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';

interface Props {
  filters: RaioXComputedFilters;
  raioxConfig: RaioxConfigInstance;
  evolucaoData: ChurnEvolucaoData | null;
  evolucaoLoading: boolean;
  evolucaoError: string | null;
  evolucaoBarbeiroData: ChurnEvolucaoBarbeiroData | null;
  evolucaoBarbeiroLoading: boolean;
  evolucaoBarbeiroError: string | null;
}

const fmtNum = (n: number | undefined | null) => {
  if (n == null) return '0';
  return n.toLocaleString('pt-BR');
};

const fmtDate = (d: string | null) => {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
};

const BASE_LABEL: Record<BaseType, string> = {
  P: 'Principal',
  S: 'Status',
  T: 'Total',
  J: 'Janela',
};

// ─── Chart config ──────────────────────────────────────────
interface ChartConfig {
  showChurnGeral: boolean;
  showChurnFid: boolean;
  showChurnOneshot: boolean;
  showPerdidosFid: boolean;
  showPerdidosOs: boolean;
  showResgatados: boolean;
  showAtendidos: boolean;
  tooltipResgatadosFaixas: boolean;
  tooltipAtendidosFaixas: boolean;
}
const defaultChartConfig: ChartConfig = {
  showChurnGeral: true,
  showChurnFid: true,
  showChurnOneshot: true,
  showPerdidosFid: true,
  showPerdidosOs: true,
  showResgatados: true,
  showAtendidos: false,
  tooltipResgatadosFaixas: true,
  tooltipAtendidosFaixas: true,
};

// ─── Analysis generator ────────────────────────────────────
interface InsightItem {
  icon: React.ReactNode;
  text: string;
  severity: 'positive' | 'negative' | 'warning' | 'neutral';
}

function generateChurnAnalysis(series: ChurnEvolucaoItem[]): InsightItem[] {
  if (series.length === 0) return [];
  const insights: InsightItem[] = [];
  const first = series[0];
  const last = series[series.length - 1];
  const diff = +(last.churn_pct - first.churn_pct).toFixed(1);

  if (series.length >= 2) {
    if (diff < -2) {
      insights.push({ icon: <TrendingDown className="h-4 w-4 text-primary shrink-0" />, text: `Churn geral caiu de ${first.churn_pct}% para ${last.churn_pct}% ao longo de ${series.length} meses (${diff > 0 ? '+' : ''}${diff}pp). Tendência positiva.`, severity: 'positive' });
    } else if (diff > 2) {
      insights.push({ icon: <TrendingUp className="h-4 w-4 text-destructive shrink-0" />, text: `Churn geral subiu de ${first.churn_pct}% para ${last.churn_pct}% ao longo de ${series.length} meses (+${diff}pp). Tendência de piora.`, severity: 'negative' });
    } else {
      insights.push({ icon: <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />, text: `Churn geral estável em torno de ${last.churn_pct}% (variação de ${diff > 0 ? '+' : ''}${diff}pp em ${series.length} meses).`, severity: 'neutral' });
    }
  }

  const worst = series.reduce((a, b) => (b.churn_pct > a.churn_pct ? b : a));
  insights.push({ icon: <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />, text: `Pior mês: ${worst.ano_mes_label} com ${worst.churn_pct}% de churn (${fmtNum(worst.perdidos)} perdidos de ${fmtNum(worst.base_ativa + worst.perdidos)}).`, severity: 'negative' });

  const best = series.reduce((a, b) => (b.churn_pct < a.churn_pct ? b : a));
  insights.push({ icon: <CheckCircle className="h-4 w-4 text-primary shrink-0" />, text: `Melhor mês: ${best.ano_mes_label} com ${best.churn_pct}% de churn (${fmtNum(best.perdidos)} perdidos de ${fmtNum(best.base_ativa + best.perdidos)}).`, severity: 'positive' });

  const fidMin = Math.min(...series.map(s => s.churn_fidelizados_pct));
  const fidMax = Math.max(...series.map(s => s.churn_fidelizados_pct));
  const osMin = Math.min(...series.map(s => s.churn_oneshot_pct));
  const osMax = Math.max(...series.map(s => s.churn_oneshot_pct));
  const fidRange = +(fidMax - fidMin).toFixed(1);
  insights.push({ icon: <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />, text: `Churn fidelizados: ${fidRange <= 5 ? 'estável' : 'variou'} entre ${fidMin}%–${fidMax}%. One-shot: entre ${osMin}%–${osMax}%.`, severity: 'neutral' });

  const spikes: string[] = [];
  for (let i = 1; i < series.length; i++) {
    const jump = +(series[i].churn_pct - series[i - 1].churn_pct).toFixed(1);
    if (jump > 5) spikes.push(`${series[i].ano_mes_label} (+${jump}pp)`);
  }
  if (spikes.length > 0) {
    insights.push({ icon: <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />, text: `Picos de alta (>5pp MoM): ${spikes.join(', ')}. Investigar causas específicas nesses meses.`, severity: 'warning' });
  }

  const criticalFid = series.filter(s => s.churn_fidelizados_pct > 15);
  if (criticalFid.length > 0) {
    insights.push({ icon: <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />, text: `Churn de fidelizados acima de 15% em ${criticalFid.length} mês(es): ${criticalFid.map(s => `${s.ano_mes_label} (${s.churn_fidelizados_pct}%)`).join(', ')}. Atenção crítica.`, severity: 'negative' });
  }

  const avgResg = series.length > 0 ? +(series.reduce((s, r) => s + r.resgatados, 0) / series.length).toFixed(1) : 0;
  const bestResg = series.reduce((a, b) => (b.resgatados > a.resgatados ? b : a));
  insights.push({ icon: <CheckCircle className="h-4 w-4 text-primary shrink-0" />, text: `Média de ${avgResg} resgatados/mês. Melhor mês: ${bestResg.ano_mes_label} (${fmtNum(bestResg.resgatados)} resgates).`, severity: 'positive' });

  return insights;
}

// ─── Custom Tooltip ────────────────────────────────────────
function EvolucaoTooltip({ active, payload, label, chartConfig }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ChurnEvolucaoItem | undefined;
  if (!row) return null;
  const cfg = chartConfig as ChartConfig;

  const totalBase = row.base_ativa + row.perdidos;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl space-y-1.5 max-w-[85vw] min-w-0">
      <p className="font-semibold text-sm">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive shrink-0" />Churn geral</span>
          <span className="font-medium tabular-nums">{row.churn_pct}% <span className="text-muted-foreground">({fmtNum(row.perdidos)}/{fmtNum(totalBase)})</span></span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'hsl(142 71% 45%)' }} />Churn fidelizados</span>
          <span className="font-medium tabular-nums">{row.churn_fidelizados_pct}% <span className="text-muted-foreground">({fmtNum(row.perdidos_fidelizados)})</span></span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'hsl(48 96% 53%)' }} />Churn one-shot</span>
          <span className="font-medium tabular-nums">{row.churn_oneshot_pct}% <span className="text-muted-foreground">({fmtNum(row.perdidos_oneshot)})</span></span>
        </div>
      </div>
      <div className="border-t border-border pt-1 space-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary shrink-0" />Resgatados</span>
          <span className="text-primary font-medium">{fmtNum(row.resgatados)}</span>
        </div>
        {cfg?.tooltipResgatadosFaixas && row.resgatados > 0 && (
          <div className="pl-4 space-y-0.5 text-muted-foreground">
            <div className="flex justify-between"><span>91–120d</span><span className="text-foreground">{fmtNum(row.resgatados_91_120)}</span></div>
            <div className="flex justify-between"><span>121–150d</span><span className="text-foreground">{fmtNum(row.resgatados_121_150)}</span></div>
            <div className="flex justify-between"><span>151–180d</span><span className="text-foreground">{fmtNum(row.resgatados_151_180)}</span></div>
            <div className="flex justify-between"><span>180d+</span><span className="text-foreground">{fmtNum(row.resgatados_180_plus)}</span></div>
          </div>
        )}
      </div>
      <div className="border-t border-border pt-1 flex items-center gap-3 text-muted-foreground">
        <span>Em risco: <span className="text-yellow-500 font-medium">{fmtNum(row.em_risco)}</span></span>
      </div>
      <div className="text-muted-foreground">
        Retidos: <span className="text-foreground font-medium">{fmtNum(row.base_ativa)}</span> · Atendidos: <span className="text-foreground font-medium">{fmtNum(row.atendidos_mes)}</span>
      </div>
      {cfg?.tooltipAtendidosFaixas && row.atendidos_mes > 0 && (
        <div className="pl-4 space-y-0.5 text-muted-foreground border-t border-border pt-1">
          <div className="flex justify-between"><span>Recorrentes (2+ vis.)</span><span className="text-foreground">{fmtNum(row.atendidos_recorrentes)}</span></div>
          <div className="flex justify-between"><span>1ª vez</span><span className="text-foreground">{fmtNum(row.atendidos_primeira_vez)}</span></div>
          <div className="flex justify-between"><span>Cadência ≤30d</span><span className="text-foreground">{fmtNum(row.atendidos_cadencia_30)}</span></div>
          <div className="flex justify-between"><span>31–45d</span><span className="text-foreground">{fmtNum(row.atendidos_cadencia_45)}</span></div>
          <div className="flex justify-between"><span>46–60d</span><span className="text-foreground">{fmtNum(row.atendidos_cadencia_60)}</span></div>
          <div className="flex justify-between"><span>61–90d</span><span className="text-foreground">{fmtNum(row.atendidos_cadencia_90)}</span></div>
          <div className="flex justify-between"><span>90d+</span><span className="text-foreground">{fmtNum(row.atendidos_cadencia_90_plus)}</span></div>
        </div>
      )}
    </div>
  );
}

// ─── Mensal Tooltip ────────────────────────────────────────
function MensalTooltip({ active, payload, label, chartConfig }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ChurnMensalItem | undefined;
  if (!row) return null;
  const cfg = chartConfig as ChartConfig;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl space-y-1.5 max-w-[85vw] min-w-0">
      <p className="font-semibold text-sm">{label}</p>

      {/* Total perdidos */}
      <div className="flex items-center justify-between gap-4 bg-destructive/10 rounded px-2 py-1 -mx-1">
        <span className="font-semibold text-destructive">Total perdidos no mês</span>
        <span className="font-bold tabular-nums text-destructive">{fmtNum(row.novos_perdidos)}</span>
      </div>

      {/* Abertura */}
      <div className="pl-2 space-y-0.5 text-muted-foreground">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'hsl(0 72% 51%)' }} />Fidelizados</span>
          <span className="tabular-nums text-foreground font-medium">{fmtNum(row.novos_perdidos_fid)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'hsl(25 95% 53%)' }} />One-shot</span>
          <span className="tabular-nums text-foreground font-medium">{fmtNum(row.novos_perdidos_os)}</span>
        </div>
      </div>

      {/* Churn % */}
      <div className="border-t border-border pt-1 space-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <span>Churn geral</span>
          <span className="text-foreground font-medium">{row.churn_pct}%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'hsl(142 71% 45%)' }} />Fid: <span className="text-foreground font-medium">{row.churn_fidelizados_pct}%</span></span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'hsl(48 96% 53%)' }} />1-shot: <span className="text-foreground font-medium">{row.churn_oneshot_pct}%</span></span>
        </div>
      </div>

      {/* Resgatados + base */}
      <div className="border-t border-border pt-1 space-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary shrink-0" />Resgatados</span>
          <span className="font-medium tabular-nums text-primary">{fmtNum(row.resgatados)}</span>
        </div>
        {cfg?.tooltipResgatadosFaixas && row.resgatados > 0 && (
          <div className="pl-4 space-y-0.5 text-muted-foreground">
            <div className="flex justify-between"><span>91–120d</span><span className="text-foreground">{fmtNum(row.resgatados_91_120)}</span></div>
            <div className="flex justify-between"><span>121–150d</span><span className="text-foreground">{fmtNum(row.resgatados_121_150)}</span></div>
            <div className="flex justify-between"><span>151–180d</span><span className="text-foreground">{fmtNum(row.resgatados_151_180)}</span></div>
            <div className="flex justify-between"><span>180d+</span><span className="text-foreground">{fmtNum(row.resgatados_180_plus)}</span></div>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <span>Atendidos no mês</span>
          <span className="font-medium tabular-nums">{fmtNum(row.atendidos_mes)}</span>
        </div>
        {cfg?.tooltipAtendidosFaixas && row.atendidos_mes > 0 && (
          <div className="pl-4 space-y-0.5 text-muted-foreground">
            <div className="flex justify-between"><span>Recorrentes</span><span className="text-foreground">{fmtNum(row.atendidos_recorrentes)}</span></div>
            <div className="flex justify-between"><span>1ª vez</span><span className="text-foreground">{fmtNum(row.atendidos_primeira_vez)}</span></div>
            <div className="flex justify-between"><span>≤30d</span><span className="text-foreground">{fmtNum(row.atendidos_cadencia_30)}</span></div>
            <div className="flex justify-between"><span>31–45d</span><span className="text-foreground">{fmtNum(row.atendidos_cadencia_45)}</span></div>
            <div className="flex justify-between"><span>46–60d</span><span className="text-foreground">{fmtNum(row.atendidos_cadencia_60)}</span></div>
            <div className="flex justify-between"><span>61–90d</span><span className="text-foreground">{fmtNum(row.atendidos_cadencia_90)}</span></div>
            <div className="flex justify-between"><span>90d+</span><span className="text-foreground">{fmtNum(row.atendidos_cadencia_90_plus)}</span></div>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <span>Δ Base</span>
          <span className={`font-medium tabular-nums ${row.variacao_base > 0 ? 'text-primary' : row.variacao_base < 0 ? 'text-destructive' : 'text-foreground'}`}>
            {row.variacao_base > 0 ? '+' : ''}{fmtNum(row.variacao_base)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Severity colors ───────────────────────────────────────
const severityBorder: Record<string, string> = {
  positive: 'border-primary/30',
  negative: 'border-destructive/30',
  warning: 'border-yellow-500/30',
  neutral: 'border-border',
};
const severityBg: Record<string, string> = {
  positive: 'bg-primary/5',
  negative: 'bg-destructive/5',
  warning: 'bg-yellow-500/5',
  neutral: 'bg-muted/30',
};

// ─── Derived monthly series ────────────────────────────────
export interface ChurnMensalItem {
  ano_mes: string;
  ano_mes_label: string;
  atendidos_mes: number;
  novos_perdidos: number;
  variacao_base: number;
  resgatados: number;
  churn_pct: number;
  churn_fidelizados_pct: number;
  churn_oneshot_pct: number;
  novos_perdidos_fid: number;
  novos_perdidos_os: number;
  // breakdowns
  resgatados_91_120: number;
  resgatados_121_150: number;
  resgatados_151_180: number;
  resgatados_180_plus: number;
  atendidos_recorrentes: number;
  atendidos_primeira_vez: number;
  atendidos_cadencia_30: number;
  atendidos_cadencia_45: number;
  atendidos_cadencia_60: number;
  atendidos_cadencia_90: number;
  atendidos_cadencia_90_plus: number;
}

function deriveMonthly(series: ChurnEvolucaoItem[]): ChurnMensalItem[] {
  return series.map((cur, i) => {
    const prev = i > 0 ? series[i - 1] : null;
    const novos_perdidos_fid = prev ? Math.max(0, cur.perdidos_fidelizados - prev.perdidos_fidelizados) : cur.perdidos_fidelizados;
    const novos_perdidos_os = prev ? Math.max(0, cur.perdidos_oneshot - prev.perdidos_oneshot) : cur.perdidos_oneshot;
    return {
      ano_mes: cur.ano_mes,
      ano_mes_label: cur.ano_mes_label,
      atendidos_mes: cur.atendidos_mes,
      novos_perdidos: novos_perdidos_fid + novos_perdidos_os,
      variacao_base: prev ? cur.base_ativa - prev.base_ativa : 0,
      resgatados: cur.resgatados,
      churn_pct: cur.churn_pct,
      churn_fidelizados_pct: cur.churn_fidelizados_pct,
      churn_oneshot_pct: cur.churn_oneshot_pct,
      novos_perdidos_fid,
      novos_perdidos_os,
      resgatados_91_120: cur.resgatados_91_120 ?? 0,
      resgatados_121_150: cur.resgatados_121_150 ?? 0,
      resgatados_151_180: cur.resgatados_151_180 ?? 0,
      resgatados_180_plus: cur.resgatados_180_plus ?? 0,
      atendidos_recorrentes: cur.atendidos_recorrentes ?? 0,
      atendidos_primeira_vez: cur.atendidos_primeira_vez ?? 0,
      atendidos_cadencia_30: cur.atendidos_cadencia_30 ?? 0,
      atendidos_cadencia_45: cur.atendidos_cadencia_45 ?? 0,
      atendidos_cadencia_60: cur.atendidos_cadencia_60 ?? 0,
      atendidos_cadencia_90: cur.atendidos_cadencia_90 ?? 0,
      atendidos_cadencia_90_plus: cur.atendidos_cadencia_90_plus ?? 0,
    };
  });
}

// ─── Chart Config Popover ──────────────────────────────────
function ChartConfigPopover({ config, onChange }: { config: ChartConfig; onChange: (c: ChartConfig) => void }) {
  const toggle = (key: keyof ChartConfig) => onChange({ ...config, [key]: !config[key] });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1">
          <Settings2 className="h-3 w-3" /> Config
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-64 text-xs space-y-3">
        <p className="font-semibold text-foreground text-sm">Configurar gráfico</p>
        <div className="space-y-1.5">
          <p className="text-muted-foreground font-medium">Linhas (%)</p>
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={config.showChurnGeral} onCheckedChange={() => toggle('showChurnGeral')} /> Churn geral</label>
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={config.showChurnFid} onCheckedChange={() => toggle('showChurnFid')} /> Churn fidelizados</label>
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={config.showChurnOneshot} onCheckedChange={() => toggle('showChurnOneshot')} /> Churn one-shot</label>
        </div>
        <div className="space-y-1.5">
          <p className="text-muted-foreground font-medium">Barras (qtd)</p>
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={config.showPerdidosFid} onCheckedChange={() => toggle('showPerdidosFid')} /> Perdidos fid.</label>
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={config.showPerdidosOs} onCheckedChange={() => toggle('showPerdidosOs')} /> Perdidos 1-shot</label>
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={config.showResgatados} onCheckedChange={() => toggle('showResgatados')} /> Resgatados</label>
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={config.showAtendidos} onCheckedChange={() => toggle('showAtendidos')} /> Atendidos</label>
        </div>
        <div className="space-y-1.5">
          <p className="text-muted-foreground font-medium">Tooltip</p>
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={config.tooltipResgatadosFaixas} onCheckedChange={() => toggle('tooltipResgatadosFaixas')} /> Resgatados por faixa</label>
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={config.tooltipAtendidosFaixas} onCheckedChange={() => toggle('tooltipAtendidosFaixas')} /> Atendidos por cadência</label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Resgatados stacked bar chart colors ───────────────────
const RESG_COLORS = ['hsl(200 80% 50%)', 'hsl(170 70% 45%)', 'hsl(280 60% 55%)', 'hsl(330 70% 50%)'];
const ATEND_COLORS = ['hsl(142 71% 45%)', 'hsl(200 70% 50%)', 'hsl(48 96% 53%)', 'hsl(25 95% 53%)', 'hsl(280 60% 55%)', 'hsl(330 70% 50%)', 'hsl(0 72% 51%)'];

export function TabChurn({ filters, raioxConfig, evolucaoData, evolucaoLoading, evolucaoError, evolucaoBarbeiroData, evolucaoBarbeiroLoading, evolucaoBarbeiroError }: Props) {
  const [modo, setModo] = useState('snapshot');
  const [evolucaoModo, setEvolucaoModo] = useState<'acumulado' | 'mensal'>('acumulado');
  const [listaFiltro, setListaFiltro] = useState('PERDIDO');
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillRequest, setDrillRequest] = useState<DrillRequest | null>(null);
  const [listaOpen, setListaOpen] = useState(false);
  const [barbeirosOpen, setBarbeirosOpen] = useState(false);
  const [evolucaoTableOpen, setEvolucaoTableOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [barbeirosEvolOpen, setBarbeirosEvolOpen] = useState(false);
  const [barbeirosEvolMetrica, setBarbeirosEvolMetrica] = useState<'geral' | 'fidelizados' | 'oneshot'>('geral');
  const [chartConfig, setChartConfig] = useState<ChartConfig>(defaultChartConfig);
  const [resgatadosChartOpen, setResgatadosChartOpen] = useState(false);
  const [atendidosChartOpen, setAtendidosChartOpen] = useState(false);
  const [saldoChartOpen, setSaldoChartOpen] = useState(false);
  const [barbeirosChurnTipoMode, setBarbeirosChurnTipoMode] = useState<'ultimo_mes' | 'media'>('ultimo_mes');
  const [barbeirosEvolDisplay, setBarbeirosEvolDisplay] = useState<'%' | 'num' | 'ambos'>('%');
  const [hiddenBarbers, setHiddenBarbers] = useState<Set<string>>(new Set());

  const cfg = raioxConfig.config;
  const { data, loading, error } = useRaioXClientesChurn(filters, {
    ref_mode: cfg?.ref_mode,
    base_mode: cfg?.base_mode,
    base_corte_meses: cfg?.base_corte_meses,
    churn_dias_sem_voltar: cfg?.churn_dias_sem_voltar,
    risco_min_dias: cfg?.risco_min_dias,
    risco_max_dias: cfg?.risco_max_dias,
    cadencia_min_visitas: cfg?.cadencia_min_visitas,
    resgate_dias_minimos: cfg?.resgate_dias_minimos,
    atribuicao_modo: cfg?.atribuicao_modo,
    atribuicao_janela_meses: cfg?.atribuicao_janela_meses,
  });

  const kpis = data?.kpis;
  const meta = data?.meta;
  const lista = data?.lista_perdidos ?? [];
  const porBarbeiro = data?.por_barbeiro ?? [];

  const listaFiltrada = lista.filter((r) => r.status_churn === listaFiltro);

  const openDrill = (tipo: string, valor: string, label: string) => {
    setDrillRequest({ tipo: tipo as DrillRequest['tipo'], valor, label });
    setDrillOpen(true);
  };

  const churnDrillExtraParams = {
    p_churn_dias_sem_voltar: cfg?.churn_dias_sem_voltar ?? 90,
    p_risco_min_dias: cfg?.risco_min_dias ?? 45,
    p_risco_max_dias: cfg?.risco_max_dias ?? 90,
    p_cadencia_min_visitas: cfg?.cadencia_min_visitas ?? 3,
    p_resgate_dias_minimos: cfg?.resgate_dias_minimos ?? 90,
    p_atribuicao_modo: cfg?.atribuicao_modo ?? 'MULTI',
    p_atribuicao_janela_meses: cfg?.atribuicao_janela_meses ?? 12,
    p_base_mode: cfg?.base_mode ?? 'TOTAL_COM_CORTE',
    p_base_corte_meses: cfg?.base_corte_meses ?? 24,
    p_ref_mode: cfg?.ref_mode ?? 'FIM_FILTRO',
  };

  const exportCSV = (rows: { cliente_nome?: string | null; telefone?: string | null; colaborador_nome?: string | null; ultima_visita?: string | null; dias_sem_vir?: number; visitas_total?: number; valor_total?: number; status_churn?: string }[], filename: string) => {
    if (!rows.length) return;
    const headers = ['Cliente', 'Telefone', 'Barbeiro', 'Última visita', 'Dias sem vir', 'Visitas', 'Valor', 'Status'];
    const csvRows = rows.map((r) => [
      r.cliente_nome || '', r.telefone || '', r.colaborador_nome || '',
      r.ultima_visita || '', r.dias_sem_vir ?? '', r.visitas_total ?? '',
      (r.valor_total ?? 0).toFixed(2), r.status_churn || '',
    ]);
    const csv = [headers, ...csvRows].map((r) => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportMonthCSV = (m: ChurnMensalItem) => {
    const headers = ['Mês', 'Atendidos', 'Novos perdidos total', 'Perdidos fid', 'Perdidos 1-shot', 'Resgatados', 'Resg 91-120d', 'Resg 121-150d', 'Resg 151-180d', 'Resg 180d+', 'Δ Base', 'Churn %', 'Churn fid %', 'Churn 1-shot %', 'Atend recorrentes', 'Atend 1ª vez', 'Cad ≤30d', 'Cad 31-45d', 'Cad 46-60d', 'Cad 61-90d', 'Cad 90d+'];
    const row = [
      m.ano_mes_label, m.atendidos_mes, m.novos_perdidos, m.novos_perdidos_fid, m.novos_perdidos_os,
      m.resgatados, m.resgatados_91_120, m.resgatados_121_150, m.resgatados_151_180, m.resgatados_180_plus,
      m.variacao_base, m.churn_pct, m.churn_fidelizados_pct, m.churn_oneshot_pct,
      m.atendidos_recorrentes, m.atendidos_primeira_vez,
      m.atendidos_cadencia_30, m.atendidos_cadencia_45, m.atendidos_cadencia_60, m.atendidos_cadencia_90, m.atendidos_cadencia_90_plus,
    ];
    const csv = [headers.join(';'), row.join(';')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `churn_mensal_${m.ano_mes}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportAllMonthsCSV = () => {
    if (!monthlySeries.length) return;
    const headers = ['Mês', 'Atendidos', 'Novos perdidos total', 'Perdidos fid', 'Perdidos 1-shot', 'Resgatados', 'Resg 91-120d', 'Resg 121-150d', 'Resg 151-180d', 'Resg 180d+', 'Δ Base', 'Churn %', 'Churn fid %', 'Churn 1-shot %', 'Atend recorrentes', 'Atend 1ª vez', 'Cad ≤30d', 'Cad 31-45d', 'Cad 46-60d', 'Cad 61-90d', 'Cad 90d+'];
    const rows = monthlySeries.map(m => [
      m.ano_mes_label, m.atendidos_mes, m.novos_perdidos, m.novos_perdidos_fid, m.novos_perdidos_os,
      m.resgatados, m.resgatados_91_120, m.resgatados_121_150, m.resgatados_151_180, m.resgatados_180_plus,
      m.variacao_base, m.churn_pct, m.churn_fidelizados_pct, m.churn_oneshot_pct,
      m.atendidos_recorrentes, m.atendidos_primeira_vez,
      m.atendidos_cadencia_30, m.atendidos_cadencia_45, m.atendidos_cadencia_60, m.atendidos_cadencia_90, m.atendidos_cadencia_90_plus,
    ].join(';'));
    const csv = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `churn_evolucao_mensal.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const baseTotal = kpis ? (kpis.base_ativa ?? 0) + (kpis.perdidos ?? 0) : 0;
  const baseFid = kpis ? (kpis.base_fidelizados ?? 0) + (kpis.perdidos_fidelizados ?? 0) : 0;
  const baseOneshot = kpis ? (kpis.base_oneshot ?? 0) + (kpis.perdidos_oneshot ?? 0) : 0;
  const churnDias = cfg?.churn_dias_sem_voltar ?? 90;
  const riscoMin = cfg?.risco_min_dias ?? 45;
  const riscoMax = cfg?.risco_max_dias ?? 90;
  const minVisitas = cfg?.cadencia_min_visitas ?? 3;
  const resgateDias = cfg?.resgate_dias_minimos ?? 90;

  const baseChurn: BaseType = (cfg?.base_churn as BaseType) ?? 'P';
  const baseModeLabel = BASE_LABEL[baseChurn] ?? 'Principal';

  const perdidosCount = lista.filter(r => r.status_churn === 'PERDIDO').length;
  const riscoCount = lista.filter(r => r.status_churn === 'RISCO').length;
  const resgatadosCount = lista.filter(r => r.status_churn === 'RESGATADO').length;

  const avgChurn = porBarbeiro.length > 0
    ? (porBarbeiro.reduce((s, b) => s + b.churn_pct, 0) / porBarbeiro.length).toFixed(1)
    : '0';

  // Evolução data
  const series = evolucaoData?.series ?? [];
  const monthlySeries = useMemo(() => deriveMonthly(series), [series]);
  const insights = useMemo(() => generateChurnAnalysis(series), [series]);

  // Barbeiro evolution data processing
  const barbeiroSeries = evolucaoBarbeiroData?.series ?? [];
  const barbeiroEvol = useMemo(() => {
    if (barbeiroSeries.length === 0) return { barbers: [], months: [] };
    const monthsSet = new Set<string>();
    const barbersMap = new Map<string, { id: string; nome: string }>();
    barbeiroSeries.forEach(s => {
      monthsSet.add(s.ano_mes);
      if (!barbersMap.has(s.colaborador_id)) barbersMap.set(s.colaborador_id, { id: s.colaborador_id, nome: s.colaborador_nome });
    });
    const months = Array.from(monthsSet).sort();
    const barbers = Array.from(barbersMap.values());
    const lookup = new Map<string, ChurnEvolucaoBarbeiroItem>();
    barbeiroSeries.forEach(s => lookup.set(`${s.colaborador_id}|${s.ano_mes}`, s));
    const barbersWithTrend = barbers.map(b => {
      const firstMonth = lookup.get(`${b.id}|${months[0]}`);
      const lastMonth = lookup.get(`${b.id}|${months[months.length - 1]}`);
      const getChurn = (item: ChurnEvolucaoBarbeiroItem | undefined) => {
        if (!item) return 0;
        if (barbeirosEvolMetrica === 'fidelizados') return item.churn_fidelizados_pct;
        if (barbeirosEvolMetrica === 'oneshot') return item.churn_oneshot_pct;
        return item.churn_pct;
      };
      const first = getChurn(firstMonth);
      const last = getChurn(lastMonth);
      const trend = months.length >= 2 ? last - first : 0;
      const avgChurn = months.reduce((sum, m) => sum + getChurn(lookup.get(`${b.id}|${m}`)), 0) / months.length;
      return { ...b, trend: +trend.toFixed(1), avgChurn: +avgChurn.toFixed(1) };
    }).sort((a, b) => b.avgChurn - a.avgChurn);
    const monthLabels = months.map(m => {
      const item = barbeiroSeries.find(s => s.ano_mes === m);
      return item?.ano_mes_label ?? m;
    });
    return { barbers: barbersWithTrend, months, monthLabels, lookup };
  }, [barbeiroSeries, barbeirosEvolMetrica]);

  // Barbeiro churn by type chart data
  const barbeirosChurnTipoData = useMemo(() => {
    if (barbeiroSeries.length === 0) return [];
    const months = Array.from(new Set(barbeiroSeries.map(s => s.ano_mes))).sort();
    const lastMonth = months[months.length - 1];

    // Group by barbeiro
    const barbMap = new Map<string, ChurnEvolucaoBarbeiroItem[]>();
    barbeiroSeries.forEach(s => {
      if (!barbMap.has(s.colaborador_id)) barbMap.set(s.colaborador_id, []);
      barbMap.get(s.colaborador_id)!.push(s);
    });

    const result: { nome: string; churn_fid: number; churn_os: number; perdidos_fid: number; perdidos_os: number; base_ativa: number; churn_total: number }[] = [];

    barbMap.forEach((items, _id) => {
      if (barbeirosChurnTipoMode === 'ultimo_mes') {
        const item = items.find(i => i.ano_mes === lastMonth);
        if (!item || item.atendidos_mes <= 0) return;
        result.push({
          nome: item.colaborador_nome,
          churn_fid: item.churn_fidelizados_pct,
          churn_os: item.churn_oneshot_pct,
          perdidos_fid: item.perdidos_fidelizados,
          perdidos_os: item.perdidos_oneshot,
          base_ativa: item.base_ativa,
          churn_total: item.churn_pct,
        });
      } else {
        const active = items.filter(i => i.atendidos_mes > 0);
        if (active.length === 0) return;
        const avgFid = +(active.reduce((s, i) => s + i.churn_fidelizados_pct, 0) / active.length).toFixed(1);
        const avgOs = +(active.reduce((s, i) => s + i.churn_oneshot_pct, 0) / active.length).toFixed(1);
        const avgTotal = +(active.reduce((s, i) => s + i.churn_pct, 0) / active.length).toFixed(1);
        const sumFid = active.reduce((s, i) => s + i.perdidos_fidelizados, 0);
        const sumOs = active.reduce((s, i) => s + i.perdidos_oneshot, 0);
        const avgBase = Math.round(active.reduce((s, i) => s + i.base_ativa, 0) / active.length);
        result.push({
          nome: active[0].colaborador_nome,
          churn_fid: avgFid,
          churn_os: avgOs,
          perdidos_fid: sumFid,
          perdidos_os: sumOs,
          base_ativa: avgBase,
          churn_total: avgTotal,
        });
      }
    });

    return result.sort((a, b) => b.churn_total - a.churn_total);
  }, [barbeiroSeries, barbeirosChurnTipoMode]);

  const avgChurnRef = barbeirosChurnTipoData.length > 0
    ? +(barbeirosChurnTipoData.reduce((s, b) => s + b.churn_total, 0) / barbeirosChurnTipoData.length).toFixed(1)
    : 0;

  // InfoIconTooltip content for the evolução mode
  const evolucaoInfoDetails = (
    <div className="space-y-3">
      <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 space-y-0.5">
        <p className="text-muted-foreground font-medium text-[9px]">Fonte: <span className="text-foreground/80 font-medium">Base Status {cfg?.status12m_meses ?? 12}m (S)</span></p>
        <p className="text-muted-foreground text-[9px]">Usada em: <span className="text-foreground/80 font-medium">Churn % · Perdidos · Resgatados · Em risco mensal</span></p>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">📷 Modo Acumulado (Snapshot)</p>
        <p>Mostra o <strong>estado total</strong> no fim de cada mês. Retidos, perdidos e em risco são contagens cumulativas.</p>
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">📅 Modo Mensal (Variação)</p>
        <p><strong>Novos perdidos</strong> = quantos clientes cruzaram o limite de {churnDias}d sem vir <em>naquele mês</em>.</p>
        <p>Cálculo: perdidos_fid[mês] − perdidos_fid[mês-1] + perdidos_os[mês] − perdidos_os[mês-1].</p>
      </div>
      <hr className="border-border" />
      <div>
        <p className="font-semibold text-foreground mb-1">Métricas do Tooltip</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Perdidos fidelizados</strong>: clientes com ≥{minVisitas} visitas que ficaram ≥{churnDias}d sem vir.</li>
          <li><strong>Perdidos one-shot</strong>: clientes com 1 visita que ficaram ≥{churnDias}d sem vir.</li>
          <li><strong>Churn %</strong>: perdidos ÷ (retidos + perdidos) no fim do mês.</li>
          <li><strong>Resgatados</strong>: clientes que estavam ≥{resgateDias}d sem vir e voltaram no mês.</li>
          <li><strong>Em risco</strong>: entre {riscoMin}d e {riscoMax}d sem vir (quase perdidos).</li>
          <li><strong>Δ Base</strong>: retidos[mês] − retidos[mês-1]. Positivo = base cresceu.</li>
        </ul>
      </div>
      <hr className="border-border" />
      <div>
        <p className="font-semibold text-foreground mb-1">Resgatados por faixa</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>91–120d</strong>: ficaram fora entre 91 e 120 dias antes de voltar.</li>
          <li><strong>121–150d</strong>: fora entre 121 e 150 dias.</li>
          <li><strong>151–180d</strong>: fora entre 151 e 180 dias.</li>
          <li><strong>180d+</strong>: ficaram fora mais de 180 dias.</li>
        </ul>
        <p className="mt-1 text-muted-foreground">Quanto maior a faixa, mais difícil o resgate. Muitos em 180d+ = recuperação de clientes antigos.</p>
      </div>
      <hr className="border-border" />
      <div>
        <p className="font-semibold text-foreground mb-1">Atendidos por cadência</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Recorrentes</strong>: 2+ visitas no histórico.</li>
          <li><strong>1ª vez</strong>: exatamente 1 visita (cliente novo ou one-shot).</li>
          <li><strong>≤30d</strong>: cadência média de até 30 dias entre visitas.</li>
          <li><strong>31–45d</strong>: cadência entre 31 e 45 dias.</li>
          <li><strong>46–60d</strong>: cadência entre 46 e 60 dias.</li>
          <li><strong>61–90d</strong>: cadência entre 61 e 90 dias.</li>
          <li><strong>90d+</strong>: cadência acima de 90 dias (esporádicos).</li>
        </ul>
        <p className="mt-1 text-muted-foreground">Mostra o perfil dos clientes que realmente vieram no mês: frequentes vs esporádicos.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* A) Header explicativo */}
      <HowToReadSection
        title="Como ler esta aba"
        bullets={[
          <span key="1">
            <BaseBadge type={baseChurn} meses={meta?.base_corte_meses ?? cfg?.base_corte_meses ?? 24} dias={cfg?.janela_dias_padrao ?? 60} />
            {' '}<strong>Churn geral</strong> = perdidos ÷ (retidos + perdidos). Perdido = ≥{churnDias}d sem vir.
            {kpis && <span className="text-muted-foreground"> Atual: {fmtNum(kpis.perdidos)} ÷ {fmtNum(baseTotal)} = {kpis.churn_geral_pct}%</span>}
          </span>,
          <span key="2">
            <Badge variant="outline" className="mr-1.5 text-[9px] px-1.5 py-0 border-green-500/40 text-green-400">Fidelizados</Badge>
            <strong>Churn fidelizados</strong> = clientes com ≥{minVisitas} visitas que pararam de vir.
            {kpis && <span className="text-muted-foreground"> {fmtNum(kpis.perdidos_fidelizados)} perdidos de {fmtNum(baseFid)} = {kpis.churn_fidelizados_pct}%</span>}
          </span>,
          <span key="3">
            <Badge variant="outline" className="mr-1.5 text-[9px] px-1.5 py-0 border-yellow-500/40 text-yellow-400">One-shot</Badge>
            <strong>Churn one-shot</strong> = clientes com exatamente 1 visita que não voltaram.
            {kpis && <span className="text-muted-foreground"> {fmtNum(kpis.perdidos_oneshot)} de {fmtNum(baseOneshot)} = {kpis.churn_oneshot_pct}%</span>}
          </span>,
          <span key="4">
            <strong>Resgatados</strong> = ficaram ≥{resgateDias}d sem vir e voltaram no período ({meta ? `${fmtDate(meta.inicio)}–${fmtDate(meta.fim)}` : '...'}).
            {kpis && <span className="text-muted-foreground"> Total: {fmtNum(kpis.resgatados)}</span>}
          </span>,
          <span key="5">
            <strong>Em risco</strong> = entre {riscoMin}d e {riscoMax}d sem vir (antes de virar perdido).
            {kpis && <span className="text-muted-foreground"> {fmtNum(kpis.em_risco)} clientes</span>}
          </span>,
        ]}
      />

      {/* Context banner */}
      {!loading && meta && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground bg-muted/30 border border-border rounded-md px-3 py-2">
          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Ref: <span className="text-foreground font-medium">{fmtDate(meta.ref)}</span></span>
          <span>Período: <span className="text-foreground font-medium">{fmtDate(meta.inicio)} – {fmtDate(meta.fim)}</span></span>
          <span className="inline-flex items-center gap-1"><Database className="h-3 w-3" />Base: <BaseBadge type={baseChurn} meses={meta.base_corte_meses} dias={cfg?.janela_dias_padrao ?? 60} /></span>
          <span>Universo: <span className="text-foreground font-medium">{fmtNum(meta.total_universo)}</span> clientes</span>
          <span>Churn ≥<span className="text-foreground font-medium">{churnDias}d</span></span>
        </div>
      )}

      {/* B) Toggle: Snapshot vs Evolução */}
      <div className="flex flex-wrap gap-3">
        <SegmentedToggle value={modo} onValueChange={setModo} options={[
          { value: 'snapshot', label: 'Snapshot' },
          { value: 'evolucao', label: 'Evolução' },
        ]} />
      </div>

      {/* Error state */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          Erro ao carregar dados de churn: {error}
        </div>
      )}

      {modo === 'snapshot' && (
        <>
          {/* C) KPIs clicáveis */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="cursor-pointer" onClick={() => openDrill('PERDIDOS', '', `Churn geral — ${kpis?.perdidos ?? 0} perdidos`)}>
              <KpiCard label="Churn geral" value={loading ? '--' : `${kpis?.churn_geral_pct ?? 0}%`} subtitle={!loading && kpis ? `${fmtNum(kpis.perdidos)} perdidos de ${fmtNum(baseTotal)}` : undefined} loading={loading} status={kpis && kpis.churn_geral_pct > 20 ? 'negative' : 'neutral'} />
            </div>
            <div className="cursor-pointer" onClick={() => openDrill('PERDIDOS_FIDELIZADOS', '', `Churn fidelizados — ${kpis?.perdidos_fidelizados ?? 0} perdidos`)}>
              <KpiCard label="Churn fidelizados" value={loading ? '--' : `${kpis?.churn_fidelizados_pct ?? 0}%`} subtitle={!loading && kpis ? `${fmtNum(kpis.perdidos_fidelizados)} de ${fmtNum(baseFid)} (≥${minVisitas} vis.)` : undefined} loading={loading} status={kpis && kpis.churn_fidelizados_pct > 15 ? 'negative' : 'neutral'} />
            </div>
            <div className="cursor-pointer" onClick={() => openDrill('PERDIDOS_ONESHOT', '', `Churn one-shot — ${kpis?.perdidos_oneshot ?? 0} perdidos`)}>
              <KpiCard label="Churn one-shot" value={loading ? '--' : `${kpis?.churn_oneshot_pct ?? 0}%`} subtitle={!loading && kpis ? `${fmtNum(kpis.perdidos_oneshot)} de ${fmtNum(baseOneshot)} (1 vis.)` : undefined} loading={loading} status={kpis && kpis.churn_oneshot_pct > 40 ? 'warning' : 'neutral'} />
            </div>
            <div className="cursor-pointer" onClick={() => openDrill('RESGATADOS', '', `Resgatados — ${kpis?.resgatados ?? 0} clientes`)}>
              <KpiCard label="Resgatados" value={loading ? '--' : String(kpis?.resgatados ?? 0)} subtitle={!loading && kpis ? `voltaram após ≥${resgateDias}d sem vir` : undefined} loading={loading} status="positive" />
            </div>
          </div>

          {/* Extra KPI: Em risco */}
          {!loading && kpis && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-yellow-500 font-medium">{fmtNum(kpis.em_risco)}</span> clientes em risco ({riscoMin}–{riscoMax}d sem vir)
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-foreground" onClick={() => openDrill('RISCO', '', `Em risco — ${kpis.em_risco} clientes`)}>Ver lista</Button>
            </div>
          )}

          {/* D) Lista acionável — Collapsible */}
          <Collapsible open={listaOpen} onOpenChange={setListaOpen}>
            <CollapsibleTrigger asChild>
              <button type="button" className="w-full flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 text-xs text-foreground">
                  <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${listaOpen ? 'rotate-90' : ''}`} />
                  <span className="font-semibold">Lista de clientes</span>
                  <span className="text-muted-foreground">Perdidos ({perdidosCount}) · Em risco ({riscoCount}) · Resgatados ({resgatadosCount})</span>
                </div>
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); exportCSV(listaFiltrada, `churn_${listaFiltro.toLowerCase()}.csv`); }} disabled={!listaFiltrada.length}>
                  <Download className="h-3 w-3 mr-1" /> CSV
                </Button>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 pt-2">
                <SegmentedToggle value={listaFiltro} onValueChange={setListaFiltro} options={[
                  { value: 'PERDIDO', label: `Perdidos (${perdidosCount})` },
                  { value: 'RISCO', label: `Em risco (${riscoCount})` },
                  { value: 'RESGATADO', label: `Resgatados (${resgatadosCount})` },
                ]} />

                {loading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : listaFiltrada.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhum cliente nesta categoria.</p>
                ) : (
                  <div className="border border-border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] py-1 text-muted-foreground">Cliente</TableHead>
                          <TableHead className="text-[10px] py-1 text-muted-foreground">Status</TableHead>
                          <TableHead className="text-[10px] py-1 text-right text-muted-foreground hidden sm:table-cell">Última visita</TableHead>
                          <TableHead className="text-[10px] py-1 text-right text-muted-foreground">Dias s/ vir</TableHead>
                          <TableHead className="text-[10px] py-1 text-right text-muted-foreground hidden sm:table-cell">Visitas</TableHead>
                          <TableHead className="text-[10px] py-1 text-muted-foreground hidden sm:table-cell">Barbeiro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listaFiltrada.map((r) => (
                          <TableRow key={r.cliente_id} className="text-[11px]">
                            <TableCell className="py-1 text-foreground font-medium">{r.cliente_nome || '-'}</TableCell>
                            <TableCell className="py-1">
                              <span className={`text-[10px] font-medium ${r.status_churn === 'PERDIDO' ? 'text-destructive' : r.status_churn === 'RISCO' ? 'text-yellow-500' : 'text-primary'}`}>
                                {r.status_churn === 'PERDIDO' ? 'Perdido' : r.status_churn === 'RISCO' ? 'Em risco' : 'Resgatado'}
                              </span>
                            </TableCell>
                            <TableCell className="py-1 text-right text-foreground hidden sm:table-cell">{fmtDate(r.ultima_visita)}</TableCell>
                            <TableCell className="py-1 text-right text-foreground">{r.dias_sem_vir}d</TableCell>
                            <TableCell className="py-1 text-right text-foreground hidden sm:table-cell">{r.visitas_total}</TableCell>
                            <TableCell className="py-1 text-foreground hidden sm:table-cell">{r.colaborador_nome || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}

      {/* ===================== EVOLUÇÃO VIEW ===================== */}
      {modo === 'evolucao' && (
        <>
          {evolucaoError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">Erro ao carregar evolução: {evolucaoError}</div>
          )}

          {evolucaoLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : series.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados de evolução para o período.</p>
          ) : (
            <>
              {/* Chart */}
              <div className="border border-border rounded-md p-3 bg-muted/10">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <p className="text-xs font-semibold text-foreground">Evolução do Churn</p>
                  <SegmentedToggle
                    value={evolucaoModo}
                    onValueChange={(v) => setEvolucaoModo(v as 'acumulado' | 'mensal')}
                    options={[
                      { value: 'acumulado', label: '📷 Acumulado' },
                      { value: 'mensal', label: '📅 Mensal' },
                    ]}
                  />
                  <InfoIconTooltip
                    title="Guia de leitura — Evolução do Churn"
                    short="Clique para ver definição de cada métrica, faixas e cálculos"
                    details={evolucaoInfoDetails}
                  />
                  <ChartConfigPopover config={chartConfig} onChange={setChartConfig} />
                  {insights.length > 0 && (
                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10" onClick={() => setAnalysisOpen(true)}>
                      <BarChart3 className="h-3 w-3" /> Análise
                    </Button>
                  )}
                </div>

                {evolucaoModo === 'acumulado' ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={series} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="ano_mes_label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} className="fill-muted-foreground" unit="%" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                      <Tooltip content={<EvolucaoTooltip chartConfig={chartConfig} />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {chartConfig.showPerdidosFid && <Bar yAxisId="right" dataKey="perdidos" name="Perdidos (qtd)" fill="hsl(var(--destructive))" opacity={0.12} radius={[2, 2, 0, 0]} />}
                      {chartConfig.showResgatados && <Bar yAxisId="right" dataKey="resgatados" name="Resgatados" fill="hsl(var(--primary))" opacity={0.2} radius={[2, 2, 0, 0]} />}
                      {chartConfig.showChurnGeral && <Line yAxisId="left" type="monotone" dataKey="churn_pct" name="Churn geral" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />}
                      {chartConfig.showChurnFid && <Line yAxisId="left" type="monotone" dataKey="churn_fidelizados_pct" name="Churn fidelizados" stroke="hsl(142 71% 45%)" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />}
                      {chartConfig.showChurnOneshot && <Line yAxisId="left" type="monotone" dataKey="churn_oneshot_pct" name="Churn one-shot" stroke="hsl(48 96% 53%)" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={monthlySeries} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="ano_mes_label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} className="fill-muted-foreground" unit="%" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                      <Tooltip content={<MensalTooltip chartConfig={chartConfig} />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {chartConfig.showPerdidosFid && <Bar yAxisId="right" dataKey="novos_perdidos_fid" name="Perdidos fid." fill="hsl(var(--destructive))" opacity={0.3} stackId="perdidos" />}
                      {chartConfig.showPerdidosOs && <Bar yAxisId="right" dataKey="novos_perdidos_os" name="Perdidos 1-shot" fill="hsl(25 95% 53%)" opacity={0.3} stackId="perdidos" radius={[2, 2, 0, 0]} />}
                      {chartConfig.showResgatados && <Bar yAxisId="right" dataKey="resgatados" name="Resgatados" fill="hsl(var(--primary))" opacity={0.25} radius={[2, 2, 0, 0]} />}
                      {chartConfig.showAtendidos && <Bar yAxisId="right" dataKey="atendidos_mes" name="Atendidos" fill="hsl(200 70% 50%)" opacity={0.15} radius={[2, 2, 0, 0]} />}
                      {chartConfig.showChurnGeral && <Line yAxisId="left" type="monotone" dataKey="churn_pct" name="Churn geral %" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />}
                      {chartConfig.showChurnFid && <Line yAxisId="left" type="monotone" dataKey="churn_fidelizados_pct" name="Churn fid. %" stroke="hsl(142 71% 45%)" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />}
                      {chartConfig.showChurnOneshot && <Line yAxisId="left" type="monotone" dataKey="churn_oneshot_pct" name="Churn 1-shot %" stroke="hsl(48 96% 53%)" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Evolução table — Collapsible */}
              <Collapsible open={evolucaoTableOpen} onOpenChange={setEvolucaoTableOpen}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="w-full flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 text-xs text-foreground">
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${evolucaoTableOpen ? 'rotate-90' : ''}`} />
                      <span className="font-semibold">Tabela mensal</span>
                      <span className="text-muted-foreground">{series.length} meses</span>
                      <MetricTypeBadge type={evolucaoModo === 'acumulado' ? 'snapshot' : 'mensal'} />
                    </div>
                    {evolucaoModo === 'mensal' && monthlySeries.length > 0 && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); exportAllMonthsCSV(); }}>
                        <Download className="h-3 w-3 mr-1" /> CSV todos
                      </Button>
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-2 border border-border rounded-md overflow-x-auto">
                    {evolucaoModo === 'acumulado' ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] py-1 text-muted-foreground">Mês</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground"><span className="inline-flex items-center gap-1">Atendidos <MetricTypeBadge type="mensal" /></span></TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground"><span className="inline-flex items-center gap-1">Retidos <MetricTypeBadge type="snapshot" /></span></TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground"><span className="inline-flex items-center gap-1">Perdidos <MetricTypeBadge type="snapshot" /></span></TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">Churn %</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground hidden sm:table-cell">Fid. perd.</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground hidden sm:table-cell">Churn fid. %</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground hidden sm:table-cell">1-shot perd.</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground hidden sm:table-cell">Churn 1-shot %</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground"><span className="inline-flex items-center gap-1">Resgatados <MetricTypeBadge type="mensal" /></span></TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground hidden sm:table-cell"><span className="inline-flex items-center gap-1">Em risco <MetricTypeBadge type="snapshot" /></span></TableHead>
                            {series.length > 1 && <TableHead className="text-[10px] py-1 text-right text-muted-foreground hidden sm:table-cell">Δ MoM</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {series.map((s, idx) => {
                            const prevChurn = idx > 0 ? series[idx - 1].churn_pct : null;
                            const mom = prevChurn != null ? +(s.churn_pct - prevChurn).toFixed(1) : null;
                            const totalBase = s.base_ativa + s.perdidos;
                            return (
                              <TableRow key={s.ano_mes} className="text-[11px] cursor-pointer hover:bg-muted/50" onClick={() => openDrill('PERDIDOS', '', `Perdidos ${s.ano_mes_label} — ${s.perdidos} clientes`)}>
                                <TableCell className="py-1 font-medium text-foreground">{s.ano_mes_label}</TableCell>
                                <TableCell className="py-1 text-right text-primary font-medium">{fmtNum(s.atendidos_mes)}</TableCell>
                                <TableCell className="py-1 text-right text-foreground">{fmtNum(s.base_ativa)}</TableCell>
                                <TableCell className="py-1 text-right text-foreground">{fmtNum(s.perdidos)}</TableCell>
                                <TableCell className={`py-1 text-right font-medium ${s.churn_pct > 20 ? 'text-destructive' : 'text-foreground'}`}>
                                  {s.churn_pct}% <span className="text-muted-foreground font-normal text-[10px]">({fmtNum(s.perdidos)}/{fmtNum(totalBase)})</span>
                                </TableCell>
                                <TableCell className="py-1 text-right text-foreground hidden sm:table-cell">{fmtNum(s.perdidos_fidelizados)}</TableCell>
                                <TableCell className={`py-1 text-right hidden sm:table-cell ${s.churn_fidelizados_pct > 15 ? 'text-destructive font-medium' : 'text-foreground'}`}>{s.churn_fidelizados_pct}%</TableCell>
                                <TableCell className="py-1 text-right text-foreground hidden sm:table-cell">{fmtNum(s.perdidos_oneshot)}</TableCell>
                                <TableCell className="py-1 text-right text-foreground hidden sm:table-cell">{s.churn_oneshot_pct}%</TableCell>
                                <TableCell className="py-1 text-right text-primary">{fmtNum(s.resgatados)}</TableCell>
                                <TableCell className="py-1 text-right text-yellow-500 hidden sm:table-cell">{fmtNum(s.em_risco)}</TableCell>
                                {series.length > 1 && (
                                  <TableCell className={`py-1 text-right font-medium hidden sm:table-cell ${mom != null && mom > 0 ? 'text-destructive' : mom != null && mom < 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {mom != null ? `${mom > 0 ? '+' : ''}${mom}pp` : '-'}
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] py-1 text-muted-foreground">Mês</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">Atendidos</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">Novos perd.</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">Fid.</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">1-shot</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">Resgatados</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">Δ Base</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">Churn %</TableHead>
                            <TableHead className="text-[10px] py-1 text-center text-muted-foreground w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthlySeries.map((m) => (
                            <TableRow key={m.ano_mes} className="text-[11px] hover:bg-muted/50">
                              <TableCell className="py-1 font-medium text-foreground">{m.ano_mes_label}</TableCell>
                              <TableCell className="py-1 text-right text-primary font-medium">{fmtNum(m.atendidos_mes)}</TableCell>
                              <TableCell className="py-1 text-right text-destructive font-medium">{fmtNum(m.novos_perdidos)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.novos_perdidos_fid)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.novos_perdidos_os)}</TableCell>
                              <TableCell className="py-1 text-right text-primary">{fmtNum(m.resgatados)}</TableCell>
                              <TableCell className={`py-1 text-right font-medium ${m.variacao_base > 0 ? 'text-primary' : m.variacao_base < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {m.variacao_base > 0 ? '+' : ''}{fmtNum(m.variacao_base)}
                              </TableCell>
                              <TableCell className={`py-1 text-right font-medium ${m.churn_pct > 20 ? 'text-destructive' : 'text-foreground'}`}>{m.churn_pct}%</TableCell>
                              <TableCell className="py-1 text-center">
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); exportMonthCSV(m); }} title={`Exportar CSV de ${m.ano_mes_label}`}>
                                  <Download className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ─── Analytical sections ──────────────────────────── */}

              {/* Resgatados by faixa */}
              <Collapsible open={resgatadosChartOpen} onOpenChange={setResgatadosChartOpen}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="w-full flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                    <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${resgatadosChartOpen ? 'rotate-90' : ''}`} />
                    <span className="text-xs font-semibold text-foreground">Resgatados por faixa de ausência</span>
                    <span className="text-xs text-muted-foreground">Distribuição mensal</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-2 space-y-3">
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={monthlySeries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="ano_mes_label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="resgatados_91_120" name="91–120d" fill={RESG_COLORS[0]} stackId="resg" />
                        <Bar dataKey="resgatados_121_150" name="121–150d" fill={RESG_COLORS[1]} stackId="resg" />
                        <Bar dataKey="resgatados_151_180" name="151–180d" fill={RESG_COLORS[2]} stackId="resg" />
                        <Bar dataKey="resgatados_180_plus" name="180d+" fill={RESG_COLORS[3]} stackId="resg" radius={[2, 2, 0, 0]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div className="border border-border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] py-1 text-muted-foreground">Mês</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">Total</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">91–120d</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">121–150d</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">151–180d</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">180d+</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthlySeries.map(m => (
                            <TableRow key={m.ano_mes} className="text-[11px]">
                              <TableCell className="py-1 font-medium text-foreground">{m.ano_mes_label}</TableCell>
                              <TableCell className="py-1 text-right text-primary font-medium">{fmtNum(m.resgatados)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.resgatados_91_120)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.resgatados_121_150)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.resgatados_151_180)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.resgatados_180_plus)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Atendidos by cadência */}
              <Collapsible open={atendidosChartOpen} onOpenChange={setAtendidosChartOpen}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="w-full flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                    <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${atendidosChartOpen ? 'rotate-90' : ''}`} />
                    <span className="text-xs font-semibold text-foreground">Perfil dos atendidos por cadência</span>
                    <span className="text-xs text-muted-foreground">Distribuição mensal</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-2 space-y-3">
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={monthlySeries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="ano_mes_label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="atendidos_cadencia_30" name="≤30d" fill={ATEND_COLORS[0]} stackId="atend" />
                        <Bar dataKey="atendidos_cadencia_45" name="31–45d" fill={ATEND_COLORS[1]} stackId="atend" />
                        <Bar dataKey="atendidos_cadencia_60" name="46–60d" fill={ATEND_COLORS[2]} stackId="atend" />
                        <Bar dataKey="atendidos_cadencia_90" name="61–90d" fill={ATEND_COLORS[3]} stackId="atend" />
                        <Bar dataKey="atendidos_cadencia_90_plus" name="90d+" fill={ATEND_COLORS[4]} stackId="atend" />
                        <Bar dataKey="atendidos_primeira_vez" name="1ª vez" fill={ATEND_COLORS[5]} stackId="atend" radius={[2, 2, 0, 0]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div className="border border-border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] py-1 text-muted-foreground">Mês</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">Total</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">Recorr.</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">1ª vez</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">≤30d</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">31–45d</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">46–60d</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">61–90d</TableHead>
                            <TableHead className="text-[10px] py-1 text-right text-muted-foreground">90d+</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthlySeries.map(m => (
                            <TableRow key={m.ano_mes} className="text-[11px]">
                              <TableCell className="py-1 font-medium text-foreground">{m.ano_mes_label}</TableCell>
                              <TableCell className="py-1 text-right text-primary font-medium">{fmtNum(m.atendidos_mes)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.atendidos_recorrentes)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.atendidos_primeira_vez)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.atendidos_cadencia_30)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.atendidos_cadencia_45)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.atendidos_cadencia_60)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.atendidos_cadencia_90)}</TableCell>
                              <TableCell className="py-1 text-right text-foreground">{fmtNum(m.atendidos_cadencia_90_plus)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Saldo mensal (waterfall) */}
              <Collapsible open={saldoChartOpen} onOpenChange={setSaldoChartOpen}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="w-full flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                    <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${saldoChartOpen ? 'rotate-90' : ''}`} />
                    <span className="text-xs font-semibold text-foreground">Saldo mensal da base</span>
                    <span className="text-xs text-muted-foreground">Resgatados vs Perdidos</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-2">
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={monthlySeries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="ano_mes_label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="resgatados" name="Resgatados (+)" fill="hsl(142 71% 45%)" opacity={0.6} radius={[2, 2, 0, 0]} />
                        <Bar dataKey="novos_perdidos" name="Perdidos (−)" fill="hsl(var(--destructive))" opacity={0.6} radius={[2, 2, 0, 0]} />
                        <Line type="monotone" dataKey="variacao_base" name="Δ Base" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Evolução por barbeiro — Collapsible */}
              <Collapsible open={barbeirosEvolOpen} onOpenChange={setBarbeirosEvolOpen}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="w-full flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 text-xs text-foreground">
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${barbeirosEvolOpen ? 'rotate-90' : ''}`} />
                      <span className="font-semibold">Evolução por barbeiro</span>
                      <span className="text-muted-foreground">{barbeiroEvol.barbers.length} barbeiros · {barbeiroEvol.months?.length ?? 0} meses</span>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-3 space-y-4">

                    {evolucaoBarbeiroLoading ? (
                      <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : evolucaoBarbeiroError ? (
                      <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">Erro: {evolucaoBarbeiroError}</div>
                    ) : barbeiroEvol.barbers.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">Sem dados de evolução por barbeiro.</p>
                    ) : (
                      <>
                        {/* ─── A) Gráfico de linhas temporal ──────────── */}
                        <Collapsible defaultOpen>
                          <CollapsibleTrigger asChild>
                            <button type="button" className="w-full flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-1.5 text-left hover:bg-muted/40 transition-colors">
                              <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90" />
                              <span className="text-xs font-semibold text-foreground">📈 Evolução mês a mês</span>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="pt-2 space-y-2">
                              {/* Controls: metric type + display mode */}
                              <div className="flex flex-wrap items-center gap-2">
                                <SegmentedToggle
                                  value={barbeirosEvolMetrica}
                                  onValueChange={(v) => setBarbeirosEvolMetrica(v as 'geral' | 'fidelizados' | 'oneshot')}
                                  options={[
                                    { value: 'geral', label: 'Churn geral' },
                                    { value: 'fidelizados', label: 'Fidelizados' },
                                    { value: 'oneshot', label: 'One-shot' },
                                  ]}
                                />
                                <SegmentedToggle
                                  value={barbeirosEvolDisplay}
                                  onValueChange={(v) => setBarbeirosEvolDisplay(v as '%' | 'num' | 'ambos')}
                                  options={[
                                    { value: '%', label: '%' },
                                    { value: 'num', label: 'Nº' },
                                    { value: 'ambos', label: 'Ambos' },
                                  ]}
                                />
                              </div>
                              {(() => {
                                const BARBER_COLORS = [
                                  'hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(48 96% 53%)',
                                  'hsl(280 60% 55%)', 'hsl(25 95% 53%)', 'hsl(170 70% 45%)',
                                  'hsl(330 70% 50%)', 'hsl(200 80% 50%)', 'hsl(100 60% 40%)', 'hsl(0 0% 50%)',
                                ];
                                // Only barbers with at least 1 month of atendidos_mes > 0
                                const activeBarbers = barbeiroEvol.barbers.filter(b =>
                                  barbeiroEvol.months.some(m => {
                                    const item = barbeiroEvol.lookup?.get(`${b.id}|${m}`);
                                    return item && item.atendidos_mes > 0;
                                  })
                                );
                                const barberColorMap = new Map(activeBarbers.map((b, i) => [b.id, BARBER_COLORS[i % BARBER_COLORS.length]]));

                                const metricKeyPct = barbeirosEvolMetrica === 'fidelizados' ? 'churn_fidelizados_pct' : barbeirosEvolMetrica === 'oneshot' ? 'churn_oneshot_pct' : 'churn_pct';
                                const metricKeyNum = barbeirosEvolMetrica === 'fidelizados' ? 'perdidos_fidelizados' : barbeirosEvolMetrica === 'oneshot' ? 'perdidos_oneshot' : 'perdidos';

                                const lineData = barbeiroEvol.months.map((m, mi) => {
                                  const row: Record<string, any> = { mes: barbeiroEvol.monthLabels?.[mi] ?? m };
                                  activeBarbers.forEach(b => {
                                    const item = barbeiroEvol.lookup?.get(`${b.id}|${m}`);
                                    if (item) {
                                      row[`${b.id}_pct`] = (item as any)[metricKeyPct] ?? null;
                                      row[`${b.id}_num`] = (item as any)[metricKeyNum] ?? null;
                                      row[`${b.id}_base`] = item.base_ativa;
                                      row[`${b.id}_atend`] = item.atendidos_mes;
                                      row[`${b.id}_pfid`] = item.perdidos_fidelizados;
                                      row[`${b.id}_pos`] = item.perdidos_oneshot;
                                    }
                                  });
                                  return row;
                                });
                                // Average
                                const lineDataWithAvg = lineData.map(row => {
                                  const vals = activeBarbers.filter(b => hiddenBarbers.size === 0 || !hiddenBarbers.has(b.id)).map(b => row[`${b.id}_pct`]).filter((v): v is number => v != null);
                                  return { ...row, _avg: vals.length > 0 ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : null };
                                });

                                const showPct = barbeirosEvolDisplay === '%' || barbeirosEvolDisplay === 'ambos';
                                const showNum = barbeirosEvolDisplay === 'num' || barbeirosEvolDisplay === 'ambos';

                                return (
                                  <>
                                    {/* Interactive legend */}
                                    <div className="flex flex-wrap gap-1.5 pb-1">
                                      {activeBarbers.map(b => {
                                        const color = barberColorMap.get(b.id) ?? 'hsl(var(--muted-foreground))';
                                        const isHidden = hiddenBarbers.has(b.id);
                                        return (
                                          <button
                                            key={b.id}
                                            type="button"
                                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${isHidden ? 'opacity-40 border-border bg-muted/20 text-muted-foreground' : 'border-border bg-card text-foreground shadow-sm'}`}
                                            onClick={() => {
                                              setHiddenBarbers(prev => {
                                                const next = new Set(prev);
                                                if (next.has(b.id)) next.delete(b.id); else next.add(b.id);
                                                return next;
                                              });
                                            }}
                                          >
                                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color, opacity: isHidden ? 0.3 : 1 }} />
                                            {b.nome}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <ResponsiveContainer width="100%" height={300}>
                                      <ComposedChart data={lineDataWithAvg} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis dataKey="mes" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                                        {showPct && <YAxis yAxisId="pct" tick={{ fontSize: 10 }} className="fill-muted-foreground" unit="%" />}
                                        {showNum && <YAxis yAxisId="num" orientation="right" tick={{ fontSize: 10 }} className="fill-muted-foreground" />}
                                        <Tooltip
                                          content={({ active, payload, label }) => {
                                            if (!active || !payload?.length) return null;
                                            // Deduplicate entries per barber
                                            const barberEntries = new Map<string, { nome: string; pct: number | null; num: number | null; base: number; atend: number; pfid: number; pos: number; color: string }>();
                                            payload.forEach(p => {
                                              if (!p.dataKey || p.dataKey === '_avg') return;
                                              const dk = String(p.dataKey);
                                              const barberId = dk.replace(/_pct$|_num$/, '');
                                              if (hiddenBarbers.has(barberId)) return;
                                              if (!barberEntries.has(barberId)) {
                                                const barber = activeBarbers.find(b => b.id === barberId);
                                                const row = p.payload;
                                                barberEntries.set(barberId, {
                                                  nome: barber?.nome ?? barberId,
                                                  pct: row[`${barberId}_pct`] ?? null,
                                                  num: row[`${barberId}_num`] ?? null,
                                                  base: row[`${barberId}_base`] ?? 0,
                                                  atend: row[`${barberId}_atend`] ?? 0,
                                                  pfid: row[`${barberId}_pfid`] ?? 0,
                                                  pos: row[`${barberId}_pos`] ?? 0,
                                                  color: barberColorMap.get(barberId) ?? 'hsl(var(--muted-foreground))',
                                                });
                                              }
                                            });
                                            const sorted = [...barberEntries.values()].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
                                            const avg = payload.find(p => p.dataKey === '_avg');
                                            return (
                                              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl space-y-1 max-w-[85vw] min-w-0 max-h-[350px] overflow-y-auto">
                                                <p className="font-semibold text-sm">{label}</p>
                                                {avg && avg.value != null && (
                                                  <div className="flex items-center justify-between gap-3 text-muted-foreground border-b border-border pb-1 mb-1">
                                                    <span>Média geral</span>
                                                    <span className="font-medium tabular-nums text-foreground">{avg.value}%</span>
                                                  </div>
                                                )}
                                                {sorted.map(entry => (
                                                  <div key={entry.nome} className="space-y-0.5">
                                                    <div className="flex items-center justify-between gap-3">
                                                      <span className="flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: entry.color }} />
                                                        <span className="font-medium">{entry.nome}</span>
                                                      </span>
                                                      <span className="font-medium tabular-nums">
                                                        {entry.pct != null ? `${entry.pct}%` : '-'}
                                                        {entry.num != null && <span className="text-muted-foreground ml-1">({fmtNum(entry.num)})</span>}
                                                      </span>
                                                    </div>
                                                    <div className="pl-4 flex items-center gap-2 text-muted-foreground text-[10px]">
                                                      <span>Base: {fmtNum(entry.base)}</span>
                                                      <span>·</span>
                                                      <span>Atend: {fmtNum(entry.atend)}</span>
                                                      <span>·</span>
                                                      <span>Fid: {fmtNum(entry.pfid)}</span>
                                                      <span>·</span>
                                                      <span>1-shot: {fmtNum(entry.pos)}</span>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            );
                                          }}
                                        />
                                        <ReferenceLine yAxisId={showPct ? "pct" : "num"} y={0} stroke="transparent" />
                                        {activeBarbers.filter(b => !hiddenBarbers.has(b.id)).map(b => {
                                          const color = barberColorMap.get(b.id) ?? 'hsl(var(--muted-foreground))';
                                          return (
                                            <React.Fragment key={b.id}>
                                              {showPct && (
                                                <Line
                                                  yAxisId="pct"
                                                  type="monotone"
                                                  dataKey={`${b.id}_pct`}
                                                  name={b.nome}
                                                  stroke={color}
                                                  strokeWidth={2}
                                                  dot={{ r: 3 }}
                                                  activeDot={{ r: 5 }}
                                                  connectNulls
                                                  legendType="none"
                                                />
                                              )}
                                              {showNum && (
                                                <Bar
                                                  yAxisId="num"
                                                  dataKey={`${b.id}_num`}
                                                  name={`${b.nome} (qtd)`}
                                                  fill={color}
                                                  opacity={0.3}
                                                  radius={[2, 2, 0, 0]}
                                                  barSize={8}
                                                  legendType="none"
                                                />
                                              )}
                                            </React.Fragment>
                                          );
                                        })}
                                        {showPct && (
                                          <Line
                                            yAxisId="pct"
                                            type="monotone"
                                            dataKey="_avg"
                                            name="Média"
                                            stroke="hsl(var(--muted-foreground))"
                                            strokeWidth={1.5}
                                            strokeDasharray="6 3"
                                            dot={false}
                                            connectNulls
                                            legendType="none"
                                          />
                                        )}
                                      </ComposedChart>
                                    </ResponsiveContainer>
                                  </>
                                );
                              })()}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* ─── B) Rankings: One-shot vs Fidelizados ──── */}
                        <Collapsible defaultOpen>
                          <CollapsibleTrigger asChild>
                            <button type="button" className="w-full flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-1.5 text-left hover:bg-muted/40 transition-colors">
                              <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90" />
                              <span className="text-xs font-semibold text-foreground">🏆 Ranking por tipo de churn</span>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="pt-2 space-y-3">
                              {/* Context / explanation */}
                              <div className="text-[11px] text-muted-foreground bg-muted/30 border border-border rounded-md px-3 py-2 space-y-1">
                                <p>
                                  <strong>Período:</strong>{' '}
                                  {barbeirosChurnTipoMode === 'ultimo_mes'
                                    ? `Último mês com dados (${barbeiroEvol.monthLabels?.[barbeiroEvol.monthLabels.length - 1] ?? '—'})`
                                    : `Média de ${barbeiroEvol.months?.length ?? 0} meses (${barbeiroEvol.monthLabels?.[0] ?? ''} – ${barbeiroEvol.monthLabels?.[barbeiroEvol.monthLabels.length - 1] ?? ''})`
                                  }
                                </p>
                                <p>
                                  <strong>Perda</strong> = cliente que não voltou à <em>barbearia</em> em ≥{churnDias}d. Inclui tanto quem migrou para outro barbeiro quanto quem saiu por completo — o sistema não distingue entre os dois cenários.
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <SegmentedToggle
                                  value={barbeirosChurnTipoMode}
                                  onValueChange={(v) => setBarbeirosChurnTipoMode(v as 'ultimo_mes' | 'media')}
                                  options={[
                                    { value: 'ultimo_mes', label: 'Último mês' },
                                    { value: 'media', label: 'Média do período' },
                                  ]}
                                />
                              </div>
                              {barbeirosChurnTipoData.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">Sem dados de barbeiros com faturamento no período.</p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Card: Quem mais perde One-shot */}
                                  {(() => {
                                    const sorted = [...barbeirosChurnTipoData].sort((a, b) => b.churn_os - a.churn_os);
                                    const maxVal = sorted[0]?.churn_os || 1;
                                    return (
                                      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-yellow-500/40 text-yellow-400">One-shot</Badge>
                                          <span className="text-xs font-semibold text-foreground">Quem mais perde one-shot</span>
                                          <InfoIconTooltip title="Churn One-shot" short={`% de clientes com 1 visita que não voltaram em ${churnDias}d.`} details={<p>Número absoluto de perdidos e retidos ao lado. Clique para ver a lista de clientes.</p>} />
                                        </div>
                                        <div className="space-y-1.5">
                                          {sorted.map((b, i) => (
                                            <button
                                              key={i}
                                              type="button"
                                              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors text-left group"
                                              onClick={() => openDrill('PERDIDOS_ONESHOT', '', `One-shot perdidos — ${b.nome}`)}
                                            >
                                              <span className="text-[10px] font-bold text-muted-foreground w-4 text-right shrink-0">{i + 1}.</span>
                              <span className="text-[11px] font-medium text-foreground min-w-0 max-w-[60px] sm:max-w-[70px] truncate shrink-0">{b.nome}</span>
                              <div className="flex-1 h-4 bg-muted/30 rounded-full overflow-hidden relative">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.max(4, (b.churn_os / maxVal) * 100)}%`,
                                    background: 'linear-gradient(90deg, hsl(48 96% 53% / 0.3), hsl(48 96% 53% / 0.7))',
                                  }}
                                />
                                <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold tabular-nums text-foreground">{b.churn_os}%</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 hidden sm:inline w-[70px] text-right">{fmtNum(b.perdidos_os)} de {fmtNum(b.base_ativa)}</span>
                                              <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  {/* Card: Quem mais perde Fidelizados */}
                                  {(() => {
                                    const sorted = [...barbeirosChurnTipoData].sort((a, b) => b.churn_fid - a.churn_fid);
                                    const maxVal = sorted[0]?.churn_fid || 1;
                                    return (
                                      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-green-500/40 text-green-400">Fidelizados</Badge>
                                          <span className="text-xs font-semibold text-foreground">Quem mais perde fidelizados</span>
                                          <InfoIconTooltip title="Churn Fidelizados" short={`% de clientes com ≥${minVisitas} visitas que não voltaram em ${churnDias}d.`} details={<p>Perda crítica — estes clientes tinham hábito de retorno. Número de perdidos e retidos ao lado.</p>} />
                                        </div>
                                        <div className="space-y-1.5">
                                          {sorted.map((b, i) => (
                                            <button
                                              key={i}
                                              type="button"
                                              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors text-left group"
                                              onClick={() => openDrill('PERDIDOS_FIDELIZADOS', '', `Fidelizados perdidos — ${b.nome}`)}
                                            >
                                              <span className="text-[10px] font-bold text-muted-foreground w-4 text-right shrink-0">{i + 1}.</span>
                              <span className="text-[11px] font-medium text-foreground min-w-0 max-w-[60px] sm:max-w-[70px] truncate shrink-0">{b.nome}</span>
                              <div className="flex-1 h-4 bg-muted/30 rounded-full overflow-hidden relative">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.max(4, (b.churn_fid / maxVal) * 100)}%`,
                                    background: 'linear-gradient(90deg, hsl(142 71% 45% / 0.3), hsl(142 71% 45% / 0.7))',
                                  }}
                                />
                                <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold tabular-nums text-foreground">{b.churn_fid}%</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 hidden sm:inline w-[70px] text-right">{fmtNum(b.perdidos_fid)} de {fmtNum(b.base_ativa)}</span>
                                              <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* ─── C) Barras agrupadas comparativas ─────── */}
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <button type="button" className="w-full flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-1.5 text-left hover:bg-muted/40 transition-colors">
                              <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90" />
                              <span className="text-xs font-semibold text-foreground">📊 Comparativo fidelizados vs one-shot</span>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="pt-2">
                              {barbeirosChurnTipoData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={Math.max(200, barbeirosChurnTipoData.length * 44 + 60)}>
                                   <BarChart data={barbeirosChurnTipoData} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" unit="%" />
                                    <YAxis dataKey="nome" type="category" tick={{ fontSize: 9 }} className="fill-muted-foreground" width={70} tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 9) + '…' : v} />
                                    <Tooltip
                                      content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0]?.payload;
                                        if (!d) return null;
                                        return (
                                          <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl space-y-1 max-w-[85vw] min-w-0">
                                            <p className="font-semibold text-sm">{d.nome}</p>
                                            <div className="flex items-center justify-between gap-4">
                                              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'hsl(142 71% 45%)' }} />Fidelizados</span>
                                              <span className="font-medium tabular-nums">{d.churn_fid}% <span className="text-muted-foreground">({fmtNum(d.perdidos_fid)} de {fmtNum(d.base_ativa)})</span></span>
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'hsl(48 96% 53%)' }} />One-shot</span>
                                              <span className="font-medium tabular-nums">{d.churn_os}% <span className="text-muted-foreground">({fmtNum(d.perdidos_os)} de {fmtNum(d.base_ativa)})</span></span>
                                            </div>
                                            <div className="border-t border-border pt-1 text-muted-foreground">
                                              Base: {fmtNum(d.base_ativa)} · Total: {d.churn_total}%
                                            </div>
                                          </div>
                                        );
                                      }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 10 }} />
                                    <Bar dataKey="churn_fid" name="Fidelizados %" fill="hsl(142 71% 45%)" opacity={0.8} radius={[0, 3, 3, 0]} barSize={14} label={{ position: 'right', fontSize: 9, fill: 'hsl(var(--muted-foreground))', formatter: (v: number) => `${v}%` }} />
                                    <Bar dataKey="churn_os" name="One-shot %" fill="hsl(48 96% 53%)" opacity={0.8} radius={[0, 3, 3, 0]} barSize={14} label={{ position: 'right', fontSize: 9, fill: 'hsl(var(--muted-foreground))', formatter: (v: number) => `${v}%` }} />
                                    <ReferenceLine x={avgChurnRef} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Média ${avgChurnRef}%`, position: 'top', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                                  </BarChart>
                                </ResponsiveContainer>
                              ) : (
                                <p className="text-xs text-muted-foreground text-center py-4">Sem dados.</p>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </>
                    )}

                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </>
      )}

      {/* F) HelpBox */}
      <HelpBox>
        <div className="space-y-1.5">
          <p><strong>Como interpretar:</strong> Churn acima de <strong>20%</strong> indica necessidade urgente de ações de retenção. Churn de fidelizados acima de <strong>15%</strong> é crítico.</p>
          <p><strong>Base de cálculo:</strong> <BaseBadge type={baseChurn} meses={meta?.base_corte_meses ?? cfg?.base_corte_meses ?? 24} withLabel /> — {baseModeLabel}. Altere na aba Config.</p>
          <p><strong>Evolução:</strong> Alterne para "Evolução" para ver o churn mês a mês. Use o botão Config para escolher quais séries mostrar.</p>
        </div>
      </HelpBox>

      {/* Analysis Dialog */}
      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Análise da Evolução do Churn</DialogTitle>
            <DialogDescription>Análise automática gerada a partir de {series.length} meses de dados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 mt-2">
            {insights.map((insight, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${severityBorder[insight.severity]} ${severityBg[insight.severity]}`}>
                {insight.icon}
                <p className="text-foreground leading-relaxed">{insight.text}</p>
              </div>
            ))}
            {insights.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem dados suficientes para gerar análise.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* DrillSheet */}
      <RaioXDrillSheet open={drillOpen} onClose={() => setDrillOpen(false)} request={drillRequest} filters={filters} rpcName="rpc_raiox_clientes_churn_drill_v1" extraParams={churnDrillExtraParams} />
    </div>
  );
}

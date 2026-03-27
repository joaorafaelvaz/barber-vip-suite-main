import React, { useState, useMemo } from 'react';
import { HelpBox, KpiCard, EmptyState, BaseBadge } from '@/components/raiox-shared';
import type { KpiMedias } from '@/components/raiox-shared/KpiCard';
import type { BaseType } from '@/components/raiox-shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertTriangle, ArrowRight, BarChart3, Users, TrendingUp, TrendingDown,
  Activity, Shield, Zap, Target, ChevronRight, UserPlus,
  BookOpen, CheckCircle2, Settings, Filter,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip, Legend, ReferenceLine,
} from 'recharts';
import { useRaioxVisaoGeralDrillMensal, type DrillMensalTipo } from '@/hooks/raiox-clientes/useRaioxVisaoGeralDrillMensal';
import { DrillMensalSheet } from '../components/DrillMensalSheet';
import { InfoIconTooltip } from '@/components/help/InfoIconTooltip';
import { HowToReadSection } from '@/components/help';
import { RaioXDrillSheet, type DrillRequest } from '../components/RaioXDrillSheet';
import type { RaioXComputedFilters, RaioXTab } from '../raioxTypes';
import type { OverviewData, OverviewDistItem } from '@/hooks/raiox-clientes/useRaioXClientesOverview';
import type { CadenciaData, CadenciaBarbeiroItem } from '@/hooks/raiox-clientes/useRaioXClientesCadencia';
import type { ChurnEvolucaoData } from '@/hooks/raiox-clientes/useRaioXClientesChurnEvolucao';
import type { RaioxConfigInstance } from '../RaioXClientesTabs';

// ─── Constants ────────────────────────────────────────────────────────────────

const ONE_SHOT_STATUSES = ['ONE_SHOT_AGUARDANDO', 'ONE_SHOT_RISCO', 'ONE_SHOT_PERDIDO'];

const BASE_MODE_LABELS: Record<string, string> = {
  JANELA: 'Janela', PERIODO_FILTRADO: 'Período', TOTAL: 'Total', TOTAL_COM_CORTE: 'Corte',
};
const BASE_MODE_BADGE: Record<string, BaseType> = {
  JANELA: 'J', PERIODO_FILTRADO: 'P', TOTAL: 'T', TOTAL_COM_CORTE: 'P',
};

const DIST_LABELS: Record<string, string> = {
  FIEL: 'Fiel', RECORRENTE: 'Recorrente', REGULAR: 'Regular', OCASIONAL: 'Ocasional',
  ONE_SHOT: 'One-shot', INATIVO: 'Inativo', MUITO_FREQUENTE: 'Mto frequente',
  ESPACANDO: 'Espaçando', EM_RISCO: 'Em risco', PERDIDO: 'Perdido', SAUDAVEL: 'Saudável',
  ONE_SHOT_AGUARDANDO: 'Aguardando', ONE_SHOT_RISCO: 'Em risco', ONE_SHOT_PERDIDO: 'Perdido',
};
const DIST_BAR_COLOR: Record<string, string> = {
  FIEL: 'bg-emerald-500/80', RECORRENTE: 'bg-blue-500/80', REGULAR: 'bg-cyan-500/75',
  OCASIONAL: 'bg-slate-400/75', ONE_SHOT: 'bg-violet-400/75', INATIVO: 'bg-rose-400/70',
  MUITO_FREQUENTE: 'bg-emerald-500/80', ESPACANDO: 'bg-amber-500/75',
  EM_RISCO: 'bg-orange-500/75', PERDIDO: 'bg-rose-500/75', SAUDAVEL: 'bg-emerald-500/80',
};
const DIST_DOT_COLOR: Record<string, string> = {
  FIEL: 'bg-emerald-500', RECORRENTE: 'bg-blue-500', REGULAR: 'bg-cyan-500',
  OCASIONAL: 'bg-slate-400', ONE_SHOT: 'bg-violet-400', INATIVO: 'bg-rose-400',
  MUITO_FREQUENTE: 'bg-emerald-500', ESPACANDO: 'bg-amber-500',
  EM_RISCO: 'bg-orange-500', PERDIDO: 'bg-rose-500', SAUDAVEL: 'bg-emerald-500',
};

const SHORTCUTS: { tab: RaioXTab; label: string; icon: React.ElementType; desc: string }[] = [
  { tab: 'oneshot', label: 'One-Shot', icon: Target, desc: 'Clientes com 1 visita' },
  { tab: 'cadencia', label: 'Cadência', icon: Activity, desc: 'Frequência e perfil' },
  { tab: 'churn', label: 'Churn', icon: TrendingUp, desc: 'Perdas e retenção' },
  { tab: 'cohort', label: 'Cohort', icon: BarChart3, desc: 'Por coorte de entrada' },
  { tab: 'barbeiros', label: 'Barbeiros', icon: Users, desc: 'Por colaborador' },
  { tab: 'acoes', label: 'Ações CRM', icon: Zap, desc: 'Fila de contato' },
  { tab: 'diagnostico', label: 'Diagnóstico', icon: Shield, desc: 'Qualidade de dados' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtD(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR'); }
function fmtN(n: number) { return n.toLocaleString('pt-BR'); }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }

// ─── Médias históricas ────────────────────────────────────────────────────────

function computeMedias(series: ChurnEvolucaoData['series'] | undefined, key: string): KpiMedias | null {
  if (!series || series.length === 0) return null;
  const now = new Date();
  const curYear = now.getFullYear();

  const vals12 = series.slice(-12);
  const vals6 = series.slice(-6);
  const valsAno = series.filter(s => {
    const [y] = s.ano_mes.split('-').map(Number);
    return y === curYear;
  });

  const avg = (arr: typeof series) => {
    if (arr.length === 0) return null;
    const sum = arr.reduce((s, m) => s + ((m as any)[key] ?? 0), 0);
    return Math.round(sum / arr.length);
  };

  return { m12: avg(vals12), m6: avg(vals6), ano: avg(valsAno) };
}

// ─── Tooltip body padronizado ─────────────────────────────────────────────────

interface TooltipCtx {
  inicio: string; fim: string; janela: number;
  badge: BaseType; meses: number; universoTotal?: number | null;
  regra?: string; interpretacao?: string;
  /** Datas reais da base quando diferem do período filtrado */
  baseInicio?: string; baseFim?: string;
  /** Indicadores alimentados por esta base */
  indicadores?: string[];
}

function TooltipBody({ descricao, ctx, extra }: {
  descricao: React.ReactNode; ctx: TooltipCtx; extra?: React.ReactNode;
}) {
  const baseDifere = ctx.baseInicio && ctx.baseInicio !== ctx.inicio;
  return (
    <div className="space-y-2 text-[10px]">
      <div>{descricao}</div>
      <div className="rounded-md bg-muted/40 px-2.5 py-2 space-y-1 border border-border/30">
        <p className="text-muted-foreground font-medium uppercase tracking-wider text-[9px] mb-1">Contexto</p>
        <p><span className="text-muted-foreground">Período filtrado:</span> <span className="text-foreground font-medium">{fmtD(ctx.inicio)} – {fmtD(ctx.fim)}</span></p>
        <p><span className="text-muted-foreground">REF:</span> <span className="text-foreground font-medium">{fmtD(ctx.fim)}</span></p>
        {baseDifere && ctx.baseInicio && ctx.baseFim && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-muted-foreground">Base usada:</span>
            <BaseBadge type={ctx.badge} meses={ctx.meses} />
            <span className="text-foreground font-medium">{fmtD(ctx.baseInicio)} – {fmtD(ctx.baseFim)}</span>
            {ctx.universoTotal != null && <span className="text-foreground/80">· {fmtN(ctx.universoTotal)} clientes</span>}
          </div>
        )}
        {!baseDifere && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-muted-foreground">Universo:</span>
            <BaseBadge type={ctx.badge} meses={ctx.meses} />
            {ctx.universoTotal != null && <span className="text-foreground font-medium">{fmtN(ctx.universoTotal)} clientes</span>}
          </div>
        )}
        {ctx.regra && <p><span className="text-muted-foreground">Regra:</span> <span className="text-foreground">{ctx.regra}</span></p>}
        {ctx.indicadores && ctx.indicadores.length > 0 && (
          <div>
            <span className="text-muted-foreground">Usada em:</span>{' '}
            <span className="text-foreground/80 font-medium">{ctx.indicadores.join(' · ')}</span>
          </div>
        )}
      </div>
      {ctx.interpretacao && (
        <p className="text-primary/80 border-t border-border/20 pt-1.5">{ctx.interpretacao}</p>
      )}
      {extra}
    </div>
  );
}

// ─── Diagnóstico Rápido (painel de sinais — topo da página) ──────────────────

function DiagnosticoRapido({ data, loading, filters, cfg, onTabChange }: {
  data: OverviewData | null; loading: boolean;
  filters: RaioXComputedFilters; cfg: any; onTabChange: (tab: RaioXTab) => void;
}) {
  if (loading || !data?.kpis) return null;

  const kpis = data.kpis;
  const baseTotal = (data?.meta?.base_distribuicao_total as number) ?? 0;
  const cadDist = data?.distribuicoes?.por_cadencia_momento ?? [];
  const trend = data?.tendencias?.clientes_unicos_mensal ?? [];

  const ativos = kpis.clientes_ativos_janela ?? 0;
  const perdidos = kpis.clientes_perdidos_macro ?? 0;
  const emRisco = kpis.clientes_em_risco_macro ?? 0;
  const novos = kpis.novos_clientes_periodo ?? 0;
  const unicos = kpis.clientes_unicos_periodo ?? 0;

  const osAg = cadDist.find((i: any) => i.status === 'ONE_SHOT_AGUARDANDO')?.qtd ?? 0;
  const osRisco = cadDist.find((i: any) => i.status === 'ONE_SHOT_RISCO')?.qtd ?? 0;
  const osPerd = cadDist.find((i: any) => i.status === 'ONE_SHOT_PERDIDO')?.qtd ?? 0;
  const osTotal = osAg + osRisco + osPerd;

  let trendStatus: 'up' | 'down' | 'stable' = 'stable';
  let trendPct = 0;
  if (trend.length >= 2) {
    const last = trend[trend.length - 1].qtd;
    const prev = trend[trend.length - 2].qtd;
    trendPct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
    if (trendPct > 3) trendStatus = 'up';
    else if (trendPct < -3) trendStatus = 'down';
  }

  const items = [
    {
      label: `Ativos (${filters.janelaDias}d)`,
      value: fmtN(ativos),
      sub: baseTotal > 0 ? `${pct(ativos, baseTotal)}% da base` : '—',
      trend: trendStatus, trendPct,
      color: trendStatus === 'up' ? 'text-emerald-400' : trendStatus === 'down' ? 'text-rose-400' : 'text-foreground',
      tab: 'geral' as RaioXTab,
      alert: trendStatus === 'down',
    },
    {
      label: 'Perdidos',
      value: fmtN(perdidos),
      sub: baseTotal > 0 ? `${pct(perdidos, baseTotal)}% da base` : '—',
      trend: null, trendPct: 0,
      color: pct(perdidos, baseTotal) > 30 ? 'text-rose-400' : pct(perdidos, baseTotal) > 15 ? 'text-orange-400' : 'text-muted-foreground',
      tab: 'churn' as RaioXTab,
      alert: pct(perdidos, baseTotal) > 30,
    },
    {
      label: 'Em risco',
      value: fmtN(emRisco),
      sub: baseTotal > 0 ? `${pct(emRisco, baseTotal)}% da base` : '—',
      trend: null, trendPct: 0,
      color: pct(emRisco, baseTotal) > 20 ? 'text-orange-400' : 'text-muted-foreground',
      tab: 'acoes' as RaioXTab,
      alert: pct(emRisco, baseTotal) > 20,
    },
    {
      label: 'Novos',
      value: fmtN(novos),
      sub: unicos > 0 ? `${pct(novos, unicos)}% dos atendidos` : '—',
      trend: null, trendPct: 0,
      color: 'text-blue-400',
      tab: 'cohort' as RaioXTab,
      alert: false,
    },
    {
      label: 'One-shot urgente',
      value: fmtN(osRisco + osPerd),
      sub: osTotal > 0 ? `${pct(osRisco + osPerd, osTotal)}% dos one-shots` : '—',
      trend: null, trendPct: 0,
      color: (osRisco + osPerd) > 0 ? 'text-orange-400' : 'text-muted-foreground',
      tab: 'oneshot' as RaioXTab,
      alert: pct(osRisco + osPerd, osTotal) > 40,
    },
    {
      label: 'Resgatados',
      value: fmtN(kpis.clientes_resgatados_periodo ?? 0),
      sub: baseTotal > 0 ? `${pct(kpis.clientes_resgatados_periodo ?? 0, baseTotal)}% da base` : '—',
      trend: null, trendPct: 0,
      color: 'text-emerald-400',
      tab: 'churn' as RaioXTab,
      alert: false,
    },
  ];

  return (
    <div className="rounded-xl border border-border/40 border-l-2 border-l-primary/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/30">
        <Target className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-xs font-semibold text-foreground flex-1">Sinais da base</p>
        <p className="text-[10px] text-muted-foreground">{fmtD(filters.dataInicioISO)} – {fmtD(filters.dataFimISO)}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-border/20">
        {items.map((item) => (
          <button key={item.label} type="button" onClick={() => onTabChange(item.tab)}
            className="p-2.5 sm:p-3 text-left hover:bg-muted/20 active:bg-muted/30 transition-colors flex flex-col gap-0.5 min-w-0"
          >
            <div className="flex items-center gap-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium truncate flex-1">{item.label}</p>
              {item.alert && <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />}
            </div>
            <div className="flex items-baseline gap-1">
              <p className={`text-base sm:text-lg font-bold tabular-nums leading-tight ${item.color}`}>{item.value}</p>
              {item.trend && (
                <span className={`text-[9px] font-medium ${item.trend === 'up' ? 'text-emerald-400' : item.trend === 'down' ? 'text-rose-400' : 'text-muted-foreground'}`}>
                  {item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'}{Math.abs(item.trendPct)}%
                </span>
              )}
            </div>
            <p className="text-[9px] text-muted-foreground tabular-nums">{item.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── KPI tooltips ─────────────────────────────────────────────────────────────

function buildKpiInfo(filters: RaioXComputedFilters, meses: number, bases: {
  status12m: BaseType; resgatados: BaseType;
}, cfg: {
  risco_min_dias: number; risco_max_dias: number; churn_dias_sem_voltar: number;
  one_shot_aguardando_max_dias: number; one_shot_risco_max_dias: number;
}, totals: { base: number | null; dist: number | null }) {
  const rMin = cfg.risco_min_dias;
  const rMax = cfg.risco_max_dias;
  const osAq = cfg.one_shot_aguardando_max_dias;
  const osRq = cfg.one_shot_risco_max_dias;
  const j = filters.janelaDias;

  // Datas reais das bases
  const refDate = new Date(filters.dataFimISO + 'T12:00:00');
  const statusInicio = new Date(refDate);
  statusInicio.setMonth(statusInicio.getMonth() - meses);
  const statusInicioISO = statusInicio.toISOString().slice(0, 10);

  const janelaInicio = new Date(refDate);
  janelaInicio.setDate(janelaInicio.getDate() - j);
  const janelaInicioISO = janelaInicio.toISOString().slice(0, 10);

  const ctx = (badge: BaseType, universoTotal?: number | null, regra?: string, interpretacao?: string, opts?: { baseInicio?: string; baseFim?: string; indicadores?: string[] }): TooltipCtx => ({
    inicio: filters.dataInicioISO, fim: filters.dataFimISO, janela: j,
    badge, meses, universoTotal, regra, interpretacao,
    baseInicio: opts?.baseInicio, baseFim: opts?.baseFim ?? filters.dataFimISO,
    indicadores: opts?.indicadores,
  });

  return [
    // Linha 1 — Atividade
    {
      key: 'clientes_unicos_periodo', label: 'Clientes únicos', badge: 'P' as BaseType,
      short: `Pessoas distintas atendidas no período.`,
      details: <TooltipBody descricao={<p>Pessoas diferentes que vieram à barbearia. Cada cliente conta <strong>1 vez</strong> mesmo com múltiplas visitas.</p>}
        ctx={ctx('P', totals.base, 'Pelo menos 1 venda no período', 'Indica o alcance real no período. Compare com meses anteriores para ver crescimento.', { indicadores: ['Clientes Únicos', 'Tendência mensal', 'Alertas de qualidade'] })} />,
    },
    {
      key: 'novos_clientes_periodo', label: 'Novos clientes', badge: 'P' as BaseType,
      short: `Primeira visita no período.`,
      details: <TooltipBody descricao={<p>Clientes cuja <strong>primeira visita histórica</strong> foi neste período.</p>}
        ctx={ctx('P', totals.base, 'first_seen dentro do período', 'Muitos novos sem crescimento de ativos = porta giratória. Aprofunde em Cohort.', { indicadores: ['Novos no período', 'Evolução mensal'] })} />,
    },
    {
      key: 'clientes_ativos_janela', label: 'Ativos na janela', badge: 'P' as BaseType,
      short: `Última visita nos últimos ${j} dias.`,
      details: <TooltipBody descricao={<p>Base viva: quem veio nos últimos <strong>{j} dias</strong> da REF. <strong>Termômetro principal.</strong></p>}
        ctx={ctx('P', totals.base, `última_visita ≥ REF − ${j} dias`, 'Queda aqui é o primeiro sinal de problema.', { baseInicio: janelaInicioISO, indicadores: ['Ativos na janela', 'Score de saúde (dim. ativos)', 'Diagnóstico rápido'] })}
        extra={<p className="text-[9px] text-muted-foreground">Janela configurável: 30 / 45 / 60 / 90d no cabeçalho.</p>} />,
      status: 'positive' as const,
    },
    {
      key: 'clientes_resgatados_periodo', label: 'Resgatados', badge: bases.resgatados,
      short: `Estavam perdidos e retornaram no período.`,
      details: <TooltipBody descricao={<p>Clientes que ficaram <strong>mais de {cfg.churn_dias_sem_voltar} dias</strong> sem visitar e retornaram neste período.</p>}
        ctx={ctx(bases.resgatados, totals.base, `ausência > ${cfg.churn_dias_sem_voltar}d + voltou no período`, 'Mede eficácia de ações de recuperação. Configure em Config → Seção 7.', { indicadores: ['Resgatados no período', 'Evolução mensal'] })} />,
      status: 'positive' as const,
    },
    // Linha 2 — Saúde da base
    {
      key: 'clientes_em_risco_macro', label: 'Em risco', badge: bases.status12m,
      short: `${rMin + 1}–${rMax} dias sem vir · inclui one-shots.`,
      details: <TooltipBody descricao={<p>Última visita entre <strong>{rMin + 1} e {rMax} dias</strong> antes da REF. Zona de alerta — ainda recuperáveis.</p>}
        ctx={ctx(bases.status12m, totals.dist, `${rMin + 1}d ≤ dias_sem_vir ≤ ${rMax}d`, 'Acione via CRM → aba Ações.', { baseInicio: statusInicioISO, indicadores: ['Em Risco', 'Score de saúde (dim. risco)', 'Distribuições'] })}
        extra={<p className="text-[9px] text-amber-400">Inclui one-shots nessa faixa. Configure em Config → Seção 5.</p>} />,
      status: 'warning' as const,
    },
    {
      key: 'clientes_perdidos_macro', label: 'Perdidos', badge: bases.status12m,
      short: `Mais de ${rMax} dias sem vir · inclui one-shots.`,
      details: <TooltipBody descricao={<p>Última visita há mais de <strong>{rMax} dias</strong>. Ultrapassaram o limiar de churn.</p>}
        ctx={ctx(bases.status12m, totals.dist, `dias_sem_vir > ${rMax}d`, '"Perdido" é por recência — resgate possível mas custoso. Ver análise em Churn.', { baseInicio: statusInicioISO, indicadores: ['Perdidos', 'Score de saúde (dim. perdidos)', 'Distribuições'] })}
        extra={<p className="text-[9px] text-amber-400">Inclui one-shots nessa faixa. Configure em Config → Seção 5.</p>} />,
      status: 'negative' as const,
    },
    {
      key: 'one_shot_em_risco', label: 'One-shot risco', badge: 'S' as BaseType,
      short: `1 visita · ${osAq + 1}–${osRq} dias sem retornar.`,
      details: <TooltipBody descricao={<p>Exatamente 1 visita, sem retorno entre <strong>{osAq + 1} e {osRq} dias</strong>. Já passaram do prazo ideal.</p>}
        ctx={ctx('S', totals.dist, `visitas=1 E ${osAq + 1}d ≤ dias_sem_vir ≤ ${osRq}d`, 'Contato proativo pode converter em recorrente. Ver análise em One-Shot.', { baseInicio: statusInicioISO, indicadores: ['One-shots (em risco + perdido)', 'Distribuições'] })}
        extra={<p className="text-[9px] text-amber-400">Incluídos em "Em risco" acima. Configure em Config → Seção 5.</p>} />,
      status: 'warning' as const,
    },
    {
      key: 'one_shot_perdido', label: 'One-shot perdido', badge: 'S' as BaseType,
      short: `1 visita · mais de ${osRq} dias sem retornar.`,
      details: <TooltipBody descricao={<p>Exatamente 1 visita, sem retorno há mais de <strong>{osRq} dias</strong>. Alta probabilidade de perda definitiva.</p>}
        ctx={ctx('S', totals.dist, `visitas=1 E dias_sem_vir > ${osRq}d`, 'Alta probabilidade de não retornar. Ver análise completa em One-Shot.', { baseInicio: statusInicioISO, indicadores: ['One-shots (em risco + perdido)', 'Distribuições'] })}
        extra={<p className="text-[9px] text-amber-400">Incluídos em "Perdidos" acima. Configure em Config → Seção 5.</p>} />,
      status: 'negative' as const,
    },
  ];
}

// ─── DistributionBar ──────────────────────────────────────────────────────────

function DistributionBar({ items, labelKey, drillTipo, onDrill }: {
  items: OverviewDistItem[]; labelKey: 'perfil' | 'status' | 'macro';
  drillTipo: 'PERFIL' | 'CADENCIA' | 'MACRO'; onDrill: (req: DrillRequest) => void;
}) {
  const total = items.reduce((s, i) => s + i.qtd, 0);
  if (total === 0) return <EmptyState className="py-4" />;
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const key = (item as any)[labelKey] as string;
        const p = pct(item.qtd, total);
        const label = DIST_LABELS[key] || key;
        return (
          <button key={key} type="button"
            className="w-full flex items-center gap-1.5 text-[10px] rounded-md px-1.5 py-1 hover:bg-accent/40 active:bg-accent/60 transition-colors group text-left"
            onClick={() => onDrill({ tipo: drillTipo, valor: key, label })}
            title={`Ver ${label} — ${item.qtd} clientes`}
          >
            <span className={`h-2 w-2 rounded-full shrink-0 ${DIST_DOT_COLOR[key] || 'bg-primary'}`} />
            <span className="w-20 sm:w-24 truncate text-muted-foreground shrink-0 group-hover:text-foreground transition-colors">{label}</span>
            <div className="flex-1 min-w-0 h-2.5 bg-muted/60 rounded-full overflow-hidden">
              <div className={`h-full ${DIST_BAR_COLOR[key] || 'bg-primary/70'} rounded-full transition-all duration-500`} style={{ width: `${Math.max(p, 2)}%` }} />
            </div>
            <span className="w-8 text-right font-semibold text-foreground shrink-0 tabular-nums">{item.qtd}</span>
            <span className="w-7 text-right text-muted-foreground/60 shrink-0 tabular-nums">{p}%</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── DistCard ─────────────────────────────────────────────────────────────────

function DistCard({ title, subtitle, badge, meses, universoTotal, loading, infoTitle, infoShort, infoDetails, items, labelKey, drillTipo, onDrill }: {
  title: string; subtitle: string; badge: BaseType; meses: number; universoTotal: number | null;
  loading: boolean; infoTitle: string; infoShort: string; infoDetails: React.ReactNode;
  items: OverviewDistItem[]; labelKey: 'perfil' | 'status' | 'macro'; drillTipo: 'PERFIL' | 'CADENCIA' | 'MACRO';
  onDrill: (req: DrillRequest) => void;
}) {
  return (
    <Card className="border-border/40 min-w-0 overflow-hidden flex flex-col hover:border-border/60 transition-colors">
      <CardHeader className="p-3 pb-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <CardTitle className="text-[11px] font-semibold text-foreground">{title}</CardTitle>
          <BaseBadge type={badge} meses={meses} />
          <InfoIconTooltip title={infoTitle} short={infoShort} details={infoDetails} />
        </div>
        <p className="text-[9px] text-muted-foreground mt-0.5">{subtitle}</p>
        <div className="mt-1.5 flex items-center gap-1 bg-muted/25 rounded-md px-2 py-0.5">
          <span className="text-[9px] text-muted-foreground">universo:</span>
          {loading ? <div className="h-3 w-10 animate-pulse bg-muted rounded" /> :
            <span className="text-[10px] font-bold text-foreground tabular-nums">{universoTotal != null ? fmtN(universoTotal) : '--'} clientes</span>}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 flex-1">
        {loading
          ? <div className="space-y-1.5">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-5 animate-pulse bg-muted rounded-md" />)}</div>
          : <DistributionBar items={items} labelKey={labelKey} drillTipo={drillTipo} onDrill={onDrill} />}
      </CardContent>
    </Card>
  );
}

// ─── OneShotCard (card completo na grade de distribuições) ───────────────────

function OneShotCard({ items, loading, cfg, meses, filters, onDrill, onTabChange }: {
  items: OverviewDistItem[]; loading: boolean;
  cfg: { one_shot_aguardando_max_dias: number; one_shot_risco_max_dias: number };
  meses: number; filters: RaioXComputedFilters;
  onDrill: (req: DrillRequest) => void;
  onTabChange: (tab: RaioXTab) => void;
}) {
  const aguardando = items.find((i: any) => i.status === 'ONE_SHOT_AGUARDANDO')?.qtd ?? 0;
  const risco = items.find((i: any) => i.status === 'ONE_SHOT_RISCO')?.qtd ?? 0;
  const perdido = items.find((i: any) => i.status === 'ONE_SHOT_PERDIDO')?.qtd ?? 0;
  const total = aguardando + risco + perdido;
  const aq = cfg.one_shot_aguardando_max_dias;
  const rq = cfg.one_shot_risco_max_dias;

  const slots = [
    { key: 'ONE_SHOT_AGUARDANDO', label: 'Aguardando', range: `≤${aq}d`, value: aguardando, color: 'text-blue-400', bg: 'bg-muted/20 border-border/30 hover:bg-muted/30', dot: 'bg-blue-400', bar: 'bg-blue-400/70' },
    { key: 'ONE_SHOT_RISCO', label: 'Em risco', range: `${aq + 1}–${rq}d`, value: risco, color: 'text-orange-400', bg: 'bg-muted/20 border-border/30 hover:bg-muted/30', dot: 'bg-orange-400', bar: 'bg-orange-400/70' },
    { key: 'ONE_SHOT_PERDIDO', label: 'Perdido', range: `+${rq + 1}d`, value: perdido, color: 'text-rose-400', bg: 'bg-muted/20 border-border/30 hover:bg-muted/30', dot: 'bg-rose-400', bar: 'bg-rose-400/70' },
  ];

  return (
    <Card className="border-border/40 bg-card/50 min-w-0 overflow-hidden flex flex-col hover:border-border/60 transition-colors">
      <CardHeader className="p-3 pb-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="h-2 w-2 rounded-full bg-violet-400 shrink-0" />
          <CardTitle className="text-[11px] font-semibold text-foreground">One-Shot</CardTitle>
          <InfoIconTooltip title="One-Shot — 1ª visita única"
            short={`1 visita total · 3 subgrupos por recência · REF: ${fmtD(filters.dataFimISO)}`}
            details={<div className="space-y-1.5 text-[10px]">
              <p><strong>One-shot</strong> = cliente com exatamente 1 visita histórica. Sem cadência calculável — monitorados por recência.</p>
              <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 space-y-0.5">
                <p className="text-muted-foreground font-medium text-[9px]">Fonte: <span className="text-foreground/80 font-medium">Base Status {meses}m</span></p>
                <p className="text-muted-foreground text-[9px]">Usada em: <span className="text-foreground/80 font-medium">One-shots (em risco + perdido) · Distribuições</span></p>
              </div>
              <div className="space-y-0.5">
                <p><span className="text-blue-400">Aguardando:</span> visitas=1 E dias_sem_vir ≤ {aq}d</p>
                <p><span className="text-orange-400">Em risco:</span> visitas=1 E {aq + 1}d ≤ dias ≤ {rq}d</p>
                <p><span className="text-rose-400">Perdido:</span> visitas=1 E dias_sem_vir &gt; {rq}d</p>
              </div>
              <p className="text-amber-400">Em risco e Perdido também somam nos KPIs gerais. Configure em Config → Seção 5.</p>
            </div>}
          />
        </div>
        <div className="mt-1 flex items-center gap-1.5 bg-muted/25 rounded-md px-2 py-0.5">
          <span className="text-[9px] text-muted-foreground">universo:</span>
          {loading ? <div className="h-3 w-10 animate-pulse bg-muted rounded" /> :
            <span className="text-[10px] font-bold text-foreground tabular-nums">{fmtN(total)}</span>}
          <span className="text-[9px] text-muted-foreground">com 1ª visita única</span>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 flex-1 flex flex-col gap-2">
        {loading ? (
          <div className="space-y-1.5">{[1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse bg-muted rounded-md" />)}</div>
        ) : total === 0 ? (
          <EmptyState className="py-4" description="Sem one-shots." />
        ) : (
          <div className="space-y-1">
            {slots.map(s => {
              const p = pct(s.value, total);
              return (
                <button key={s.key} type="button"
                  onClick={() => onDrill({ tipo: 'CADENCIA', valor: s.key, label: `One-shot ${s.label}` })}
                  className={`w-full flex items-center gap-1.5 text-[10px] rounded-md px-1.5 py-1.5 border transition-colors text-left ${s.bg}`}
                  title={`Ver ${s.label}: ${s.value} clientes`}
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                  <span className={`w-20 shrink-0 font-medium ${s.color}`}>{s.label}</span>
                  <div className="flex-1 min-w-0 h-2 bg-muted/60 rounded-full overflow-hidden">
                    <div className={`h-full ${s.bar} rounded-full`} style={{ width: `${Math.max(p, 2)}%` }} />
                  </div>
                  <span className="w-8 text-right font-semibold text-foreground shrink-0 tabular-nums">{fmtN(s.value)}</span>
                  <span className="w-7 text-right text-muted-foreground/60 shrink-0 tabular-nums">{p}%</span>
                </button>
              );
            })}
          </div>
        )}
        <button type="button" onClick={() => onTabChange('oneshot')}
          className="flex items-center gap-1 text-[9px] text-violet-400 hover:text-violet-300 transition-colors mt-auto pt-1">
          Análise completa <ChevronRight className="h-3 w-3" />
        </button>
      </CardContent>
    </Card>
  );
}

// ─── CadenciaIndividualMini ───────────────────────────────────────────────────

const CADENCIA_STATUS = [
  { key: 'assiduo', color: 'text-emerald-400', bg: 'bg-muted/20 border-border/30', dot: 'bg-emerald-500', ratioLabel: (cfg: any) => `≤${Math.round((cfg.ratio_muito_frequente_max ?? 0.8) * 100)}% do ritmo`, drillTipo: 'ASSIDUO' as const },
  { key: 'regular', color: 'text-blue-400', bg: 'bg-muted/20 border-border/30', dot: 'bg-blue-500', ratioLabel: (cfg: any) => `${Math.round((cfg.ratio_muito_frequente_max ?? 0.8) * 100)}–${Math.round((cfg.ratio_regular_max ?? 1.2) * 100)}%`, drillTipo: 'REGULAR' as const },
  { key: 'espacando', color: 'text-amber-400', bg: 'bg-muted/20 border-border/30', dot: 'bg-amber-500', ratioLabel: (cfg: any) => `${Math.round((cfg.ratio_regular_max ?? 1.2) * 100)}–${Math.round((cfg.ratio_espacando_max ?? 1.8) * 100)}%`, drillTipo: 'ESPACANDO' as const },
  { key: 'primeira_vez', color: 'text-slate-400', bg: 'bg-muted/20 border-border/30', dot: 'bg-slate-400', ratioLabel: () => '1 visita', drillTipo: 'PRIMEIRA_VEZ' as const },
  { key: 'em_risco', color: 'text-orange-400', bg: 'bg-muted/20 border-border/30', dot: 'bg-orange-500', ratioLabel: (cfg: any) => `${Math.round((cfg.ratio_espacando_max ?? 1.8) * 100)}–${Math.round((cfg.ratio_risco_max ?? 2.5) * 100)}%`, drillTipo: 'EM_RISCO' as const },
  { key: 'perdido', color: 'text-rose-400', bg: 'bg-muted/20 border-border/30', dot: 'bg-rose-500', ratioLabel: (cfg: any) => `>${Math.round((cfg.ratio_risco_max ?? 2.5) * 100)}%`, drillTipo: 'PERDIDO' as const },
] as const;

function CadenciaIndividualMini({ cadenciaData, cadenciaLoading, cfg, labels, filters, meses, onTabChange, onDrill }: {
  cadenciaData?: CadenciaData | null; cadenciaLoading?: boolean; cfg: any;
  labels: Record<string, string>; filters: RaioXComputedFilters; meses: number;
  onTabChange: (tab: RaioXTab) => void; onDrill: (req: DrillRequest) => void;
}) {
  const kpis = cadenciaData?.kpis;
  const total = kpis?.total ?? 0;
  const cadencia_meses = cfg?.cadencia_meses_analise ?? 12;
  const minVisitas = cfg?.cadencia_min_visitas ?? 3;

  return (
    <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <div className="h-6 w-6 rounded-lg bg-primary/10 border border-border/30 flex items-center justify-center shrink-0">
          <Activity className="h-3 w-3 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-foreground">Cadência Individual</p>
          <p className="text-[9px] text-muted-foreground">
            {total > 0 ? `${fmtN(total)} clientes` : '—'} · {cadencia_meses}m de histórico · ≥{minVisitas} visitas
          </p>
        </div>
        <InfoIconTooltip
          title="Cadência Individual"
          short={`Compara dias sem vir com o ritmo habitual de cada cliente.`}
          details={<div className="space-y-1 text-[10px]">
            <p>O <strong>ratio</strong> mede se o cliente está atrasado em relação ao próprio histórico: dias sem vir ÷ cadência habitual (média dos intervalos).</p>
            <p>Ratio ≤ 0.8 = chegou cedo (assíduo). Ratio &gt; 2.5 = muito atrasado (perdido).</p>
            <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 space-y-0.5">
              <p className="text-muted-foreground font-medium text-[9px]">Fonte: <span className="text-foreground/80 font-medium">Cadência individual · {cadencia_meses}m de histórico</span> {total > 0 && <span>· {fmtN(total)} clientes</span>}</p>
              <p className="text-muted-foreground text-[9px]">Usada em: <span className="text-foreground/80 font-medium">Cadência (6 status) · Score de saúde (dim. cadência)</span></p>
            </div>
            <p className="text-muted-foreground">Exige ≥{minVisitas} visitas nos últimos {cadencia_meses} meses para ser calculado.</p>
          </div>}
        />
        <button type="button" onClick={() => onTabChange('cadencia')}
          className="flex items-center gap-1 text-[9px] text-amber-400 hover:text-amber-300 transition-colors shrink-0 ml-1">
          Análise completa <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div className="p-3">
        {cadenciaLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-14 animate-pulse bg-muted rounded-lg" />)}
          </div>
        ) : !kpis ? (
          <p className="text-[10px] text-muted-foreground text-center py-2">
            Dados não disponíveis — acesse a aba <button type="button" className="text-amber-400 underline" onClick={() => onTabChange('cadencia')}>Cadência</button>.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
            {CADENCIA_STATUS.map(({ key, color, bg, dot, ratioLabel, drillTipo }) => {
              const val = (kpis as any)[key] ?? 0;
              const p = pct(val, total);
              const label = labels[key] || key;
              return (
                <button key={key} type="button"
                  onClick={() => onDrill({ tipo: drillTipo, valor: key.toUpperCase(), label: `${label} — Cadência Individual` })}
                  className={`rounded-lg border px-2.5 py-2 ${bg} hover:bg-muted/40 hover:border-border/50 active:scale-[0.98] transition-all cursor-pointer text-left`}
                  title={`Ver ${label}: ${fmtN(val)} clientes`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
                    <p className={`text-[9px] font-semibold uppercase tracking-wide truncate ${color}`}>{label}</p>
                  </div>
                  <p className="text-base font-bold text-foreground tabular-nums">{fmtN(val)}</p>
                  <p className="text-[9px] text-muted-foreground tabular-nums">{p}% · {ratioLabel(cfg)}</p>
                  <div className="mt-1.5 h-1 bg-muted/50 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full`} style={{
                      width: `${Math.max(p, 3)}%`,
                      backgroundColor: dot.includes('emerald') ? 'rgba(52,211,153,0.6)' :
                        dot.includes('blue') ? 'rgba(96,165,250,0.6)' : dot.includes('amber') ? 'rgba(251,191,36,0.6)' :
                        dot.includes('orange') ? 'rgba(251,146,60,0.6)' : dot.includes('rose') ? 'rgba(251,113,133,0.6)' : 'rgba(148,163,184,0.6)'
                    }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TrendChart ───────────────────────────────────────────────────────────────

function TrendChart({ data, color }: { data: { ano: number; mes: number; qtd: number }[]; color: string }) {
  if (!data || data.length === 0) return <EmptyState className="py-6" description="Sem dados de tendência." />;
  const chartData = data.map((d) => ({ name: `${d.mes}/${String(d.ano).slice(2)}`, qtd: d.qtd }));
  const avg = Math.round(chartData.reduce((s, d) => s + d.qtd, 0) / chartData.length);
  return (
    <div className="h-[140px] sm:h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 2, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} className="fill-muted-foreground" interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9 }} width={36} className="fill-muted-foreground" />
          <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
          <ReferenceLine y={avg} stroke="hsl(var(--muted-foreground) / 0.4)" strokeDasharray="4 4" label={{ value: `Méd: ${avg}`, position: 'insideTopLeft', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
          <Bar dataKey="qtd" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Bloco A — Como ler esta página (Sheet explicativa) ──────────────────────

function ComoLerEstaPage({ filters, raioxConfig, onTabChange }: {
  filters: RaioXComputedFilters;
  raioxConfig?: RaioxConfigInstance;
  onTabChange: (tab: RaioXTab) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = raioxConfig?.config;

  const regras = [
    { label: 'Janela de ativo', valor: `${cfg?.janela_dias_padrao ?? 60} dias`, configuravel: true, onde: 'Config → Seção 2' },
    { label: 'Cliente em risco', valor: `${(cfg?.risco_min_dias ?? 45) + 1}–${cfg?.risco_max_dias ?? 90} dias sem vir`, configuravel: true, onde: 'Config → Seção 5' },
    { label: 'Cliente perdido', valor: `>${cfg?.risco_max_dias ?? 90} dias sem vir`, configuravel: true, onde: 'Config → Seção 5' },
    { label: 'One-shot aguardando', valor: `≤${cfg?.one_shot_aguardando_max_dias ?? 45} dias`, configuravel: true, onde: 'Config → Seção 5' },
    { label: 'Churn / Resgate', valor: `>${cfg?.churn_dias_sem_voltar ?? 90} dias de ausência`, configuravel: true, onde: 'Config → Seção 7' },
    { label: 'Atribuição barbeiro', valor: cfg?.atribuicao_modo === 'MAIS_FREQUENTE' ? 'Mais frequente' : cfg?.atribuicao_modo === 'ULTIMO' ? 'Último atendimento' : (cfg?.atribuicao_modo ?? 'Último'), configuravel: true, onde: 'Config → Seção 8' },
    { label: 'Excluir sem cadastro', valor: filters.excluirSemCadastro ? 'Ativo' : 'Inativo', configuravel: false, onde: 'Filtro global' },
    { label: 'Base principal (P)', valor: `Total com corte ${cfg?.base_corte_meses ?? 24}m`, configuravel: true, onde: 'Config → Seção 1' },
    { label: 'Base Status (S)', valor: `Clientes com visita nos últimos ${cfg?.status12m_meses ?? 12}m`, configuravel: true, onde: 'Config → Seção 3' },
  ];

  const drilldowns = [
    'Indicador → lista de clientes',
    'Indicador → histórico mensal (abas Churn / Cadência)',
    'Distribuição → clique na barra → lista filtrada',
    'One-shot → 3 grupos por recência → clique → clientes',
    'Cadência → 6 grupos por ratio → aba Cadência',
    'Barbeiros → aba Barbeiros → lista por colaborador',
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted/30 border border-transparent hover:border-border/30"
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0" />
        Como ler esta página
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0 overflow-y-auto">
          <SheetHeader className="px-5 py-4 border-b border-border/40 bg-muted/10 shrink-0">
            <SheetTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Como ler esta página
            </SheetTitle>
            <p className="text-[10px] text-muted-foreground mt-1">
              Visão Geral · Raio X Clientes · {fmtD(filters.dataInicioISO)} – {fmtD(filters.dataFimISO)}
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* O que é esta página */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">O que é esta página</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                A <strong className="text-foreground">Visão Geral</strong> é o hub analítico do Raio X Clientes.
                Ela sintetiza o estado atual da base, mostra tendências e direciona para análises detalhadas nas outras abas.
                Foco exclusivo em <strong className="text-foreground">comportamento e estrutura da base de clientes</strong> — sem faturamento ou indicadores financeiros.
              </p>
            </div>

            {/* Universo analisado */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Universo analisado</p>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex gap-2">
                  <BaseBadge type="P" />
                  <span className="text-muted-foreground">Base Principal — clientes com visita nos últimos <strong className="text-foreground">{cfg?.base_corte_meses ?? 24} meses</strong></span>
                </div>
                <div className="flex gap-2">
                  <BaseBadge type="S" meses={cfg?.status12m_meses ?? 12} />
                  <span className="text-muted-foreground">Status {cfg?.status12m_meses ?? 12}m — clientes com visita nos últimos <strong className="text-foreground">{cfg?.status12m_meses ?? 12} meses</strong> (usado em risco/perdidos)</span>
                </div>
              </div>
            </div>

            {/* Regras ativas */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Regras ativas</p>
              <div className="rounded-xl border border-border/30 overflow-hidden">
                {regras.map((r, i) => (
                  <div key={i} className={`flex items-center justify-between gap-2 px-3 py-2 text-[10px] ${i < regras.length - 1 ? 'border-b border-border/20' : ''}`}>
                    <span className="text-muted-foreground flex-1">{r.label}</span>
                    <span className="font-medium text-foreground text-right">{r.valor}</span>
                    {r.configuravel ? (
                      <button type="button" onClick={() => { setOpen(false); onTabChange('config'); }}
                        className="text-[9px] text-primary/60 hover:text-primary transition-colors shrink-0 flex items-center gap-0.5">
                        <Settings className="h-2.5 w-2.5" /> {r.onde}
                      </button>
                    ) : (
                      <span className="text-[9px] text-muted-foreground/50 shrink-0">{r.onde}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Lógica de drilldown */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Como aprofundar</p>
              <ul className="space-y-1.5">
                {drilldowns.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-[10px] text-muted-foreground">
                    <ChevronRight className="h-3 w-3 text-primary/60 shrink-0 mt-0.5" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Glossário */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Glossário</p>
              <div className="space-y-1.5 text-[10px]">
                {[
                  { t: 'REF (data âncora)', d: 'Data base dos cálculos — fim do período selecionado.' },
                  { t: 'Janela de ativo', d: `Clientes que vieram nos últimos ${cfg?.janela_dias_padrao ?? 60} dias são considerados "ativos".` },
                  { t: 'One-shot', d: '1 única visita em todo o histórico. Não tem cadência calculável.' },
                  { t: 'Cadência habitual', d: 'Intervalo médio entre visitas de um cliente, calculado sobre o histórico.' },
                  { t: 'Ratio de cadência', d: 'dias sem vir ÷ cadência habitual. Ratio > 1 = está atrasado.' },
                  { t: 'Resgatado', d: `Cliente que voltou após mais de ${cfg?.churn_dias_sem_voltar ?? 90} dias de ausência.` },
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
            <Button variant="outline" size="sm" className="w-full text-[10px] h-7" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Bloco B — Alertas automáticos ───────────────────────────────────────────

// ─── SectionSkeleton — loading placeholder for sections that load async ──────

function SectionSkeleton({ title }: { title: string }) {
  return (
    <Card className="border-border/40 min-w-0 overflow-hidden">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground">{title}</CardTitle>
          <div className="h-3 w-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <span className="text-[9px] text-muted-foreground/60 animate-pulse">Carregando…</span>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <div className="h-4 w-48 animate-shimmer-subtle rounded" />
        <div className="h-32 animate-shimmer-subtle rounded-xl" />
        <div className="flex gap-3">
          <div className="h-3 w-20 animate-shimmer-subtle rounded" />
          <div className="h-3 w-20 animate-shimmer-subtle rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Bloco C — Tendência da base com gráfico interativo ──────────────────────

type ChurnSerie = ChurnEvolucaoData['series'][0];

function gerarLeituraBase(serie: ChurnSerie[]): string {
  if (serie.length < 4) return 'Dados insuficientes para leitura de tendência.';
  const ult = serie.slice(-3);
  const ant = serie.slice(-6, -3);
  if (ant.length < 3) return '';
  const mediaUlt = ult.reduce((s, m) => s + (m.base_ativa ?? 0), 0) / 3;
  const mediaAnt = ant.reduce((s, m) => s + (m.base_ativa ?? 0), 0) / 3;
  if (mediaAnt === 0) return '';
  const delta = Math.round((mediaUlt - mediaAnt) / mediaAnt * 100);
  if (delta > 5) return `Retidos crescendo ${delta}% nos últimos 3 meses vs os 3 anteriores.`;
  if (delta < -5) return `Retidos em queda de ${Math.abs(delta)}% nos últimos 3 meses — investigar churn.`;

  // Verificar estabilidade
  const vals = ult.map(m => m.base_ativa ?? 0);
  const variacao = (Math.max(...vals) - Math.min(...vals)) / Math.max(...vals, 1);
  if (variacao < 0.05) return 'Retidos estável nos últimos 3 meses.';
  return `Retidos oscilando — variação de ${Math.round(variacao * 100)}% entre os últimos meses.`;
}

interface TooltipBlocoC {
  active?: boolean;
  payload?: any[];
  label?: string;
  serie: ChurnSerie[];
  onDrillClick: (anoMes: string, tipo: DrillMensalTipo, label: string) => void;
}

function TooltipBlocoC({ active, payload, label, serie, onDrillClick }: TooltipBlocoC) {
  if (!active || !payload || !payload.length) return null;
  const item = serie.find(s => s.ano_mes_label === label);
  if (!item) return null;
  const idx = serie.findIndex(s => s.ano_mes_label === label);
  const prev = idx > 0 ? serie[idx - 1] : null;
  const media = serie.reduce((s, m) => s + (m.atendidos_mes ?? 0), 0) / serie.length;
  const delta = prev ? item.atendidos_mes - prev.atendidos_mes : null;
  const vsMedia = Math.round((item.atendidos_mes - media) / media * 100);

  return (
    <div className="bg-card border border-border/60 rounded-xl shadow-xl backdrop-blur-sm p-3 space-y-2 text-[10px] max-w-[200px]">
      <p className="font-semibold text-foreground text-[11px]">{label}</p>
      <div className="space-y-1">
        <p className="text-muted-foreground">Atendidos: <span className="text-foreground font-medium">{fmtN(item.atendidos_mes)}</span></p>
        <p className="text-muted-foreground">Retidos: <span className="text-foreground font-medium">{fmtN(item.base_ativa)}</span></p>
        {item.em_risco > 0 && <p className="text-orange-400">Em risco: {fmtN(item.em_risco)}</p>}
        {item.resgatados > 0 && <p className="text-emerald-400">Resgatados: {fmtN(item.resgatados)}</p>}
      </div>
      {delta !== null && (
        <p className={`font-medium ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} vs mês ant.
        </p>
      )}
      <p className={`text-[9px] ${vsMedia > 5 ? 'text-emerald-400' : vsMedia < -5 ? 'text-rose-400' : 'text-muted-foreground'}`}>
        {vsMedia > 5 ? `↑ ${vsMedia}% acima da média` : vsMedia < -5 ? `↓ ${Math.abs(vsMedia)}% abaixo da média` : 'Na média do período'}
      </p>
      <button type="button"
        className="w-full text-[9px] text-primary border border-primary/30 rounded-lg py-1 px-2 hover:bg-primary/10 transition-colors"
        onClick={() => onDrillClick(item.ano_mes, 'ativos', `Clientes ativos — ${label}`)}>
        Ver clientes deste mês →
      </button>
    </div>
  );
}

function BlocoTamanhoBase({ serie, loading, filters, thresholds, onTabChange }: {
  serie: ChurnSerie[];
  loading: boolean;
  filters: RaioXComputedFilters;
  thresholds: { risco_min_dias: number; risco_max_dias: number };
  onTabChange: (tab: RaioXTab) => void;
}) {
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillAnoMes, setDrillAnoMes] = useState('');
  const [drillTipo, setDrillTipo] = useState<DrillMensalTipo>('ativos');
  const [drillLabel, setDrillLabel] = useState('');

  const drillMensal = useRaioxVisaoGeralDrillMensal({
    riscoMinDias: thresholds.risco_min_dias,
    riscoMaxDias: thresholds.risco_max_dias,
  });

  const handleDrillClick = (anoMes: string, tipo: DrillMensalTipo, label: string) => {
    setDrillAnoMes(anoMes);
    setDrillTipo(tipo);
    setDrillLabel(label);
    setDrillOpen(true);
    drillMensal.reset();
    drillMensal.fetch(anoMes, tipo);
  };

  const handleBarClick = (data: any) => {
    const item = serie.find(s => s.ano_mes_label === data.ano_mes_label);
    if (item) handleDrillClick(item.ano_mes, 'ativos', `Ativos — ${data.ano_mes_label}`);
  };

  const leitura = serie.length >= 4 ? gerarLeituraBase(serie) : '';
  const ultimoMes = serie.length > 0 ? serie[serie.length - 1] : null;
  const penultimoMes = serie.length > 1 ? serie[serie.length - 2] : null;
  const deltaMes = ultimoMes && penultimoMes
    ? ultimoMes.atendidos_mes - penultimoMes.atendidos_mes : null;

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-48 animate-pulse bg-muted rounded" />
        <div className="h-40 animate-pulse bg-muted rounded-xl" />
      </div>
    );
  }

  if (!serie || serie.length === 0) return null;

  return (
    <>
      <Card className="border-border/40 min-w-0 overflow-hidden">
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-xs font-semibold text-foreground">Movimento da base</CardTitle>
            {ultimoMes && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                · <span className="font-bold text-foreground tabular-nums">{fmtN(ultimoMes.atendidos_mes)}</span> atendidos
                {deltaMes !== null && (
                  <span className={`font-medium ${deltaMes >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {deltaMes >= 0 ? '↑' : '↓'}{Math.abs(deltaMes)}
                  </span>
                )}
              </span>
            )}
            <InfoIconTooltip title="Movimento da base — mensal"
              short="Atendidos, em risco e resgatados por mês."
              details={<div className="space-y-1.5 text-[10px]">
                <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 space-y-0.5">
                  <p className="text-muted-foreground font-medium text-[9px]">Fonte: <span className="text-foreground/80 font-medium">Base Principal (P)</span></p>
                  <p className="text-muted-foreground text-[9px]">Usada em: <span className="text-foreground/80 font-medium">Atendidos · Em risco mensal · Resgatados mensal</span></p>
                </div>
                <p><strong className="text-blue-400">Barras:</strong> Clientes atendidos naquele mês (clique para ver a lista).</p>
                <p><strong className="text-orange-400">Linha laranja:</strong> Clientes em risco ao fim do mês.</p>
                <p><strong className="text-emerald-400">Linha verde:</strong> Clientes resgatados no mês.</p>
                <p className="text-muted-foreground">Clique em qualquer barra para ver quem veio naquele mês. Configure os thresholds em Config → Seção 5.</p>
              </div>}
            />
          </div>
          {leitura && (
            <p className="text-[9px] text-muted-foreground mt-0.5 italic">{leitura}</p>
          )}
          {(() => {
            const avgAtend = serie.length > 0 ? Math.round(serie.reduce((s, m) => s + (m.atendidos_mes ?? 0), 0) / serie.length) : 0;
            const vals12 = serie.slice(-12);
            const vals6 = serie.slice(-6);
            const curYear = new Date().getFullYear();
            const valsAno = serie.filter(s => { const [y] = s.ano_mes.split('-').map(Number); return y === curYear; });
            const avg12 = vals12.length > 0 ? Math.round(vals12.reduce((s, m) => s + (m.atendidos_mes ?? 0), 0) / vals12.length) : null;
            const avg6 = vals6.length > 0 ? Math.round(vals6.reduce((s, m) => s + (m.atendidos_mes ?? 0), 0) / vals6.length) : null;
            const avgAno = valsAno.length > 0 ? Math.round(valsAno.reduce((s, m) => s + (m.atendidos_mes ?? 0), 0) / valsAno.length) : null;
            return (
              <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground tabular-nums flex-wrap">
                {avg12 != null && <span>12m: <span className="text-foreground/80 font-medium">{fmtN(avg12)}</span></span>}
                {avg6 != null && <span>6m: <span className="text-foreground/80 font-medium">{fmtN(avg6)}</span></span>}
                {avgAno != null && <span>Ano: <span className="text-foreground/80 font-medium">{fmtN(avgAno)}</span></span>}
              </div>
            );
          })()}
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <p className="text-[8px] text-muted-foreground/60 mb-1">Clique em qualquer barra para ver os clientes daquele mês</p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart
              data={serie.map(s => ({ ...s }))}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              onClick={(d) => d?.activePayload?.[0] && handleBarClick(d.activePayload[0].payload)}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="ano_mes_label" tick={{ fontSize: 8 }} className="fill-muted-foreground" interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 8 }} width={34} className="fill-muted-foreground" />
              <RechartsTooltip
                content={(props) => (
                  <TooltipBlocoC
                    {...props}
                    serie={serie}
                    onDrillClick={handleDrillClick}
                  />
                )}
              />
              <ReferenceLine y={serie.length > 0 ? Math.round(serie.reduce((s, m) => s + (m.atendidos_mes ?? 0), 0) / serie.length) : 0} stroke="hsl(var(--muted-foreground) / 0.4)" strokeDasharray="4 4" label={{ value: `Méd: ${serie.length > 0 ? Math.round(serie.reduce((s, m) => s + (m.atendidos_mes ?? 0), 0) / serie.length) : 0}`, position: 'insideTopLeft', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
              <Bar dataKey="atendidos_mes" name="Atendidos" fill="hsl(var(--primary) / 0.55)" radius={[2, 2, 0, 0]} />
              <Line type="monotone" dataKey="em_risco" name="Em risco" stroke="hsl(24 95% 55%)" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="resgatados" name="Resgatados" stroke="hsl(142 71% 45%)" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className="h-2 w-3 rounded-sm bg-primary/55 shrink-0" /> Atendidos
            </span>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className="h-0.5 w-4 bg-orange-500 shrink-0" /> Em risco
            </span>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className="h-0.5 w-4 bg-emerald-500 shrink-0" /> Resgatados
            </span>
            <button type="button" onClick={() => onTabChange('churn')}
              className="ml-auto text-[9px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
              Análise completa <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </CardContent>
      </Card>

      <DrillMensalSheet
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        result={drillMensal.data}
        loading={drillMensal.loading}
        error={drillMensal.error}
        anoMes={drillAnoMes}
        tipo={drillTipo}
        mesLabel={drillLabel}
      />
    </>
  );
}

// ─── Bloco D — Saldo da base: entradas por mês ───────────────────────────────

function gerarLeituraSaldo(serie: ChurnSerie[]): string {
  if (serie.length < 3) return '';
  const ult = serie.slice(-3);
  const ant = serie.slice(-6, -3);
  if (ant.length < 2) return '';
  const mediaUltBase = ult.reduce((s, m) => s + (m.base_ativa ?? 0), 0) / ult.length;
  const mediaAntBase = ant.reduce((s, m) => s + (m.base_ativa ?? 0), 0) / ant.length;
  const delta = mediaAntBase > 0 ? Math.round((mediaUltBase - mediaAntBase) / mediaAntBase * 100) : 0;
  if (delta > 5) return `Entradas superando saídas — base crescendo ${delta}% nos últimos 3 meses.`;
  if (delta < -5) return `Saídas superando entradas — base encolhendo ${Math.abs(delta)}% nos últimos 3 meses.`;
  return 'Entradas e saídas em equilíbrio — base estável.';
}

function BlocoSaldoBase({ serie, loading, thresholds, onTabChange }: {
  serie: ChurnSerie[];
  loading: boolean;
  thresholds: { risco_min_dias: number; risco_max_dias: number };
  onTabChange: (tab: RaioXTab) => void;
}) {
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillAnoMes, setDrillAnoMes] = useState('');
  const [drillTipo, setDrillTipo] = useState<DrillMensalTipo>('novos');
  const [drillLabel, setDrillLabel] = useState('');
  const drillMensal = useRaioxVisaoGeralDrillMensal({ riscoMinDias: thresholds.risco_min_dias, riscoMaxDias: thresholds.risco_max_dias });

  if (!serie || serie.length === 0 || loading) return null;

  const chartData = serie.map(m => ({
    label: m.ano_mes_label,
    ano_mes: m.ano_mes,
    novos: m.atendidos_primeira_vez ?? 0,
    resgatados: m.resgatados ?? 0,
  }));

  const leitura = gerarLeituraSaldo(serie);
  const mediaEntradas = Math.round(chartData.reduce((s, m) => s + m.novos + m.resgatados, 0) / chartData.length);

  return (
    <>
      <Card className="border-border/40 min-w-0 overflow-hidden">
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-xs font-semibold text-foreground">Entradas na base</CardTitle>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              · Méd <span className="font-bold text-foreground tabular-nums">{fmtN(mediaEntradas)}</span>/mês
            </span>
            <InfoIconTooltip title="Entradas mensais — novos + resgatados"
              short="Clientes que entraram na base: 1ª visita ou retorno após ausência longa."
              details={<div className="space-y-1.5 text-[10px]">
                <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 space-y-0.5">
                  <p className="text-muted-foreground font-medium text-[9px]">Fonte: <span className="text-foreground/80 font-medium">Base Principal (P)</span></p>
                  <p className="text-muted-foreground text-[9px]">Novos = 1ª visita na base · Resgatados = ausência &gt; {thresholds.risco_max_dias}d</p>
                </div>
                <p><strong className="text-blue-400">Azul (Novos):</strong> 1ª visita histórica naquele mês.</p>
                <p><strong className="text-emerald-400">Verde (Resgatados):</strong> voltaram após mais de {thresholds.risco_max_dias}d ausentes.</p>
                <p className="text-muted-foreground">Clique nas barras para ver os clientes. Configure o prazo de resgate em Config → Seção 7.</p>
              </div>}
            />
          </div>
          {leitura && <p className="text-[9px] text-muted-foreground mt-0.5 italic">{leitura}</p>}
          {(() => {
            const vals12 = chartData.slice(-12);
            const vals6 = chartData.slice(-6);
            const curYear = new Date().getFullYear();
            const valsAno = serie.filter(s => { const [y] = s.ano_mes.split('-').map(Number); return y === curYear; }).map(m => (m.atendidos_primeira_vez ?? 0) + (m.resgatados ?? 0));
            const avg12 = vals12.length > 0 ? Math.round(vals12.reduce((s, m) => s + m.novos + m.resgatados, 0) / vals12.length) : null;
            const avg6 = vals6.length > 0 ? Math.round(vals6.reduce((s, m) => s + m.novos + m.resgatados, 0) / vals6.length) : null;
            const avgAno = valsAno.length > 0 ? Math.round(valsAno.reduce((s, v) => s + v, 0) / valsAno.length) : null;
            return (
              <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground tabular-nums flex-wrap">
                {avg12 != null && <span>12m: <span className="text-foreground/80 font-medium">{fmtN(avg12)}</span></span>}
                {avg6 != null && <span>6m: <span className="text-foreground/80 font-medium">{fmtN(avg6)}</span></span>}
                {avgAno != null && <span>Ano: <span className="text-foreground/80 font-medium">{fmtN(avgAno)}</span></span>}
              </div>
            );
          })()}
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <p className="text-[8px] text-muted-foreground/60 mb-1">Clique nas barras para ver os clientes daquele mês</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}
              onClick={(d) => {
                const p = d?.activePayload?.[0]?.payload;
                if (!p) return;
                const tipo: DrillMensalTipo = d.activePayload![0].dataKey === 'resgatados' ? 'resgatados' : 'novos';
                setDrillAnoMes(p.ano_mes); setDrillTipo(tipo);
                setDrillLabel(`${tipo === 'novos' ? 'Novos' : 'Resgatados'} — ${p.label}`);
                setDrillOpen(true); drillMensal.reset(); drillMensal.fetch(p.ano_mes, tipo);
              }} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="label" tick={{ fontSize: 8 }} className="fill-muted-foreground" interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 8 }} width={32} className="fill-muted-foreground" />
              <RechartsTooltip contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                formatter={(v: number, n: string) => [fmtN(v), n === 'novos' ? 'Novos' : 'Resgatados']} />
              <ReferenceLine y={mediaEntradas} stroke="hsl(var(--muted-foreground) / 0.4)" strokeDasharray="4 4" label={{ value: `Méd: ${mediaEntradas}`, position: 'insideTopLeft', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
              <Bar dataKey="novos" name="novos" stackId="a" fill="hsl(217 91% 60% / 0.65)" radius={[0,0,0,0]} />
              <Bar dataKey="resgatados" name="resgatados" stackId="a" fill="hsl(142 71% 45% / 0.70)" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-2 w-3 rounded-sm bg-blue-500/65 shrink-0" /> Novos</span>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-2 w-3 rounded-sm bg-emerald-500/70 shrink-0" /> Resgatados</span>
            <button type="button" onClick={() => onTabChange('cohort')} className="ml-auto text-[9px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
              Ver retenção de novos <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </CardContent>
      </Card>
      <DrillMensalSheet open={drillOpen} onClose={() => setDrillOpen(false)}
        result={drillMensal.data} loading={drillMensal.loading} error={drillMensal.error}
        anoMes={drillAnoMes} tipo={drillTipo} mesLabel={drillLabel} />
    </>
  );
}

// ─── Bloco E — Risco & Retenção ───────────────────────────────────────────────

function gerarLeituraRisco(serie: ChurnSerie[]): string {
  if (serie.length < 4) return '';
  const ult = serie.slice(-3);
  const ant = serie.slice(-6, -3);
  if (ant.length < 2) return '';
  const mediaUlt = ult.reduce((s, m) => s + (m.em_risco ?? 0), 0) / ult.length;
  const mediaAnt = ant.reduce((s, m) => s + (m.em_risco ?? 0), 0) / ant.length;
  const mediaChurn = ult.reduce((s, m) => s + (m.churn_pct ?? 0), 0) / ult.length;
  if (mediaAnt === 0) return '';
  const delta = Math.round((mediaUlt - mediaAnt) / mediaAnt * 100);
  if (delta > 15) return `Em risco acelerando +${delta}% vs 3 meses anteriores — ação urgente.`;
  if (delta < -10) return `Em risco reduzindo ${Math.abs(delta)}% — tendência positiva.`;
  return `Churn médio de ${mediaChurn.toFixed(1)}% nos últimos 3 meses.`;
}

function BlocoRiscoRetencao({ serie, loading, thresholds, onTabChange }: {
  serie: ChurnSerie[];
  loading: boolean;
  thresholds: { risco_min_dias: number; risco_max_dias: number };
  onTabChange: (tab: RaioXTab) => void;
}) {
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillAnoMes, setDrillAnoMes] = useState('');
  const [drillTipo, setDrillTipo] = useState<DrillMensalTipo>('em_risco');
  const [drillLabel, setDrillLabel] = useState('');
  const drillMensal = useRaioxVisaoGeralDrillMensal({ riscoMinDias: thresholds.risco_min_dias, riscoMaxDias: thresholds.risco_max_dias });

  if (!serie || serie.length === 0 || loading) return null;

  const ultimoMes = serie[serie.length - 1];
  const penultimoMes = serie.length > 1 ? serie[serie.length - 2] : null;
  const deltaRisco = penultimoMes ? ultimoMes.em_risco - penultimoMes.em_risco : null;
  const leitura = gerarLeituraRisco(serie);

  return (
    <>
      <Card className="border-border/40 bg-card/50 min-w-0 overflow-hidden">
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-xs font-semibold text-foreground">Risco & Retenção</CardTitle>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              · <span className="font-bold text-orange-400 tabular-nums">{fmtN(ultimoMes.em_risco)}</span> em risco
              {deltaRisco !== null && (
                <span className={`font-medium ${deltaRisco > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {deltaRisco > 0 ? '↑' : '↓'}{Math.abs(deltaRisco)}
                </span>
              )}
            </span>
            <InfoIconTooltip title="Risco — evolução mensal"
              short={`Clientes em risco (${thresholds.risco_min_dias + 1}–${thresholds.risco_max_dias}d) e taxa de churn por mês.`}
              details={<div className="space-y-1.5 text-[10px]">
                <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 space-y-0.5">
                  <p className="text-muted-foreground font-medium text-[9px]">Fonte: <span className="text-foreground/80 font-medium">Base Status (S)</span></p>
                  <p className="text-muted-foreground text-[9px]">Usada em: <span className="text-foreground/80 font-medium">Em Risco mensal · Taxa de churn</span></p>
                </div>
                <p><strong className="text-orange-400">Barras:</strong> clientes em risco ao fim do mês.</p>
                <p><strong className="text-rose-400">Linha:</strong> taxa de churn % do mês.</p>
                <p className="text-muted-foreground">Clique para ver quem está em risco naquele mês. Configure em Config → Seção 5.</p>
              </div>}
            />
          </div>
          {leitura && <p className="text-[9px] text-muted-foreground mt-0.5 italic">{leitura}</p>}
          {(() => {
            const avgRisco = serie.length > 0 ? Math.round(serie.reduce((s, m) => s + (m.em_risco ?? 0), 0) / serie.length) : 0;
            const vals12 = serie.slice(-12);
            const vals6 = serie.slice(-6);
            const curYear = new Date().getFullYear();
            const valsAno = serie.filter(s => { const [y] = s.ano_mes.split('-').map(Number); return y === curYear; });
            const avg12 = vals12.length > 0 ? Math.round(vals12.reduce((s, m) => s + (m.em_risco ?? 0), 0) / vals12.length) : null;
            const avg6 = vals6.length > 0 ? Math.round(vals6.reduce((s, m) => s + (m.em_risco ?? 0), 0) / vals6.length) : null;
            const avgAno = valsAno.length > 0 ? Math.round(valsAno.reduce((s, m) => s + (m.em_risco ?? 0), 0) / valsAno.length) : null;
            return (
              <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground tabular-nums flex-wrap">
                {avg12 != null && <span>12m: <span className="text-foreground/80 font-medium">{fmtN(avg12)}</span></span>}
                {avg6 != null && <span>6m: <span className="text-foreground/80 font-medium">{fmtN(avg6)}</span></span>}
                {avgAno != null && <span>Ano: <span className="text-foreground/80 font-medium">{fmtN(avgAno)}</span></span>}
              </div>
            );
          })()}
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <p className="text-[8px] text-muted-foreground/60 mb-1">Clique nas barras para ver os clientes em risco daquele mês</p>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={serie} margin={{ top: 2, right: 28, left: -20, bottom: 0 }}
              onClick={(d) => {
                const p = d?.activePayload?.[0]?.payload;
                if (!p?.ano_mes) return;
                setDrillAnoMes(p.ano_mes); setDrillTipo('em_risco');
                setDrillLabel(`Em risco — ${p.ano_mes_label}`);
                setDrillOpen(true); drillMensal.reset(); drillMensal.fetch(p.ano_mes, 'em_risco');
              }} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="ano_mes_label" tick={{ fontSize: 8 }} className="fill-muted-foreground" interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={{ fontSize: 8 }} width={32} className="fill-muted-foreground" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 8 }} width={24} unit="%" className="fill-muted-foreground" />
              <RechartsTooltip contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                formatter={(v: number, n: string) => [n === 'churn_pct' ? `${v}%` : fmtN(v), n === 'em_risco' ? 'Em risco' : 'Churn %']} />
              <ReferenceLine yAxisId="left" y={serie.length > 0 ? Math.round(serie.reduce((s, m) => s + (m.em_risco ?? 0), 0) / serie.length) : 0} stroke="hsl(var(--muted-foreground) / 0.4)" strokeDasharray="4 4" label={{ value: `Méd: ${serie.length > 0 ? Math.round(serie.reduce((s, m) => s + (m.em_risco ?? 0), 0) / serie.length) : 0}`, position: 'insideTopLeft', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
              <Bar yAxisId="left" dataKey="em_risco" name="em_risco" fill="hsl(24 95% 55% / 0.65)" radius={[2,2,0,0]} />
              <Line yAxisId="right" type="monotone" dataKey="churn_pct" name="churn_pct" stroke="hsl(0 84% 60%)" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-2 w-3 rounded-sm bg-orange-500/65 shrink-0" /> Em risco</span>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-0.5 w-4 bg-rose-500 shrink-0" /> Churn %</span>
            <button type="button" onClick={() => onTabChange('churn')} className="ml-auto text-[9px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
              Análise de churn <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </CardContent>
      </Card>
      <DrillMensalSheet open={drillOpen} onClose={() => setDrillOpen(false)}
        result={drillMensal.data} loading={drillMensal.loading} error={drillMensal.error}
        anoMes={drillAnoMes} tipo={drillTipo} mesLabel={drillLabel} />
    </>
  );
}

// ─── Bloco F — Base por barbeiro (ranking de saúde) ──────────────────────────

function barbeiroHealthScore(b: CadenciaBarbeiroItem): number {
  if (!b.total) return 0;
  const saudavel = (b.assiduo ?? 0) + (b.regular ?? 0);
  const risco = (b.em_risco ?? 0) + (b.perdido ?? 0);
  return Math.max(0, Math.min(100, Math.round((saudavel / b.total) * 100 - (risco / b.total) * 50)));
}

function BlocoBarbeiros({ porBarbeiro, loading, onTabChange, raioxConfig, onDrill, filters }: {
  porBarbeiro: CadenciaBarbeiroItem[] | null | undefined;
  loading: boolean;
  onTabChange: (tab: RaioXTab) => void;
  raioxConfig?: RaioxConfigInstance;
  onDrill: (req: DrillRequest) => void;
  filters: RaioXComputedFilters;
}) {
  const cfg = raioxConfig?.config;
  const atribuicao = cfg?.atribuicao_modo === 'MAIS_FREQUENTE' ? 'mais frequente'
    : cfg?.atribuicao_modo === 'ULTIMO' ? 'último atendimento' : 'último atendimento';

  const [hiddenBarbeiros, setHiddenBarbeiros] = useState<Set<string>>(new Set());

  const allBarbeiros = useMemo(() =>
    (porBarbeiro ?? []).filter(b => b.total > 0).sort((a, b) => (a.colaborador_nome ?? '').localeCompare(b.colaborador_nome ?? '')),
    [porBarbeiro]
  );

  const toggleBarbeiro = (id: string) => {
    setHiddenBarbeiros(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="h-28 animate-pulse bg-muted rounded-xl" />;
  if (!porBarbeiro || porBarbeiro.length === 0) {
    return (
      <div className="rounded-xl border border-border/30 bg-muted/10 p-4 text-center">
        <p className="text-[10px] text-muted-foreground">
          Dados de cadência por barbeiro não disponíveis — carregue a aba Cadência primeiro.
        </p>
        <button type="button" onClick={() => onTabChange('cadencia')}
          className="mt-2 text-[10px] text-primary hover:text-primary/80 flex items-center gap-1 mx-auto">
          Ir para Cadência <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  const sorted = allBarbeiros
    .filter(b => !hiddenBarbeiros.has(b.colaborador_id))
    .sort((a, b) => {
      const pRiscoA = ((a.em_risco ?? 0) + (a.perdido ?? 0)) / a.total;
      const pRiscoB = ((b.em_risco ?? 0) + (b.perdido ?? 0)) / b.total;
      return pRiscoB - pRiscoA;
    })
    .slice(0, 8);

  const mediaRisco = sorted.length > 0
    ? sorted.reduce((s, b) => s + ((b.em_risco ?? 0) + (b.perdido ?? 0)), 0)
      / sorted.reduce((s, b) => s + b.total, 0)
    : 0;

  const hiddenCount = hiddenBarbeiros.size;

  return (
    <Card className="border-border/40 min-w-0 overflow-hidden">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            Saúde por barbeiro
          </CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors rounded-md border border-border/40 px-2 py-0.5">
                <Filter className="h-3 w-3" />
                Filtrar
                {hiddenCount > 0 && <span className="ml-0.5 text-[8px] bg-primary/20 text-primary rounded-full px-1">{hiddenCount}</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <p className="text-[10px] font-medium text-foreground mb-2">Mostrar barbeiros</p>
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {allBarbeiros.map(b => (
                    <label key={b.colaborador_id} className="flex items-center gap-2 text-[10px] text-foreground cursor-pointer hover:bg-muted/30 rounded px-1.5 py-1">
                      <Checkbox
                        checked={!hiddenBarbeiros.has(b.colaborador_id)}
                        onCheckedChange={() => toggleBarbeiro(b.colaborador_id)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="truncate">{b.colaborador_nome || 'Sem nome'}</span>
                      <span className="ml-auto text-muted-foreground tabular-nums shrink-0">{b.total}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <InfoIconTooltip title="Saúde por barbeiro — cadência individual"
            short={`Score de saúde por colaborador · Atribuição: ${atribuicao}`}
            details={<div className="space-y-1.5 text-[10px]">
              <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 space-y-0.5">
                <p className="text-muted-foreground font-medium text-[9px]">Fonte: <span className="text-foreground/80 font-medium">Cadência individual · {cfg?.cadencia_meses_analise ?? 12}m de histórico</span></p>
                <p className="text-muted-foreground text-[9px]">Usada em: <span className="text-foreground/80 font-medium">Saúde por barbeiro · Score individual</span></p>
              </div>
              <p>Baseado na cadência individual — cada barbeiro vê os clientes atribuídos a ele.</p>
              <p><strong className="text-emerald-400">Saudável:</strong> assíduo + regular · <strong className="text-amber-400">Atenção:</strong> espaçando · <strong className="text-rose-400">Risco:</strong> em risco + perdido</p>
              <p className="text-muted-foreground">Atribuição: {atribuicao}. Altere em Config → Seção 8. Clientes multi-barbeiro aparecem em mais de um.</p>
            </div>}
          />
          <button type="button" onClick={() => onTabChange('barbeiros')}
            className="ml-auto text-[9px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
            Análise completa <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-0.5">
          {fmtD(filters.dataInicioISO)} – {fmtD(filters.dataFimISO)} · {fmtN(allBarbeiros.reduce((s, b) => s + b.total, 0))} clientes · Cadência Individual ·
          Ordenado por % risco+perdido · Média: {Math.round(mediaRisco * 100)}%
          {hiddenCount > 0 && <span className="text-primary/70"> · {hiddenCount} oculto{hiddenCount > 1 ? 's' : ''}</span>}
        </p>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-1.5">
        {sorted.map((b) => {
          const total = b.total;
          const saudavel = (b.assiduo ?? 0) + (b.regular ?? 0);
          const espacando = b.espacando ?? 0;
          const risco = (b.em_risco ?? 0) + (b.perdido ?? 0);
          const pSaudavel = pct(saudavel, total);
          const pEspacando = pct(espacando, total);
          const pRisco = pct(risco, total);
          const acimaDaMedia = pRisco / 100 > mediaRisco + 0.1;

          return (
            <div key={b.colaborador_id} className="group">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[10px] font-medium text-foreground flex-1 truncate">{b.colaborador_nome || 'Sem nome'}</p>
                {acimaDaMedia && (
                  <span className="text-[8px] text-rose-400 flex items-center gap-0.5 shrink-0">
                    <AlertTriangle className="h-2.5 w-2.5" /> acima da média
                  </span>
                )}
                <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">{fmtN(total)} clientes</span>
              </div>
              <div className="h-5 rounded-lg overflow-hidden flex bg-muted/40">
                {pSaudavel > 0 && (
                  <button type="button" className="h-full bg-emerald-500/65 transition-all hover:bg-emerald-500/80 flex items-center justify-center cursor-pointer" style={{ width: `${pSaudavel}%` }}
                    onClick={() => onDrill({ tipo: 'BARBEIRO', valor: `${b.colaborador_id}::SAUDAVEL`, label: `${b.colaborador_nome} — Saudável` })}
                    title={`Saudável: ${fmtN(saudavel)} clientes (${pSaudavel}%)`}>
                    {pSaudavel > 15 && <span className="text-[8px] text-emerald-100 font-bold">{pSaudavel}%</span>}
                  </button>
                )}
                {pEspacando > 0 && (
                  <button type="button" className="h-full bg-amber-500/65 transition-all hover:bg-amber-500/80 flex items-center justify-center cursor-pointer" style={{ width: `${pEspacando}%` }}
                    onClick={() => onDrill({ tipo: 'BARBEIRO', valor: `${b.colaborador_id}::ESPACANDO`, label: `${b.colaborador_nome} — Espaçando` })}
                    title={`Espaçando: ${fmtN(espacando)} clientes (${pEspacando}%)`}>
                    {pEspacando > 15 && <span className="text-[8px] text-amber-100 font-bold">{pEspacando}%</span>}
                  </button>
                )}
                {pRisco > 0 && (
                  <button type="button" className="h-full bg-rose-500/65 transition-all hover:bg-rose-500/80 flex items-center justify-center cursor-pointer" style={{ width: `${pRisco}%` }}
                    onClick={() => onDrill({ tipo: 'BARBEIRO', valor: `${b.colaborador_id}::RISCO`, label: `${b.colaborador_nome} — Em risco + Perdido` })}
                    title={`Risco: ${fmtN(risco)} clientes (${pRisco}%)`}>
                    {pRisco > 10 && <span className="text-[8px] text-rose-200 font-bold">{pRisco}%</span>}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[8px] text-muted-foreground/70">
                <span>{pSaudavel}% saudável ({fmtN(saudavel)})</span>
                {pEspacando > 0 && <span>{pEspacando}% espaçando ({fmtN(espacando)})</span>}
                <span className={pRisco > Math.round(mediaRisco * 100) + 10 ? 'text-rose-400' : ''}>{pRisco}% risco ({fmtN(risco)})</span>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && hiddenCount > 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-3">Todos os barbeiros estão ocultos pelo filtro.</p>
        )}

        {allBarbeiros.filter(b => !hiddenBarbeiros.has(b.colaborador_id)).length > 8 && (
          <button type="button" onClick={() => onTabChange('barbeiros')}
            className="w-full text-[9px] text-muted-foreground hover:text-primary transition-colors pt-1 flex items-center justify-center gap-1">
            Ver todos os {allBarbeiros.filter(b => !hiddenBarbeiros.has(b.colaborador_id)).length} barbeiros <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── MetaHeader ───────────────────────────────────────────────────────────────

function MetaHeader({ data, filters, raioxConfig }: {
  data: OverviewData | null; filters: RaioXComputedFilters; raioxConfig?: RaioxConfigInstance;
}) {
  const cfg = raioxConfig?.config;
  const baseModeLabel = cfg ? (BASE_MODE_LABELS[cfg.base_mode] || cfg.base_mode) : '—';
  const baseCorte = cfg?.base_mode === 'TOTAL_COM_CORTE' ? ` ${cfg.base_corte_meses}m` : '';
  const baseBadgeType: BaseType = cfg ? (BASE_MODE_BADGE[cfg.base_mode] ?? 'P') : 'P';
  const janelaDias = cfg?.janela_dias_padrao ?? 60;
  const meses = cfg?.status12m_meses ?? 12;
  const baseTotal = data?.meta?.base_total as number | null | undefined;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 rounded-xl border border-border/30 bg-muted/15 text-[10px] text-muted-foreground">
      <span><strong className="text-foreground">Período:</strong> {fmtD(filters.dataInicioISO)} – {fmtD(filters.dataFimISO)}</span>
      <span><strong className="text-foreground">REF:</strong> {fmtD(filters.dataFimISO)}</span>
      <span className="flex items-center gap-1">
        <BaseBadge type={baseBadgeType} dias={janelaDias} /> {baseModeLabel}{baseCorte}
      </span>
      <span className="flex items-center gap-1"><BaseBadge type="S" meses={meses} /> Status {meses}m</span>
      {baseTotal != null && <span className="ml-auto font-medium text-foreground">{fmtN(baseTotal)} na base principal</span>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  data: OverviewData | null; loading: boolean; error: string | null;
  filters: RaioXComputedFilters; onTabChange: (tab: RaioXTab) => void;
  raioxConfig?: RaioxConfigInstance;
  cadenciaData?: CadenciaData | null; cadenciaLoading?: boolean;
  churnEvolucaoData?: ChurnEvolucaoData | null; churnEvolucaoLoading?: boolean;
}

export function TabVisaoGeral({ data, loading, error, filters, onTabChange, raioxConfig, cadenciaData, cadenciaLoading, churnEvolucaoData, churnEvolucaoLoading }: Props) {
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillReq, setDrillReq] = useState<DrillRequest | null>(null);

  const cfg = raioxConfig?.config;
  const meses = cfg?.status12m_meses ?? (data?.meta as any)?.status12m_meses ?? 12;

  const bases = {
    status12m: ((cfg as any)?.base_status12m ?? 'S') as BaseType,
    resgatados: ((cfg as any)?.base_resgatados ?? 'P') as BaseType,
  };

  const thresholds = {
    risco_min_dias: cfg?.risco_min_dias ?? 45,
    risco_max_dias: cfg?.risco_max_dias ?? 90,
    one_shot_aguardando_max_dias: cfg?.one_shot_aguardando_max_dias ?? 45,
    one_shot_risco_max_dias: cfg?.one_shot_risco_max_dias ?? 90,
    churn_dias_sem_voltar: cfg?.churn_dias_sem_voltar ?? 90,
  };

  const baseDistTotal = (data?.meta?.base_distribuicao_total as number) ?? null;
  const baseTotal = (data?.meta?.base_total as number) ?? null;
  const totals = { base: baseTotal, dist: baseDistTotal };

  const kpiMeta = buildKpiInfo(filters, meses, bases, thresholds, totals);
  const kpis = data?.kpis;

  const allCadencia = data?.distribuicoes?.por_cadencia_momento || [];
  const cadenciaOneShot = allCadencia.filter((i: any) => ONE_SHOT_STATUSES.includes(i.status));
  const cadenciaRecorr = allCadencia.filter((i: any) => !ONE_SHOT_STATUSES.includes(i.status));

  const statusSubtitle = `≤${thresholds.risco_min_dias}d · ${thresholds.risco_min_dias + 1}–${thresholds.risco_max_dias}d · ${thresholds.risco_max_dias}d+`;
  const handleDrill = (req: DrillRequest) => { setDrillReq(req); setDrillOpen(true); };

  const cadenciaLabels: Record<string, string> = (cfg as any)?.cadencia_individual_labels ?? {
    assiduo: 'Assíduo', regular: 'Regular', espacando: 'Espaçando',
    em_risco: 'Em Risco', perdido: 'Perdido', primeira_vez: '1ª Vez',
  };

  const novos = kpis?.novos_clientes_periodo ?? 0;
  const unicos = kpis?.clientes_unicos_periodo ?? 0;

  // Linha 1: 4 KPIs de atividade; Linha 2: 4 KPIs de saúde
  const kpisAtividade = kpiMeta.slice(0, 4);
  const kpisSaude = kpiMeta.slice(4, 8);

  // Médias históricas por KPI
  const serieEvo = churnEvolucaoData?.series;
  const KPI_SERIE_MAP: Record<string, string> = {
    clientes_unicos_periodo: 'atendidos_mes',
    novos_clientes_periodo: 'atendidos_primeira_vez',
    clientes_ativos_janela: 'base_ativa',
    clientes_resgatados_periodo: 'resgatados',
    clientes_em_risco_macro: 'em_risco',
    clientes_perdidos_macro: 'perdidos',
  };
  const kpiMediasMap = useMemo(() => {
    const map: Record<string, KpiMedias | null> = {};
    Object.entries(KPI_SERIE_MAP).forEach(([kpiKey, serieKey]) => {
      map[kpiKey] = computeMedias(serieEvo, serieKey);
    });
    return map;
  }, [serieEvo]);

  return (
    <div className="space-y-3 min-w-0 w-full overflow-x-hidden">

      <HowToReadSection
        bullets={[
          'Painel principal do Raio X — sintetiza o estado atual da base e direciona para análises detalhadas nas outras abas.',
          'Clique em qualquer KPI para abrir a lista de clientes e ver o drill histórico mensal.',
          'Distribuição de perfil, status e cadência — clique nas barras para filtrar clientes por segmento.',
          'Cohort e tendência de novos mostram aquisição e evolução da base mês a mês.',
          'One-shot, Cadência e Barbeiros abrem análises dedicadas — acesse pelas abas do menu.',
        ]}
      />

      {error && <HelpBox variant="warning">Erro ao carregar: {error}</HelpBox>}

      {/* 2. Sinais da base — primeiro olhar */}
      <DiagnosticoRapido data={data} loading={loading} filters={filters} cfg={thresholds} onTabChange={onTabChange} />

      {/* 3. KPIs — Atividade do período */}
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium px-0.5 mb-1.5 section-header-line">Atividade do período</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {kpisAtividade.map((k) => {
            const value = kpis ? (kpis as any)[k.key] : undefined;
            return (
              <KpiCard key={k.key} label={k.label} value={loading ? '--' : (value ?? '--')} status={k.status} loading={loading}
                suffix={<><BaseBadge type={k.badge} meses={meses} /><InfoIconTooltip title={k.label} short={k.short} details={k.details} /></>}
                medias={kpiMediasMap[k.key]}
              />
            );
          })}
        </div>
      </div>

      {/* 4. KPIs — Saúde da base */}
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium px-0.5 mb-1.5 section-header-line">Saúde da base · <BaseBadge type={bases.status12m} meses={meses} /></p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {kpisSaude.map((k) => {
            const value = kpis ? (kpis as any)[k.key] : undefined;
            return (
              <KpiCard key={k.key} label={k.label} value={loading ? '--' : (value ?? '--')} status={k.status} loading={loading}
                suffix={<><BaseBadge type={k.badge} meses={meses} /><InfoIconTooltip title={k.label} short={k.short} details={k.details} /></>}
                medias={kpiMediasMap[k.key]}
              />
            );
          })}
        </div>
      </div>

      {/* 5. Distribuições — 4 cards */}
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium px-0.5 mb-1.5 section-header-line">Distribuições da base</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          <DistCard
            title="Por Perfil" subtitle="Volume histórico + recência na REF"
            badge={((cfg as any)?.base_perfil ?? 'S') as BaseType} meses={meses} universoTotal={baseDistTotal} loading={loading}
            infoTitle="Por Perfil"
            infoShort={`Frequência histórica + recência · ${fmtD(filters.dataFimISO)}`}
            infoDetails={<TooltipBody
              descricao={<p>Retrato do relacionamento: combina <strong>total de visitas</strong> com <strong>recência</strong> na REF.</p>}
              ctx={{ inicio: filters.dataInicioISO, fim: filters.dataFimISO, janela: filters.janelaDias, badge: ((cfg as any)?.base_perfil ?? 'S') as BaseType, meses, universoTotal: baseDistTotal }}
              extra={<div className="space-y-0.5">
                <p><span className="text-emerald-400">Fiel:</span> ≥{cfg?.perfil_fiel_min_visitas ?? 12}v E ≤{cfg?.perfil_fiel_max_dias ?? 45}d</p>
                <p><span className="text-blue-400">Recorrente:</span> ≥{cfg?.perfil_recorrente_min_visitas ?? 6}v E ≤{cfg?.perfil_recorrente_max_dias ?? 60}d</p>
                <p><span className="text-cyan-400">Regular:</span> ≥{cfg?.perfil_regular_min_visitas ?? 3}v E ≤{cfg?.perfil_regular_max_dias ?? 90}d</p>
                <p className="text-muted-foreground">Config → Seção 3 para editar thresholds.</p>
              </div>}
            />}
            items={data?.distribuicoes?.por_perfil_tipo || []} labelKey="perfil" drillTipo="PERFIL" onDrill={handleDrill}
          />

          <DistCard
            title="Por Cadência" subtitle={`Dias sem vir · recorrentes · REF: ${fmtD(filters.dataFimISO)}`}
            badge={((cfg as any)?.base_cadencia ?? 'S') as BaseType} meses={meses}
            universoTotal={cadenciaRecorr.reduce((s, i) => s + i.qtd, 0) || null} loading={loading}
            infoTitle="Cadência Fixa"
            infoShort={`Recorrentes (2+ visitas) por faixas de dias · ${fmtD(filters.dataFimISO)}`}
            infoDetails={<TooltipBody
              descricao={<p>Clientes com <strong>2+ visitas</strong> por dias sem vir. One-shots no card ao lado.</p>}
              ctx={{ inicio: filters.dataInicioISO, fim: filters.dataFimISO, janela: filters.janelaDias, badge: ((cfg as any)?.base_cadencia ?? 'S') as BaseType, meses, universoTotal: cadenciaRecorr.reduce((s, i) => s + i.qtd, 0) }}
              extra={<p className="text-muted-foreground">Análise detalhada na aba Cadência. Labels editáveis em Config → Seção 4.</p>}
            />}
            items={cadenciaRecorr} labelKey="status" drillTipo="CADENCIA" onDrill={handleDrill}
          />

          <DistCard
            title={`Status ${meses}m`} subtitle={statusSubtitle}
            badge={bases.status12m} meses={meses} universoTotal={baseDistTotal} loading={loading}
            infoTitle={`Status ${meses}m — Saúde por Recência`}
            infoShort={`Recência pura · ${statusSubtitle} · REF: ${fmtD(filters.dataFimISO)}`}
            infoDetails={<TooltipBody
              descricao={<p>Classificação baseada <strong>apenas em recência</strong> (dias desde última visita).</p>}
              ctx={{ inicio: filters.dataInicioISO, fim: filters.dataFimISO, janela: filters.janelaDias, badge: bases.status12m, meses, universoTotal: baseDistTotal,
                regra: `Saudável ≤${thresholds.risco_min_dias}d · Em Risco ${thresholds.risco_min_dias + 1}–${thresholds.risco_max_dias}d · Perdido >${thresholds.risco_max_dias}d`,
                interpretacao: '"Perdido" aqui é por recência, não definitivo. Configure em Config → Seção 5.'
              }}
            />}
            items={data?.distribuicoes?.por_macro || []} labelKey="macro" drillTipo="MACRO" onDrill={handleDrill}
          />

          <OneShotCard
            items={cadenciaOneShot} loading={loading}
            cfg={{ one_shot_aguardando_max_dias: thresholds.one_shot_aguardando_max_dias, one_shot_risco_max_dias: thresholds.one_shot_risco_max_dias }}
            meses={meses} filters={filters} onDrill={handleDrill} onTabChange={onTabChange}
          />
        </div>
      </div>

      {/* 6. Cadência Individual */}
      <CadenciaIndividualMini
        cadenciaData={cadenciaData} cadenciaLoading={cadenciaLoading}
        cfg={cfg ?? {}} labels={cadenciaLabels} filters={filters} meses={meses} onTabChange={onTabChange} onDrill={handleDrill}
      />

      {/* 7. Novos do período */}
      <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
          <div className="h-6 w-6 rounded-lg bg-primary/10 border border-border/30 flex items-center justify-center shrink-0">
            <UserPlus className="h-3 w-3 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-foreground">Clientes Novos no período</p>
            <p className="text-[9px] text-muted-foreground">
              1ª visita histórica em {fmtD(filters.dataInicioISO)} – {fmtD(filters.dataFimISO)}
            </p>
          </div>
          <InfoIconTooltip
            title="Clientes Novos no período"
            short="Primeira visita histórica dentro do período selecionado."
            details={<div className="space-y-1.5 text-[10px]">
              <p>Clientes cuja <strong>primeira visita em toda a história</strong> ocorreu no período selecionado. Indica aquisição.</p>
              <p className="text-amber-400">Atenção: muitos novos sem crescimento de ativos = porta giratória — cliente entra e sai sem fidelizar.</p>
              <p className="text-muted-foreground">Para análise de retenção dos novos (M1, M3, M6), acesse a aba Cohort.</p>
            </div>}
          />
          <button type="button" onClick={() => onTabChange('cohort')}
            className="flex items-center gap-1 text-[9px] text-blue-400 hover:text-blue-300 transition-colors shrink-0 ml-1">
            Ver retenção <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total novos</p>
            {loading ? <div className="h-7 w-16 animate-pulse bg-muted rounded" /> :
              <p className="text-xl font-bold text-blue-400 tabular-nums">{fmtN(novos)}</p>}
            <p className="text-[9px] text-muted-foreground">{unicos > 0 ? `${pct(novos, unicos)}% dos atendidos` : '—'}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Recorrentes</p>
            {loading ? <div className="h-7 w-16 animate-pulse bg-muted rounded" /> : (() => {
              const perfilDist = data?.distribuicoes?.por_perfil_tipo || [];
              const oneShotCount = perfilDist.find((i: any) => i.perfil === 'ONE_SHOT')?.qtd ?? 0;
              const recorr = novos > 0 ? Math.max(0, novos - oneShotCount) : 0;
              return (
                <>
                  <p className="text-xl font-bold text-emerald-400 tabular-nums">{fmtN(recorr)}</p>
                  <p className="text-[9px] text-muted-foreground">{novos > 0 ? `${pct(recorr, novos)}% voltaram` : '—'}</p>
                </>
              );
            })()}
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">One-shot</p>
            {loading ? <div className="h-7 w-16 animate-pulse bg-muted rounded" /> : (() => {
              const perfilDist = data?.distribuicoes?.por_perfil_tipo || [];
              const oneShotCount = perfilDist.find((i: any) => i.perfil === 'ONE_SHOT')?.qtd ?? 0;
              return (
                <>
                  <p className="text-xl font-bold text-violet-400 tabular-nums">{fmtN(oneShotCount)}</p>
                  <p className="text-[9px] text-muted-foreground">{novos > 0 ? `${pct(oneShotCount, novos)}% só 1 visita` : '—'}</p>
                </>
              );
            })()}
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Saúde aquisição</p>
            {loading ? <div className="h-7 w-16 animate-pulse bg-muted rounded" /> : (() => {
              const ratio = unicos > 0 ? pct(novos, unicos) : 0;
              const label = ratio > 40 ? 'Alta · ver fidelização' : ratio > 20 ? 'Saudável' : 'Baixa · avaliar marketing';
              const color = ratio > 40 ? 'text-amber-400' : ratio > 20 ? 'text-emerald-400' : 'text-rose-400';
              return (
                <>
                  <p className={`text-[11px] font-bold tabular-nums ${color}`}>{ratio}%</p>
                  <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* C. Tendências — Bloco C: Movimento da base (gráfico interativo) */}
      {churnEvolucaoLoading && !churnEvolucaoData?.series && (
        <SectionSkeleton title="Movimento da base" />
      )}
      {churnEvolucaoData?.series && churnEvolucaoData.series.length > 0 && (
        <BlocoTamanhoBase
          serie={churnEvolucaoData.series}
          loading={false}
          filters={filters}
          thresholds={thresholds}
          onTabChange={onTabChange}
        />
      )}

      {/* D. Entradas na base — novos + resgatados por mês */}
      {churnEvolucaoLoading && !churnEvolucaoData?.series && (
        <SectionSkeleton title="Entradas na base" />
      )}
      {churnEvolucaoData?.series && churnEvolucaoData.series.length > 0 && (
        <BlocoSaldoBase
          serie={churnEvolucaoData.series}
          loading={false}
          thresholds={thresholds}
          onTabChange={onTabChange}
        />
      )}

      {/* E. Risco & Retenção — em risco + churn por mês */}
      {churnEvolucaoLoading && !churnEvolucaoData?.series && (
        <SectionSkeleton title="Risco & Retenção" />
      )}
      {churnEvolucaoData?.series && churnEvolucaoData.series.length > 0 && (
        <BlocoRiscoRetencao
          serie={churnEvolucaoData.series}
          loading={false}
          thresholds={thresholds}
          onTabChange={onTabChange}
        />
      )}

      {/* F. Saúde por barbeiro */}
      {cadenciaLoading && !cadenciaData?.por_barbeiro && (
        <SectionSkeleton title="Saúde por barbeiro" />
      )}
      {cadenciaData?.por_barbeiro && cadenciaData.por_barbeiro.length > 0 && (
        <BlocoBarbeiros
          porBarbeiro={cadenciaData.por_barbeiro}
          loading={cadenciaLoading ?? false}
          onTabChange={onTabChange}
          raioxConfig={raioxConfig}
          onDrill={handleDrill}
          filters={filters}
        />
      )}

      {/* C.2 Novos clientes (mensal) — tendência de aquisição */}
      <Card className="border-border/40 min-w-0 overflow-hidden">
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            Novos clientes (mensal)
            <InfoIconTooltip title="Tendência: Novos clientes" short="Primeiras visitas históricas por mês."
              details={<TooltipBody descricao={<p>Clientes cuja <strong>primeira visita histórica</strong> foi naquele mês. Pico sem crescimento de ativos = porta giratória.</p>}
                ctx={{ inicio: filters.dataInicioISO, fim: filters.dataFimISO, janela: filters.janelaDias, badge: 'P', meses,
                  interpretacao: 'Aquisição saudável: novos crescendo proporcionalmente aos ativos totais.' }} />}
            />
            <button type="button" onClick={() => onTabChange('cohort')}
              className="ml-auto flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-primary transition-colors">
              Ver retenção <ChevronRight className="h-3 w-3" />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {loading ? <div className="h-28 animate-pulse bg-muted rounded-md" /> :
            <TrendChart data={data?.tendencias?.novos_clientes_mensal || []} color="hsl(142, 71%, 45%)" />}
        </CardContent>
      </Card>

      {/* 7. Alerta de dados */}
      {data?.alerts && data.alerts.registros_sem_cliente_id > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-foreground">
                <strong>{fmtN(data.alerts.registros_sem_cliente_id)}</strong> registros sem cliente_id ({data.alerts.pct_registros_sem_cliente_id}%) ignorados.
              </p>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto shrink-0 text-xs border-amber-500/30" onClick={() => onTabChange('diagnostico')}>
              Ver Diagnóstico <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 8. Atalhos para análises profundas */}
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium px-0.5 mb-1.5 section-header-line">Explorar em profundidade</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
          {SHORTCUTS.map((s) => (
            <button key={s.tab} type="button" onClick={() => onTabChange(s.tab)}
              className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:border-primary/40 hover:bg-primary/5 hover:scale-[1.02] hover:shadow-gold active:scale-95 transition-all duration-200 p-2.5 flex flex-col items-center text-center gap-1.5">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-[10px] font-semibold text-foreground">{s.label}</span>
              <span className="text-[9px] text-muted-foreground">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <RaioXDrillSheet open={drillOpen} onClose={() => setDrillOpen(false)} request={drillReq} filters={filters} />
    </div>
  );
}

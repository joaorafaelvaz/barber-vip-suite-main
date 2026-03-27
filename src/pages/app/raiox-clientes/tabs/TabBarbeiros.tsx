import React, { useState, useEffect, useMemo } from 'react';
import { HelpBox } from '@/components/raiox-shared';
import { SegmentedToggle } from '@/components/raiox-shared/SegmentedToggle';
import { HowToReadSection } from '@/components/help';
import { InfoIconTooltip } from '@/components/help/InfoIconTooltip';
import { KpiCard } from '@/components/raiox-shared/KpiCard';
import { Loader2, RefreshCw, Users, TrendingDown, TrendingUp, Minus, UserCheck, UserMinus, Activity, Info, BookOpen, Settings2, BarChart3, AlertTriangle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  ClientesBarbeirosVisaoGeral,
  ClientesDrillDialog,
  type DrillDialogState,
} from '@/components/clientes';
import { useClientes } from '@/hooks/useClientes';
import { useClientesNovos } from '@/hooks/useClientesNovos';
import type { RaioXComputedFilters } from '../raioxTypes';
import type { RaioxConfigInstance } from '../RaioXClientesTabs';
import type { ChurnEvolucaoBarbeiroData, ChurnEvolucaoBarbeiroItem } from '@/hooks/raiox-clientes/useRaioXClientesChurnEvolucaoBarbeiro';
import type { OverviewData } from '@/hooks/raiox-clientes/useRaioXClientesOverview';
import {
  ResponsiveContainer, ComposedChart, Line, Bar, BarChart, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine, Cell,
} from 'recharts';

interface Props {
  filters: RaioXComputedFilters;
  raioxConfig: RaioxConfigInstance;
  churnEvolucaoBarbeiroData?: ChurnEvolucaoBarbeiroData | null;
  churnEvolucaoBarbeiroLoading?: boolean;
  overviewData?: OverviewData | null;
}

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

type MetricKey = 'churn_pct' | 'base_ativa' | 'perdidos' | 'atendidos_mes' | 'resgatados';

const METRIC_OPTIONS: { value: MetricKey; label: string; suffix: string }[] = [
  { value: 'churn_pct', label: 'Churn %', suffix: '%' },
  { value: 'base_ativa', label: 'Base Ativa', suffix: '' },
  { value: 'perdidos', label: 'Perdidos', suffix: '' },
  { value: 'atendidos_mes', label: 'Atendidos', suffix: '' },
  { value: 'resgatados', label: 'Resgatados', suffix: '' },
];

const VIEW_OPTIONS = [
  { value: 'resumo', label: 'Resumo' },
  { value: 'evolucao', label: 'Evolução' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'saude', label: 'Saúde' },
];

function fmtD(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

function fmtNum(n: number, suffix: string) {
  if (suffix === '%') return `${n.toFixed(1)}%`;
  return n.toLocaleString('pt-BR');
}

function churnColor(pct: number) {
  if (pct < 5) return 'text-emerald-500';
  if (pct <= 10) return 'text-yellow-500';
  return 'text-destructive';
}

function churnBg(pct: number) {
  if (pct < 5) return 'bg-emerald-500/10';
  if (pct <= 10) return 'bg-yellow-500/10';
  return 'bg-destructive/10';
}

interface BarberTooltipRow {
  id: string; nome: string; value: number;
  base_ativa: number; atendidos_mes: number;
  churn_pct: number; churn_fidelizados_pct: number;
  perdidos: number; perdidos_fidelizados: number;
  resgatados: number; em_risco: number;
}

function BarberChartTooltip({ active, payload, barChartData, barChartMetric, barChartAvg, churnDias }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as BarberTooltipRow;
  const rank = barChartData.findIndex((b: BarberTooltipRow) => b.id === d.id) + 1;
  const total = barChartData.length;
  const metricInfo = METRIC_OPTIONS.find(m => m.value === barChartMetric)!;
  const diff = d.value - barChartAvg;
  const diffSign = diff > 0 ? '+' : '';
  const diffLabel = metricInfo.suffix === '%' ? `${diffSign}${diff.toFixed(1)}pp` : `${diffSign}${diff.toFixed(0)}`;
  // For churn, lower is better
  const isLowerBetter = barChartMetric === 'churn_pct' || barChartMetric === 'perdidos';
  const diffColor = isLowerBetter
    ? (diff < 0 ? 'text-emerald-500' : diff > 0 ? 'text-destructive' : 'text-muted-foreground')
    : (diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-destructive' : 'text-muted-foreground');

  const metrics: { key: MetricKey; label: string; value: string; highlight?: boolean; colorClass?: string; bgClass?: string }[] = [
    { key: 'base_ativa', label: 'Base Ativa', value: d.base_ativa.toLocaleString('pt-BR') },
    { key: 'atendidos_mes', label: 'Atendidos', value: d.atendidos_mes.toLocaleString('pt-BR') },
    { key: 'churn_pct', label: 'Churn %', value: `${d.churn_pct.toFixed(1)}%`, colorClass: churnColor(d.churn_pct), bgClass: churnBg(d.churn_pct) },
    { key: 'churn_pct' as MetricKey, label: 'Churn Fidel.', value: `${d.churn_fidelizados_pct.toFixed(1)}%`, colorClass: churnColor(d.churn_fidelizados_pct), bgClass: churnBg(d.churn_fidelizados_pct) },
    { key: 'perdidos', label: 'Perdidos', value: d.perdidos.toLocaleString('pt-BR') },
    { key: 'resgatados', label: 'Resgatados', value: d.resgatados.toLocaleString('pt-BR') },
  ];

  return (
    <div className="bg-popover border border-border rounded-lg shadow-xl p-2.5 min-w-[200px] max-w-[260px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-bold text-foreground truncate">{d.nome}</span>
        <span className="text-[10px] font-medium text-muted-foreground shrink-0">{rank}º de {total}</span>
      </div>
      <div className="h-px bg-border/50 mb-1.5" />

      {/* Metrics grid */}
      <div className="space-y-0.5">
        {metrics.map((m, i) => {
          const isActive = m.key === barChartMetric || (m.label === 'Churn Fidel.' && barChartMetric === 'churn_pct');
          return (
            <div key={i} className={`flex items-center justify-between text-[10px] px-1 py-0.5 rounded ${isActive ? 'bg-primary/10 font-semibold' : ''}`}>
              <span className="text-muted-foreground">{m.label}</span>
              <span className={`font-mono tabular-nums ${m.colorClass || 'text-foreground'}`}>
                {m.value}
              </span>
            </div>
          );
        })}
        {/* Em Risco */}
        <div className="flex items-center justify-between text-[10px] px-1 py-0.5 rounded">
          <span className="text-muted-foreground">Em Risco</span>
          <span className={`font-mono tabular-nums ${d.em_risco > 0 ? 'text-orange-500' : 'text-foreground'}`}>
            {d.em_risco.toLocaleString('pt-BR')}
          </span>
        </div>
      </div>

      {/* Comparison vs average */}
      <div className="h-px bg-border/50 mt-1.5 mb-1" />
      <div className="text-[10px] px-1 flex items-center justify-between">
        <span className="text-muted-foreground">vs média ({metricInfo.label})</span>
        <span className={`font-mono font-semibold tabular-nums ${diffColor}`}>
          {diffLabel}
        </span>
      </div>
    </div>
  );
}

/* ─── Rich Info Sheet for Comparativo ─── */
function BarberInfoSheet({ open, onOpenChange, atribuicaoLabel, cfg }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atribuicaoLabel: string;
  cfg: { churn_dias_sem_voltar: number; risco_min_dias: number; risco_max_dias: number; base_mode: string; base_corte_meses: number; atribuicao_modo: string; atribuicao_janela_meses: number; cadencia_min_visitas: number; resgate_dias_minimos: number };
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <SheetTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Comparativo por Barbeiro
          </SheetTitle>
          <SheetDescription className="text-[11px]">
            Métricas, interpretação e parâmetros do gráfico
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="metricas" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-3 h-8 w-auto justify-start">
            <TabsTrigger value="metricas" className="text-[11px] gap-1"><BarChart3 className="h-3 w-3" />Métricas</TabsTrigger>
            <TabsTrigger value="interpretar" className="text-[11px] gap-1"><BookOpen className="h-3 w-3" />Interpretar</TabsTrigger>
            <TabsTrigger value="config" className="text-[11px] gap-1"><Settings2 className="h-3 w-3" />Config</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-4 pb-4">
            {/* ── Métricas ── */}
            <TabsContent value="metricas" className="mt-3 space-y-3">
              <MetricCard
                icon={<Users className="h-3.5 w-3.5 text-primary" />}
                title="Base Ativa"
                formula="Clientes com visita dentro do limiar de churn"
                description={`Clientes atribuídos ao barbeiro que visitaram nos últimos ${cfg.churn_dias_sem_voltar} dias. Quanto maior, mais responsabilidade de retenção.`}
                benchmark={null}
              />
              <MetricCard
                icon={<Activity className="h-3.5 w-3.5 text-primary" />}
                title="Atendidos"
                formula="Clientes únicos atendidos no mês"
                description="Contagem de clientes distintos atendidos no período. Mesmo cliente atendido 2× conta 1×."
                benchmark={null}
              />
              <MetricCard
                icon={<TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                title="Churn %"
                formula="Perdidos ÷ Base Ativa × 100"
                description="Taxa de perda de clientes. Quanto menor, melhor a retenção do barbeiro."
                benchmark={{ green: '< 5%', yellow: '5–10%', red: '> 10%' }}
              />
              <MetricCard
                icon={<TrendingDown className="h-3.5 w-3.5 text-orange-500" />}
                title="Churn Fidelizados"
                formula="Perdidos Fidel. ÷ Base Fidel. × 100"
                description="Churn apenas entre clientes com 2+ visitas. É a métrica mais relevante — exclui clientes de passagem."
                benchmark={{ green: '< 3%', yellow: '3–7%', red: '> 7%' }}
              />
              <MetricCard
                icon={<UserMinus className="h-3.5 w-3.5 text-destructive" />}
                title="Perdidos"
                formula={`Sem visita há > ${cfg.churn_dias_sem_voltar} dias`}
                description="Volume absoluto de clientes perdidos. Compare com a base para dimensionar o impacto real."
                benchmark={null}
              />
              <MetricCard
                icon={<UserCheck className="h-3.5 w-3.5 text-emerald-500" />}
                title="Resgatados"
                formula={`Perdido que retornou (ausência ≥ ${cfg.resgate_dias_minimos}d)`}
                description="Clientes perdidos que voltaram. Sinal positivo de recuperação. Compare resgatados vs perdidos para avaliar saldo líquido."
                benchmark={null}
              />
              <MetricCard
                icon={<AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                title="Em Risco"
                formula={`Entre ${cfg.risco_min_dias}d e ${cfg.risco_max_dias}d sem voltar`}
                description="Clientes que podem se tornar perdidos em breve. Priorize ações de retenção neste grupo."
                benchmark={null}
              />
            </TabsContent>

            {/* ── Como Interpretar ── */}
            <TabsContent value="interpretar" className="mt-3 space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground">📊 Leitura do Gráfico</h4>
                <ul className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
                  <li>• Cada <strong className="text-foreground">barra</strong> representa um barbeiro, ordenados do maior para o menor valor da métrica selecionada.</li>
                  <li>• O <strong className="text-foreground">tooltip</strong> mostra todas as métricas do barbeiro e a comparação com a média da unidade.</li>
                  <li>• Use o <strong className="text-foreground">toggle de métricas</strong> acima do gráfico para alternar entre indicadores.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground">🎯 Como Comparar</h4>
                <ul className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
                  <li>• <strong className="text-foreground">Base Ativa alta + Churn baixo</strong> = barbeiro retém bem seus clientes.</li>
                  <li>• <strong className="text-foreground">Base Ativa alta + Churn alto</strong> = muitos clientes mas perdendo rápido. Requer atenção.</li>
                  <li>• <strong className="text-foreground">Resgatados alto</strong> = barbeiro com bom poder de reconquista.</li>
                  <li>• <strong className="text-foreground">Em Risco alto</strong> = clientes na "zona de perigo". Ação de CRM recomendada.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground">⚠ Cuidados</h4>
                <ul className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
                  <li>• Barbeiros com <strong className="text-foreground">base pequena</strong> podem ter churn % distorcido (1 cliente perdido = 50% de churn em base de 2).</li>
                  <li>• A <strong className="text-foreground">atribuição</strong> define como o cliente é vinculado ao barbeiro. Modo atual: <em>{atribuicaoLabel}</em>.</li>
                  <li>• Cliente atendido por <strong className="text-foreground">múltiplos barbeiros</strong> pode aparecer na base de mais de um, dependendo do modo de atribuição.</li>
                </ul>
              </div>
            </TabsContent>

            {/* ── Configuração ── */}
            <TabsContent value="config" className="mt-3 space-y-3">
              <p className="text-[11px] text-muted-foreground">Parâmetros ativos que influenciam os números exibidos. Altere em <strong className="text-foreground">Config → Seção 8</strong>.</p>

              <div className="space-y-2">
                <ConfigRow label="Limiar de Churn" value={`${cfg.churn_dias_sem_voltar} dias`} description="Dias sem visita para considerar perdido" />
                <ConfigRow label="Faixa de Risco" value={`${cfg.risco_min_dias}d – ${cfg.risco_max_dias}d`} description="Intervalo antes de virar perdido" />
                <ConfigRow label="Atribuição" value={cfg.atribuicao_modo} description="Como o cliente é vinculado ao barbeiro" />
                <ConfigRow label="Janela Atribuição" value={`${cfg.atribuicao_janela_meses} meses`} description="Período analisado para definir atribuição" />
                <ConfigRow label="Base Mode" value={cfg.base_mode} description="Modo de cálculo da base ativa" />
                <ConfigRow label="Corte Base" value={`${cfg.base_corte_meses} meses`} description="Meses para corte da base" />
                <ConfigRow label="Cadência Min." value={`${cfg.cadencia_min_visitas} visitas`} description="Mínimo de visitas para calcular cadência" />
                <ConfigRow label="Resgate Min." value={`${cfg.resgate_dias_minimos} dias`} description="Dias mínimos de ausência para contar como resgate" />
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function MetricCard({ icon, title, formula, description, benchmark }: {
  icon: React.ReactNode;
  title: string;
  formula: string;
  description: string;
  benchmark: { green: string; yellow: string; red: string } | null;
}) {
  return (
    <Card className="border-border/40">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold text-foreground">{title}</span>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground bg-muted/40 rounded px-2 py-1">{formula}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
        {benchmark && (
          <div className="flex items-center gap-2 text-[10px] font-medium pt-0.5">
            <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">🟢 {benchmark.green}</span>
            <span className="text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">🟡 {benchmark.yellow}</span>
            <span className="text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">🔴 {benchmark.red}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfigRow({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 px-3 rounded-lg bg-muted/30 border border-border/30">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <span className="text-[11px] font-mono font-semibold text-primary shrink-0">{value}</span>
    </div>
  );
}

// ─── Evolution Tooltip ─────────────────────────────────────────────────────
function EvolutionTooltip({ active, payload, label, rawData }: {
  active?: boolean; payload?: any[]; label?: string;
  rawData: ChurnEvolucaoBarbeiroItem[];
}) {
  if (!active || !payload?.length || !label) return null;

  const barberId = payload[0]?.dataKey;
  const monthData = rawData.find(item =>
    (item.ano_mes_label === label || item.ano_mes === label) && item.colaborador_id === barberId
  );
  if (!monthData) return null;

  const sameMonthData = rawData.filter(item => item.ano_mes_label === label || item.ano_mes === label);
  const teamAvgChurn = sameMonthData.length > 0
    ? sameMonthData.reduce((sum, item) => sum + item.churn_pct, 0) / sameMonthData.length
    : 0;

  const saldo = monthData.resgatados - monthData.perdidos;
  const vsAvg = monthData.churn_pct - teamAvgChurn;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-xl p-3 text-xs min-w-52 max-w-64">
      <div className="font-semibold text-foreground mb-0.5 truncate">{monthData.colaborador_nome}</div>
      <div className="text-[10px] text-muted-foreground mb-2">{label}</div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base Ativa:</span>
          <span className="font-medium">{monthData.base_ativa.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Atendidos:</span>
          <span className="font-medium">{monthData.atendidos_mes.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Churn %:</span>
          <span className={`font-medium ${monthData.churn_pct > teamAvgChurn * 1.2 ? 'text-destructive' : monthData.churn_pct < teamAvgChurn * 0.8 ? 'text-emerald-600' : 'text-foreground'}`}>
            {monthData.churn_pct.toFixed(1)}%
            <span className={`ml-1 text-[9px] ${vsAvg > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
              ({vsAvg > 0 ? '+' : ''}{vsAvg.toFixed(1)}pp vs equipe)
            </span>
          </span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground ml-2">Fidel. Churn:</span>
          <span>{monthData.churn_fidelizados_pct.toFixed(1)}%</span>
        </div>
        <div className="h-px bg-border/50 my-1" />
        <div className="flex justify-between">
          <span className="text-muted-foreground">Perdidos:</span>
          <span className="font-medium text-destructive">{monthData.perdidos}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground ml-2">Fidelizados:</span>
          <span>{monthData.perdidos_fidelizados}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground ml-2">One-shot:</span>
          <span>{monthData.perdidos_oneshot}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Resgatados:</span>
          <span className="font-medium text-emerald-600">{monthData.resgatados}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Em Risco:</span>
          <span className="font-medium text-amber-600">{monthData.em_risco}</span>
        </div>
        <div className="h-px bg-border/50 my-1" />
        <div className="flex justify-between font-semibold">
          <span className="text-muted-foreground">Saldo Líquido:</span>
          <span className={saldo > 0 ? 'text-emerald-600' : saldo < 0 ? 'text-destructive' : 'text-foreground'}>
            {saldo > 0 ? '+' : ''}{saldo}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Cards for Period ──────────────────────────────────────────────────
function EvolutionKpis({ data, visibleBarbers }: {
  data: ChurnEvolucaoBarbeiroItem[];
  visibleBarbers: Set<string>;
}) {
  const kpis = useMemo(() => {
    const filtered = data.filter(item => visibleBarbers.has(item.colaborador_id));
    if (filtered.length === 0) return null;

    const months = new Set(filtered.map(item => item.ano_mes));
    const nMonths = months.size || 1;

    const churnMedia = filtered.reduce((sum, item) => sum + item.churn_pct, 0) / filtered.length;
    const baseMedia = filtered.reduce((sum, item) => sum + item.base_ativa, 0) / filtered.length;
    const perdidosPorMes = filtered.reduce((sum, item) => sum + item.perdidos, 0) / nMonths;
    const resgatadosPorMes = filtered.reduce((sum, item) => sum + item.resgatados, 0) / nMonths;
    const emRiscoMedio = filtered.reduce((sum, item) => sum + item.em_risco, 0) / filtered.length;
    const saldoLiquido = Math.round(resgatadosPorMes - perdidosPorMes);

    return {
      churnMedia: churnMedia.toFixed(1),
      baseMedia: Math.round(baseMedia).toLocaleString('pt-BR'),
      perdidosPorMes: perdidosPorMes.toFixed(1),
      resgatadosPorMes: resgatadosPorMes.toFixed(1),
      emRiscoMedio: Math.round(emRiscoMedio).toLocaleString('pt-BR'),
      saldoLiquido,
    };
  }, [data, visibleBarbers]);

  if (!kpis) return null;
  const churnVal = parseFloat(kpis.churnMedia);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <KpiCard label="Churn Médio" value={`${kpis.churnMedia}%`}
        status={churnVal > 15 ? 'negative' : churnVal > 10 ? 'warning' : 'positive'} />
      <KpiCard label="Base Média" value={kpis.baseMedia} status="neutral" />
      <KpiCard label="Perdidos/Mês" value={kpis.perdidosPorMes} status="negative" />
      <KpiCard label="Resgatados/Mês" value={kpis.resgatadosPorMes} status="positive" />
      <KpiCard label="Em Risco Médio" value={kpis.emRiscoMedio} status="warning" />
      <KpiCard label="Saldo Líquido" value={`${kpis.saldoLiquido > 0 ? '+' : ''}${kpis.saldoLiquido}`}
        status={kpis.saldoLiquido > 0 ? 'positive' : kpis.saldoLiquido < 0 ? 'negative' : 'neutral'} />
    </div>
  );
}

// ─── Monthly Details Table ─────────────────────────────────────────────────
function EvolutionMonthlyTable({ data, visibleBarbers }: {
  data: ChurnEvolucaoBarbeiroItem[];
  visibleBarbers: Set<string>;
}) {
  const [open, setOpen] = useState(false);

  const monthlyData = useMemo(() => {
    const filtered = data.filter(item => visibleBarbers.has(item.colaborador_id));
    if (!filtered.length) return [];

    const monthGroups = filtered.reduce((acc, item) => {
      const key = item.ano_mes;
      if (!acc[key]) acc[key] = { label: item.ano_mes_label || item.ano_mes, items: [] };
      acc[key].items.push(item);
      return acc;
    }, {} as Record<string, { label: string; items: ChurnEvolucaoBarbeiroItem[] }>);

    const months = Object.keys(monthGroups).sort();

    return months.map((month, idx) => {
      const { label, items } = monthGroups[month];
      const baseAtiva = items.reduce((s, i) => s + i.base_ativa, 0);
      const perdidos = items.reduce((s, i) => s + i.perdidos, 0);
      const resgatados = items.reduce((s, i) => s + i.resgatados, 0);
      const emRisco = items.reduce((s, i) => s + i.em_risco, 0);
      const atendidos = items.reduce((s, i) => s + i.atendidos_mes, 0);
      const churnPct = items.reduce((s, i) => s + i.churn_pct, 0) / items.length;

      let deltaChurn: number | null = null;
      let deltaPerdidos: number | null = null;
      let deltaResgatados: number | null = null;

      if (idx > 0) {
        const prevMonth = months[idx - 1];
        const prevItems = monthGroups[prevMonth].items;
        const prevChurn = prevItems.reduce((s, i) => s + i.churn_pct, 0) / prevItems.length;
        deltaChurn = churnPct - prevChurn;
        deltaPerdidos = perdidos - prevItems.reduce((s, i) => s + i.perdidos, 0);
        deltaResgatados = resgatados - prevItems.reduce((s, i) => s + i.resgatados, 0);
      }

      return { label, baseAtiva, perdidos, resgatados, emRisco, atendidos, churnPct, saldo: resgatados - perdidos, deltaChurn, deltaPerdidos, deltaResgatados, isHighChurn: churnPct > 15 };
    });
  }, [data, visibleBarbers]);

  if (!monthlyData.length) return null;

  const DeltaCell = ({ value, suffix = '', invertColor = false }: { value: number | null; suffix?: string; invertColor?: boolean }) => {
    if (value === null) return <span className="text-muted-foreground text-[10px]">—</span>;
    const isPositive = invertColor ? value < 0 : value > 0;
    const isNegative = invertColor ? value > 0 : value < 0;
    const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] ${isNegative ? 'text-emerald-600' : isPositive ? 'text-destructive' : 'text-muted-foreground'}`}>
        <Icon className="h-2.5 w-2.5" />
        {Math.abs(suffix === '%' ? parseFloat(value.toFixed(1)) : value).toFixed(suffix === '%' ? 1 : 0)}{suffix}
      </span>
    );
  };

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/40 transition-colors text-left rounded-lg">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Detalhes mensais</span>
              <span className="text-[10px] text-muted-foreground">({monthlyData.length} meses)</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Mês</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Base Ativa</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Atendidos</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Churn %</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Δ Churn</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Perdidos</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Δ Perdidos</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Resgatados</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Δ Resgatados</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Em Risco</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row) => (
                  <tr key={row.label} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${row.isHighChurn ? 'bg-destructive/5' : ''}`}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{row.label}</td>
                    <td className="text-right px-2 py-2">{row.baseAtiva.toLocaleString('pt-BR')}</td>
                    <td className="text-right px-2 py-2">{row.atendidos.toLocaleString('pt-BR')}</td>
                    <td className={`text-right px-2 py-2 font-medium ${row.isHighChurn ? 'text-destructive' : row.churnPct < 10 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {row.churnPct.toFixed(1)}%
                    </td>
                    <td className="text-right px-2 py-2"><DeltaCell value={row.deltaChurn} suffix="%" invertColor /></td>
                    <td className="text-right px-2 py-2">{row.perdidos}</td>
                    <td className="text-right px-2 py-2"><DeltaCell value={row.deltaPerdidos} invertColor /></td>
                    <td className="text-right px-2 py-2">{row.resgatados}</td>
                    <td className="text-right px-2 py-2"><DeltaCell value={row.deltaResgatados} /></td>
                    <td className="text-right px-2 py-2 text-amber-600">{row.emRisco}</td>
                    <td className={`text-right px-3 py-2 font-semibold ${row.saldo > 0 ? 'text-emerald-600' : row.saldo < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {row.saldo > 0 ? '+' : ''}{row.saldo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ─── Automated Insights ────────────────────────────────────────────────────
function EvolutionInsight({ data, visibleBarbers, barbers }: {
  data: ChurnEvolucaoBarbeiroItem[];
  visibleBarbers: Set<string>;
  barbers: Array<{ id: string; nome: string }>;
}) {
  const insights = useMemo(() => {
    const filtered = data.filter(item => visibleBarbers.has(item.colaborador_id));
    if (filtered.length < 2) return null;

    const monthGroups = filtered.reduce((acc, item) => {
      const key = item.ano_mes_label || item.ano_mes;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, ChurnEvolucaoBarbeiroItem[]>);

    const monthStats = Object.entries(monthGroups).map(([month, items]) => ({
      month,
      avgChurn: items.reduce((sum, item) => sum + item.churn_pct, 0) / items.length,
    }));

    if (!monthStats.length) return null;

    const bestMonth = monthStats.reduce((a, b) => b.avgChurn < a.avgChurn ? b : a);
    const worstMonth = monthStats.reduce((a, b) => b.avgChurn > a.avgChurn ? b : a);

    // Most volatile barber
    const barberVariance = Array.from(visibleBarbers).map(bId => {
      const bData = filtered.filter(i => i.colaborador_id === bId);
      if (bData.length < 2) return { bId, variance: 0 };
      const mean = bData.reduce((s, i) => s + i.churn_pct, 0) / bData.length;
      const variance = bData.reduce((s, i) => s + Math.pow(i.churn_pct - mean, 2), 0) / bData.length;
      return { bId, variance };
    }).reduce((max, cur) => cur.variance > max.variance ? cur : max);

    const mostVolatileName = barbers.find(b => b.id === barberVariance.bId)?.nome;

    // Trend: compare first half vs second half
    const half = Math.ceil(monthStats.length / 2);
    const firstHalfAvg = monthStats.slice(0, half).reduce((s, m) => s + m.avgChurn, 0) / half;
    const secondHalfAvg = monthStats.slice(-half).reduce((s, m) => s + m.avgChurn, 0) / half;
    const diff = secondHalfAvg - firstHalfAvg;
    const trend = diff > 1 ? 'Piorando 📉' : diff < -1 ? 'Melhorando 📈' : 'Estável ↔';

    return { bestMonth, worstMonth, mostVolatileName, trend, diff };
  }, [data, visibleBarbers, barbers]);

  if (!insights) return null;

  return (
    <Card className="border-border/40 bg-muted/10">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">Insights do Período</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-[10px] text-muted-foreground leading-relaxed">
              <p>📉 <strong className="text-foreground">Pior mês:</strong> {insights.worstMonth.month} ({insights.worstMonth.avgChurn.toFixed(1)}% churn)</p>
              <p>📈 <strong className="text-foreground">Melhor mês:</strong> {insights.bestMonth.month} ({insights.bestMonth.avgChurn.toFixed(1)}% churn)</p>
              {insights.mostVolatileName && (
                <p>⚡ <strong className="text-foreground">Maior variação:</strong> {insights.mostVolatileName}</p>
              )}
              <p>📊 <strong className="text-foreground">Tendência:</strong> {insights.trend}
                {Math.abs(insights.diff) >= 1 && <span> ({insights.diff > 0 ? '+' : ''}{insights.diff.toFixed(1)}pp)</span>}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TabBarbeiros({ filters, raioxConfig, churnEvolucaoBarbeiroData, churnEvolucaoBarbeiroLoading, overviewData }: Props) {
  const [drillDialog, setDrillDialog] = useState<DrillDialogState>({ open: false, title: '', tipo: '', valor: '' });
  const [activeView, setActiveView] = useState('resumo');
  const [selectedBarber, setSelectedBarber] = useState<string>('__all__');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('churn_pct');
  const [barChartMetric, setBarChartMetric] = useState<MetricKey>('base_ativa');
  const [visibleBarbers, setVisibleBarbers] = useState<Set<string>>(new Set());
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);

  const clientes = useClientes();
  const novos = useClientesNovos();

  useEffect(() => {
    clientes.setDataInicio(filters.dataInicioISO);
    clientes.setDataFim(filters.dataFimISO);
  }, [filters.dataInicioISO, filters.dataFimISO]);

  useEffect(() => {
    novos.setDataInicio(filters.dataInicioISO);
    novos.setDataFim(filters.dataFimISO);
  }, [filters.dataInicioISO, filters.dataFimISO]);

  // Extract unique barbers from evolution data
  const barbers = useMemo(() => {
    if (!churnEvolucaoBarbeiroData?.series?.length) return [];
    const map = new Map<string, string>();
    for (const s of churnEvolucaoBarbeiroData.series) {
      if (s.atendidos_mes > 0 && s.colaborador_id) {
        map.set(s.colaborador_id, s.colaborador_nome);
      }
    }
    return Array.from(map, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [churnEvolucaoBarbeiroData]);

  // Init visible barbers
  useEffect(() => {
    if (barbers.length && visibleBarbers.size === 0) {
      setVisibleBarbers(new Set(barbers.map(b => b.id)));
    }
  }, [barbers]);

  // Chart data: pivot series into { ano_mes, [barberId]: value }
  const { chartData, avgValue } = useMemo(() => {
    if (!churnEvolucaoBarbeiroData?.series?.length) return { chartData: [], avgValue: 0 };
    const monthMap = new Map<string, Record<string, any>>();
    let total = 0, count = 0;
    for (const s of churnEvolucaoBarbeiroData.series) {
      if (!s.colaborador_id || s.atendidos_mes <= 0) continue;
      if (!monthMap.has(s.ano_mes)) monthMap.set(s.ano_mes, { ano_mes: s.ano_mes_label || s.ano_mes });
      const row = monthMap.get(s.ano_mes)!;
      row[s.colaborador_id] = s[selectedMetric];
      if (visibleBarbers.has(s.colaborador_id)) {
        total += s[selectedMetric];
        count++;
      }
    }
    const sorted = Array.from(monthMap.values()).sort((a, b) => (a.ano_mes as string) > (b.ano_mes as string) ? 1 : -1);
    return { chartData: sorted, avgValue: count > 0 ? total / count : 0 };
  }, [churnEvolucaoBarbeiroData, selectedMetric, visibleBarbers]);

  // KPI summaries from last month's data
  const kpiSummary = useMemo(() => {
    if (!churnEvolucaoBarbeiroData?.series?.length) return null;
    const months = [...new Set(churnEvolucaoBarbeiroData.series.map(s => s.ano_mes))].sort();
    const lastMonth = months[months.length - 1];
    const lastData = churnEvolucaoBarbeiroData.series.filter(
      s => s.ano_mes === lastMonth && s.atendidos_mes > 0
    );
    const filtered = selectedBarber === '__all__' ? lastData : lastData.filter(s => s.colaborador_id === selectedBarber);
    if (!filtered.length) return null;
    return {
      base_ativa: filtered.reduce((s, r) => s + r.base_ativa, 0),
      perdidos: filtered.reduce((s, r) => s + r.perdidos, 0),
      resgatados: filtered.reduce((s, r) => s + r.resgatados, 0),
      em_risco: filtered.reduce((s, r) => s + r.em_risco, 0),
      atendidos: filtered.reduce((s, r) => s + r.atendidos_mes, 0),
      churn_pct: filtered.length > 0
        ? filtered.reduce((s, r) => s + r.churn_pct, 0) / filtered.length
        : 0,
      churn_fidelizados_pct: filtered.length > 0
        ? filtered.reduce((s, r) => s + r.churn_fidelizados_pct, 0) / filtered.length
        : 0,
      count: filtered.length,
      monthLabel: filtered[0]?.ano_mes_label || lastMonth,
    };
  }, [churnEvolucaoBarbeiroData, selectedBarber]);

  // Bar chart data: one bar per barber for the selected metric (last month)
  const barChartData = useMemo(() => {
    if (!churnEvolucaoBarbeiroData?.series?.length) return [];
    const months = [...new Set(churnEvolucaoBarbeiroData.series.map(s => s.ano_mes))].sort();
    const lastMonth = months[months.length - 1];
    const lastData = churnEvolucaoBarbeiroData.series.filter(
      s => s.ano_mes === lastMonth && s.atendidos_mes > 0 && s.colaborador_id
    );
    return lastData
      .map(s => ({
        id: s.colaborador_id,
        nome: s.colaborador_nome,
        value: s[barChartMetric],
        base_ativa: s.base_ativa,
        atendidos_mes: s.atendidos_mes,
        churn_pct: s.churn_pct,
        churn_fidelizados_pct: s.churn_fidelizados_pct,
        perdidos: s.perdidos,
        perdidos_fidelizados: s.perdidos_fidelizados,
        resgatados: s.resgatados,
        em_risco: s.em_risco,
      }))
      .sort((a, b) => b.value - a.value);
  }, [churnEvolucaoBarbeiroData, barChartMetric]);

  // Average for comparison in tooltip
  const barChartAvg = useMemo(() => {
    if (!barChartData.length) return 0;
    return barChartData.reduce((s, d) => s + d.value, 0) / barChartData.length;
  }, [barChartData]);

  // Full details per barber for the "Detalhes" table
  const detailsTableData = useMemo(() => {
    if (!churnEvolucaoBarbeiroData?.series?.length) return [];
    const months = [...new Set(churnEvolucaoBarbeiroData.series.map(s => s.ano_mes))].sort();
    const lastMonth = months[months.length - 1];
    return churnEvolucaoBarbeiroData.series
      .filter(s => s.ano_mes === lastMonth && s.atendidos_mes > 0 && s.colaborador_id)
      .map(s => ({
        id: s.colaborador_id,
        nome: s.colaborador_nome,
        base_ativa: s.base_ativa,
        atendidos_mes: s.atendidos_mes,
        churn_pct: s.churn_pct,
        churn_fidelizados_pct: s.churn_fidelizados_pct,
        perdidos: s.perdidos,
        resgatados: s.resgatados,
        em_risco: s.em_risco,
      }))
      .sort((a, b) => b.base_ativa - a.base_ativa);
  }, [churnEvolucaoBarbeiroData]);

  const periodoLabel = `${fmtD(filters.dataInicioISO)} – ${fmtD(filters.dataFimISO)}`;
  const cfg = raioxConfig.config;
  const atribuicaoLabel =
    cfg.atribuicao_modo === 'MAIS_FREQUENTE' ? 'mais frequente' :
    cfg.atribuicao_modo === 'ULTIMO' ? 'último atendimento' :
    cfg.atribuicao_modo === 'MAIOR_FATURAMENTO' ? 'maior faturamento' : 'multi-barber';

  const metricInfo = METRIC_OPTIONS.find(m => m.value === selectedMetric)!;

  const toggleBarberVisibility = (id: string) => {
    setVisibleBarbers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openDrill = (tipo: string, valor: string, title: string, colaboradorId?: string) => {
    setDrillDialog({ open: true, title, tipo, valor, colaboradorId });
  };

  if (churnEvolucaoBarbeiroLoading && !churnEvolucaoBarbeiroData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Carregando dados por barbeiro...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 min-w-0 w-full overflow-x-hidden">
      {/* Header: filter + view toggle */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-border/40 bg-muted/15">
        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-[10px] text-muted-foreground"><strong className="text-foreground">Período:</strong> {periodoLabel}</span>

        <Select value={selectedBarber} onValueChange={setSelectedBarber}>
          <SelectTrigger className="h-7 w-[180px] text-xs">
            <SelectValue placeholder="Todos os barbeiros" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os barbeiros</SelectItem>
            {barbers.map(b => (
              <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SegmentedToggle options={VIEW_OPTIONS} value={activeView} onValueChange={setActiveView} />
      </div>

      <HowToReadSection
        bullets={[
          `Atribuição: ${atribuicaoLabel}. Altere em Config → Seção 8. Cliente multi-barbeiro pode aparecer em mais de um.`,
          'Resumo: KPIs do último mês. Churn Fidelizados = perda de recorrentes — métrica mais relevante.',
          'Evolução: linha de cada barbeiro. Tracejado = média do período. Passe o mouse sobre os pontos para detalhes.',
          'Ranking: segmentos de clientes por barbeiro. Clique em qualquer barbeiro para sua lista completa.',
          'Saúde: distribuição de status por barbeiro. Alto % de risco pode indicar problema de retenção.',
        ]}
      />

      {/* ===== RESUMO ===== */}
      {activeView === 'resumo' && (
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          <div className="space-y-3">
          {kpiSummary ? (
            <>
              <p className="text-xs text-muted-foreground px-1">
                Referência: <strong className="text-foreground">{kpiSummary.monthLabel}</strong>
                {selectedBarber !== '__all__' && (
                  <> — <strong className="text-foreground">{barbers.find(b => b.id === selectedBarber)?.nome}</strong></>
                )}
                {selectedBarber === '__all__' && <> — {kpiSummary.count} barbeiros</>}
              </p>
              {overviewData?.meta && (
                <p className="text-[10px] text-muted-foreground px-1 -mt-1">
                  Base total da unidade: <strong className="text-foreground">{(overviewData.meta.base_total ?? 0).toLocaleString('pt-BR')}</strong> clientes
                  {overviewData.kpis?.clientes_ativos_janela != null && (
                    <> · Base ativa geral: <strong className="text-foreground">{overviewData.kpis.clientes_ativos_janela.toLocaleString('pt-BR')}</strong></>
                  )}
                </p>
              )}

              <Tabs defaultValue="visao-geral" className="w-full">
                <TabsList className="w-full justify-start h-8">
                  <TabsTrigger value="visao-geral" className="text-xs">Visão Geral</TabsTrigger>
                  <TabsTrigger value="comparativo" className="text-xs">Comparativo</TabsTrigger>
                  <TabsTrigger value="detalhes" className="text-xs">Detalhes</TabsTrigger>
                </TabsList>

                {/* ── Sub-tab: Visão Geral ── */}
                <TabsContent value="visao-geral" className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <KpiMini
                      icon={<Users className="h-3.5 w-3.5" />}
                      label="Base Ativa"
                      value={fmtNum(kpiSummary.base_ativa, '')}
                      description={`com visita nos últimos ${cfg.churn_dias_sem_voltar}d`}
                      info={{
                        title: 'Base Ativa',
                        short: 'Clientes com visita recente atribuídos ao barbeiro',
                        details: (
                          <div className="space-y-1.5">
                            <p>Clientes atribuídos ao barbeiro que visitaram dentro do limiar de churn (<strong>{cfg.churn_dias_sem_voltar} dias</strong>).</p>
                            <p>Modo de atribuição: <em>{atribuicaoLabel}</em>.</p>
                            {overviewData?.meta?.base_total != null && (
                              <p>Base total da unidade: <strong>{(overviewData.meta.base_total).toLocaleString('pt-BR')}</strong> clientes.</p>
                            )}
                          </div>
                        ),
                      }}
                    />
                    <KpiMini
                      icon={<Activity className="h-3.5 w-3.5" />}
                      label="Atendidos"
                      value={fmtNum(kpiSummary.atendidos, '')}
                      description={`em ${kpiSummary.monthLabel}`}
                      info={{
                        title: 'Atendidos no Mês',
                        short: 'Clientes únicos atendidos no mês',
                        details: (
                          <div className="space-y-1.5">
                            <p>Total de clientes únicos atendidos no mês de referência.</p>
                            <p>Um cliente atendido por 2 barbeiros conta <strong>1× por barbeiro</strong>.</p>
                            <p>Não conta repetições do mesmo cliente no período.</p>
                          </div>
                        ),
                      }}
                    />
                    <KpiMini
                      icon={<TrendingDown className="h-3.5 w-3.5" />}
                      label="Churn %"
                      value={fmtNum(kpiSummary.churn_pct, '%')}
                      variant="danger"
                      description={`${kpiSummary.perdidos} perdidos de ${kpiSummary.base_ativa}`}
                      info={{
                        title: 'Churn %',
                        short: 'Percentual de clientes perdidos sobre a base ativa',
                        details: (
                          <div className="space-y-1.5">
                            <p>Fórmula: <strong>Perdidos ÷ Base Ativa × 100</strong>.</p>
                            <p>Mede a taxa de perda de clientes do barbeiro.</p>
                            <p>🟢 Bom: &lt;5% · 🟡 Atenção: 5-10% · 🔴 Crítico: &gt;10%</p>
                          </div>
                        ),
                      }}
                    />
                    <KpiMini
                      icon={<TrendingDown className="h-3.5 w-3.5" />}
                      label="Churn Fidel."
                      value={fmtNum(kpiSummary.churn_fidelizados_pct, '%')}
                      variant="warning"
                      description={`só recorrentes (2+ visitas)`}
                      info={{
                        title: 'Churn Fidelizados',
                        short: 'Churn apenas entre clientes recorrentes',
                        details: (
                          <div className="space-y-1.5">
                            <p>Churn calculado apenas entre clientes com <strong>2 ou mais visitas</strong> no histórico.</p>
                            <p>É mais relevante que o churn geral porque exclui clientes de passagem (1ª vez).</p>
                            <p>Um churn fidelizados alto indica problema real de retenção.</p>
                          </div>
                        ),
                      }}
                    />
                    <KpiMini
                      icon={<UserMinus className="h-3.5 w-3.5" />}
                      label="Perdidos"
                      value={fmtNum(kpiSummary.perdidos, '')}
                      variant="danger"
                      description={`sem visita há >${cfg.churn_dias_sem_voltar}d`}
                      info={{
                        title: 'Clientes Perdidos',
                        short: 'Clientes que ultrapassaram o limiar de dias sem retornar',
                        details: (
                          <div className="space-y-1.5">
                            <p>Clientes que estão há mais de <strong>{cfg.churn_dias_sem_voltar} dias</strong> sem visitar.</p>
                            <p>Compare com a base ativa para entender a proporção: {kpiSummary.base_ativa > 0 ? `${((kpiSummary.perdidos / kpiSummary.base_ativa) * 100).toFixed(1)}% da base` : '—'}.</p>
                          </div>
                        ),
                      }}
                    />
                    <KpiMini
                      icon={<UserCheck className="h-3.5 w-3.5" />}
                      label="Resgatados"
                      value={fmtNum(kpiSummary.resgatados, '')}
                      variant="success"
                      description={kpiSummary.resgatados === 0
                        ? 'nenhum resgate no período'
                        : `${kpiSummary.resgatados} de ${kpiSummary.perdidos} perdidos recuperados`
                      }
                      info={{
                        title: 'Clientes Resgatados',
                        short: 'Clientes que estavam perdidos e voltaram',
                        details: (
                          <div className="space-y-1.5">
                            <p>Clientes que estavam classificados como <strong>perdidos</strong> (sem visita há &gt;{cfg.churn_dias_sem_voltar}d) e retornaram no período.</p>
                            <p>Sinal positivo de recuperação. Compare resgatados vs perdidos para avaliar o saldo líquido.</p>
                            {kpiSummary.resgatados === 0 && (
                              <p className="text-orange-500 font-medium">⚠ Nenhum resgate registrado — pode indicar ausência de ações de recuperação ou dados ainda não processados.</p>
                            )}
                          </div>
                        ),
                      }}
                    />
                  </div>

                  {/* Em Risco highlight */}
                  <Card className="border-orange-500/30 bg-orange-500/5">
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                      <div className="rounded-full bg-orange-500/10 p-2">
                        <TrendingDown className="h-4 w-4 text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{fmtNum(kpiSummary.em_risco, '')} clientes em risco</p>
                          {kpiSummary.base_ativa > 0 && (
                            <span className="text-[10px] font-medium text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">
                              {((kpiSummary.em_risco / kpiSummary.base_ativa) * 100).toFixed(1)}% da base
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Clientes entre {cfg.risco_min_dias}d e {cfg.risco_max_dias}d sem voltar — ainda não classificados como perdidos ({'>'}{cfg.churn_dias_sem_voltar}d).
                        </p>
                      </div>
                      <InfoIconTooltip
                        title="Clientes em Risco"
                        short="Clientes que podem se tornar perdidos em breve"
                        details={
                          <div className="space-y-1.5">
                            <p>Clientes que ultrapassaram <strong>{cfg.risco_min_dias} dias</strong> sem voltar mas ainda não atingiram o limiar de churn de <strong>{cfg.churn_dias_sem_voltar} dias</strong>.</p>
                            <p>São os clientes com maior probabilidade de se tornarem perdidos — priorize ações de retenção aqui.</p>
                            <p>Faixa de risco configurada: {cfg.risco_min_dias}d – {cfg.risco_max_dias}d.</p>
                          </div>
                        }
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── Sub-tab: Comparativo ── */}
                <TabsContent value="comparativo" className="space-y-3">
                  {/* Resgatados zero banner */}
                  {barChartData.length > 0 && barChartData.every(b => b.resgatados === 0) && (
                    <Card className="border-orange-500/30 bg-orange-500/5">
                      <CardContent className="py-2.5 px-3 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                        <div className="text-[11px] text-muted-foreground">
                          <strong className="text-foreground">Nenhum resgate registrado</strong> para todos os barbeiros no período.
                          Pode indicar ausência de ações de recuperação ou dados ainda não processados.
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {barChartData.length > 0 ? (
                    <Card>
                      <CardHeader className="pb-2 pt-3 px-4 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xs font-semibold">Comparativo por Barbeiro</CardTitle>
                          <button
                            type="button"
                            onClick={() => setInfoSheetOpen(true)}
                            className="inline-flex items-center justify-center rounded-full h-5 w-5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                            aria-label="Informações do gráfico"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                          <SegmentedToggle
                            options={METRIC_OPTIONS.map(m => ({ value: m.value, label: m.label }))}
                            value={barChartMetric}
                            onValueChange={(v) => setBarChartMetric(v as MetricKey)}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Ref.: <strong className="text-foreground">{kpiSummary?.monthLabel}</strong> · {barChartData.length} barbeiros com atendimento · Atribuição: {atribuicaoLabel}
                        </p>
                      </CardHeader>
                      <CardContent className="pb-3 px-2">
                        <ResponsiveContainer width="100%" height={Math.max(200, barChartData.length * 38)}>
                          <BarChart data={barChartData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                              tickFormatter={(v: number) => {
                                const info = METRIC_OPTIONS.find(m => m.value === barChartMetric)!;
                                return info.suffix === '%' ? `${v}%` : v.toLocaleString('pt-BR');
                              }}
                            />
                            <YAxis dataKey="nome" type="category" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={90} />
                            <RTooltip
                              content={<BarberChartTooltip barChartData={barChartData} barChartMetric={barChartMetric} barChartAvg={barChartAvg} churnDias={cfg.churn_dias_sem_voltar} />}
                              cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.3 }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}
                              label={{ position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))', formatter: (v: number) => fmtNum(v, METRIC_OPTIONS.find(m => m.value === barChartMetric)!.suffix) }}
                            >
                              {barChartData.map((entry, i) => {
                                const idx = barbers.findIndex(b => b.id === entry.id);
                                const isSelected = selectedBarber === '__all__' || selectedBarber === entry.id;
                                return (
                                  <Cell
                                    key={entry.id}
                                    fill={PALETTE[idx >= 0 ? idx % PALETTE.length : i % PALETTE.length]}
                                    fillOpacity={isSelected ? 1 : 0.25}
                                  />
                                );
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <p className="text-[10px] text-muted-foreground px-3 pt-1 pb-1 border-t border-border/20 mt-1">
                          {barChartMetric === 'base_ativa' && `Clientes com visita nos últimos ${cfg.churn_dias_sem_voltar}d. Barbeiro com mais base = mais responsabilidade de retenção.`}
                          {barChartMetric === 'churn_pct' && 'Perdidos ÷ Base × 100. Quanto menor, melhor a retenção. Benchmark barbearias: <5% bom, >10% crítico.'}
                          {barChartMetric === 'perdidos' && 'Volume absoluto de clientes que pararam de vir. Compare com a base para dimensionar o impacto.'}
                          {barChartMetric === 'atendidos_mes' && 'Clientes únicos atendidos no mês. Não conta repetições do mesmo cliente.'}
                          {barChartMetric === 'resgatados' && 'Clientes que estavam perdidos e retornaram. Sinal positivo de recuperação ativa.'}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <HelpBox variant="warning">Sem dados comparativos para o período.</HelpBox>
                  )}
                </TabsContent>

                {/* ── Sub-tab: Detalhes ── */}
                <TabsContent value="detalhes" className="space-y-3">
                  {detailsTableData.length > 0 ? (
                    <Card>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-xs font-semibold">Todos os Barbeiros — {kpiSummary?.monthLabel}</CardTitle>
                        <p className="text-[10px] text-muted-foreground">
                          Comparação numérica lado a lado · {detailsTableData.length} barbeiros · Atribuição: {atribuicaoLabel}
                        </p>
                      </CardHeader>
                      <CardContent className="px-2 pb-3">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Barbeiro</TableHead>
                                <TableHead className="text-xs text-right">Base Ativa</TableHead>
                                <TableHead className="text-xs text-right">Atendidos</TableHead>
                                <TableHead className="text-xs text-right">Churn %</TableHead>
                                <TableHead className="text-xs text-right">Churn Fidel.</TableHead>
                                <TableHead className="text-xs text-right">Perdidos</TableHead>
                                <TableHead className="text-xs text-right">Resgatados</TableHead>
                                <TableHead className="text-xs text-right">Em Risco</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detailsTableData.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell className="text-xs font-medium">{row.nome}</TableCell>
                                  <TableCell className="text-xs text-right">{row.base_ativa.toLocaleString('pt-BR')}</TableCell>
                                  <TableCell className="text-xs text-right">{row.atendidos_mes.toLocaleString('pt-BR')}</TableCell>
                                  <TableCell className="text-xs text-right">{row.churn_pct.toFixed(1)}%</TableCell>
                                  <TableCell className="text-xs text-right">{row.churn_fidelizados_pct.toFixed(1)}%</TableCell>
                                  <TableCell className="text-xs text-right text-destructive font-medium">{row.perdidos.toLocaleString('pt-BR')}</TableCell>
                                  <TableCell className="text-xs text-right text-emerald-500 font-medium">{row.resgatados.toLocaleString('pt-BR')}</TableCell>
                                  <TableCell className="text-xs text-right text-orange-500 font-medium">{row.em_risco.toLocaleString('pt-BR')}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <HelpBox variant="warning">Sem dados detalhados para o período.</HelpBox>
                  )}
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <HelpBox variant="warning">Sem dados de evolução para exibir KPIs.</HelpBox>
          )}
          </div>
        </div>
      )}

      {/* ===== EVOLUÇÃO ===== */}
      {activeView === 'evolucao' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedToggle
              options={METRIC_OPTIONS.map(m => ({ value: m.value, label: m.label }))}
              value={selectedMetric}
              onValueChange={(v) => setSelectedMetric(v as MetricKey)}
            />
            {avgValue > 0 && (
              <span className="text-[10px] text-muted-foreground ml-2">
                Média: <strong className="text-foreground">{fmtNum(avgValue, metricInfo.suffix)}</strong>
              </span>
            )}
          </div>

          {chartData.length > 0 ? (
            <>
              <Card>
                <CardContent className="pt-4 pb-2 px-2">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                      <XAxis dataKey="ano_mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(v: number) => metricInfo.suffix === '%' ? `${v}%` : v.toLocaleString('pt-BR')} />
                      <RTooltip content={<EvolutionTooltip rawData={churnEvolucaoBarbeiroData?.series || []} />} />
                      {avgValue > 0 && (
                        <ReferenceLine
                          y={avgValue}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="4 4"
                          strokeWidth={1}
                          label={{ value: `Média ${fmtNum(avgValue, metricInfo.suffix)}`, position: 'left', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                        />
                      )}
                      {barbers.map((b, i) => (
                        <Line
                          key={b.id}
                          type="monotone"
                          dataKey={b.id}
                          name={b.nome}
                          stroke={PALETTE[i % PALETTE.length]}
                          strokeWidth={selectedBarber === b.id ? 3 : visibleBarbers.has(b.id) ? 1.5 : 0}
                          strokeOpacity={selectedBarber !== '__all__' && selectedBarber !== b.id ? 0.2 : 1}
                          dot={false}
                          hide={!visibleBarbers.has(b.id)}
                          connectNulls
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* Interactive legend */}
                  <div className="flex flex-wrap gap-1.5 px-2 pt-2 pb-1">
                    {barbers.map((b, i) => {
                      const active = visibleBarbers.has(b.id);
                      return (
                        <button
                          key={b.id}
                          onClick={() => toggleBarberVisibility(b.id)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all
                            ${active
                              ? 'border-border/80 bg-muted/60 text-foreground'
                              : 'border-transparent bg-muted/20 text-muted-foreground/50 line-through'
                            }`}
                        >
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: PALETTE[i % PALETTE.length], opacity: active ? 1 : 0.3 }}
                          />
                          {b.nome}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* KPI Cards do Período */}
              <EvolutionKpis 
                data={churnEvolucaoBarbeiroData?.series || []} 
                visibleBarbers={visibleBarbers}
              />

              {/* Tabela Mensal Detalhada */}
              <EvolutionMonthlyTable 
                data={churnEvolucaoBarbeiroData?.series || []} 
                visibleBarbers={visibleBarbers}
              />

              {/* Insight Automático */}
              <EvolutionInsight 
                data={churnEvolucaoBarbeiroData?.series || []} 
                visibleBarbers={visibleBarbers}
                barbers={barbers}
              />
            </>
          ) : (
            <HelpBox variant="warning">Sem dados de evolução por barbeiro para o período.</HelpBox>
          )}
        </div>
      )}

      {/* ===== RANKING ===== */}
      {activeView === 'ranking' && (
        <div className="space-y-3">
          {clientes.loading && !clientes.painel ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Carregando ranking...</p>
            </div>
          ) : clientes.painel ? (
            <ClientesBarbeirosVisaoGeral
              barbeiros={clientes.painel.por_barbeiro}
              periodoLabel={periodoLabel}
              dataInicio={filters.dataInicioISO}
              dataFim={filters.dataFimISO}
              refDate={filters.dataFimISO}
              onSelectBarbeiro={(id, nome) => openDrill('BARBEIRO', id, nome)}
              novosData={novos.resumo?.por_barbeiro_aquisicao}
              onDrillFaixa={(tipo, valor, label) => openDrill(tipo, valor, label)}
              painelKpis={clientes.painel.kpis}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Nenhum dado de ranking disponível.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => clientes.loadPainel()}>
                <RefreshCw className="h-3 w-3 mr-1" /> Carregar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ===== SAÚDE ===== */}
      {activeView === 'saude' && (
        <div className="space-y-3">
          {clientes.loading && !clientes.painel ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Carregando saúde...</p>
            </div>
          ) : clientes.painel ? (
            <ClientesBarbeirosVisaoGeral
              barbeiros={clientes.painel.por_barbeiro}
              periodoLabel={periodoLabel}
              dataInicio={filters.dataInicioISO}
              dataFim={filters.dataFimISO}
              refDate={filters.dataFimISO}
              onSelectBarbeiro={(id, nome) => openDrill('BARBEIRO', id, nome)}
              novosData={novos.resumo?.por_barbeiro_aquisicao}
              onDrillFaixa={(tipo, valor, label) => openDrill(tipo, valor, label)}
              painelKpis={clientes.painel.kpis}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => clientes.loadPainel()}>
                <RefreshCw className="h-3 w-3 mr-1" /> Carregar
              </Button>
            </div>
          )}
        </div>
      )}

      <ClientesDrillDialog
        state={drillDialog}
        onClose={() => setDrillDialog((p) => ({ ...p, open: false }))}
        dataInicio={filters.dataInicioISO}
        dataFim={filters.dataFimISO}
        refDate={filters.dataFimISO}
      />

      <BarberInfoSheet
        open={infoSheetOpen}
        onOpenChange={setInfoSheetOpen}
        atribuicaoLabel={atribuicaoLabel}
        cfg={cfg}
      />
    </div>
  );
}

/* ─── Mini KPI Card ─── */
function KpiMini({ icon, label, value, variant, description, info }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  variant?: 'danger' | 'warning' | 'success';
  description?: string;
  info?: { title: string; short: string; details: React.ReactNode };
}) {
  const color =
    variant === 'danger' ? 'text-destructive' :
    variant === 'warning' ? 'text-orange-500' :
    variant === 'success' ? 'text-emerald-500' :
    'text-foreground';

  return (
    <Card className="border-border/40">
      <CardContent className="py-2.5 px-3 flex items-center gap-2.5">
        <div className={`shrink-0 ${color}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-[10px] text-muted-foreground truncate">{label}</p>
            {info && <InfoIconTooltip title={info.title} short={info.short} details={info.details} size="sm" />}
          </div>
          <p className={`text-sm font-bold ${color} leading-tight`}>{value}</p>
          {description && <p className="text-[9px] text-muted-foreground/70 leading-tight mt-0.5 truncate">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

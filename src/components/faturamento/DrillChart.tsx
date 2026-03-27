// ============================================================
// FILE: src/components/faturamento/DrillChart.tsx
// PROPÓSITO: Gráfico ComposedChart + PieChart com stats integrados
// ============================================================

import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, BarChart3, ArrowUp, ArrowDown, Activity, Target, PieChartIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { DrillSeriesPoint } from '@/hooks/useFaturamentoDrill';

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 220 70% 50%))',
  'hsl(var(--chart-3, 150 60% 45%))',
  'hsl(var(--chart-4, 280 65% 55%))',
  'hsl(var(--chart-5, 30 80% 55%))',
  'hsl(340 75% 55%)',
  'hsl(200 70% 50%)',
  'hsl(60 70% 45%)',
];

function formatBRL(n: number): string {
  if (n >= 1000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function formatBRLFull(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 2,
  }).format(n || 0);
}

function StatItem({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-bold text-foreground truncate">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}

export interface RefLineConfig {
  value: number;
  label: string;
  color: string;
  dashArray?: string;
}

interface DrillChartProps {
  series: DrillSeriesPoint[];
  title?: string;
  allowPie?: boolean;
  refLines?: RefLineConfig[];
}

// Enriched tooltip with qtd, ticket, and refLine comparisons
function EnrichedTooltip({ active, payload, label, refLines, avg }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as DrillSeriesPoint | undefined;
  const valor = point?.valor ?? 0;

  // Build comparison lines: avg + refLines
  const comparisons: { label: string; value: number; color: string }[] = [];
  if (avg != null && avg > 0) {
    comparisons.push({ label: 'Média Atual', value: avg, color: 'hsl(var(--muted-foreground))' });
  }
  if (refLines) {
    for (const rl of refLines) {
      comparisons.push({ label: rl.label, value: rl.value, color: rl.color });
    }
  }

  return (
    <div className="bg-background border border-border rounded-lg shadow-xl px-3 py-2.5 min-w-[180px]">
      <p className="text-xs font-medium text-foreground mb-1">{label}</p>
      
      {/* Main value + delta vs avg */}
      <div className="flex items-baseline gap-2">
        <p className="text-sm font-bold" style={{ color: 'hsl(var(--primary))' }}>
          {formatBRLFull(valor)}
        </p>
        {avg != null && avg > 0 && (
          <span className={`text-[10px] font-semibold ${valor >= avg ? 'text-emerald-500' : 'text-red-500'}`}>
            {valor >= avg ? '▲' : '▼'} {((valor - avg) / avg * 100).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Qtd + Ticket */}
      {point?.qtd != null && (
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {point.qtd} atendimento{point.qtd !== 1 ? 's' : ''}
        </p>
      )}
      {point?.ticket != null && point.ticket > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Ticket: {formatBRLFull(point.ticket)}
        </p>
      )}

      {/* Separator + Comparisons */}
      {comparisons.length > 0 && (
        <>
          <div className="border-t border-border/50 my-1.5" />
          <div className="space-y-0.5">
            {comparisons.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-muted-foreground">{c.label}</span>
                </div>
                <span className="font-medium text-foreground">{formatBRL(c.value)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-background border border-border rounded-lg shadow-xl px-3 py-2">
      <p className="text-xs font-medium text-foreground mb-1">{d.name}</p>
      <p className="text-sm font-bold" style={{ color: d.payload?.fill }}>
        {formatBRLFull(d.value)}
      </p>
      <p className="text-[10px] text-muted-foreground">
        {((d.payload?.percent || 0) * 100).toFixed(1)}%
      </p>
    </div>
  );
}

function PieLegendContent({ payload }: any) {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-1 text-[10px] text-foreground">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="truncate max-w-[100px]">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// Reference lines legend below the chart
function RefLinesLegend({ refLines, avg }: { refLines?: RefLineConfig[]; avg?: number }) {
  const items: { label: string; value: number; color: string }[] = [];
  if (avg != null && avg > 0) {
    items.push({ label: 'Média Atual', value: avg, color: 'hsl(var(--muted-foreground))' });
  }
  if (refLines) {
    for (const rl of refLines) {
      items.push({ label: rl.label, value: rl.value, color: rl.color });
    }
  }
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center pt-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[10px]">
          <svg width="16" height="2" className="shrink-0">
            <line x1="0" y1="1" x2="16" y2="1" stroke={item.color} strokeWidth="2" strokeDasharray="4 2" />
          </svg>
          <span className="text-muted-foreground">{item.label}:</span>
          <span className="font-semibold text-foreground">{formatBRL(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function DrillChart({ series, title = 'Série', allowPie = false, refLines }: DrillChartProps) {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const isMobile = useIsMobile();

  useEffect(() => {
    if (chartType === 'pie' && !allowPie) {
      setChartType('bar');
    }
  }, [allowPie, chartType]);

  const stats = useMemo(() => {
    if (!series || series.length === 0) return null;
    const values = series.map(s => s.valor);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const maxIdx = values.indexOf(maxVal);
    const minIdx = values.indexOf(minVal);
    return { total, avg, max: maxVal, maxBucket: series[maxIdx]?.bucket || '', min: minVal, minBucket: series[minIdx]?.bucket || '' };
  }, [series]);

  const pieData = useMemo(() => {
    if (!series || series.length === 0 || !stats) return [];
    const MAX_SLICES = 7;
    const sorted = [...series].sort((a, b) => b.valor - a.valor);
    if (sorted.length <= MAX_SLICES) {
      return sorted.map(s => ({ name: s.bucket || '(Sem nome)', value: s.valor, percent: stats.total > 0 ? s.valor / stats.total : 0 }));
    }
    const top = sorted.slice(0, MAX_SLICES - 1);
    const rest = sorted.slice(MAX_SLICES - 1);
    const outrosVal = rest.reduce((a, b) => a + b.valor, 0);
    return [
      ...top.map(s => ({ name: s.bucket || '(Sem nome)', value: s.valor, percent: stats.total > 0 ? s.valor / stats.total : 0 })),
      { name: `Outros (${rest.length})`, value: outrosVal, percent: stats.total > 0 ? outrosVal / stats.total : 0 },
    ];
  }, [series, stats]);

  if (!series || series.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center h-56">
          <p className="text-sm text-muted-foreground">Sem dados para exibir</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 min-w-0">
            <TrendingUp className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{title}</span>
          </CardTitle>
          <Tabs value={chartType} onValueChange={(v) => setChartType(v as any)} className="shrink-0">
            <TabsList className="h-8">
              <TabsTrigger value="bar" className="text-xs px-2 h-6 gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                Barra
              </TabsTrigger>
              <TabsTrigger value="line" className="text-xs px-2 h-6 gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                Linha
              </TabsTrigger>
              <TabsTrigger
                value="pie"
                className="text-xs px-2 h-6 gap-1"
                disabled={!allowPie}
              >
                <PieChartIcon className="h-3.5 w-3.5" />
                Pizza
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/20 border border-border/30">
            <StatItem icon={<Activity className="h-3.5 w-3.5 text-primary" />} label="Acumulado" value={formatBRL(stats.total)} />
            <StatItem icon={<Target className="h-3.5 w-3.5 text-muted-foreground" />} label="Média" value={formatBRL(stats.avg)} />
            <StatItem icon={<ArrowUp className="h-3.5 w-3.5 text-emerald-500" />} label="Máximo" value={formatBRL(stats.max)} sub={stats.maxBucket} />
            <StatItem icon={<ArrowDown className="h-3.5 w-3.5 text-red-500" />} label="Mínimo" value={formatBRL(stats.min)} sub={stats.minBucket} />
          </div>
        )}

        {/* Chart */}
        <div className={isMobile ? 'h-44' : 'h-72'}>
          {chartType === 'pie' ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="42%"
                  outerRadius="65%"
                  innerRadius="30%"
                  paddingAngle={2}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={9}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend content={<PieLegendContent />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 5, right: 5, left: isMobile ? 0 : -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="drillGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: isMobile ? 8 : 9 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                  angle={series.length > 7 ? -45 : 0}
                  textAnchor={series.length > 7 ? 'end' : 'middle'}
                  height={series.length > 7 ? 50 : 25}
                />
                {isMobile ? (
                  <YAxis hide />
                ) : (
                  <YAxis
                    tickFormatter={formatBRL}
                    tick={{ fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    width={45}
                  />
                )}
                <Tooltip content={<EnrichedTooltip refLines={refLines} avg={stats?.avg} />} />
                {stats && !isMobile && (
                  <ReferenceLine y={stats.avg} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5}
                    label={{ value: 'Média', position: 'insideTopRight', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                )}
                {refLines && refLines.map((rl, i) => (
                  <ReferenceLine
                    key={i}
                    y={rl.value}
                    stroke={rl.color}
                    strokeDasharray={rl.dashArray || '4 4'}
                    strokeOpacity={0.7}
                    label={isMobile ? undefined : { value: rl.label, position: 'insideTopRight', fontSize: 9, fill: rl.color }}
                  />
                ))}
                {chartType === 'bar' ? (
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} maxBarSize={36} />
                ) : (
                  <>
                    <Area type="monotone" dataKey="valor" fill="url(#drillGradient)" stroke="none" />
                    <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2}
                      dot={false} activeDot={{ r: 4, fill: 'hsl(var(--primary))', stroke: '#fff', strokeWidth: 2 }} />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Reference lines legend */}
        {chartType !== 'pie' && (refLines?.length || (stats?.avg && stats.avg > 0)) && (
          <RefLinesLegend refLines={refLines} avg={stats?.avg} />
        )}
      </CardContent>
    </Card>
  );
}

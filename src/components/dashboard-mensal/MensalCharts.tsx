import React, { useState, useMemo } from 'react';
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
  ReferenceDot,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, BarChart3, Sigma, Target, Trophy, AlertTriangle, Calendar } from 'lucide-react';

import type { DashboardIndicator } from '@/components/dashboard/types';
import type { DashboardMonthly } from '@/hooks/useDashboardMensal';

const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const INDICATOR_CONFIG: Record<DashboardIndicator, {
  label: string;
  format: 'currency' | 'number';
  color: string;
}> = {
  faturamento: { label: 'Faturamento', format: 'currency', color: 'hsl(var(--primary))' },
  atendimentos: { label: 'Atendimentos', format: 'number', color: 'hsl(142, 76%, 36%)' },
  ticket_medio: { label: 'Ticket Médio', format: 'currency', color: 'hsl(262, 83%, 58%)' },
  clientes: { label: 'Clientes', format: 'number', color: 'hsl(25, 95%, 53%)' },
  clientes_novos: { label: 'Clientes Novos', format: 'number', color: 'hsl(188, 78%, 41%)' },
  extras_qtd: { label: 'Extras (Qtd)', format: 'number', color: 'hsl(330, 81%, 60%)' },
  extras_valor: { label: 'Extras (R$)', format: 'currency', color: 'hsl(45, 93%, 47%)' },
  servicos_totais: { label: 'Serviços', format: 'number', color: 'hsl(239, 84%, 67%)' },
};

function formatBRL(value: number): string {
  if (value >= 1000) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatBRLFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(value));
}

function formatValue(value: number, fmt: 'currency' | 'number'): string {
  return fmt === 'currency' ? formatBRL(value) : formatNumber(value);
}

function formatValueFull(value: number, fmt: 'currency' | 'number'): string {
  return fmt === 'currency' ? formatBRLFull(value) : formatNumber(value);
}

function formatAnoMes(anoMes: string): string {
  const [year, month] = anoMes.split('-');
  const m = parseInt(month, 10);
  return `${MESES_CURTOS[m]}/${year.slice(2)}`;
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  variant?: 'default' | 'success' | 'danger';
}

function StatItem({ icon, label, value, subValue, variant = 'default' }: StatItemProps) {
  const cls = { default: 'text-foreground', success: 'text-emerald-500', danger: 'text-red-500' };
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="flex items-center justify-center w-6 h-6 rounded bg-muted/50">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-semibold ${cls[variant]} truncate`}>
          {value}
          {subValue && <span className="text-[10px] font-normal text-muted-foreground ml-1">{subValue}</span>}
        </p>
      </div>
    </div>
  );
}

interface MensalChartsProps {
  monthly: DashboardMonthly[];
}

export function MensalCharts({ monthly }: MensalChartsProps) {
  const [selectedIndicator, setSelectedIndicator] = useState<DashboardIndicator>('faturamento');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const config = INDICATOR_CONFIG[selectedIndicator];

  const stats = useMemo(() => {
    if (!monthly || monthly.length === 0) return { total: 0, average: 0, max: 0, min: 0, maxMonth: null as string | null, minMonth: null as string | null };
    const values = monthly.map((d) => (d as any)[selectedIndicator] ?? 0);
    const total = values.reduce((a: number, b: number) => a + b, 0);
    const average = values.length ? total / values.length : 0;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const maxMonth = monthly.find((d) => (d as any)[selectedIndicator] === max)?.ano_mes ?? null;
    const minMonth = monthly.find((d) => (d as any)[selectedIndicator] === min)?.ano_mes ?? null;
    return { total, average, max, min, maxMonth, minMonth };
  }, [monthly, selectedIndicator]);

  const hasData = monthly && monthly.length > 0 && stats.total > 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const value = payload[0]?.value ?? 0;
    const monthData = monthly.find((d) => d.ano_mes === label);

    return (
      <div className="bg-background border border-border rounded-lg shadow-xl min-w-[200px] overflow-hidden">
        <div className="bg-muted/50 px-3 py-2 border-b border-border">
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            {formatAnoMes(label)}
          </p>
        </div>
        <div className="px-3 py-2 border-b border-border/50">
          <p className="text-lg font-bold" style={{ color: config.color }}>{formatValueFull(value, config.format)}</p>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </div>
        {monthData && (
          <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(INDICATOR_CONFIG).map(([key, cfg]) => {
              if (key === selectedIndicator) return null;
              const val = (monthData as any)[key] ?? 0;
              return (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate">{cfg.label}:</span>
                  <span className="font-medium text-foreground ml-1">{formatValue(val, cfg.format)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Evolução Mensal
          </CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={chartType} onValueChange={(v) => setChartType(v as 'line' | 'bar')}>
              <TabsList className="h-7">
                <TabsTrigger value="line" className="text-xs px-2 h-5"><TrendingUp className="h-3 w-3" /></TabsTrigger>
                <TabsTrigger value="bar" className="text-xs px-2 h-5"><BarChart3 className="h-3 w-3" /></TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={selectedIndicator} onValueChange={(v) => setSelectedIndicator(v as DashboardIndicator)}>
              <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INDICATOR_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key} className="text-xs">{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {hasData ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0 mb-3 p-2 rounded-lg bg-muted/20 border border-border/30">
              <StatItem icon={<Sigma className="h-3 w-3 text-muted-foreground" />} label="Acumulado" value={formatValue(stats.total, config.format)} />
              <StatItem icon={<Target className="h-3 w-3 text-muted-foreground" />} label="Média/mês" value={formatValue(stats.average, config.format)} />
              <StatItem
                icon={<Trophy className="h-3 w-3 text-emerald-500" />}
                label="Máximo"
                value={formatValue(stats.max, config.format)}
                subValue={stats.maxMonth ? formatAnoMes(stats.maxMonth) : undefined}
                variant="success"
              />
              <StatItem
                icon={<AlertTriangle className="h-3 w-3 text-red-500" />}
                label="Mínimo"
                value={formatValue(stats.min, config.format)}
                subValue={stats.minMonth ? formatAnoMes(stats.minMonth) : undefined}
                variant="danger"
              />
            </div>

            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLineMensal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={config.color} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={config.color} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
                  <XAxis dataKey="ano_mes" tickFormatter={formatAnoMes} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
                  <YAxis tickFormatter={(v) => formatValue(v, config.format)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} className="text-muted-foreground" width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={stats.average} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1} label={{ value: 'Média', position: 'insideTopRight', fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                  {chartType === 'line' && <Area type="monotone" dataKey={selectedIndicator} fill="url(#colorLineMensal)" stroke="transparent" />}
                  {chartType === 'line' ? (
                    <Line type="monotone" dataKey={selectedIndicator} stroke={config.color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: config.color, stroke: '#fff', strokeWidth: 2 }} />
                  ) : (
                    <Bar dataKey={selectedIndicator} fill={config.color} radius={[2, 2, 0, 0]} maxBarSize={35} />
                  )}
                  {stats.maxMonth && chartType === 'line' && <ReferenceDot x={stats.maxMonth} y={stats.max} r={5} fill="hsl(142 76% 36%)" stroke="#fff" strokeWidth={2} />}
                  {stats.minMonth && stats.minMonth !== stats.maxMonth && chartType === 'line' && <ReferenceDot x={stats.minMonth} y={stats.min} r={5} fill="hsl(0 84% 60%)" stroke="#fff" strokeWidth={2} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="h-56 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Sem dados no período selecionado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

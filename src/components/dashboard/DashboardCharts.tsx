// ============================================================
// FILE: src/components/dashboard/DashboardCharts.tsx
// PROPÓSITO: Gráficos interativos do Dashboard com stats em lista
// ============================================================

import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  ReferenceDot
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, BarChart3, ArrowUp, ArrowDown, Calendar, Sigma, Target, Trophy, AlertTriangle } from 'lucide-react';

import type { DashboardDaily, DashboardIndicator, DashboardStats } from './types';

// ============================================================
// CONFIGURAÇÃO DOS INDICADORES
// ============================================================

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
  servicos_totais: { label: 'Serviços', format: 'number', color: 'hsl(239, 84%, 67%)' }
};

// ============================================================
// HELPERS DE FORMATAÇÃO
// ============================================================

function formatBRL(value: number): string {
  if (value >= 1000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBRLFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(value));
}

function formatValue(value: number, format: 'currency' | 'number'): string {
  return format === 'currency' ? formatBRL(value) : formatNumber(value);
}

function formatValueFull(value: number, format: 'currency' | 'number'): string {
  return format === 'currency' ? formatBRLFull(value) : formatNumber(value);
}

function formatDayMonth(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'dd/MM', { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function formatDayOfWeek(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'EEE', { locale: ptBR });
  } catch {
    return '';
  }
}

function formatFullDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, "dd/MM (EEEE)", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

// ============================================================
// TIPOS
// ============================================================

interface DashboardChartsProps {
  daily: DashboardDaily[];
}

// ============================================================
// COMPONENTE: ITEM DA LISTA DE ESTATÍSTICAS
// ============================================================

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  variant?: 'default' | 'success' | 'danger';
}

function StatItem({ icon, label, value, subValue, variant = 'default' }: StatItemProps) {
  const variantClasses = {
    default: 'text-foreground',
    success: 'text-emerald-500',
    danger: 'text-red-500'
  };

  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="flex items-center justify-center w-6 h-6 rounded bg-muted/50">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className={`text-sm font-semibold ${variantClasses[variant]} truncate`}>
          {value}
          {subValue && (
            <span className="text-[10px] font-normal text-muted-foreground ml-1">
              {subValue}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function DashboardCharts({ daily }: DashboardChartsProps) {
  const [selectedIndicator, setSelectedIndicator] = useState<DashboardIndicator>('faturamento');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const currentConfig = INDICATOR_CONFIG[selectedIndicator];

  // Calcula estatísticas do período
  const stats: DashboardStats = useMemo(() => {
    if (!daily || daily.length === 0) {
      return { total: 0, average: 0, max: 0, min: 0, maxDay: null, minDay: null };
    }

    const values = daily.map(d => d[selectedIndicator] ?? 0);
    const total = values.reduce((a, b) => a + b, 0);
    const average = values.length ? total / values.length : 0;
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    const maxDay = daily.find(d => d[selectedIndicator] === max)?.dia ?? null;
    const minDay = daily.find(d => d[selectedIndicator] === min)?.dia ?? null;

    return { total, average, max, min, maxDay, minDay };
  }, [daily, selectedIndicator]);

  const hasData = daily && daily.length > 0 && stats.total > 0;

  // Tooltip customizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    const value = payload[0]?.value ?? 0;
    const dayData = daily.find(d => d.dia === label);
    
    return (
      <div className="bg-background border border-border rounded-lg shadow-xl min-w-[200px] overflow-hidden">
        <div className="bg-muted/50 px-3 py-2 border-b border-border">
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            {formatFullDate(label)}
          </p>
        </div>
        
        <div className="px-3 py-2 border-b border-border/50">
          <p className="text-lg font-bold" style={{ color: currentConfig.color }}>
            {formatValueFull(value, currentConfig.format)}
          </p>
          <p className="text-xs text-muted-foreground">{currentConfig.label}</p>
        </div>
        
        {dayData && (
          <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(INDICATOR_CONFIG).map(([key, config]) => {
              if (key === selectedIndicator) return null;
              const val = dayData[key as DashboardIndicator] ?? 0;
              return (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate">{config.label}:</span>
                  <span className="font-medium text-foreground ml-1">
                    {formatValue(val, config.format)}
                  </span>
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
            Evolução Diária
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Tabs value={chartType} onValueChange={(v) => setChartType(v as 'line' | 'bar')}>
              <TabsList className="h-7">
                <TabsTrigger value="line" className="text-xs px-2 h-5">
                  <TrendingUp className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="bar" className="text-xs px-2 h-5">
                  <BarChart3 className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Select 
              value={selectedIndicator} 
              onValueChange={(v) => setSelectedIndicator(v as DashboardIndicator)}
            >
              <SelectTrigger className="w-[130px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INDICATOR_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {hasData ? (
          <>
            {/* ESTATÍSTICAS EM LISTA VERTICAL */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0 mb-3 p-2 rounded-lg bg-muted/20 border border-border/30">
              <StatItem 
                icon={<Sigma className="h-3 w-3 text-muted-foreground" />}
                label="Acumulado"
                value={formatValue(stats.total, currentConfig.format)}
              />
              <StatItem 
                icon={<Target className="h-3 w-3 text-muted-foreground" />}
                label="Média/dia"
                value={formatValue(stats.average, currentConfig.format)}
              />
              <StatItem 
                icon={<Trophy className="h-3 w-3 text-emerald-500" />}
                label="Máximo"
                value={formatValue(stats.max, currentConfig.format)}
                subValue={stats.maxDay ? formatDayMonth(stats.maxDay) : undefined}
                variant="success"
              />
              <StatItem 
                icon={<AlertTriangle className="h-3 w-3 text-red-500" />}
                label="Mínimo"
                value={formatValue(stats.min, currentConfig.format)}
                subValue={stats.minDay ? formatDayMonth(stats.minDay) : undefined}
                variant="danger"
              />
            </div>

            {/* GRÁFICO */}
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLine" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={currentConfig.color} stopOpacity={0.8}/>
                      <stop offset="100%" stopColor={currentConfig.color} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>

                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    className="stroke-border/30" 
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="dia" 
                    tickFormatter={formatDayMonth}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tickFormatter={(v) => formatValue(v, currentConfig.format)}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    width={55}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  <ReferenceLine 
                    y={stats.average} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="5 5"
                    strokeWidth={1}
                    label={{
                      value: 'Média',
                      position: 'insideTopRight',
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 9
                    }}
                  />
                  
                  {chartType === 'line' && (
                    <Area
                      type="monotone"
                      dataKey={selectedIndicator}
                      fill="url(#colorLine)"
                      stroke="transparent"
                    />
                  )}

                  {chartType === 'line' ? (
                    <Line
                      type="monotone"
                      dataKey={selectedIndicator}
                      stroke={currentConfig.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: currentConfig.color, stroke: '#fff', strokeWidth: 2 }}
                    />
                  ) : (
                    <Bar
                      dataKey={selectedIndicator}
                      fill={currentConfig.color}
                      radius={[2, 2, 0, 0]}
                      maxBarSize={35}
                    />
                  )}

                  {stats.maxDay && chartType === 'line' && (
                    <ReferenceDot
                      x={stats.maxDay}
                      y={stats.max}
                      r={5}
                      fill="hsl(142 76% 36%)"
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  )}

                  {stats.minDay && stats.minDay !== stats.maxDay && chartType === 'line' && (
                    <ReferenceDot
                      x={stats.minDay}
                      y={stats.min}
                      r={5}
                      fill="hsl(0 84% 60%)"
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="h-56 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Sem dados no período selecionado
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DashboardCharts;

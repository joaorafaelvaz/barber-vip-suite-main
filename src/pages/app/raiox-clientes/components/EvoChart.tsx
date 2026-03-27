import React, { useState, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Loader2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface EvolucaoMes {
  mes: string;
  clientes_unicos: number;
  novos: number;
  recorrentes: number;
  recorrentes_fieis: number;
  recorrentes_exclusivos: number;
  recorrentes_rotativos: number;
  total_atendimentos: number;
  receita: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function fmtMes(yyyymm: string) {
  const [y, m] = yyyymm.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]}/${y.slice(2)}`;
}

/* ------------------------------------------------------------------ */
/*  Series config                                                      */
/* ------------------------------------------------------------------ */

export const EVO_SERIES = [
  // Stacked bars
  {
    key: 'novos',
    label: 'Novos',
    color: '#14b8a6',
    type: 'bar'  as const,
    stackId: 'a',
    yAxisId: 'count',
    defaultOn: true,
    hint: '1ª visita à barbearia no mês — nunca tinham vindo antes',
  },
  {
    key: 'recorrentes_fieis',
    label: 'Rec. Fiéis',
    color: '#10b981',
    type: 'bar'  as const,
    stackId: 'a',
    yAxisId: 'count',
    defaultOn: true,
    hint: 'Recorrentes fiéis: 3+ visitas, só com um barbeiro no período',
  },
  {
    key: 'recorrentes_exclusivos',
    label: 'Rec. Exclusivos',
    color: '#34d399',
    type: 'bar'  as const,
    stackId: 'a',
    yAxisId: 'count',
    defaultOn: true,
    hint: 'Recorrentes exclusivos: 2 visitas, só com um barbeiro',
  },
  {
    key: 'recorrentes_rotativos',
    label: 'Rec. Rotativos',
    color: '#60a5fa',
    type: 'bar'  as const,
    stackId: 'a',
    yAxisId: 'count',
    defaultOn: true,
    hint: 'Recorrentes rotativos: visitam múltiplos barbeiros',
  },
  // Lines
  {
    key: 'clientes_unicos',
    label: 'Total único',
    color: '#a78bfa',
    type: 'line' as const,
    stackId: undefined,
    yAxisId: 'count',
    defaultOn: true,
    hint: 'Total de clientes únicos atendidos no mês',
  },
  {
    key: 'total_atendimentos',
    label: 'Atend. total',
    color: '#fbbf24',
    type: 'line' as const,
    stackId: undefined,
    yAxisId: 'count',
    defaultOn: false,
    hint: 'Total de atendimentos (transações) no mês',
  },
  {
    key: 'pct_recorrentes',
    label: '% Recorrentes',
    color: '#f97316',
    type: 'line' as const,
    stackId: undefined,
    yAxisId: 'rate',
    defaultOn: false,
    hint: '% dos clientes do mês que já haviam visitado antes — quanto maior, mais a carteira está se consolidando',
  },
  {
    key: 'media_atend_por_cliente',
    label: 'Atend./cliente',
    color: '#f472b6',
    type: 'line' as const,
    stackId: undefined,
    yAxisId: 'rate',
    defaultOn: false,
    hint: 'Média de atendimentos por cliente único — valores altos indicam clientes assíduos',
  },
] as const;

export type EvoSeriesKey = typeof EVO_SERIES[number]['key'];

/* ------------------------------------------------------------------ */
/*  Tooltip                                                            */
/* ------------------------------------------------------------------ */

export function EvoTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-[11px] space-y-1 shadow-lg min-w-[180px]">
      <p className="font-semibold text-foreground border-b border-border/30 pb-1 mb-1">{fmtMes(label)}</p>
      {payload.map((p: any) => {
        const cfg = EVO_SERIES.find(s => s.key === p.dataKey);
        const val = p.dataKey === 'pct_recorrentes'
          ? `${p.value}%`
          : p.dataKey === 'media_atend_por_cliente'
          ? Number(p.value).toFixed(2)
          : p.value;
        return (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full inline-block shrink-0"
              style={{ backgroundColor: p.fill ?? p.stroke }}
            />
            <span className="text-muted-foreground flex-1">{cfg?.label ?? p.dataKey}</span>
            <span className="font-semibold tabular-nums text-foreground">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EvoChart component                                                 */
/* ------------------------------------------------------------------ */

interface EvoChartProps {
  data: EvolucaoMes[];
  loading?: boolean;
  height?: number;
}

export function EvoChart({ data, loading = false, height = 240 }: EvoChartProps) {
  const [activeSeries, setActiveSeries] = useState<Set<EvoSeriesKey>>(
    () => new Set(EVO_SERIES.filter(s => s.defaultOn).map(s => s.key))
  );

  const toggleSeries = (key: EvoSeriesKey) => {
    setActiveSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const enriched = useMemo(() => data.map(m => ({
    ...m,
    pct_recorrentes:         m.clientes_unicos > 0
      ? Math.round(m.recorrentes / m.clientes_unicos * 100) : 0,
    media_atend_por_cliente: m.clientes_unicos > 0
      ? parseFloat((m.total_atendimentos / m.clientes_unicos).toFixed(2)) : 0,
  })), [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (enriched.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-muted-foreground">Sem dados de evolução.</p>
      </div>
    );
  }

  const hasRate = EVO_SERIES.some(s => s.yAxisId === 'rate' && activeSeries.has(s.key));
  const activeBars = EVO_SERIES.filter(s => s.type === 'bar' && activeSeries.has(s.key));
  const activeLines = EVO_SERIES.filter(s => s.type === 'line' && activeSeries.has(s.key));

  return (
    <div className="space-y-2">
      {/* Series toggle pills */}
      <div className="flex flex-wrap gap-1">
        {EVO_SERIES.map(s => {
          const isOn = activeSeries.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              title={s.hint}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-medium transition-all ${
                isOn
                  ? 'border-transparent text-background'
                  : 'border-border/30 text-muted-foreground bg-transparent hover:border-border/60'
              }`}
              style={isOn ? { backgroundColor: s.color } : {}}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: isOn ? 'rgba(255,255,255,0.7)' : s.color }}
              />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={enriched} margin={{ top: 4, right: hasRate ? 40 : 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="mes"
            tickFormatter={fmtMes}
            tick={{ fontSize: 9, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="count"
            tick={{ fontSize: 9, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          {hasRate && (
            <YAxis
              yAxisId="rate"
              orientation="right"
              tick={{ fontSize: 9, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                activeSeries.has('pct_recorrentes') && !activeSeries.has('media_atend_por_cliente')
                  ? `${v}%`
                  : String(v)
              }
            />
          )}
          <Tooltip content={<EvoTooltip />} />
          {activeBars.map((s, i) => (
            <Bar
              key={s.key}
              yAxisId={s.yAxisId}
              dataKey={s.key}
              stackId={s.stackId}
              fill={s.color}
              opacity={0.85}
              radius={i === activeBars.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
          {activeLines.map(s => (
            <Line
              key={s.key}
              yAxisId={s.yAxisId}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 2, fill: s.color }}
              activeDot={{ r: 4 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

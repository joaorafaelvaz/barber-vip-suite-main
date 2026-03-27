// ============================================================
// FILE: src/components/relatorios/SemanalCharts.tsx
// PROPÓSITO: Gráficos de evolução semanal com seletor de período
// ============================================================

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { SemanaData, SemanalIndicator } from '@/types/relatorio-semanal';

interface SemanalChartsProps {
  semanas: SemanaData[];
  medias: {
    faturamento: number;
    atendimentos: number;
    ticket_medio: number;
    extras_qtd: number;
  };
}

const INDICADORES: { value: SemanalIndicator; label: string }[] = [
  { value: 'faturamento', label: 'Faturamento' },
  { value: 'atendimentos', label: 'Atendimentos' },
  { value: 'ticket_medio', label: 'Ticket Médio' },
  { value: 'extras_qtd', label: 'Extras' }
];

function formatValue(value: number, indicator: SemanalIndicator): string {
  if (indicator === 'faturamento' || indicator === 'ticket_medio') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }
  return value.toString();
}

function semanaLabel(s: SemanaData) {
  return `Sem. ${s.semana_numero} · ${format(s.data_inicio, 'dd/MM')}–${format(s.data_fim, 'dd/MM')}`;
}

export function SemanalCharts({ semanas, medias }: SemanalChartsProps) {
  const [indicador, setIndicador] = useState<SemanalIndicator>('faturamento');
  const [fromIdx, setFromIdx] = useState<number>(0);
  const [toIdx, setToIdx] = useState<number>(() => Math.max(0, semanas.length - 1));

  // Atualiza toIdx quando semanas muda
  const adjustedTo = Math.min(toIdx, semanas.length - 1);
  const adjustedFrom = Math.min(fromIdx, adjustedTo);

  const semanasFiltradas = useMemo(
    () => semanas.slice(adjustedFrom, adjustedTo + 1),
    [semanas, adjustedFrom, adjustedTo]
  );

  const data = semanasFiltradas.map((s) => ({
    name: `Sem ${s.semana_numero}`,
    label: s.label,
    value: s[indicador] as number,
    tendencia: s.tendencia
  }));

  const media = useMemo(() => {
    if (semanasFiltradas.length === 0) return 0;
    const sum = semanasFiltradas.reduce((acc, s) => acc + (s[indicador] as number), 0);
    return sum / semanasFiltradas.length;
  }, [semanasFiltradas, indicador]);

  if (semanas.length === 0) return null;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Evolução Semanal
          </CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de período (de / até) — só mostra se houver mais de 2 semanas */}
            {semanas.length > 2 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="shrink-0">De</span>
                <select
                  value={adjustedFrom}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setFromIdx(v);
                    if (v > adjustedTo) setToIdx(v);
                  }}
                  className="h-7 rounded-md border border-border/40 bg-card text-[11px] text-foreground px-1.5 pr-5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  {semanas.map((s, i) => (
                    <option key={i} value={i}>{semanaLabel(s)}</option>
                  ))}
                </select>
                <span className="shrink-0">até</span>
                <select
                  value={adjustedTo}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setToIdx(v);
                    if (v < adjustedFrom) setFromIdx(v);
                  }}
                  className="h-7 rounded-md border border-border/40 bg-card text-[11px] text-foreground px-1.5 pr-5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  {semanas.map((s, i) => (
                    <option key={i} value={i}>{semanaLabel(s)}</option>
                  ))}
                </select>
                {(adjustedFrom !== 0 || adjustedTo !== semanas.length - 1) && (
                  <button
                    onClick={() => { setFromIdx(0); setToIdx(semanas.length - 1); }}
                    className="text-[10px] text-primary/60 hover:text-primary underline-offset-2 hover:underline shrink-0"
                  >
                    Todas
                  </button>
                )}
              </div>
            )}

            {/* Indicador */}
            <Select value={indicador} onValueChange={(v) => setIndicador(v as SemanalIndicator)}>
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDICADORES.map((ind) => (
                  <SelectItem key={ind.value} value={ind.value} className="text-xs">
                    {ind.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="name"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) => formatValue(v, indicador)}
                width={indicador === 'faturamento' || indicador === 'ticket_medio' ? 62 : 36}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'hsl(var(--popover-foreground))'
                }}
                formatter={(value: number) => [formatValue(value, indicador), INDICADORES.find(i => i.value === indicador)?.label]}
                labelFormatter={(label, payload) => payload[0]?.payload?.label || label}
              />
              <ReferenceLine
                y={media}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                label={{
                  value: 'Média',
                  position: 'right',
                  fill: 'hsl(var(--primary))',
                  fontSize: 10
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.tendencia === 'up'
                        ? 'hsl(142 76% 36%)'
                        : entry.tendencia === 'down'
                          ? 'hsl(0 84% 60%)'
                          : 'hsl(var(--primary))'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default SemanalCharts;

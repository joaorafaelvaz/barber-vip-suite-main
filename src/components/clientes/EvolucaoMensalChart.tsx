import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  rows: any[];
  barbeiroField: string;
  dateField: string;
  title: string;
  description?: string;
  barColor?: string;
}

export function EvolucaoMensalChart({ rows, barbeiroField, dateField, title, description, barColor = 'hsl(var(--primary))' }: Props) {
  const [selectedBarbeiro, setSelectedBarbeiro] = useState('__todos__');

  const barbeiros = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      const n = r[barbeiroField];
      if (n) set.add(n);
    });
    return Array.from(set).sort();
  }, [rows, barbeiroField]);

  const data = useMemo(() => {
    const filtered = selectedBarbeiro === '__todos__'
      ? rows
      : rows.filter(r => r[barbeiroField] === selectedBarbeiro);

    const map: Record<string, number> = {};
    filtered.forEach(r => {
      const d = r[dateField];
      if (!d) return;
      const ym = String(d).slice(0, 7); // YYYY-MM
      map[ym] = (map[ym] ?? 0) + 1;
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, qtd]) => ({
        mes: mes.split('-').reverse().join('/'), // MM/YYYY
        qtd,
      }));
  }, [rows, selectedBarbeiro, barbeiroField, dateField]);

  const avg = useMemo(() => {
    if (data.length === 0) return 0;
    return data.reduce((s, d) => s + d.qtd, 0) / data.length;
  }, [data]);

  const insight = useMemo(() => {
    if (data.length < 2) return null;
    const peak = data.reduce((best, d) => d.qtd > best.qtd ? d : best, data[0]);
    const lastTwo = data.slice(-2);
    const trend = lastTwo.length === 2 ? lastTwo[1].qtd - lastTwo[0].qtd : 0;
    const trendText = trend > 0 ? `↑ +${trend} no último mês` : trend < 0 ? `↓ ${trend} no último mês` : 'Estável no último mês';
    return `Pico: ${peak.mes} (${peak.qtd}). Média: ${avg.toFixed(1)}/mês. ${trendText}`;
  }, [data, avg]);

  if (rows.length === 0) return null;

  return (
    <Card className="border-border/50 mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <Select value={selectedBarbeiro} onValueChange={setSelectedBarbeiro}>
            <SelectTrigger className="h-7 w-[160px] text-[11px]">
              <SelectValue placeholder="Barbeiro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__" className="text-[11px]">Todos</SelectItem>
              {barbeiros.map(b => (
                <SelectItem key={b} value={b} className="text-[11px]">{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {description && (
          <p className="text-[10px] text-muted-foreground/70 mb-3">{description}</p>
        )}
        {data.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center py-4">Sem dados para exibir.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <ReferenceLine
                  y={avg}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{ value: `Média: ${avg.toFixed(1)}`, position: 'insideTopRight', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Bar dataKey="qtd" name="Clientes" fill={barColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {insight && (
              <div className="flex items-start gap-1.5 mt-3 p-2 rounded-md bg-muted/40 border border-border/30">
                {data.length >= 2 && data[data.length - 1].qtd >= data[data.length - 2].qtd
                  ? <TrendingUp className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  : <TrendingDown className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                }
                <p className="text-[10px] text-muted-foreground leading-relaxed">{insight}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

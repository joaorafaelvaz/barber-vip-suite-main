import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface Category {
  key: string;
  label: string;
  color: string;
}

interface Props {
  rows: any[];
  barbeiroField: string;
  categorize: (row: any) => string;
  categories: Category[];
  title: string;
  description?: string;
  onBarClick?: (barbeiroName: string) => void;
}

export function BarbeiroStackedBar({ rows, barbeiroField, categorize, categories, title, description, onBarClick }: Props) {
  const data = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    rows.forEach((r) => {
      const name = r[barbeiroField] || 'Sem Barbeiro';
      if (!map[name]) {
        map[name] = { name } as any;
        categories.forEach(c => { map[name][c.key] = 0; });
      }
      const cat = categorize(r);
      if (map[name][cat] !== undefined) map[name][cat]++;
    });
    return Object.values(map)
      .map(d => ({ ...d, _total: categories.reduce((s, c) => s + ((d as any)[c.key] ?? 0), 0) }))
      .sort((a, b) => (b as any)._total - (a as any)._total)
      .slice(0, 15);
  }, [rows, barbeiroField, categorize, categories]);

  // Insight automático: quem concentra mais da última categoria (pior)
  const insight = useMemo(() => {
    if (data.length === 0 || categories.length === 0) return null;
    const worstCat = categories[categories.length - 1];
    const totalWorst = data.reduce((s, d) => s + ((d as any)[worstCat.key] ?? 0), 0);
    if (totalWorst === 0) return null;
    const top = data.reduce((best, d) => ((d as any)[worstCat.key] ?? 0) > ((best as any)[worstCat.key] ?? 0) ? d : best, data[0]);
    const topVal = (top as any)[worstCat.key] ?? 0;
    const pct = totalWorst > 0 ? ((topVal / totalWorst) * 100).toFixed(0) : '0';
    return `${(top as any).name} concentra ${pct}% dos "${worstCat.label}" (${topVal} de ${totalWorst})`;
  }, [data, categories]);

  if (data.length === 0) return null;

  const chartHeight = Math.max(200, data.length * 36 + 60);
  const totalRows = data.reduce((s, d) => s + ((d as any)._total ?? 0), 0);

  return (
    <Card className="border-border/50 mb-4">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
        {description && (
          <p className="text-[10px] text-muted-foreground/70 mb-3">{description}</p>
        )}
        <p className="text-[10px] text-muted-foreground mb-3">Total: {totalRows} clientes</p>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {categories.map((c) => (
              <Bar
                key={c.key}
                dataKey={c.key}
                name={c.label}
                stackId="a"
                fill={c.color}
                radius={0}
                style={onBarClick ? { cursor: 'pointer' } : undefined}
                onClick={(_: any, index: number) => {
                  if (onBarClick && data[index]) {
                    onBarClick((data[index] as any).name);
                  }
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        {insight && (
          <div className="flex items-start gap-1.5 mt-3 p-2 rounded-md bg-muted/40 border border-border/30">
            <TrendingUp className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">{insight}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

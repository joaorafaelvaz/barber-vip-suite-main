import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TendenciaSemanalItem, CohortMensalItem } from '@/hooks/useClientesNovos';
import { InfoPopover } from '@/components/clientes/InfoPopover';

const INDICATORS = [
  { key: 'novos', label: 'Novos (qtd)', dataKey: 'novos', suffix: '', isPercent: false },
  { key: 'pct_ret_30d', label: 'Retenção 30d (%)', dataKey: 'pct_ret_30d', suffix: '%', isPercent: true },
  { key: 'pct_ret_60d', label: 'Retenção 60d (%)', dataKey: 'pct_ret_60d', suffix: '%', isPercent: true },
  { key: 'pct_ret_90d', label: 'Retenção 90d (%)', dataKey: 'pct_ret_90d', suffix: '%', isPercent: true },
];

interface Props {
  data: TendenciaSemanalItem[];
  periodoLabel: string;
  cohortData?: CohortMensalItem[];
}

export function ClientesNovosTendencia({ data, periodoLabel, cohortData }: Props) {
  const [indicator, setIndicator] = useState('novos');

  const useCohort = cohortData && cohortData.length > 0;
  const indicatorConfig = INDICATORS.find(i => i.key === indicator) ?? INDICATORS[0];

  const chartData = useMemo(() => {
    if (useCohort) {
      return cohortData!.map(d => ({
        ...d,
        label: new Date(d.mes + '-01T00:00:00Z').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      }));
    }
    if (!data?.length) return [];
    return data.map(d => ({
      ...d,
      label: new Date(d.semana_inicio + 'T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    }));
  }, [data, cohortData, useCohort]);

  if (!chartData.length) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium text-foreground flex-1">
            {useCohort ? 'Evolução Mensal' : 'Tendência Semanal'}
          </CardTitle>
          {useCohort && (
            <Select value={indicator} onValueChange={setIndicator}>
              <SelectTrigger className="w-[160px] h-7 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDICATORS.map(ind => (
                  <SelectItem key={ind.key} value={ind.key} className="text-xs">
                    {ind.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <InfoPopover
            title={useCohort ? 'Evolução Mensal de Indicadores' : 'Tendência Semanal de Clientes Novos'}
            description={useCohort
              ? 'Gráfico mensal com seletor de indicador. Escolha entre total de novos, retenção 30d, 60d ou 90d para acompanhar a evolução mês a mês.'
              : 'Quantidade de clientes novos por semana dentro do período selecionado.'}
            periodLabel={`Período: ${periodoLabel}`}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">{periodoLabel}</p>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                allowDecimals={indicatorConfig.isPercent}
                tickFormatter={indicatorConfig.isPercent ? (v: number) => `${v}%` : undefined}
              />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [
                  indicatorConfig.isPercent ? `${value.toFixed(1)}%` : value,
                  indicatorConfig.label,
                ]}
              />
              <Line
                type="monotone"
                dataKey={useCohort ? indicatorConfig.dataKey : 'novos'}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
                name={indicatorConfig.label}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

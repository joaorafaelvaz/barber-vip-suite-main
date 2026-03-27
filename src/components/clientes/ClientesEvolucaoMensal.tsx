// ============================================================
// FILE: src/components/clientes/ClientesEvolucaoMensal.tsx
// PROPÓSITO: Gráfico de evolução mensal de clientes
// ============================================================

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { EvolucaoMensalItem } from '@/hooks/useClientes';
import { fmtInt, fmtMesAno, fmtMoney } from '@/hooks/useClientes';
import { InfoPopover } from './InfoPopover';

interface Props {
  data: EvolucaoMensalItem[];
  periodoLabel: string;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as EvolucaoMensalItem;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-popover p-3 shadow-md text-xs space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">Clientes únicos: <span className="font-medium text-foreground">{fmtInt(d.clientes_unicos)}</span></p>
      <p className="text-muted-foreground">Novos: <span className="font-medium text-foreground">{fmtInt(d.clientes_novos)}</span></p>
      <p className="text-muted-foreground">Atendimentos: <span className="font-medium text-foreground">{fmtInt(d.atendimentos)}</span></p>
      <p className="text-muted-foreground">Faturamento: <span className="font-medium text-foreground">{fmtMoney(d.valor)}</span></p>
    </div>
  );
}

export function ClientesEvolucaoMensal({ data, periodoLabel }: Props) {
  const chartData = (data ?? []).map(d => ({
    ...d,
    label: fmtMesAno(d.ano_mes),
  }));

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-1 mb-3">
          <p className="text-xs font-medium text-muted-foreground flex-1">
            Evolução mensal • {periodoLabel}
          </p>
          <InfoPopover
            title="Evolução mensal de clientes"
            description="As barras mostram o total de clientes únicos atendidos em cada mês. A linha mostra quantos desses eram novos (primeira visita histórica naquele mês). Passe o mouse sobre as barras para ver detalhes."
            example="Se em Jan/26 a barra mostra 180 e a linha marca 25, significa que 180 clientes distintos vieram, dos quais 25 nunca tinham vindo antes."
            periodLabel={`Período: ${periodoLabel}`}
          />
        </div>

        {chartData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
            Sem dados para o período selecionado
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="clientes_unicos"
                  name="Únicos"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  opacity={0.8}
                />
                <Line
                  type="monotone"
                  dataKey="clientes_novos"
                  name="Novos"
                  stroke="hsl(142, 71%, 45%)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(142, 71%, 45%)' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex justify-center gap-6 mt-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2.5 rounded-sm bg-primary opacity-80" />
            Clientes únicos
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: 'hsl(142, 71%, 45%)' }} />
            Novos
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

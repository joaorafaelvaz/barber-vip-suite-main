// ============================================================
// FILE: src/components/clientes/ClientesEvolucaoChart.tsx
// PROPÓSITO: Gráfico de barras comparativo (atual vs anterior) por barbeiro
// ============================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import type { ChartBarberItem, PeriodoInfo } from '@/hooks/useClientes';
import { fmtInt, fmtPct } from '@/hooks/useClientes';
import { InfoPopover } from './InfoPopover';

interface ClientesEvolucaoChartProps {
  data: ChartBarberItem[];
  title: string;
  periodo?: PeriodoInfo;
  onBarClick?: (item: ChartBarberItem) => void;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ChartBarberItem;
  if (!d) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-popover p-3 shadow-md text-xs space-y-1">
      <p className="font-semibold text-foreground">{d.nome}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Atual:</span>
        <span className="font-medium text-foreground">{fmtInt(d.atual)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Anterior:</span>
        <span className="font-medium text-foreground">{fmtInt(d.anterior)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Variação:</span>
        <span className={`font-medium ${d.delta_abs > 0 ? 'text-emerald-500' : d.delta_abs < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
          {fmtPct(d.delta_pct)}
        </span>
      </div>
    </div>
  );
}

export function ClientesEvolucaoChart({ data, title, periodo, onBarClick }: ClientesEvolucaoChartProps) {
  if (!data.length) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Sem dados para o gráfico.</p>
        </CardContent>
      </Card>
    );
  }

  const periodLabel = periodo
    ? `Atual: ${periodo.atual.de} – ${periodo.atual.ate} | Anterior: ${periodo.anterior.de} – ${periodo.anterior.ate}`
    : undefined;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="flex-1 min-w-0">
            {title}
            {periodo && (
              <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                {periodo.atual.de} – {periodo.atual.ate} vs {periodo.anterior.de} – {periodo.anterior.ate}
              </span>
            )}
          </span>
          <InfoPopover
            title="Evolução por barbeiro"
            description="Cada barra mostra quantos clientes únicos o barbeiro atendeu. A barra cinza clara representa o período anterior. A cor da barra atual indica tendência: verde = cresceu, vermelha = caiu. Clique na barra para ver detalhes do barbeiro."
            example="Se João atendeu 45 clientes no período atual e 38 no anterior, a barra verde mostra crescimento de +18,4%."
            periodLabel={periodLabel}
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height: Math.max(250, data.length * 20 + 60) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 20, bottom: 5, left: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                type="category"
                dataKey="nome"
                width={100}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="anterior"
                name="Anterior"
                fill="hsl(var(--muted-foreground))"
                opacity={0.3}
                radius={[0, 4, 4, 0]}
                barSize={12}
              />
              <Bar
                dataKey="atual"
                name="Atual"
                radius={[0, 4, 4, 0]}
                barSize={12}
                cursor={onBarClick ? 'pointer' : 'default'}
                onClick={(entry: any) => {
                  if (onBarClick && entry) {
                    const item = data.find(d => d.nome === entry.nome);
                    if (item) onBarClick(item);
                  }
                }}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.colaborador_id}
                    fill={
                      entry.delta_abs > 0
                        ? 'hsl(var(--success))'
                        : entry.delta_abs < 0
                          ? 'hsl(var(--destructive))'
                          : 'hsl(var(--primary))'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {onBarClick && (
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Clique em uma barra para ver detalhes do barbeiro
          </p>
        )}
      </CardContent>
    </Card>
  );
}

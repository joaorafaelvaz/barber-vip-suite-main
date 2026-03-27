// ============================================================
// FILE: src/components/clientes/ClientesKpiCards.tsx
// PROPÓSITO: Cards KPI de clientes (4 cards: 30d, 60d, barbeiros, média)
// ============================================================

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, TrendingUp, TrendingDown, Minus, Scissors, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UnicosCardsItem, PeriodoInfo } from '@/hooks/useClientes';
import { fmtInt, fmtPct, calcPeriodo } from '@/hooks/useClientes';
import { InfoPopover } from './InfoPopover';

interface ClientesKpiCardsProps {
  unicosCards: Map<number, UnicosCardsItem>;
  barbeiroCount: number;
  mediaUnicos: number;
  refDate: string;
}

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  sub,
  info,
}: {
  label: string;
  value: string;
  delta?: number | null;
  icon: React.ElementType;
  sub?: string;
  info?: { title: string; description: string; example?: string; periodLabel?: string };
}) {
  const isPositive = delta !== undefined && delta !== null && delta > 0;
  const isNegative = delta !== undefined && delta !== null && delta < 0;
  const isNeutral = delta === null || delta === undefined || Math.abs(delta) < 0.1;

  return (
    <Card className="overflow-hidden relative group border-border/50">
      <div
        className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, transparent 60%)',
        }}
      />
      <CardContent className="relative p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-tight flex-1 min-w-0">
            {label}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {info && (
              <InfoPopover
                title={info.title}
                description={info.description}
                example={info.example}
                periodLabel={info.periodLabel}
              />
            )}
            <Icon className="h-4 w-4 opacity-60 text-primary" />
          </div>
        </div>

        <div className="text-2xl font-bold text-foreground mb-1">{value}</div>

        <div className="flex items-center gap-2 pt-1 border-t border-border/30">
          {sub && (
            <span className="text-[10px] text-muted-foreground">{sub}</span>
          )}
          {delta !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[10px] font-medium',
                isNeutral
                  ? 'text-muted-foreground'
                  : isPositive
                    ? 'text-emerald-500'
                    : 'text-red-500'
              )}
            >
              {isNeutral ? (
                <Minus className="h-2.5 w-2.5" />
              ) : isPositive ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" />
              )}
              {fmtPct(delta)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ClientesKpiCards({ unicosCards, barbeiroCount, mediaUnicos, refDate }: ClientesKpiCardsProps) {
  const c30 = unicosCards.get(30);
  const c60 = unicosCards.get(60);
  const p30 = calcPeriodo(refDate, 30);
  const p60 = calcPeriodo(refDate, 60);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        icon={Users}
        label={`Únicos 30d`}
        value={fmtInt(c30?.barbearia_atual)}
        delta={c30?.delta_pct}
        sub={c30 ? `Ant: ${fmtInt(c30.barbearia_anterior)}` : undefined}
        info={{
          title: 'Clientes únicos — 30 dias',
          description: 'Quantidade de clientes distintos atendidos nos últimos 30 dias. Se um cliente veio 3 vezes, conta como 1. O delta (Δ) mostra a variação percentual em relação ao período anterior de 30 dias.',
          example: 'Se 150 clientes vieram de 29/jan a 27/fev, e no período anterior (30/dez a 28/jan) foram 142, o delta é +5,6%.',
          periodLabel: `Atual: ${p30.atual.de} – ${p30.atual.ate} | Anterior: ${p30.anterior.de} – ${p30.anterior.ate}`,
        }}
      />
      <KpiCard
        icon={Users}
        label={`Únicos 60d`}
        value={fmtInt(c60?.barbearia_atual)}
        delta={c60?.delta_pct}
        sub={c60 ? `Ant: ${fmtInt(c60.barbearia_anterior)}` : undefined}
        info={{
          title: 'Clientes únicos — 60 dias',
          description: 'Mesma lógica do indicador de 30 dias, mas com uma janela de 60 dias. Captura clientes com ciclo de retorno mais longo.',
          example: 'Um cliente que vem a cada 45 dias apareceria aqui mas talvez não no indicador de 30d.',
          periodLabel: `Atual: ${p60.atual.de} – ${p60.atual.ate} | Anterior: ${p60.anterior.de} – ${p60.anterior.ate}`,
        }}
      />
      <KpiCard
        icon={Scissors}
        label="Barbeiros ativos"
        value={fmtInt(barbeiroCount)}
        sub="No período"
        info={{
          title: 'Barbeiros ativos',
          description: 'Quantidade de barbeiros que atenderam ao menos 1 cliente no período selecionado (janela de 30d ou 60d).',
          example: 'Se 5 barbeiros estão cadastrados, mas apenas 4 atenderam no período, o valor será 4.',
        }}
      />
      <KpiCard
        icon={BarChart3}
        label="Média / barbeiro"
        value={fmtInt(mediaUnicos)}
        sub="Clientes únicos"
        info={{
          title: 'Média de clientes por barbeiro',
          description: 'Total de clientes únicos da barbearia dividido pelo número de barbeiros ativos. Indica a produtividade média.',
          example: '200 clientes únicos ÷ 5 barbeiros = 40 clientes/barbeiro.',
        }}
      />
    </div>
  );
}

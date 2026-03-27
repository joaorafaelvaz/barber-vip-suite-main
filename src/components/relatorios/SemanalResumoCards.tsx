// ============================================================
// FILE: src/components/relatorios/SemanalResumoCards.tsx
// PROPÓSITO: Cards de KPIs acumulados do período
// ============================================================

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Users, ShoppingBag, Scissors, TrendingUp, Banknote, Gift } from 'lucide-react';
import type { AcumuladoMes } from '@/types/relatorio-semanal';

interface SemanalResumoCardsProps {
  acumulado: AcumuladoMes;
}

function fmtCur(v: number): string {
  if (v >= 1000) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v);
}

export function SemanalResumoCards({ acumulado }: SemanalResumoCardsProps) {
  const cards = [
    {
      title: 'Faturamento',
      value: fmtCur(acumulado.faturamento),
      subtitle: `${acumulado.dias_trabalhados} dias trabalhados`,
      icon: DollarSign,
      color: 'text-emerald-400',
      iconBg: 'bg-emerald-400/10',
      always: true,
    },
    {
      title: 'Atendimentos',
      value: acumulado.atendimentos.toString(),
      subtitle: `TM ${fmtCur(acumulado.ticket_medio)}`,
      icon: Users,
      color: 'text-blue-400',
      iconBg: 'bg-blue-400/10',
      always: true,
    },
    {
      title: 'Ticket Médio',
      value: fmtCur(acumulado.ticket_medio),
      subtitle: `${acumulado.atendimentos} atend.`,
      icon: TrendingUp,
      color: 'text-amber-400',
      iconBg: 'bg-amber-400/10',
      always: true,
    },
    {
      title: 'Extras',
      value: acumulado.extras_qtd.toString(),
      subtitle: fmtCur(acumulado.extras_valor),
      icon: ShoppingBag,
      color: 'text-purple-400',
      iconBg: 'bg-purple-400/10',
      always: true,
    },
    {
      title: 'Serviços',
      value: acumulado.servicos_totais.toString(),
      subtitle: `${acumulado.clientes_novos} novos clientes`,
      icon: Scissors,
      color: 'text-rose-400',
      iconBg: 'bg-rose-400/10',
      always: true,
    },
    {
      title: 'Comissão',
      value: fmtCur(acumulado.comissao),
      subtitle: acumulado.faturamento > 0
        ? `${((acumulado.comissao / acumulado.faturamento) * 100).toFixed(1)}% do faturamento`
        : '—',
      icon: Banknote,
      color: 'text-amber-400',
      iconBg: 'bg-amber-400/10',
      always: false,
      show: acumulado.comissao > 0,
    },
    {
      title: 'Bônus',
      value: fmtCur(acumulado.bonus),
      subtitle: 'Bônus acumulado',
      icon: Gift,
      color: 'text-emerald-400',
      iconBg: 'bg-emerald-400/10',
      always: false,
      show: acumulado.bonus > 0,
    },
  ].filter(c => c.always || c.show);

  const cols = cards.length <= 5
    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7';

  return (
    <div className={`grid ${cols} gap-3`}>
      {cards.map((card) => (
        <Card key={card.title} className="bg-card/50 border-border/40 hover:border-border/70 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-medium text-muted-foreground">{card.title}</span>
              <div className={`h-7 w-7 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
              </div>
            </div>
            <div className="text-xl font-bold text-foreground leading-none mb-1.5">{card.value}</div>
            <div className="text-[11px] text-muted-foreground">{card.subtitle}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default SemanalResumoCards;

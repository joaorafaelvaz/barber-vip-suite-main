/**
 * Cards de resumo das comissões
 */

import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Users, Percent, TrendingUp } from 'lucide-react';
import { ResumoComissoes } from '@/types/comissao';

interface ComissaoResumoCardsProps {
  resumo: ResumoComissoes;
  isLoading?: boolean;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ComissaoResumoCards({ resumo, isLoading }: ComissaoResumoCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded mb-2 w-16" />
              <div className="h-6 bg-muted rounded w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Faturamento',
      value: formatBRL(resumo.total_faturamento),
      icon: TrendingUp,
      color: 'text-blue-500',
    },
    {
      title: 'Comissões',
      value: formatBRL(resumo.total_comissoes),
      icon: DollarSign,
      color: 'text-green-500',
    },
    {
      title: '% Médio',
      value: `${resumo.percentual_medio.toFixed(1)}%`,
      icon: Percent,
      color: 'text-amber-500',
    },
    {
      title: 'Colaboradores',
      value: resumo.total_colaboradores.toString(),
      subtitle: `Média: ${formatBRL(resumo.media_por_colaborador)}`,
      icon: Users,
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground">{card.title}</span>
            </div>
            <div className="text-sm sm:text-lg font-semibold text-foreground">{card.value}</div>
            {card.subtitle && (
              <div className="text-xs text-muted-foreground">{card.subtitle}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

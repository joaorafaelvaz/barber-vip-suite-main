import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Percent, RefreshCw, Clock, CheckCircle, DollarSign } from 'lucide-react';
import type { NovosKpis } from '@/hooks/useClientesNovos';
import { fmtInt, fmtPct, fmtMoney } from '@/hooks/useClientes';
import { InfoPopover } from '@/components/clientes/InfoPopover';

interface Props {
  kpis: NovosKpis;
  periodoLabel: string;
}

function buildSub(kpis: NovosKpis, key: string): string {
  switch (key) {
    case 'novos':
      return `Primeira visita no período`;
    case 'pct_novos': {
      const unicos = kpis.pct_novos_sobre_unicos > 0
        ? Math.round(kpis.novos_total / (kpis.pct_novos_sobre_unicos / 100))
        : 0;
      return unicos > 0
        ? `${fmtInt(kpis.novos_total)} novos em ${fmtInt(unicos)} únicos`
        : '';
    }
    case 'retencao_30d': {
      const voltaram = Math.round(kpis.novos_total * (kpis.retencao_30d ?? 0) / 100);
      return `${fmtInt(voltaram)} de ${fmtInt(kpis.novos_total)} voltaram em 30d`;
    }
    case 'recorrente_60d': {
      const recorr = Math.round(kpis.novos_total * (kpis.pct_recorrente_60d ?? 0) / 100);
      return `${fmtInt(recorr)} vieram 2+ vezes em 60d`;
    }
    case 'tempo_2a':
      return kpis.tempo_mediano_2a_visita != null
        ? `Metade voltou em até ${Math.round(kpis.tempo_mediano_2a_visita)}d`
        : '';
    case 'ticket':
      return `Gasto médio na 1ª visita`;
    default:
      return '';
  }
}

export function ClientesNovosKpis({ kpis, periodoLabel }: Props) {
  const cards = [
    {
      label: 'Novos',
      value: fmtInt(kpis.novos_total),
      icon: Users,
      subKey: 'novos',
      info: {
        title: 'Clientes Novos (Total)',
        description: 'Quantidade de clientes que visitaram a barbearia pela primeira vez dentro do período selecionado.',
        example: 'Se o período é Dez/2025 a Fev/2026 e o cliente João nunca tinha registro antes, mas veio em 15/Jan/2026, ele é contado como novo.',
      },
    },
    {
      label: '% Novos',
      value: `${kpis.pct_novos_sobre_unicos?.toFixed(1) ?? '0'}%`,
      icon: Percent,
      subKey: 'pct_novos',
      info: {
        title: '% Novos sobre Únicos',
        description: 'Percentual de clientes novos em relação ao total de clientes únicos no período.',
        example: 'Se 1.000 únicos e 130 novos → 13%. Caindo = captação diminuindo ou base recorrente crescendo.',
      },
    },
    {
      label: 'Retenção 30d',
      value: `${kpis.retencao_30d?.toFixed(1) ?? '0'}%`,
      icon: RefreshCw,
      subKey: 'retencao_30d',
      info: {
        title: 'Retenção 30 dias',
        description: 'Percentual de novos que voltaram em até 30 dias após a primeira visita.',
        example: 'Se 100 novos e 25 voltaram em 30d → 25%. Abaixo de 20% indica oportunidade de melhoria.',
      },
    },
    {
      label: '% Recorrentes 60d',
      value: `${kpis.pct_recorrente_60d?.toFixed(1) ?? '0'}%`,
      icon: CheckCircle,
      subKey: 'recorrente_60d',
      info: {
        title: '% Recorrentes em 60 dias',
        description: 'Novos que vieram 2+ vezes em 60 dias. Principal KPI de conversão.',
        example: 'Se 100 novos e 30 vieram 2+ vezes → 30%. Meta saudável: acima de 35%.',
      },
    },
    {
      label: 'Tempo mediano 2ª visita',
      value: kpis.tempo_mediano_2a_visita != null ? `${Math.round(kpis.tempo_mediano_2a_visita)}d` : '—',
      icon: Clock,
      subKey: 'tempo_2a',
      info: {
        title: 'Tempo Mediano até 2ª Visita',
        description: 'Mediana de dias entre a 1ª e 2ª visita dos novos que retornaram.',
        example: 'Se mediana é 20d, metade voltou em até 20 dias. Se > 30d, antecipar ações de retorno.',
      },
    },
    {
      label: 'Ticket 1ª visita',
      value: fmtMoney(kpis.ticket_primeira_visita),
      icon: DollarSign,
      subKey: 'ticket',
      info: {
        title: 'Ticket Médio da 1ª Visita',
        description: 'Valor médio gasto na primeira visita. Compare com ticket geral para oportunidades.',
        example: 'Se ticket 1ª visita R$75 e geral R$95, há espaço para venda cruzada já na primeira visita.',
      },
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const sub = buildSub(kpis, c.subKey);
        return (
          <Card key={c.label} className="bg-card border-border">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-1.5">
                <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-foreground">{c.label}</span>
                <InfoPopover
                  title={c.info.title}
                  description={c.info.description}
                  example={c.info.example}
                  periodLabel={`Período: ${periodoLabel}`}
                />
              </div>
              <p className="text-xl font-bold text-foreground">{c.value}</p>
              {sub && <p className="text-[9px] text-muted-foreground leading-snug">{sub}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

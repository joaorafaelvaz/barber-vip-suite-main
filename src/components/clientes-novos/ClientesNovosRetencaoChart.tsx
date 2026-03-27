// ============================================================
// Gráfico de distribuição de retenção de clientes novos
// ============================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoPopover } from '@/components/clientes/InfoPopover';

const FAIXA_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  ATE_30D: {
    label: 'Retornou ≤30d',
    color: 'hsl(var(--success))',
    desc: 'Clientes novos que retornaram em até 30 dias após a primeira visita.',
  },
  '31_45D': {
    label: 'Retornou 31-45d',
    color: 'hsl(var(--info))',
    desc: 'Clientes novos que retornaram entre 31 e 45 dias após a primeira visita.',
  },
  '46_60D': {
    label: 'Retornou 46-60d+',
    color: 'hsl(var(--warning))',
    desc: 'Clientes novos que retornaram após 45 dias da primeira visita.',
  },
  AGUARDANDO: {
    label: 'Aguardando retorno',
    color: 'hsl(45, 93%, 47%)',
    desc: 'Clientes novos que ainda não retornaram, mas a primeira visita foi recente (≤30 dias). Ainda dentro da janela normal de retorno.',
  },
  NAO_30D: {
    label: 'Não retornou >30d',
    color: 'hsl(25, 95%, 53%)',
    desc: 'Clientes novos que não retornaram e a primeira visita foi há 31-60 dias. Atenção: estão se afastando.',
  },
  NAO_60D: {
    label: 'Não retornou >60d',
    color: 'hsl(0, 84%, 60%)',
    desc: 'Clientes novos que não retornaram e a primeira visita foi há mais de 60 dias. Provavelmente perdidos.',
  },
};

export interface RetencaoDistItem {
  faixa: string;
  count: number;
  pct: number;
}

interface Props {
  data: RetencaoDistItem[];
  periodoLabel: string;
  onDrillFaixa?: (faixa: string, label: string) => void;
}

export function ClientesNovosRetencaoChart({ data, periodoLabel, onDrillFaixa }: Props) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1">
          <CardTitle className="text-sm font-semibold">Distribuição de Retenção de Novos</CardTitle>
          <InfoPopover
            title="Distribuição de Retenção"
            description="Mostra em quanto tempo os clientes novos retornaram após sua primeira visita. Clique em cada faixa para ver os clientes detalhados com análise por barbeiro."
            example="Se 60% retornou em até 30 dias, indica boa retenção imediata. Se a maioria não retornou, há oportunidade de melhoria no pós-primeira visita."
            periodLabel={periodoLabel}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stacked bar */}
        <div className="flex w-full h-8 rounded-md overflow-hidden">
          {data.map((item) => {
            const cfg = FAIXA_CONFIG[item.faixa];
            if (!cfg || item.count === 0) return null;
            return (
              <div
                key={item.faixa}
                className="h-full cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center"
                style={{ width: `${item.pct}%`, backgroundColor: cfg.color, minWidth: item.pct > 0 ? '2px' : 0 }}
                title={`${cfg.label}: ${item.count} (${item.pct}%)`}
                onClick={() => onDrillFaixa?.(item.faixa, cfg.label)}
              >
                {item.pct >= 10 && (
                  <span className="text-[10px] font-bold text-white drop-shadow-sm">
                    {item.pct.toFixed(0)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {data.map((item) => {
            const cfg = FAIXA_CONFIG[item.faixa];
            if (!cfg) return null;
            return (
              <div
                key={item.faixa}
                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors"
                onClick={() => onDrillFaixa?.(item.faixa, cfg.label)}
              >
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: cfg.color }} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{cfg.label}</div>
                  <div className="text-muted-foreground">{item.count} ({item.pct}%)</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

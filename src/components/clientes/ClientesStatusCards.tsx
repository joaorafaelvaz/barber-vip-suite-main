// ============================================================
// FILE: src/components/clientes/ClientesStatusCards.tsx
// PROPÓSITO: Cards de distribuição por status de cliente (clicáveis para drill)
// ============================================================

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import type { StatusDistItem } from '@/hooks/useClientes';
import { fmtInt, STATUS_CONFIG } from '@/hooks/useClientes';
import { InfoPopover } from './InfoPopover';

interface ClientesStatusCardsProps {
  distribuicao: StatusDistItem[];
  total: number;
  periodoLabel: string;
  refDate?: string;
  onDrillFaixa?: (tipo: string, valor: string, label: string) => void;
}

export function ClientesStatusCards({
  distribuicao,
  total,
  periodoLabel,
  refDate,
  onDrillFaixa,
}: ClientesStatusCardsProps) {
  const ALL_STATUSES = ['ATIVO_VIP', 'ATIVO_FORTE', 'ATIVO_LEVE', 'AGUARDANDO_RETORNO', 'EM_RISCO', 'PERDIDO'];

  const refFormatted = refDate ? format(parseISO(refDate), 'dd/MM/yyyy') : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <p className="text-xs font-medium text-muted-foreground">
          Distribuição por status • {refFormatted ? `Foto em ${refFormatted}` : periodoLabel}
        </p>
        <InfoPopover
          title="Classificação de clientes por status"
          description="Esta é uma fotografia da base na data de referência. Cada cliente é classificado com base na sua cadência de visitas calculada até essa data. Clique em qualquer card para ver os clientes detalhados por barbeiro."
          example="Se um cliente vem a cada 15 dias e já se passaram 10 dias desde a última visita (67% da cadência), ele é VIP. Se passaram 30 dias (200%), está Em Risco."
          periodLabel={refFormatted ? `Data de referência: ${refFormatted}` : `Referência: ${periodoLabel}`}
        />
      </div>
      {refFormatted && (
        <p className="text-[10px] text-muted-foreground/60 -mt-1">
          Situação calculada em {refFormatted}. Para ver dados atuais, selecione período que termine no mês corrente.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {ALL_STATUSES.map(status => {
          const config = STATUS_CONFIG[status];
          const item = distribuicao.find(d => d.status === status);
          const count = item?.count ?? 0;
          const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';

          return (
            <Card
              key={status}
              className={cn(
                'cursor-pointer transition-all border hover:shadow-md hover:scale-[1.02]',
                config.bgClass,
              )}
              onClick={() => onDrillFaixa?.('STATUS', status, `Status: ${config.label}`)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                    {config.label}
                  </span>
                  <div onClick={e => e.stopPropagation()}>
                    <InfoPopover
                      title={`Status: ${config.label}`}
                      description={config.description}
                      periodLabel={`Referência: ${periodoLabel}`}
                    />
                  </div>
                </div>
                <p className="text-[8px] text-muted-foreground/70 leading-tight mb-1">{config.subtitle}</p>
                <div className="text-xl font-bold text-foreground">{fmtInt(count)}</div>
                <div className="text-[10px] text-muted-foreground">{pct}% do total</div>
                <div className="text-[9px] text-muted-foreground/70 mt-0.5">{config.shortDesc}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

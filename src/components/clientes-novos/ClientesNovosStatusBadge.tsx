import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { StatusNovo } from '@/hooks/useClientesNovos';

const STATUS_CONFIG: Record<StatusNovo, { label: string; className: string }> = {
  NOVO_1X: { label: '1 visita', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  NOVO_RECORRENTE: { label: 'Recorrente', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  NOVO_VOLTOU_TARDE: { label: 'Voltou tarde', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  NOVO_COMPARTILHADO: { label: 'Compartilhado', className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  NOVO_FIEL: { label: 'Fiel', className: 'bg-green-500/15 text-green-300 border-green-500/30' },
};

interface Props {
  status: StatusNovo;
}

export function ClientesNovosStatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: '' };
  return (
    <Badge variant="outline" className={`text-[10px] font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

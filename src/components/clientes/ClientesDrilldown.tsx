// ============================================================
// FILE: src/components/clientes/ClientesDrilldown.tsx
// PROPÓSITO: Drilldown de clientes por barbeiro (compartilhados/exclusivos)
// ============================================================

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { ClientesTable, type ColumnDef } from './ClientesTable';
import type { DrillRow, RpcClientesListaCarteira, DrillModo, Janela, PeriodoInfo } from '@/hooks/useClientes';
import { fmtInt, fmtMoney } from '@/hooks/useClientes';
import { InfoPopover } from './InfoPopover';

interface ClientesDrilldownProps {
  barbeiroNome: string;
  janela: Janela;
  modo: DrillModo;
  onSetModo: (m: DrillModo) => void;
  page: number;
  onSetPage: (p: number) => void;
  data: RpcClientesListaCarteira | null;
  totalPages: number;
  onExport: () => void;
  onRefresh: () => void;
  onBack: () => void;
  loading: boolean;
  periodo?: PeriodoInfo;
}

const COLUMNS: ColumnDef<DrillRow>[] = [
  { key: 'cliente_nome', label: 'Cliente' },
  { key: 'telefone', label: 'Telefone', render: r => r.telefone ?? '—', hideOnMobile: true },
  { key: 'ultima_visita', label: 'Últ. visita', align: 'right' },
  { key: 'dias_com_presenca', label: 'Dias', align: 'right', render: r => fmtInt(r.dias_com_presenca) },
  { key: 'itens_no_periodo', label: 'Itens', align: 'right', render: r => fmtInt(r.itens_no_periodo) },
  { key: 'gasto_no_periodo', label: 'Gasto', align: 'right', render: r => fmtMoney(r.gasto_no_periodo) },
  {
    key: 'qtd_barbeiros',
    label: 'Barbeiros',
    align: 'center',
    render: r => (
      <Badge variant={r.qtd_barbeiros > 1 ? 'default' : 'secondary'} className="text-[10px]">
        {r.qtd_barbeiros}
      </Badge>
    ),
  },
  {
    key: 'barbeiros',
    label: 'Barbeiros visitados',
    hideOnMobile: true,
    render: r => Array.isArray(r.barbeiros) ? r.barbeiros.join(', ') : '—',
  },
];

export function ClientesDrilldown({
  barbeiroNome,
  janela,
  modo,
  onSetModo,
  page,
  onSetPage,
  data,
  totalPages,
  onExport,
  onRefresh,
  onBack,
  loading,
  periodo,
}: ClientesDrilldownProps) {
  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];

  const periodLabel = periodo
    ? `${periodo.atual.de} – ${periodo.atual.ate}`
    : `${janela}d`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground truncate">
            {barbeiroNome}
          </h2>
          <p className="text-xs text-muted-foreground">
            Carteira {periodLabel} • {modo === 'COMPARTILHADOS' ? 'Compartilhados' : 'Exclusivos'} • {fmtInt(total)} clientes
          </p>
        </div>
        <InfoPopover
          title="Lista de clientes da carteira"
          description="Esta tabela mostra os clientes do barbeiro selecionado, filtrados por tipo (exclusivos ou compartilhados). Entenda cada coluna:"
          example={`• Dias: em quantos dias distintos o cliente veio no período.\n• Itens: total de serviços/produtos consumidos.\n• Gasto: valor total gasto pelo cliente.\n• Barbeiros: quantos barbeiros diferentes atenderam este cliente (se > 1, é compartilhado).`}
          periodLabel={periodo ? `Período: ${periodo.atual.de} – ${periodo.atual.ate}` : undefined}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Modo toggle */}
        <div className="flex rounded-md overflow-hidden border border-border">
          <Button
            variant={modo === 'COMPARTILHADOS' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none text-xs h-8"
            onClick={() => onSetModo('COMPARTILHADOS')}
          >
            Compartilhados
          </Button>
          <Button
            variant={modo === 'EXCLUSIVOS' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none text-xs h-8"
            onClick={() => onSetModo('EXCLUSIVOS')}
          >
            Exclusivos
          </Button>
        </div>

        <div className="flex-1" />

        {/* Pagination */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0 || loading} onClick={() => onSetPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground px-2 min-w-[60px] text-center">
            {page + 1}/{totalPages}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1 || loading} onClick={() => onSetPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" className="h-8" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button variant="outline" size="sm" className="h-8" onClick={onExport} disabled={loading}>
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline ml-1">CSV</span>
        </Button>
      </div>

      {/* Table */}
      <ClientesTable<DrillRow>
        title={`Clientes ${modo === 'COMPARTILHADOS' ? 'compartilhados' : 'exclusivos'} • ${periodLabel}`}
        columns={COLUMNS}
        rows={rows}
      />
    </div>
  );
}

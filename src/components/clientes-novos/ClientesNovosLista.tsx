import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { NovosLista, ListaModo, NovoListaRow } from '@/hooks/useClientesNovos';
import { ClientesNovosStatusBadge } from './ClientesNovosStatusBadge';
import { fmtInt, fmtMoney } from '@/hooks/useClientes';
import { InfoPopover } from '@/components/clientes/InfoPopover';

const MODOS: { value: ListaModo; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'NAO_VOLTARAM', label: 'Não voltaram' },
  { value: 'TROCARAM_BARBEIRO', label: 'Trocaram barbeiro' },
  { value: 'FIEIS', label: 'Fiéis' },
];

interface Props {
  data: NovosLista | null;
  modo: ListaModo;
  onSetModo: (m: ListaModo) => void;
  page: number;
  onSetPage: (p: number) => void;
  totalPages: number;
  filtroBarbeiroNome: string;
  onClearBarbeiro: () => void;
  onExport: () => void;
  loading: boolean;
  periodoLabel: string;
}

export function ClientesNovosLista({
  data, modo, onSetModo, page, onSetPage, totalPages,
  filtroBarbeiroNome, onClearBarbeiro, onExport, loading, periodoLabel,
}: Props) {
  const rows = data?.rows ?? [];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-foreground">Clientes Novos — Lista</CardTitle>
              <InfoPopover
                title="Lista de Clientes Novos"
                description="Tabela detalhada com todos os clientes novos do período, mostrando informações de contato, status de conversão e métricas de engajamento. Use os filtros acima para segmentar por tipo: Todos, Não voltaram (risco), Trocaram barbeiro (migração) ou Fiéis (melhores casos)."
                example="Use o filtro 'Não voltaram' para encontrar clientes que vieram apenas 1 vez e estão em risco de não retornar. Estes são os melhores candidatos para uma ação de reativação via WhatsApp ou contato telefônico."
                periodLabel={`Período: ${periodoLabel}`}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {data ? `${fmtInt(data.total)} clientes` : '—'} • {periodoLabel}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onExport} disabled={loading}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        </div>

        {/* Modo toggles */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {MODOS.map((m) => (
            <Button
              key={m.value}
              variant={modo === m.value ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => { onSetModo(m.value); onSetPage(0); }}
            >
              {m.label}
            </Button>
          ))}
        </div>

        {filtroBarbeiroNome && (
          <Badge variant="secondary" className="mt-1 gap-1 text-xs cursor-pointer" onClick={onClearBarbeiro}>
            Barbeiro: {filtroBarbeiroNome}
            <X className="h-3 w-3" />
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {/* Mobile: cards */}
        <div className="sm:hidden">
          {rows.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">
              {loading ? 'Carregando...' : 'Nenhum cliente encontrado.'}
            </p>
          ) : (
            <div className="space-y-2 p-3">
              {rows.map((r: NovoListaRow) => (
                <div key={r.cliente_id} className="p-3 rounded-md bg-muted/20 border border-border/30">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-foreground truncate flex-1">{r.cliente_nome}</span>
                    <ClientesNovosStatusBadge status={r.status_novo} />
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <p>
                      Barb: <span className="text-foreground">{r.barbeiro_aquisicao_nome}</span>
                      {' • '}{r.total_visitas_60d} visitas
                      {' • '}{fmtMoney(r.gasto_60d)}
                    </p>
                    <p>
                      1ª visita: <span className="text-foreground">{new Date(r.first_seen + 'T00:00:00Z').toLocaleDateString('pt-BR')}</span>
                      {' • '}{r.dias_desde_first_seen}d
                      {modo === 'TROCARAM_BARBEIRO' && r.barbeiro_2a_visita_nome && (
                        <> • 2ª: <span className="text-foreground">{r.barbeiro_2a_visita_nome}</span></>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs text-foreground">Cliente</TableHead>
                <TableHead className="text-xs text-foreground hidden lg:table-cell">Telefone</TableHead>
                <TableHead className="text-xs text-foreground">1ª Visita</TableHead>
                <TableHead className="text-xs text-foreground">Barbeiro Aquisição</TableHead>
                <TableHead className="text-xs text-foreground">Status</TableHead>
                <TableHead className="text-xs text-right text-foreground">Visitas 60d</TableHead>
                <TableHead className="text-xs text-right text-foreground hidden lg:table-cell">Gasto 60d</TableHead>
                {modo === 'TROCARAM_BARBEIRO' && (
                  <TableHead className="text-xs text-foreground">Barb. 2ª visita</TableHead>
                )}
                <TableHead className="text-xs text-right text-foreground">Dias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-8">
                    {loading ? 'Carregando...' : 'Nenhum cliente encontrado.'}
                  </TableCell>
                </TableRow>
              ) : rows.map((r: NovoListaRow) => (
                <TableRow key={r.cliente_id}>
                  <TableCell className="text-xs font-medium max-w-[140px] truncate text-foreground">{r.cliente_nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">{r.telefone ?? '—'}</TableCell>
                  <TableCell className="text-xs">{new Date(r.first_seen + 'T00:00:00Z').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-xs">{r.barbeiro_aquisicao_nome}</TableCell>
                  <TableCell><ClientesNovosStatusBadge status={r.status_novo} /></TableCell>
                  <TableCell className="text-xs text-right">{r.total_visitas_60d}</TableCell>
                  <TableCell className="text-xs text-right hidden lg:table-cell">{fmtMoney(r.gasto_60d)}</TableCell>
                  {modo === 'TROCARAM_BARBEIRO' && (
                    <TableCell className="text-xs">{r.barbeiro_2a_visita_nome ?? '—'}</TableCell>
                  )}
                  <TableCell className="text-xs text-right">{r.dias_desde_first_seen}d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => onSetPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => onSetPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

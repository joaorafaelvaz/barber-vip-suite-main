import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { BarbeiroAquisicaoItem } from '@/hooks/useClientesNovos';
import { fmtInt, fmtMoney } from '@/hooks/useClientes';
import { InfoPopover } from '@/components/clientes/InfoPopover';

interface Props {
  barbeiros: BarbeiroAquisicaoItem[];
  periodoLabel: string;
  onSelectBarbeiro: (id: string, nome: string) => void;
}

export function ClientesNovosBarbeirosTable({ barbeiros, periodoLabel, onSelectBarbeiro }: Props) {
  if (!barbeiros?.length) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-foreground">Novos por Barbeiro de Aquisição</CardTitle>
          <InfoPopover
            title="Tabela: Novos por Barbeiro de Aquisição"
            description="Mostra a performance de cada barbeiro na captação e conversão de clientes novos. O 'barbeiro de aquisição' é quem atendeu o cliente na sua primeira visita. Clique em um barbeiro para ver a lista detalhada dos clientes novos dele."
            example="Se o barbeiro João tem 42 novos, Ret. 30d = 16.7% e % Fiéis = 14.3%, significa que dos 42 clientes que vieram pela primeira vez com ele, 16.7% voltaram em até 30 dias e 14.3% se tornaram fiéis (2+ visitas com o mesmo barbeiro)."
            periodLabel={`Período: ${periodoLabel}`}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">Clique no barbeiro para ver a lista filtrada • {periodoLabel}</p>
      </CardHeader>
      <CardContent className="p-0 sm:p-0">
        {/* Mobile: cards */}
        <div className="space-y-2 p-3 sm:hidden">
          {barbeiros.map((b) => (
            <div
              key={b.colaborador_id}
              className="p-3 rounded-md bg-muted/20 border border-border/30 cursor-pointer hover:bg-muted/40 transition-colors active:bg-muted/60"
              onClick={() => onSelectBarbeiro(b.colaborador_id, b.colaborador_nome)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground truncate flex-1">{b.colaborador_nome}</span>
                <span className="text-xs font-bold text-primary ml-2">{fmtInt(b.novos)} novos</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ret. 30d</span>
                  <span className="font-medium text-foreground">{b.retencao_30d?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ret. 60d</span>
                  <span className="font-medium text-foreground">{b.retencao_60d?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">% Recorr.</span>
                  <span className="font-medium text-foreground">{b.pct_recorrente_60d?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">% Fiéis</span>
                  <span className="font-medium text-foreground">{b.pct_fieis?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Ticket Novo</span>
                  <span className="font-medium text-foreground">{fmtMoney(b.ticket_medio_novo)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs text-foreground">Barbeiro</TableHead>
                <TableHead className="text-xs text-right text-foreground">Novos</TableHead>
                <TableHead className="text-xs text-right text-foreground">Ret. 30d</TableHead>
                <TableHead className="text-xs text-right text-foreground">Ret. 60d</TableHead>
                <TableHead className="text-xs text-right text-foreground">% Recorr.</TableHead>
                <TableHead className="text-xs text-right text-foreground">% Fiéis</TableHead>
                <TableHead className="text-xs text-right text-foreground">Ticket Novo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {barbeiros.map((b) => (
                <TableRow
                  key={b.colaborador_id}
                  className="cursor-pointer hover:bg-accent/10"
                  onClick={() => onSelectBarbeiro(b.colaborador_id, b.colaborador_nome)}
                >
                  <TableCell className="text-xs font-medium text-foreground">{b.colaborador_nome}</TableCell>
                  <TableCell className="text-xs text-right text-foreground">{fmtInt(b.novos)}</TableCell>
                  <TableCell className="text-xs text-right text-foreground">{b.retencao_30d?.toFixed(1)}%</TableCell>
                  <TableCell className="text-xs text-right text-foreground">{b.retencao_60d?.toFixed(1)}%</TableCell>
                  <TableCell className="text-xs text-right text-foreground">{b.pct_recorrente_60d?.toFixed(1)}%</TableCell>
                  <TableCell className="text-xs text-right text-foreground">{b.pct_fieis?.toFixed(1)}%</TableCell>
                  <TableCell className="text-xs text-right">{fmtMoney(b.ticket_medio_novo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

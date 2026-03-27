import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InfoPopover } from './InfoPopover';

function fmtPct(v: number | null | undefined) {
  if (v == null) return '—';
  return `${(v * 100).toFixed(1)}%`;
}
function fmtInt(v: number | null | undefined) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR').format(v);
}

function churnBarColor(v: number): string {
  const pct = v * 100;
  if (pct < 5) return 'bg-emerald-500';
  if (pct < 10) return 'bg-yellow-500';
  if (pct < 15) return 'bg-orange-500';
  return 'bg-red-500';
}

function churnRowClass(v: number): string {
  return v * 100 > 15 ? 'bg-red-500/5' : '';
}

function churnBorderClass(v: number): string {
  const pct = v * 100;
  if (pct > 15) return 'border-red-500/40';
  if (pct > 10) return 'border-orange-500/30';
  return 'border-border/50';
}

interface Props {
  loading: boolean;
  data: Array<{
    colaborador_id: string;
    colaborador_nome: string;
    base_ativa: number;
    perdidos: number;
    churn_pct: number;
    exclusivos_pct?: number | null;
    compartilhados_pct?: number | null;
  }> | null;
  onOpenBarbeiro: (id: string, nome: string) => void;
  onDrill?: (tipo: string, valor: string, title: string, colaboradorId: string) => void;
  janelaDias?: number;
}

/* Mobile card for a single barber */
function ChurnMobileCard({ r, onOpenBarbeiro, onDrill, janelaDias = 60 }: { r: Props['data'] extends (infer T)[] | null ? T : never; onOpenBarbeiro: Props['onOpenBarbeiro']; onDrill?: Props['onDrill']; janelaDias?: number }) {
  return (
    <div className={`rounded-lg border ${churnBorderClass(r.churn_pct)} bg-card p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{r.colaborador_nome}</span>
        <Badge variant={r.churn_pct * 100 > 15 ? 'destructive' : 'secondary'} className="text-[10px]">
          {fmtPct(r.churn_pct)}
        </Badge>
      </div>
      {/* Churn bar */}
      <div className="w-full h-2 bg-muted/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${churnBarColor(r.churn_pct)}`}
          style={{ width: `${Math.min(r.churn_pct * 100 * 3, 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ativos</span>
          <span
            className={`font-medium ${onDrill ? 'cursor-pointer underline decoration-dotted hover:text-primary' : ''}`}
            onClick={onDrill ? () => onDrill('CHURN_ATIVO', String(janelaDias), `Ativos — ${r.colaborador_nome}`, r.colaborador_id) : undefined}
          >{fmtInt(r.base_ativa)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Perdidos</span>
          <span
            className={`font-medium text-red-400 ${onDrill ? 'cursor-pointer underline decoration-dotted hover:text-primary' : ''}`}
            onClick={onDrill ? () => onDrill('CHURN_PERDIDO', String(janelaDias), `Perdidos — ${r.colaborador_nome}`, r.colaborador_id) : undefined}
          >{fmtInt(r.perdidos)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Exclusivos</span>
          <span className="font-medium">{r.exclusivos_pct != null ? fmtPct(r.exclusivos_pct) : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Compartilhados</span>
          <span className="font-medium">{r.compartilhados_pct != null ? fmtPct(r.compartilhados_pct) : '—'}</span>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => onOpenBarbeiro(r.colaborador_id, r.colaborador_nome)}>
        Ver carteira
      </Button>
    </div>
  );
}

export function ClientesChurnBarbeirosTable({ loading, data, onOpenBarbeiro, onDrill, janelaDias = 60 }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Churn por Barbeiro</CardTitle>
          <InfoPopover
            title="Churn por Barbeiro"
            description="Mostra a taxa de churn de cada barbeiro, baseado nos clientes cujo último atendimento foi com ele. Barbeiros com churn alto (>15%) precisam de atenção — pode indicar problemas de qualidade, pontualidade ou relacionamento."
            example="Se o Barbeiro A tem 50 clientes ativos e 10 perdidos, seu churn é 10/(50+10) = 16.7%. Linha destacada em vermelho indica urgência."
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-48" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sem dados de churn por barbeiro.</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {data.map((r) => (
                <ChurnMobileCard key={r.colaborador_id} r={r} onOpenBarbeiro={onOpenBarbeiro} onDrill={onDrill} janelaDias={janelaDias} />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barbeiro</TableHead>
                    <TableHead className="text-right">Base ativa</TableHead>
                    <TableHead className="text-right">Perdidos</TableHead>
                    <TableHead className="text-center w-36">
                      <div className="flex items-center justify-center gap-1">
                        Churn
                        <InfoPopover
                          title="Churn % do Barbeiro"
                          description="Taxa de perda de clientes deste barbeiro. Barra colorida indica gravidade: verde (<5%), amarelo (5-10%), laranja (10-15%), vermelho (>15%)."
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Exclusivos</TableHead>
                    <TableHead className="text-center">Compartilhados</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.colaborador_id} className={churnRowClass(r.churn_pct)}>
                      <TableCell className="font-medium">{r.colaborador_nome}</TableCell>
                      <TableCell
                        className={`text-right ${onDrill ? 'cursor-pointer underline decoration-dotted hover:text-primary' : ''}`}
                        onClick={onDrill ? () => onDrill('CHURN_ATIVO', String(janelaDias), `Ativos — ${r.colaborador_nome}`, r.colaborador_id) : undefined}
                      >{fmtInt(r.base_ativa)}</TableCell>
                      <TableCell
                        className={`text-right font-medium text-red-400 ${onDrill ? 'cursor-pointer underline decoration-dotted hover:text-primary' : ''}`}
                        onClick={onDrill ? () => onDrill('CHURN_PERDIDO', String(janelaDias), `Perdidos — ${r.colaborador_nome}`, r.colaborador_id) : undefined}
                      >{fmtInt(r.perdidos)}</TableCell>
                      <TableCell className="p-1">
                        <div className="flex flex-col items-center gap-1 px-2">
                          <span className="text-xs font-semibold">{fmtPct(r.churn_pct)}</span>
                          <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${churnBarColor(r.churn_pct)}`}
                              style={{ width: `${Math.min(r.churn_pct * 100 * 3, 100)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {r.exclusivos_pct != null ? (
                          <Badge variant="secondary" className="text-[10px]">{fmtPct(r.exclusivos_pct)}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.compartilhados_pct != null ? (
                          <Badge variant="outline" className="text-[10px]">{fmtPct(r.compartilhados_pct)}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => onOpenBarbeiro(r.colaborador_id, r.colaborador_nome)}>
                          Ver carteira
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Explicação */}
            <div className="mt-4 rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground text-sm">📋 Como interpretar</p>
              <p><strong>Exclusivos:</strong> % dos clientes ativos que só são atendidos por esse barbeiro. Alto = carteira fiel.</p>
              <p><strong>Compartilhados:</strong> % dos clientes que também são atendidos por outros barbeiros.</p>
              <p><strong>Linhas em vermelho:</strong> barbeiros com churn acima de 15% — priorizar conversa e plano de ação.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Drill de retenção de novos: lista de clientes + análise por barbeiro
// ============================================================

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface BarbeiroRetorno {
  colaborador_id: string;
  colaborador_nome: string;
  visitas: number;
}

interface ClienteRetencao {
  cliente_id: string;
  cliente_nome: string;
  telefone: string | null;
  first_seen: string;
  dias_ate_retorno: number | null;
  total_retornos: number;
  barbeiro_aquisicao_nome: string;
  ultimo_barbeiro_nome: string | null;
  barbeiros_retorno: BarbeiroRetorno[];
}

interface PorBarbeiroResumo {
  colaborador_id: string;
  colaborador_nome: string;
  count: number;
}

export interface RetencaoDrillData {
  total: number;
  faixa: string;
  clientes: ClienteRetencao[];
  por_barbeiro: PorBarbeiroResumo[];
}

interface Props {
  data: RetencaoDrillData | null;
  faixaLabel: string;
  periodoLabel: string;
  loading: boolean;
  onBack: () => void;
}

export function ClientesNovosRetencaoDrill({ data, faixaLabel, periodoLabel, loading, onBack }: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 overflow-x-hidden max-w-full">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-lg font-semibold text-foreground">{faixaLabel}</h1>
        <Badge variant="secondary" className="text-xs">{data.total} clientes</Badge>
        <span className="text-xs text-muted-foreground">{periodoLabel}</span>
      </div>

      {/* Resumo por barbeiro */}
      {data.por_barbeiro && data.por_barbeiro.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">Por Barbeiro de Aquisição</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.por_barbeiro.map((b) => (
                <Badge key={b.colaborador_id} variant="outline" className="text-xs">
                  {b.colaborador_nome}: {b.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de clientes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">Clientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile: cards */}
          <div className="sm:hidden">
            {data.clientes.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">
                Nenhum cliente encontrado nesta faixa.
              </p>
            ) : (
              <div className="space-y-2 p-3">
                {data.clientes.map((c) => (
                  <div key={c.cliente_id} className="p-3 rounded-md bg-muted/20 border border-border/30">
                    <p className="text-xs font-semibold text-foreground truncate mb-1">{c.cliente_nome}</p>
                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                      <p>
                        Aquisição: <span className="text-foreground">{c.barbeiro_aquisicao_nome}</span>
                        {c.ultimo_barbeiro_nome && <> • Último: <span className="text-foreground">{c.ultimo_barbeiro_nome}</span></>}
                      </p>
                      <p>
                        1ª visita: <span className="text-foreground">{c.first_seen}</span>
                        {' • '}Retornos: <span className="text-foreground">{c.total_retornos}</span>
                        {c.dias_ate_retorno !== null && <> • {c.dias_ate_retorno}d até retorno</>}
                      </p>
                      {c.barbeiros_retorno?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.barbeiros_retorno.map((br) => (
                            <span key={br.colaborador_id} className="text-[9px] bg-muted px-1.5 py-0.5 rounded">
                              {br.colaborador_nome} ({br.visitas}x)
                            </span>
                          ))}
                        </div>
                      )}
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
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">1ª Visita</TableHead>
                  <TableHead className="text-xs">Dias até retorno</TableHead>
                  <TableHead className="text-xs">Retornos</TableHead>
                  <TableHead className="text-xs">Barb. Aquisição</TableHead>
                  <TableHead className="text-xs">Último Barb.</TableHead>
                  <TableHead className="text-xs">Barbeiros retorno</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.clientes.map((c) => (
                  <TableRow key={c.cliente_id}>
                    <TableCell className="text-xs font-medium max-w-[120px] truncate">{c.cliente_nome}</TableCell>
                    <TableCell className="text-xs">{c.first_seen}</TableCell>
                    <TableCell className="text-xs">{c.dias_ate_retorno ?? '—'}</TableCell>
                    <TableCell className="text-xs">{c.total_retornos}</TableCell>
                    <TableCell className="text-xs">{c.barbeiro_aquisicao_nome}</TableCell>
                    <TableCell className="text-xs">{c.ultimo_barbeiro_nome ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {c.barbeiros_retorno?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.barbeiros_retorno.map((br) => (
                            <span key={br.colaborador_id} className="text-[10px] bg-muted px-1 rounded">
                              {br.colaborador_nome} ({br.visitas}x)
                            </span>
                          ))}
                        </div>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {data.clientes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">
                      Nenhum cliente encontrado nesta faixa.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

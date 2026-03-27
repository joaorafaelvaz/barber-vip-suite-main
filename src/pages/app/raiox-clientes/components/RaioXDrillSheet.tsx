import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Download, Loader2, Phone, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { RaioXComputedFilters } from '../raioxTypes';
import { calcDiasSemVir } from '@/lib/diasSemVir';

export interface DrillRequest {
  tipo: 'PERFIL' | 'CADENCIA' | 'MACRO' | 'PERDIDOS' | 'RISCO' | 'RESGATADOS' | 'PERDIDOS_ONESHOT' | 'PERDIDOS_FIDELIZADOS' | 'BARBEIRO' | 'ASSIDUO' | 'REGULAR' | 'ESPACANDO' | 'EM_RISCO' | 'PERDIDO' | 'PRIMEIRA_VEZ' | 'CADENCIA_FIXA';
  valor: string;
  label: string;
}

interface DrillRow {
  cliente_id: string;
  cliente_nome: string | null;
  telefone: string | null;
  colaborador_nome: string | null;
  ultima_visita: string | null;
  dias_sem_vir: number;
  visitas_total: number;
  valor_total: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  request: DrillRequest | null;
  filters: RaioXComputedFilters;
  rpcName?: string;
  extraParams?: Record<string, unknown>;
}

function fmtD(d: string | null) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

function fmtN(n: number) { return n.toLocaleString('pt-BR'); }

function diasColor(dias: number) {
  if (dias <= 45) return 'text-emerald-400';
  if (dias <= 90) return 'text-orange-400';
  return 'text-rose-400';
}

function copyPhone(phone: string) {
  navigator.clipboard?.writeText(phone).catch(() => {});
}

export function RaioXDrillSheet({ open, onClose, request, filters, rpcName, extraParams }: Props) {
  const [rows, setRows] = useState<DrillRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveRpc = rpcName || 'rpc_raiox_overview_drill_v1';

  useEffect(() => {
    if (!open || !request) return;
    setLoading(true);
    setError(null);
    supabase
      .rpc(effectiveRpc as any, {
        p_inicio: filters.dataInicioISO,
        p_fim: filters.dataFimISO,
        p_janela_dias: filters.janelaDias,
        p_colaborador_id: filters.filtroColaborador.id || null,
        p_excluir_sem_cadastro: filters.excluirSemCadastro,
        p_tipo: request.tipo,
        p_valor: request.valor,
        p_limit: 500,
        ...(extraParams || {}),
      })
      .then(({ data, error: rpcErr }) => {
        if (rpcErr) {
          console.error('Drill error:', rpcErr);
          setError(rpcErr.message);
          setRows([]);
          setTotal(0);
        } else {
          const result = data as any;
          setRows(result?.rows || []);
          setTotal(result?.total || 0);
        }
        setLoading(false);
      });
  }, [open, request, filters.dataInicioISO, filters.dataFimISO, filters.janelaDias, filters.filtroColaborador.id, filters.excluirSemCadastro, effectiveRpc, extraParams]);

  const handleExportCSV = () => {
    if (!rows.length) return;
    const headers = ['Cliente', 'Telefone', 'Barbeiro', 'Última visita', 'Dias sem vir', 'Visitas', 'Valor total'];
    const csvRows = rows.map((r) => [
      r.cliente_nome || '',
      r.telefone || '',
      r.colaborador_nome || '',
      r.ultima_visita || '',
      calcDiasSemVir(r.ultima_visita, r.dias_sem_vir),
      r.visitas_total,
      r.valor_total?.toFixed(2) || '0',
    ]);
    const csv = [headers, ...csvRows].map((r) => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raiox_${request?.tipo}_${request?.valor || 'drill'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAllPhones = () => {
    const phones = rows.filter(r => r.telefone).map(r => r.telefone).join('\n');
    navigator.clipboard?.writeText(phones).catch(() => {});
  };

  // Group by barbeiro
  const grouped = rows.reduce<Record<string, DrillRow[]>>((acc, r) => {
    const key = r.colaborador_nome || 'Sem barbeiro';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const withPhone = rows.filter(r => r.telefone).length;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col overflow-hidden p-0">
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/40 shrink-0">
          <SheetTitle className="text-sm font-semibold text-foreground">
            {request?.label}
          </SheetTitle>
          {/* Context bar */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>Período: <span className="text-foreground">{fmtD(filters.dataInicioISO)} – {fmtD(filters.dataFimISO)}</span></span>
            <span>Janela: <span className="text-foreground">{filters.janelaDias}d</span></span>
            {!loading && <span className="font-semibold text-foreground">{fmtN(total)} clientes</span>}
          </div>
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!rows.length} className="h-7 text-xs">
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
            {withPhone > 0 && (
              <Button variant="outline" size="sm" onClick={copyAllPhones} className="h-7 text-xs">
                <Phone className="h-3 w-3 mr-1" /> Copiar {withPhone} tel.
              </Button>
            )}
            {!loading && total > 0 && (
              <span className="text-[10px] text-muted-foreground ml-auto">{rows.length < total ? `${rows.length} de ${fmtN(total)} carregados` : `${fmtN(total)} clientes`}</span>
            )}
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando clientes...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Erro ao carregar</p>
                <p className="text-[10px] text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum cliente neste segmento.</p>
            </div>
          )}

          {!loading && !error && Object.entries(grouped).map(([barbeiro, bRows]) => (
            <div key={barbeiro} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-foreground">{barbeiro}</p>
                <span className="text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">{bRows.length} clientes</span>
              </div>

              {/* Mobile: Cards */}
              <div className="sm:hidden space-y-1.5">
                {bRows.map((r) => (
                  <div key={r.cliente_id} className="p-2.5 rounded-lg border border-border/30 bg-muted/10 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate flex-1">{r.cliente_nome || '—'}</p>
                      <span className={`text-[10px] font-bold tabular-nums shrink-0 ${diasColor(calcDiasSemVir(r.ultima_visita, r.dias_sem_vir))}`}>{calcDiasSemVir(r.ultima_visita, r.dias_sem_vir)}d</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span>Última: {fmtD(r.ultima_visita)}</span>
                      <span>Visitas: {r.visitas_total}</span>
                      <span>R$ {r.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    {r.telefone && (
                      <div className="flex items-center gap-1.5">
                        <a href={`tel:${r.telefone}`} className="text-[10px] text-primary flex items-center gap-1 hover:underline">
                          <Phone className="h-2.5 w-2.5" /> {r.telefone}
                        </a>
                        <button type="button" onClick={() => copyPhone(r.telefone!)}
                          className="text-[9px] text-muted-foreground hover:text-foreground transition-colors">copiar</button>
                        <a href={`https://wa.me/55${r.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                          className="text-[9px] text-emerald-400 hover:underline ml-1">WhatsApp</a>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: Table */}
              <div className="hidden sm:block border border-border/40 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-[10px] py-1.5 font-semibold">Cliente</TableHead>
                      <TableHead className="text-[10px] py-1.5 font-semibold">Telefone</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right font-semibold">Última visita</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right font-semibold">Dias s/ vir</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right font-semibold">Visitas</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right font-semibold">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bRows.map((r) => (
                      <TableRow key={r.cliente_id} className="text-[11px] hover:bg-muted/20">
                        <TableCell className="py-1.5 font-medium text-foreground">{r.cliente_nome || '—'}</TableCell>
                        <TableCell className="py-1.5">
                          {r.telefone ? (
                            <div className="flex items-center gap-1.5">
                              <a href={`tel:${r.telefone}`} className="text-primary hover:underline text-[10px]">{r.telefone}</a>
                              <a href={`https://wa.me/55${r.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                className="text-[9px] text-emerald-400 hover:underline shrink-0">WA</a>
                            </div>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-muted-foreground">{fmtD(r.ultima_visita)}</TableCell>
                        <TableCell className={`py-1.5 text-right font-semibold tabular-nums ${diasColor(calcDiasSemVir(r.ultima_visita, r.dias_sem_vir))}`}>{calcDiasSemVir(r.ultima_visita, r.dias_sem_vir)}d</TableCell>
                        <TableCell className="py-1.5 text-right text-muted-foreground tabular-nums">{r.visitas_total}</TableCell>
                        <TableCell className="py-1.5 text-right text-muted-foreground tabular-nums">R$ {r.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}

          {!loading && !error && total > rows.length && (
            <p className="text-[10px] text-muted-foreground text-center mt-2 py-2 border-t border-border/20">
              Mostrando {rows.length} de {fmtN(total)} clientes. Exporte o CSV para ver todos.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Loader2, Phone, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { RaioXComputedFilters } from '../raioxTypes';
import type { BarberSegment, RoutingClient } from '../routingTypes';
import { SEGMENT_CONFIG, classifyForBarber, fmtD, diasColor } from '../routingTypes';
import { calcDiasSemVir } from '@/lib/diasSemVir';

interface RoutingDrillSheetProps {
  open: boolean;
  onClose: () => void;
  barberId: string;
  barberName: string;
  segment: BarberSegment;
  filters: RaioXComputedFilters;
  baseCorteMeses?: number;
}

export function RoutingDrillSheet({
  open, onClose, barberId, barberName, segment, filters, baseCorteMeses = 12,
}: RoutingDrillSheetProps) {
  const [rows, setRows] = useState<RoutingClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cfg = SEGMENT_CONFIG[segment];

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    supabase
      .rpc('rpc_raiox_clientes_routing_v1' as any, {
        p_inicio:               filters.dataInicioISO,
        p_fim:                  filters.dataFimISO,
        p_colaborador_id:       filters.filtroColaborador.id || null,
        p_excluir_sem_cadastro: filters.excluirSemCadastro,
        p_base_corte_meses:     baseCorteMeses,
        p_limit:                9999,
        p_janela_dias:          filters.janelaDias,
        p_focus_colaborador_id: barberId,
      })
      .then(({ data, error: rpcErr }) => {
        if (rpcErr) {
          setError(rpcErr.message);
          setRows([]);
        } else {
          const allRows: RoutingClient[] = (data as any)?.rows ?? [];
          setRows(allRows.filter(c => classifyForBarber(c, barberId, filters.janelaDias) === segment));
        }
        setLoading(false);
      });
  }, [open, barberId, segment, filters.dataInicioISO, filters.dataFimISO, filters.filtroColaborador.id, filters.excluirSemCadastro, filters.janelaDias, baseCorteMeses]);

  const handleExportCSV = useCallback(() => {
    if (!rows.length) return;
    const headers = ['Cliente', 'Telefone', 'Visitas total', 'Visitas com barbeiro', 'Outros barbeiros', 'Dias sem vir', 'Última visita'];
    const csvRows = rows.map(c => {
      const bv      = c.barbeiros?.find(b => b.colaborador_id === barberId);
      const outros  = (c.barbeiros || []).filter(b => b.colaborador_id !== barberId).map(b => `${b.colaborador_nome}(${b.visitas}x)`).join(' | ');
      return [
        c.cliente_nome || '',
        c.telefone || '',
        c.visitas_total,
        bv?.visitas ?? 0,
        outros,
        calcDiasSemVir(c.ultima_visita, c.dias_sem_vir),
        c.ultima_visita || '',
      ];
    });
    const csv  = [headers, ...csvRows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${barberName.replace(/\s+/g, '_')}_${segment}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, barberName, barberId, segment]);

  const copyAllPhones = () => {
    const phones = rows.filter(r => r.telefone).map(r => r.telefone).join('\n');
    navigator.clipboard?.writeText(phones).catch(() => {});
  };

  const withPhone = rows.filter(r => r.telefone).length;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col overflow-hidden p-0">
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/40 shrink-0 space-y-2">
          <SheetTitle className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
            <span className={cfg.color}>{cfg.label}</span>
            <span className="text-muted-foreground font-normal">— {barberName}</span>
          </SheetTitle>

          {/* Segment explanation */}
          <div className={`text-[10px] rounded-md border px-2 py-1.5 ${cfg.isPerdido ? 'border-rose-500/20 bg-rose-500/5 text-rose-300' : 'border-border/30 bg-muted/10 text-muted-foreground'}`}>
            <span className="font-semibold">{cfg.isPerdido ? 'Perdido · ' : ''}Definição: </span>
            {cfg.description}
            <br />
            <span className="font-semibold">Ação recomendada: </span>
            {cfg.action}
          </div>

          {/* Context */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>Período: <span className="text-foreground">{fmtD(filters.dataInicioISO)} – {fmtD(filters.dataFimISO)}</span></span>
            <span>Janela ativa: <span className="text-foreground">{filters.janelaDias}d</span></span>
            {!loading && <span className="font-semibold text-foreground">{rows.length} clientes</span>}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!rows.length} className="h-7 text-xs gap-1">
              <Download className="h-3 w-3" /> CSV
            </Button>
            {withPhone > 0 && (
              <Button variant="outline" size="sm" onClick={copyAllPhones} className="h-7 text-xs gap-1">
                <Phone className="h-3 w-3" /> Copiar {withPhone} tel.
              </Button>
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
              <p>{error}</p>
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum cliente neste segmento.</p>
            </div>
          )}
          {!loading && !error && rows.length > 0 && (
            <div className="space-y-3">
              {/* Table legend */}
              <div className="text-[9px] text-muted-foreground leading-relaxed px-0.5">
                <span className="font-semibold text-foreground">V. Total</span> = visitas à barbearia no período ·{' '}
                <span className="font-semibold text-foreground">V. Barb.</span> = visitas especificamente com {barberName} ·{' '}
                <span className="font-semibold text-foreground">Dias s/ vir</span> = calculado a partir de hoje
              </div>

              <div className="border border-border/40 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-[10px] py-1.5 font-semibold">Cliente</TableHead>
                      <TableHead className="text-[10px] py-1.5 font-semibold">Telefone</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right font-semibold">V. Total</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right font-semibold">V. Barb.</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right font-semibold">Dias s/ vir</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right font-semibold">Última visita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(c => {
                      const bv   = c.barbeiros?.find(b => b.colaborador_id === barberId);
                      const dias = calcDiasSemVir(c.ultima_visita, c.dias_sem_vir);
                      return (
                        <TableRow key={c.cliente_id} className="text-[11px] hover:bg-muted/20">
                          <TableCell className="py-1.5 font-medium text-foreground">{c.cliente_nome || '—'}</TableCell>
                          <TableCell className="py-1.5">
                            {c.telefone ? (
                              <div className="flex items-center gap-1.5">
                                <a href={`tel:${c.telefone}`} className="text-primary hover:underline text-[10px]">{c.telefone}</a>
                                <a href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                  className="text-[9px] text-emerald-400 hover:underline">WA</a>
                              </div>
                            ) : <span className="text-muted-foreground/40">—</span>}
                          </TableCell>
                          <TableCell className="py-1.5 text-right text-muted-foreground tabular-nums">{c.visitas_total}</TableCell>
                          <TableCell className="py-1.5 text-right text-muted-foreground tabular-nums">{bv?.visitas ?? 0}</TableCell>
                          <TableCell className={`py-1.5 text-right font-semibold tabular-nums ${diasColor(dias)}`}>{dias}d</TableCell>
                          <TableCell className="py-1.5 text-right text-muted-foreground">{fmtD(c.ultima_visita)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

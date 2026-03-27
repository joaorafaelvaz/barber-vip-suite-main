import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Phone, Calendar, TrendingDown, RefreshCw } from 'lucide-react';
import type { DrillMensalResult, DrillMensalTipo } from '@/hooks/raiox-clientes/useRaioxVisaoGeralDrillMensal';

const TIPO_CONFIG: Record<DrillMensalTipo, { label: string; color: string; bg: string; border: string }> = {
  novos:      { label: 'Novos clientes',   color: 'text-blue-400',    bg: 'bg-blue-500/10',   border: 'border-blue-500/25' },
  em_risco:   { label: 'Em risco',         color: 'text-orange-400',  bg: 'bg-orange-500/10', border: 'border-orange-500/25' },
  perdidos:   { label: 'Perdidos',         color: 'text-rose-400',    bg: 'bg-rose-500/10',   border: 'border-rose-500/25' },
  resgatados: { label: 'Resgatados',       color: 'text-emerald-400', bg: 'bg-emerald-500/10',border: 'border-emerald-500/25' },
  ativos:     { label: 'Ativos no mês',   color: 'text-primary',     bg: 'bg-primary/10',    border: 'border-primary/25' },
};

function fmtD(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}
function fmtN(n: number) { return n.toLocaleString('pt-BR'); }

interface Props {
  open: boolean;
  onClose: () => void;
  result: DrillMensalResult | null;
  loading: boolean;
  error: string | null;
  anoMes: string;
  tipo: DrillMensalTipo;
  mesLabel?: string;
}

export function DrillMensalSheet({ open, onClose, result, loading, error, anoMes, tipo, mesLabel }: Props) {
  const cfg = TIPO_CONFIG[tipo] ?? TIPO_CONFIG.ativos;
  const clientes = result?.clientes ?? [];
  const total = result?.meta?.total ?? 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className={`px-4 py-3 border-b border-border/40 ${cfg.bg}`}>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full shrink-0 ${cfg.color.replace('text-', 'bg-')}`} />
            <SheetTitle className="text-sm font-semibold text-foreground">
              {cfg.label}
            </SheetTitle>
            <Badge variant="outline" className={`text-[10px] ${cfg.color} border-current ml-1`}>
              {mesLabel || anoMes}
            </Badge>
          </div>
          <SheetDescription className="text-[10px] text-muted-foreground mt-0.5">
            {loading ? 'Carregando...' : `${fmtN(total)} clientes encontrados`}
            {result?.meta && (
              <span className="ml-2">
                · {fmtD(result.meta.mes_inicio)} – {fmtD(result.meta.mes_fim)}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && !loading && (
            <div className="p-4 text-center">
              <p className="text-[11px] text-rose-400">{error}</p>
            </div>
          )}

          {!loading && !error && clientes.length === 0 && (
            <div className="p-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground">Nenhum cliente encontrado para este recorte.</p>
            </div>
          )}

          {!loading && clientes.length > 0 && (
            <div className="divide-y divide-border/20">
              {clientes.map((c) => (
                <div key={c.cliente_id} className="px-4 py-3 hover:bg-muted/10 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground truncate">{c.nome || 'Sem nome'}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{c.colaborador_nome || '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {(tipo === 'em_risco' || tipo === 'perdidos') && c.dias_sem_vir != null && (
                        <p className={`text-[11px] font-semibold tabular-nums ${cfg.color}`}>
                          {c.dias_sem_vir}d sem vir
                        </p>
                      )}
                      {tipo === 'resgatados' && c.dias_ausente != null && (
                        <p className="text-[11px] font-semibold text-emerald-400 tabular-nums">
                          ausente {c.dias_ausente}d
                        </p>
                      )}
                      <p className="text-[9px] text-muted-foreground tabular-nums">
                        {fmtN(c.visitas_total)} visita{c.visitas_total !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {c.telefone && (
                      <a href={`tel:${c.telefone}`}
                        className="flex items-center gap-1 text-[9px] text-primary hover:text-primary/80 transition-colors">
                        <Phone className="h-2.5 w-2.5" /> {c.telefone}
                      </a>
                    )}
                    <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                      <Calendar className="h-2.5 w-2.5" /> últ. {fmtD(c.ultima_visita)}
                    </span>
                    {tipo === 'novos' && (
                      <span className="flex items-center gap-1 text-[9px] text-blue-400">
                        1ª visita: {fmtD(c.primeira_visita)}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {total > clientes.length && (
                <div className="p-4 text-center">
                  <p className="text-[10px] text-muted-foreground">
                    Mostrando {fmtN(clientes.length)} de {fmtN(total)} clientes.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-4 py-3 bg-muted/10">
          <Button variant="outline" size="sm" className="w-full text-[10px] h-7" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

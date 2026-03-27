import React, { useEffect, useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, X, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface DrillClienteRow {
  cliente_id: string;
  cliente_nome: string;
  telefone: string | null;
  colaborador_nome: string | null;
  ultima_visita: string | null;
  dias_sem_vir: number | null;
  atendimentos: number | null;
  valor_total: number | null;
  outros_barbeiros?: { id: string; nome: string }[] | null;
}

interface GroupedByBarbeiro {
  barbeiro: string;
  clientes: DrillClienteRow[];
}

export interface DrillDialogState {
  open: boolean;
  title: string;
  tipo: string;
  valor: string;
  colaboradorId?: string;
}

interface Props {
  state: DrillDialogState;
  onClose: () => void;
  dataInicio: string;
  dataFim: string;
  refDate: string;
}

function fmtMoney(v: number | null) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function exportCsv(rows: DrillClienteRow[], title: string) {
  const header = 'Cliente,Telefone,Barbeiro,Última Visita,Dias s/ Vir,Atendimentos,Valor Total,Ticket Médio';
  const lines = rows.map(r =>
    [r.cliente_nome, r.telefone || '', r.colaborador_nome || '', r.ultima_visita || '', r.dias_sem_vir ?? '', r.atendimentos ?? '', r.valor_total ?? '', (r.atendimentos && r.atendimentos > 0 && r.valor_total ? (r.valor_total / r.atendimentos).toFixed(2) : '')].join(',')
  );
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `drill_${title.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ClientesDrillDialog({ state, onClose, dataInicio, dataFim, refDate }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DrillClienteRow[]>([]);

  const load = useCallback(async () => {
    if (!state.open) return;
    setLoading(true);
    try {
      const res = await supabase.rpc('rpc_clientes_drill_faixa' as any, {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_ref_date: refDate,
        p_tipo: state.tipo,
        p_valor: state.valor,
        p_colaborador_id: state.colaboradorId || null,
      });
      if (res.error) throw res.error;
      const raw = (res.data as any) ?? {};
      const rows: DrillClienteRow[] = Array.isArray(raw) ? raw : (raw.rows ?? []);
      setData(rows);
    } catch (e) {
      console.error('[DrillDialog]', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [state.open, state.tipo, state.valor, state.colaboradorId, dataInicio, dataFim, refDate]);

  useEffect(() => { load(); }, [load]);

  const grouped: GroupedByBarbeiro[] = React.useMemo(() => {
    const map = new Map<string, DrillClienteRow[]>();
    data.forEach(r => {
      const key = r.colaborador_nome || 'Sem barbeiro';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries())
      .map(([barbeiro, clientes]) => ({ barbeiro, clientes }))
      .sort((a, b) => b.clientes.length - a.clientes.length);
  }, [data]);

  return (
    <Sheet open={state.open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm">{state.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{data.length} clientes</span>
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => exportCsv(data, state.title)} disabled={data.length === 0}>
              <Download className="h-3 w-3" /> CSV
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente encontrado.</p>
          ) : (
            grouped.map(g => (
              <div key={g.barbeiro} className="space-y-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-foreground">{g.barbeiro}</span>
                  <span className="text-[10px] text-muted-foreground">{g.clientes.length}</span>
                </div>
                <div className="space-y-1">
                  {g.clientes.map(c => (
                    <div key={c.cliente_id} className="rounded-md border bg-card p-2 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground truncate">{c.cliente_nome || 'Sem nome'}</span>
                        {c.dias_sem_vir != null && (
                          <span className={`text-[10px] ${c.dias_sem_vir > 60 ? 'text-red-400' : c.dias_sem_vir > 30 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                            {c.dias_sem_vir}d sem vir
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-muted-foreground">
                        <span>{c.atendimentos ?? 0} visitas</span>
                        <span>{fmtMoney(c.valor_total)}</span>
                        <span>TM {fmtMoney(c.atendimentos && c.atendimentos > 0 && c.valor_total ? c.valor_total / c.atendimentos : null)}</span>
                        {c.outros_barbeiros && c.outros_barbeiros.length > 0 && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 border-yellow-500/30 text-yellow-500">
                            <Users className="h-2.5 w-2.5" />
                            Compartilhado
                          </Badge>
                        )}
                      </div>
                      {c.outros_barbeiros && c.outros_barbeiros.length > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          Outros: {c.outros_barbeiros.map(b => b.nome).join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

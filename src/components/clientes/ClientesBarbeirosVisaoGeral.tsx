// ============================================================
// FILE: src/components/clientes/ClientesBarbeirosVisaoGeral.tsx
// PROPÓSITO: Dashboard comparativo entre barbeiros (sem consolidados da barbearia)
// ============================================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RefreshCw, Users, Trophy, BarChart3, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { PorBarbeiroItem } from '@/hooks/useClientes';
import { fmtInt, fmtMoney, STATUS_CONFIG } from '@/hooks/useClientes';
import { InfoPopover } from './InfoPopover';
import { SectionInsight } from './SectionInsight';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import {
  gerarInsightSaude,
  gerarInsightRanking,
  gerarResumoExecutivoCompleto,
} from './ClientesRelatorioGenerator';

interface Props {
  barbeiros: PorBarbeiroItem[];
  periodoLabel: string;
  dataInicio: string;
  dataFim: string;
  refDate: string;
  onSelectBarbeiro: (id: string, nome: string) => void;
  novosData?: any[];
  onDrillFaixa?: (tipo: string, valor: string, label: string) => void;
  painelKpis?: { total_clientes: number; clientes_novos: number; valor_total: number; ticket_medio?: number };
}

function findMaxIdx(arr: number[]): number {
  if (!arr.length) return -1;
  let maxIdx = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > arr[maxIdx]) maxIdx = i;
  }
  return maxIdx;
}

const STATUS_ORDER = ['ATIVO_VIP', 'ATIVO_FORTE', 'ATIVO_LEVE', 'AGUARDANDO_RETORNO', 'EM_RISCO', 'PERDIDO'];

export function ClientesBarbeirosVisaoGeral({
  barbeiros, periodoLabel, dataInicio, dataFim, refDate,
  onSelectBarbeiro, novosData, onDrillFaixa, painelKpis,
}: Props) {
  const [comparativo, setComparativo] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(false);

  const novosMap = useMemo(() => {
    const map = new Map<string, any>();
    novosData?.forEach(n => map.set(n.colaborador_id, n));
    return map;
  }, [novosData]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const compRes = await supabase.rpc('rpc_clientes_comparativo_barbeiros' as any, {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_ref_date: refDate,
      });
      if (compRes.data) setComparativo(compRes.data as any[] ?? []);
    } catch (e) {
      console.error('Erro ao carregar comparativo:', e);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, refDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const rows = useMemo(() => {
    return barbeiros.map(b => {
      const nd = novosMap.get(b.colaborador_id);
      const comp = comparativo.find((c: any) => c.colaborador_id === b.colaborador_id);
      const pctExcl = b.clientes_unicos > 0 ? (b.clientes_exclusivos / b.clientes_unicos) * 100 : 0;
      return {
        ...b,
        pctExcl,
        ticketMedio: comp?.ticket_medio ?? (b.clientes_unicos > 0 ? b.valor_total / b.clientes_unicos : 0),
        retencao30d: nd?.retencao_30d ?? null,
        pctFieis: nd?.pct_fieis ?? null,
        pctVipForte: comp?.pct_vip_forte ?? null,
        statusDist: comp?.status_distribuicao ?? [],
        totalClientes: comp?.total_clientes ?? b.clientes_unicos,
      };
    });
  }, [barbeiros, novosMap, comparativo]);

  const maxes = useMemo(() => {
    if (!rows.length) return {} as any;
    return {
      clientes: findMaxIdx(rows.map(r => r.clientes_unicos)),
      novos: findMaxIdx(rows.map(r => r.clientes_novos)),
      exclusivos: findMaxIdx(rows.map(r => r.clientes_exclusivos)),
      pctExcl: findMaxIdx(rows.map(r => r.pctExcl)),
      ticket: findMaxIdx(rows.map(r => r.ticketMedio)),
      valor: findMaxIdx(rows.map(r => r.valor_total)),
      retencao: findMaxIdx(rows.map(r => r.retencao30d ?? -1)),
      fieis: findMaxIdx(rows.map(r => r.pctFieis ?? -1)),
      saude: findMaxIdx(rows.map(r => r.pctVipForte ?? -1)),
    };
  }, [rows]);

  const totals = useMemo(() => {
    // Use painelKpis (global unique counts) when available to avoid double-counting
    // clients who visited multiple barbers in the period
    const totalClientes = painelKpis?.total_clientes ?? rows.reduce((s, r) => s + r.clientes_unicos, 0);
    const totalNovos = painelKpis?.clientes_novos ?? rows.reduce((s, r) => s + r.clientes_novos, 0);
    const totalExcl = rows.reduce((s, r) => s + r.clientes_exclusivos, 0); // exclusivos don't overlap by definition
    const totalValor = painelKpis?.valor_total ?? rows.reduce((s, r) => s + r.valor_total, 0);
    return {
      clientes: totalClientes,
      novos: totalNovos,
      exclusivos: totalExcl,
      valor: totalValor,
      ticket: totalClientes > 0 ? totalValor / totalClientes : 0,
    };
  }, [rows, painelKpis]);

  const saudeRows = useMemo(() =>
    [...rows].sort((a, b) => (b.pctVipForte ?? 0) - (a.pctVipForte ?? 0)),
  [rows]);

  const resumoExecutivo = useMemo(() => {
    // We don't have detalhe in this component anymore — generate from comparativo data
    return [];
  }, []);

  const insightSaude = gerarInsightSaude(saudeRows);
  const insightRanking = gerarInsightRanking(rows, totals, novosData);

  if (loading && !comparativo.length) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  const TrophyBadge = () => (
    <Trophy className="h-3 w-3 text-yellow-500 inline ml-0.5" />
  );

  return (
    <div className="space-y-4">
      {/* Header + Barbeiro selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-1">
            <Users className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-semibold text-foreground">Comparativo por Barbeiro</p>
            <InfoPopover
              title="Comparativo entre Barbeiros"
              description="Comparação direta entre barbeiros. O 🏆 destaca o melhor em cada métrica. Clique em um barbeiro para ver o detalhe individual."
              periodLabel={`Período: ${periodoLabel}`}
            />
          </div>
          <p className="text-[10px] text-muted-foreground truncate">Período: {periodoLabel} • Clique em um barbeiro para detalhar</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select onValueChange={(val) => {
            const barb = barbeiros.find(b => b.colaborador_id === val);
            if (barb) onSelectBarbeiro(barb.colaborador_id, barb.colaborador_nome);
          }}>
            <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
              <SelectValue placeholder="Ir para barbeiro..." />
            </SelectTrigger>
            <SelectContent>
              {barbeiros.filter(b => b.colaborador_id).map(b => (
                <SelectItem key={b.colaborador_id} value={b.colaborador_id} className="text-xs">
                  {b.colaborador_nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="shrink-0">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Saúde da Base por Barbeiro */}
      {saudeRows.length > 0 && saudeRows[0].pctVipForte !== null && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-1 mb-1">
              <BarChart3 className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs font-medium text-foreground flex-1">Saúde da Base por Barbeiro</p>
              <InfoPopover
                title="Saúde da base por barbeiro"
                description="Distribuição de status da carteira de cada barbeiro. O % Assíduo+Regular indica a 'saúde' — quanto maior, mais saudável."
                periodLabel={`Período: ${periodoLabel}`}
              />
              <SectionInsight text={insightSaude} label="Resumo: Saúde" inline />
            </div>
            <p className="text-[10px] text-muted-foreground mb-1 truncate">
              🏆 Mais saudável: <span className="font-semibold text-foreground">{saudeRows[0].colaborador_nome}</span> ({saudeRows[0].pctVipForte}% Assíduo+Regular)
            </p>
            <div className="space-y-2 mt-3">
              {saudeRows.map((r, i) => {
                const total = r.totalClientes || 1;
                const ordered = STATUS_ORDER.map(s => {
                  const item = r.statusDist.find((d: any) => d.status === s);
                  return { status: s, count: item?.count ?? 0 };
                });
                return (
                  <div
                    key={r.colaborador_id}
                    className="cursor-pointer hover:bg-muted/30 rounded p-1.5 transition-colors"
                    onClick={() => onSelectBarbeiro(r.colaborador_id, r.colaborador_nome)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-0">
                      <span className="text-xs font-medium text-foreground truncate">
                        {r.colaborador_nome}
                        {i === 0 && <Trophy className="h-3 w-3 text-yellow-500 inline ml-1" />}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground shrink-0">
                        {r.pctVipForte}% Assíduo+Regular • {fmtInt(r.totalClientes)} cl.
                      </span>
                    </div>
                    <div className="flex w-full h-5 rounded overflow-hidden">
                      {ordered.map(({ status, count }) => {
                        const cfg = STATUS_CONFIG[status];
                        if (!cfg || count === 0) return null;
                        const pct = (count / total) * 100;
                        return (
                          <div
                            key={status}
                            className="h-full flex items-center justify-center"
                            style={{ width: `${pct}%`, backgroundColor: cfg.color, minWidth: pct > 0 ? '2px' : 0 }}
                            title={`${cfg.label}: ${count} (${pct.toFixed(0)}%)`}
                          >
                            {pct >= 12 && (
                              <span className="text-[8px] font-bold text-white drop-shadow-sm">
                                {pct.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-2 mt-0.5">
                      {ordered.filter(o => o.count > 0).map(({ status, count }) => {
                        const cfg = STATUS_CONFIG[status];
                        if (!cfg) return null;
                        return (
                          <span key={status} className="text-[9px] text-muted-foreground">
                            <span className="inline-block w-1.5 h-1.5 rounded-sm mr-0.5" style={{ backgroundColor: cfg.color }} />
                            {cfg.label} {((count / total) * 100).toFixed(0)}%
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranking Comparativo */}
      {rows.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-1 mb-3">
              <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
              <p className="text-xs font-medium text-foreground flex-1">Ranking Comparativo</p>
              <InfoPopover
                title="Ranking comparativo entre barbeiros"
                description="Todas as métricas lado a lado. 🏆 destaca o líder em cada coluna. Clique para abrir detalhe individual."
                periodLabel={`Período: ${periodoLabel}`}
              />
              <SectionInsight text={insightRanking} label="Resumo: Ranking" inline />
            </div>

            {/* Mobile: card list */}
            <div className="space-y-3 sm:hidden">
              {rows.map((r, i) => (
                <div
                  key={r.colaborador_id}
                  className="p-3 rounded-md bg-muted/20 border border-border/30 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => onSelectBarbeiro(r.colaborador_id, r.colaborador_nome)}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] text-muted-foreground font-medium">{i + 1}.</span>
                    <span className="text-xs font-semibold text-foreground truncate flex-1">{r.colaborador_nome}</span>
                    {(i === maxes.clientes || i === maxes.valor) && <Trophy className="h-3 w-3 text-yellow-500 shrink-0" />}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clientes</span>
                      <span className="font-medium text-foreground">{fmtInt(r.clientes_unicos)}{i === maxes.clientes ? ' 🏆' : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Novos</span>
                      <span className="font-medium text-foreground">{fmtInt(r.clientes_novos)}{i === maxes.novos ? ' 🏆' : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ticket</span>
                      <span className="font-medium text-foreground">{fmtMoney(r.ticketMedio)}{i === maxes.ticket ? ' 🏆' : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor</span>
                      <span className="font-semibold text-foreground">{fmtMoney(r.valor_total)}{i === maxes.valor ? ' 🏆' : ''}</span>
                    </div>
                    {r.retencao30d !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ret.30d</span>
                        <span className="font-medium text-foreground">{r.retencao30d}%{i === maxes.retencao && r.retencao30d !== null && ' 🏆'}</span>
                      </div>
                    )}
                    {r.pctVipForte !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Saúde</span>
                        <span className="font-medium text-foreground">{r.pctVipForte}%{i === maxes.saude && r.pctVipForte !== null && ' 🏆'}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                <p className="text-[10px] font-bold text-foreground mb-1.5">BARBEARIA (Total)</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clientes</span>
                    <span className="font-bold text-foreground">{fmtInt(totals.clientes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Novos</span>
                    <span className="font-bold text-foreground">{fmtInt(totals.novos)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ticket</span>
                    <span className="font-bold text-foreground">{fmtMoney(totals.ticket)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-bold text-foreground">{fmtMoney(totals.valor)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block">
              <div className="overflow-x-auto -mx-4 px-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] h-8 min-w-[100px]">Barbeiro</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Clientes</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Novos</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Excl.</TableHead>
                      <TableHead className="text-[10px] h-8 text-right hidden md:table-cell">%Excl</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Ticket</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Valor</TableHead>
                      <TableHead className="text-[10px] h-8 text-right hidden lg:table-cell">Ret.30d</TableHead>
                      <TableHead className="text-[10px] h-8 text-right hidden lg:table-cell">%Fiéis</TableHead>
                      <TableHead className="text-[10px] h-8 text-right hidden md:table-cell">%Saúde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow
                        key={r.colaborador_id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => onSelectBarbeiro(r.colaborador_id, r.colaborador_nome)}
                      >
                        <TableCell className="text-xs py-2 font-medium text-foreground max-w-[120px]">
                          <span className="text-muted-foreground mr-1">{i + 1}.</span>
                          <span className="truncate inline-block max-w-[90px] align-bottom">{r.colaborador_nome}</span>
                        </TableCell>
                        <TableCell className="text-xs text-right py-2 font-semibold">
                          {fmtInt(r.clientes_unicos)}{i === maxes.clientes && <TrophyBadge />}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2">
                          {fmtInt(r.clientes_novos)}{i === maxes.novos && <TrophyBadge />}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2">
                          {fmtInt(r.clientes_exclusivos)}{i === maxes.exclusivos && <TrophyBadge />}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2 hidden md:table-cell">
                          {r.pctExcl.toFixed(0)}%{i === maxes.pctExcl && <TrophyBadge />}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2">
                          {fmtMoney(r.ticketMedio)}{i === maxes.ticket && <TrophyBadge />}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2 font-semibold">
                          {fmtMoney(r.valor_total)}{i === maxes.valor && <TrophyBadge />}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2 hidden lg:table-cell">
                          {r.retencao30d !== null ? `${r.retencao30d}%` : '—'}{i === maxes.retencao && r.retencao30d !== null && <TrophyBadge />}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2 hidden lg:table-cell">
                          {r.pctFieis !== null ? `${r.pctFieis}%` : '—'}{i === maxes.fieis && r.pctFieis !== null && <TrophyBadge />}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2 hidden md:table-cell">
                          {r.pctVipForte !== null ? `${r.pctVipForte}%` : '—'}{i === maxes.saude && r.pctVipForte !== null && <TrophyBadge />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="text-[10px] font-bold text-foreground py-2">BARBEARIA</TableCell>
                      <TableCell className="text-[10px] text-right font-bold py-2">{fmtInt(totals.clientes)}</TableCell>
                      <TableCell className="text-[10px] text-right font-bold py-2">{fmtInt(totals.novos)}</TableCell>
                      <TableCell className="text-[10px] text-right font-bold py-2">{fmtInt(totals.exclusivos)}</TableCell>
                      <TableCell className="text-[10px] text-right py-2 hidden md:table-cell">—</TableCell>
                      <TableCell className="text-[10px] text-right font-bold py-2">{fmtMoney(totals.ticket)}</TableCell>
                      <TableCell className="text-[10px] text-right font-bold py-2">{fmtMoney(totals.valor)}</TableCell>
                      <TableCell className="text-[10px] text-right py-2 hidden lg:table-cell">—</TableCell>
                      <TableCell className="text-[10px] text-right py-2 hidden lg:table-cell">—</TableCell>
                      <TableCell className="text-[10px] text-right py-2 hidden md:table-cell">—</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RaioXComputedFilters } from '../raioxTypes';
import type { RaioxConfigInstance } from '../RaioXClientesTabs';
import type { RoutingClient, BarberSummary, BarberSegment } from '../routingTypes';
import {
  SEGMENT_CONFIG, CARD_SEGS, PERDIDO_CARD_SEGS, ACTIVE_SEG_ORDER, PERDIDO_SEG_ORDER,
  classifyForBarber, getMainBarber, fmtD, diasColor, totalPerdidos,
} from '../routingTypes';
import { BarbeiroDetalheView } from '../components/BarbeiroDetalheView';
import { EvoChart } from '../components/EvoChart';
import type { EvolucaoMes } from '../components/EvoChart';
import { RoutingDrillSheet } from '../components/RoutingDrillSheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Loader2, RefreshCw, Search, Users, User, ChevronDown, ChevronRight,
  ArrowUpDown, Shuffle, UserCheck, X, Download, SlidersHorizontal,
  Clock, Info, Filter, Repeat,
} from 'lucide-react';
import { BaseBadge } from '@/components/raiox-shared';
import { calcDiasSemVir } from '@/lib/diasSemVir';
import { HowToReadSection } from '@/components/help';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RoutingKpis {
  total_clientes: number;
  exclusivos_1_barbeiro: number;
  rotativos_2_plus: number;
  media_barbeiros: number;
  total_perdidos: number;
}

interface RoutingMeta {
  inicio: string;
  fim: string;
  base_corte_meses: number;
  janela_dias: number;
}

interface RoutingData {
  meta: RoutingMeta;
  kpis: RoutingKpis;
  por_barbeiro: BarberSummary[];
  total: number;
  rows: RoutingClient[];
}

type FilterMode = 'todos' | 'exclusivos' | 'rotativos' | 'perdidos' | BarberSegment;

interface Props {
  filters: RaioXComputedFilters;
  raioxConfig?: RaioxConfigInstance;
  baseDistTotal?: number;
}

const PAGE_SIZE = 25;

/* ------------------------------------------------------------------ */
/*  BarberCard                                                         */
/* ------------------------------------------------------------------ */

interface BarberCardProps {
  barber: BarberSummary;
  janelaDias: number;
  onOpenDetail: (b: BarberSummary) => void;
  onDrillSegment: (barberId: string, barberName: string, segment: BarberSegment) => void;
}

function BarberCard({ barber, janelaDias, onOpenDetail, onDrillSegment }: BarberCardProps) {
  const [showPerdidos, setShowPerdidos] = useState(false);
  const total    = barber.total_atendidos;
  const perdidos = totalPerdidos(barber);
  const ativos   = total - perdidos;

  // Partition: clientes que só foram com este barb. vs. multi-barbeiro
  const soloCount  = barber.fieis + barber.exclusivos + barber.oneshot_aguardando + barber.oneshot_sem_retorno;
  const multiCount = barber.convertendo + barber.saindo + barber.oneshot_com_outro;
  const pctSolo    = ativos > 0 ? Math.round(soloCount  / ativos * 100) : 0;
  const pctMulti   = ativos > 0 ? Math.round(multiCount / ativos * 100) : 0;

  const SOLO_SEGS = [
    { key: 'fieis' as const,               label: 'Fiel',                color: 'text-emerald-400', bar: 'bg-emerald-500', desc: '3+ visitas, exclusivamente com ele' },
    { key: 'exclusivos' as const,          label: 'Exclusivo',           color: 'text-teal-400',    bar: 'bg-teal-500',    desc: 'Só com ele, 2x (ainda não fiel)' },
    { key: 'oneshot_aguardando' as const,  label: '1-shot · Aguardando', color: 'text-yellow-400',  bar: 'bg-yellow-500',  desc: '1ª visita na barbearia, ≤45d — pode voltar' },
    { key: 'oneshot_sem_retorno' as const, label: '1-shot · Não voltou', color: 'text-amber-400',   bar: 'bg-amber-500',   desc: '1ª visita na barbearia, +45d sem retorno' },
  ];

  const MULTI_SEGS = [
    { key: 'convertendo' as const,       label: 'Convertendo',        color: 'text-sky-400',    bar: 'bg-sky-500',    desc: 'Multi-barb.: última visita foi com ele' },
    { key: 'saindo' as const,            label: 'Saindo',             color: 'text-rose-400',   bar: 'bg-rose-500',   desc: 'Multi-barb.: veio 2+ com ele, última foi com outro' },
    { key: 'oneshot_com_outro' as const, label: '1-shot · Com outro', color: 'text-orange-400', bar: 'bg-orange-500', desc: 'Multi-barb.: 1x com ele, voltou com outro barbeiro' },
  ];

  const renderSeg = (s: { key: keyof BarberSummary; label: string; color: string; bar: string; desc: string }) => {
    const val    = barber[s.key] as number;
    const pct    = ativos > 0 ? Math.round(val / ativos * 100) : 0;
    const segKey = s.key === 'fieis' ? 'fiel' : s.key === 'exclusivos' ? 'exclusivo' : s.key as BarberSegment;
    const segCfg = SEGMENT_CONFIG[segKey as BarberSegment];
    return (
      <div
        key={s.key}
        className="space-y-0.5"
        title={segCfg ? `${segCfg.label}\n\nDefinição: ${segCfg.description}\n\nAção: ${segCfg.action}` : s.desc}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`w-2 h-2 rounded-full ${s.bar} shrink-0`} />
            <span className={`text-[10px] font-semibold ${s.color}`}>{s.label}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-sm font-bold tabular-nums ${s.color}`}>{val}</span>
            <span className="text-[9px] text-muted-foreground w-7 text-right tabular-nums">{pct}%</span>
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground leading-snug pl-3.5">{s.desc}</p>
        <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
          <div className={`h-full ${s.bar} rounded-full opacity-70 transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <Card className="border border-border/40 bg-card/50 hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        {/* Header — click opens detail page */}
        <button
          className="w-full flex items-start justify-between gap-2 text-left group"
          onClick={() => onOpenDetail(barber)}
        >
          <p className="text-sm font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
            {barber.colaborador_nome}
          </p>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-foreground leading-none">{total}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">clientes</p>
          </div>
        </button>

        {/* Active sub-total */}
        <div className="flex items-center gap-2 text-[9px]">
          <span className="text-emerald-400 font-semibold">{ativos} ativos</span>
          <span className="text-muted-foreground">·</span>
          {perdidos > 0 ? (
            <button
              onClick={() => setShowPerdidos(v => !v)}
              className="text-rose-400 font-semibold hover:underline flex items-center gap-0.5"
            >
              {perdidos} perdidos ({Math.round(perdidos / total * 100)}%)
              <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showPerdidos ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <span className="text-muted-foreground">0 perdidos</span>
          )}
          <span className="ml-auto text-[8px] text-muted-foreground">janela {janelaDias}d</span>
        </div>

        {/* Group 1: Só com este barbeiro */}
        {soloCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="h-px flex-1 bg-amber-500/25" />
              <span className="text-[9px] font-semibold text-amber-400/70 uppercase tracking-wide shrink-0">Só com ele</span>
              <span className="text-[9px] tabular-nums text-amber-400/50 shrink-0">{soloCount} · {pctSolo}%</span>
              <div className="h-px flex-1 bg-amber-500/25" />
            </div>
            <div className="space-y-2">
              {SOLO_SEGS.map(s => renderSeg(s))}
            </div>
          </div>
        )}

        {/* Group 2: Multi-barbeiro */}
        {multiCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="h-px flex-1 bg-sky-500/25" />
              <span className="text-[9px] font-semibold text-sky-400/70 uppercase tracking-wide shrink-0">Multi-barb.</span>
              <span className="text-[9px] tabular-nums text-sky-400/50 shrink-0">{multiCount} · {pctMulti}%</span>
              <div className="h-px flex-1 bg-sky-500/25" />
            </div>
            <div className="space-y-2">
              {MULTI_SEGS.map(s => renderSeg(s))}
            </div>
          </div>
        )}

        {/* Perdidos section (collapsible) — each sub-seg is clickable to open drill sheet */}
        {perdidos > 0 && showPerdidos && (
          <div className="space-y-1 pt-2 border-t border-rose-500/10">
            <p className="text-[9px] font-semibold text-rose-400 uppercase tracking-wide">
              Perdidos — fora da janela de {janelaDias}d · clique para ver a lista
            </p>
            {PERDIDO_CARD_SEGS.map(s => {
              const val = barber[s.key] as number;
              if (val === 0) return null;
              const pct = perdidos > 0 ? Math.round(val / perdidos * 100) : 0;
              // Map CARD_SEGS key → BarberSegment type
              const segMap: Record<string, import('../routingTypes').BarberSegment> = {
                perdido_fiel:      'perdido_fiel',
                perdido_exclusivo: 'perdido_exclusivo',
                perdido_regular:   'perdido_regular',
                perdido_oneshot:   'perdido_oneshot',
              };
              const seg = segMap[s.key as string];
              return (
                <button
                  key={s.key}
                  onClick={() => seg && onDrillSegment(barber.colaborador_id, barber.colaborador_nome, seg)}
                  title={seg ? `${SEGMENT_CONFIG[seg].label}\n\nDefinição: ${SEGMENT_CONFIG[seg].description}\n\nAção: ${SEGMENT_CONFIG[seg].action}\n\nClique para ver a lista de clientes.` : undefined}
                  className="w-full space-y-0.5 opacity-85 hover:opacity-100 group/drill"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${s.bar} shrink-0`} />
                      <span className={`text-[9px] font-semibold ${s.color}`}>{s.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs font-bold tabular-nums ${s.color}`}>{val}</span>
                      <span className="text-[9px] text-muted-foreground w-6 text-right tabular-nums">{pct}%</span>
                      <span className="text-[8px] text-primary opacity-0 group-hover/drill:opacity-100 transition-opacity">↗</span>
                    </div>
                  </div>
                  {seg && (
                    <p className="text-[8px] text-muted-foreground/60 leading-snug pl-3 text-left">
                      {SEGMENT_CONFIG[seg].description}
                    </p>
                  )}
                  <div className="h-0.5 bg-muted/20 rounded-full overflow-hidden">
                    <div className={`h-full ${s.bar} rounded-full opacity-50`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-[9px] text-primary font-medium text-right">Ver análise completa →</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  ClientRow                                                          */
/* ------------------------------------------------------------------ */

function ClientRow({
  client, highlightBarberId, janelaDias,
}: {
  client: RoutingClient;
  highlightBarberId: string | null;
  janelaDias: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const dias       = calcDiasSemVir(client.ultima_visita, client.dias_sem_vir);
  const mainBarber = getMainBarber(client);
  // When no specific barber is highlighted, classify relative to main barber
  const refBarberId = highlightBarberId ?? mainBarber?.colaborador_id ?? null;
  const segment    = refBarberId ? classifyForBarber(client, refBarberId, janelaDias) : null;
  const segCfg     = segment ? SEGMENT_CONFIG[segment] : null;

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/10" onClick={() => setExpanded(v => !v)}>
        <TableCell className="text-xs font-medium text-foreground max-w-[160px]">
          <div className="flex items-center gap-1">
            {expanded
              ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            <span className="truncate">{client.cliente_nome || 'Sem nome'}</span>
          </div>
        </TableCell>
        <TableCell className="text-center text-xs font-semibold text-foreground">{client.visitas_total}</TableCell>
        <TableCell className="text-center">
          {segCfg ? (
            <Badge variant="outline" className={`text-[8px] h-4 ${segCfg.badgeClass}`} title={segCfg.description}>{segCfg.label}</Badge>
          ) : (
            client.barbeiros_distintos === 1
              ? <Badge variant="outline" className="text-[8px] h-4 border-emerald-500/30 text-emerald-400">Exclusivo</Badge>
              : <Badge variant="outline" className="text-[8px] h-4 border-sky-500/30 text-sky-400">{client.barbeiros_distintos} barb.</Badge>
          )}
        </TableCell>
        <TableCell className="hidden sm:table-cell text-[11px] text-muted-foreground truncate max-w-[120px]">
          {client.ultimo_colaborador_nome || '-'}
        </TableCell>
        <TableCell className={`text-center text-xs font-semibold ${diasColor(dias)}`}>{dias}d</TableCell>
        <TableCell className="hidden sm:table-cell text-center">
          {client.cadencia_media_dias != null ? (
            <span
              className={`text-[10px] tabular-nums ${dias > client.cadencia_media_dias * 1.5 ? 'text-rose-400' : dias > client.cadencia_media_dias ? 'text-amber-400' : 'text-muted-foreground'}`}
              title={`Cadência habitual: ${client.cadencia_media_dias}d entre visitas`}
            >
              {client.cadencia_media_dias}d
            </span>
          ) : <span className="text-muted-foreground/30 text-[10px]">—</span>}
        </TableCell>
        <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">{fmtD(client.ultima_visita)}</TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/5 px-6 py-3">
            <div className="space-y-2">
              {segCfg && (
                <p className={`text-[9px] font-medium ${segCfg.color}`}>{segCfg.description}</p>
              )}
              {highlightBarberId && mainBarber && mainBarber.colaborador_id !== highlightBarberId && (
                <p className="text-[9px] text-muted-foreground">
                  Barbeiro principal:{' '}
                  <span className="text-foreground font-medium">{mainBarber.colaborador_nome}</span>
                  {' '}({mainBarber.visitas}x)
                </p>
              )}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Histórico por barbeiro</p>
                <div className="flex flex-wrap gap-2">
                  {(client.barbeiros || []).map(b => {
                    const isHighlight = highlightBarberId && b.colaborador_id === highlightBarberId;
                    const isMain      = mainBarber?.colaborador_id === b.colaborador_id;
                    return (
                      <div
                        key={b.colaborador_id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] ${
                          isHighlight
                            ? 'border-primary/50 bg-primary/10 text-foreground'
                            : 'border-border/30 bg-card/50 text-muted-foreground'
                        }`}
                      >
                        <span className="font-medium">{b.colaborador_nome}</span>
                        <span className="text-[9px] opacity-70">{b.visitas}x</span>
                        {isMain && !isHighlight && (
                          <span className="text-[8px] text-amber-400 opacity-80">principal</span>
                        )}
                        <span className="text-[9px] opacity-50">último {fmtD(b.ultima_visita)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {client.telefone && (
                <p className="text-[10px] text-muted-foreground">📱 {client.telefone}</p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function TabRoutingBarbeiros({ filters, raioxConfig, baseDistTotal: _baseDistTotal = 0 }: Props) {
  // base_corte_meses: used as history lookback for routing segment classification in the RPC
  const baseCorteMeses = raioxConfig?.config?.base_corte_meses ?? 24;
  const [data, setData] = useState<RoutingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail view — when set, replaces the overview with BarbeiroDetalheView
  const [detailBarber, setDetailBarber] = useState<BarberSummary | null>(null);

  // Drill sheet — lateral panel for a specific barber + segment
  const [drillSheet, setDrillSheet] = useState<{
    open: boolean;
    barberId: string;
    barberName: string;
    segment: BarberSegment;
  } | null>(null);

  const handleDrillSegment = useCallback((barberId: string, barberName: string, segment: BarberSegment) => {
    setDrillSheet({ open: true, barberId, barberName, segment });
  }, []);

  // Full client list for barber detail view
  const [focusedRows, setFocusedRows] = useState<RoutingClient[] | null>(null);
  const [focusLoading, setFocusLoading] = useState(false);

  const [allRowsLoading, setAllRowsLoading] = useState(false);
  const [hiddenBarbers, setHiddenBarbers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('todos');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  /* ---- Load overview ---- */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcErr } = await supabase.rpc(
        'rpc_raiox_clientes_routing_v1' as any,
        {
          p_inicio:               filters.dataInicioISO,
          p_fim:                  filters.dataFimISO,
          p_colaborador_id:       filters.filtroColaborador.id || null,
          p_excluir_sem_cadastro: filters.excluirSemCadastro,
          p_base_corte_meses:     baseCorteMeses,
          p_limit:                300,
          p_janela_dias:          filters.janelaDias,
        }
      );
      if (rpcErr) throw new Error(rpcErr.message);
      const d = result as RoutingData;
      setData(d);
      setVisibleCount(PAGE_SIZE);
      // Auto-load all rows in background so segmentCounts is computed on full data
      if (d.total > d.rows.length) {
        setAllRowsLoading(true);
        (supabase.rpc('rpc_raiox_clientes_routing_v1' as any, {
          p_inicio:               filters.dataInicioISO,
          p_fim:                  filters.dataFimISO,
          p_colaborador_id:       filters.filtroColaborador.id || null,
          p_excluir_sem_cadastro: filters.excluirSemCadastro,
          p_base_corte_meses:     baseCorteMeses,
          p_limit:                9999,
          p_janela_dias:          filters.janelaDias,
        }) as unknown as Promise<{ data: any; error: any }>).then(({ data: all }) => {
          if (all) {
            const allD = all as RoutingData;
            setData(prev => prev ? { ...prev, rows: allD.rows, total: allD.total } : allD);
          }
        }).finally(() => setAllRowsLoading(false));
      }
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [filters.dataInicioISO, filters.dataFimISO, filters.filtroColaborador.id, filters.excluirSemCadastro, filters.janelaDias, baseCorteMeses]);

  useEffect(() => { load(); }, [load]);

  /* ---- Load full client list for detail view ---- */
  const loadFocusBarber = useCallback(async (barberId: string) => {
    setFocusLoading(true);
    setFocusedRows(null);
    try {
      const { data: result, error: rpcErr } = await supabase.rpc(
        'rpc_raiox_clientes_routing_v1' as any,
        {
          p_inicio:               filters.dataInicioISO,
          p_fim:                  filters.dataFimISO,
          p_colaborador_id:       filters.filtroColaborador.id || null,
          p_excluir_sem_cadastro: filters.excluirSemCadastro,
          p_base_corte_meses:     baseCorteMeses,
          p_limit:                300,
          p_janela_dias:          filters.janelaDias,
          p_focus_colaborador_id: barberId,
        }
      );
      if (rpcErr) throw new Error(rpcErr.message);
      setFocusedRows((result as RoutingData).rows);
    } catch {
      // fallback: use what's already loaded
    } finally {
      setFocusLoading(false);
    }
  }, [filters.dataInicioISO, filters.dataFimISO, filters.filtroColaborador.id, filters.excluirSemCadastro, filters.janelaDias, baseCorteMeses]);

  const handleOpenDetail = useCallback((barber: BarberSummary) => {
    setDetailBarber(barber);
    setFocusedRows(null);
    loadFocusBarber(barber.colaborador_id);
  }, [loadFocusBarber]);

  const handleBack = useCallback(() => {
    setDetailBarber(null);
    setFocusedRows(null);
  }, []);

  /* ---- Load all rows (no limit) ---- */
  const loadAll = useCallback(async () => {
    setAllRowsLoading(true);
    try {
      const { data: result, error: rpcErr } = await supabase.rpc(
        'rpc_raiox_clientes_routing_v1' as any,
        {
          p_inicio:               filters.dataInicioISO,
          p_fim:                  filters.dataFimISO,
          p_colaborador_id:       filters.filtroColaborador.id || null,
          p_excluir_sem_cadastro: filters.excluirSemCadastro,
          p_base_corte_meses:     baseCorteMeses,
          p_limit:                9999,
          p_janela_dias:          filters.janelaDias,
        }
      );
      if (rpcErr) throw new Error(rpcErr.message);
      const d = result as RoutingData;
      setData(prev => prev ? { ...prev, rows: d.rows, total: d.total } : d);
    } catch { /* ignore */ } finally {
      setAllRowsLoading(false);
    }
  }, [filters.dataInicioISO, filters.dataFimISO, filters.filtroColaborador.id, filters.excluirSemCadastro, filters.janelaDias, baseCorteMeses]);

  /* ---- Per-client segment classification (relative to main barber) ---- */
  const segmentCounts = useMemo(() => {
    const rows = data?.rows ?? [];
    const counts: Partial<Record<BarberSegment, number>> = {};
    rows.forEach(c => {
      const mb = getMainBarber(c);
      if (!mb) return;
      const seg = classifyForBarber(c, mb.colaborador_id, filters.janelaDias);
      counts[seg] = (counts[seg] ?? 0) + 1;
    });
    return counts;
  }, [data, filters.janelaDias]);

  /* ---- Filtered client list ---- */
  const filteredClients = useMemo(() => {
    if (!data) return [];
    let list = data.rows;

    if (filterMode === 'exclusivos') {
      list = list.filter(c => c.barbeiros_distintos === 1);
    } else if (filterMode === 'rotativos') {
      list = list.filter(c => c.barbeiros_distintos >= 2 && c.dias_sem_vir <= filters.janelaDias);
    } else if (filterMode === 'perdidos') {
      list = list.filter(c => c.dias_sem_vir > filters.janelaDias);
    } else if (filterMode !== 'todos') {
      // BarberSegment filter — classify each client relative to their main barber
      list = list.filter(c => {
        const mb = getMainBarber(c);
        if (!mb) return false;
        return classifyForBarber(c, mb.colaborador_id, filters.janelaDias) === filterMode;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        (c.cliente_nome || '').toLowerCase().includes(q) ||
        (c.telefone || '').includes(q)
      );
    }
    return list;
  }, [data, filterMode, searchQuery, filters.janelaDias]);

  const visibleClients = filteredClients.slice(0, visibleCount);
  const remaining      = filteredClients.length - visibleCount;

  const handleExportCSV = useCallback(() => {
    const rows = filteredClients.length > 0 ? filteredClients : (data?.rows ?? []);
    if (!rows.length) return;
    const headers = ['Cliente', 'Telefone', 'Visitas total', 'Barbeiros distintos', 'Último barbeiro', 'Dias sem vir', 'Última visita', 'Histórico barbeiros'];
    const csvRows = rows.map(c => [
      c.cliente_nome || '',
      c.telefone || '',
      c.visitas_total,
      c.barbeiros_distintos,
      c.ultimo_colaborador_nome || '',
      calcDiasSemVir(c.ultima_visita, c.dias_sem_vir),
      c.ultima_visita || '',
      (c.barbeiros || []).map(b => `${b.colaborador_nome}(${b.visitas}x)`).join(' | '),
    ]);
    const csv  = [headers, ...csvRows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `routing_geral.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredClients, data]);

  const kpis = data?.kpis;
  const pctExclusivos = kpis && kpis.total_clientes > 0
    ? Math.round(kpis.exclusivos_1_barbeiro / kpis.total_clientes * 100) : 0;
  const pctRotativos  = kpis && kpis.total_clientes > 0
    ? Math.round(kpis.rotativos_2_plus / kpis.total_clientes * 100) : 0;
  const pctPerdidos   = kpis && kpis.total_clientes > 0
    ? Math.round((kpis.total_perdidos ?? 0) / kpis.total_clientes * 100) : 0;

  // Clientes que voltaram pelo menos 2x no período — calculado dos rows carregados
  const voltaramCount = useMemo(() => (data?.rows ?? []).filter(c => c.visitas_total >= 2).length, [data]);
  const pctVoltaram   = kpis && kpis.total_clientes > 0 ? Math.round(voltaramCount / kpis.total_clientes * 100) : 0;

  // Helper to format filter period label from routing meta (or filters fallback)
  const periodoInicio = (data?.meta?.inicio as string) ?? filters.dataInicioISO;
  const periodoFim    = (data?.meta?.fim as string) ?? filters.dataFimISO;

  /* ---- Evolution chart state ---- */
  const [evoBarber, setEvoBarber] = useState<string | null>(null);
  const [evoData, setEvoData]     = useState<EvolucaoMes[]>([]);
  const [evoLoading, setEvoLoading] = useState(true);

  useEffect(() => {
    if (!filters.dataFimISO) return;
    setEvoLoading(true);
    const params: Record<string, any> = {
      p_fim:   filters.dataFimISO,
      p_meses: 13,
    };
    if (evoBarber) params.p_colaborador_id = evoBarber;
    supabase
      .rpc('rpc_raiox_routing_barbeiro_evolucao_v1' as any, params)
      .then(({ data: d, error: rpcErr }) => {
        if (!rpcErr && d) {
          const raw = d as any;
          const sorted = (raw.evolucao ?? []).slice().sort(
            (a: EvolucaoMes, b: EvolucaoMes) => a.mes.localeCompare(b.mes)
          );
          setEvoData(sorted);
        }
        setEvoLoading(false);
      });
  }, [evoBarber, filters.dataFimISO]);

  /* ---- Detail view ---- */
  if (detailBarber) {
    return (
      <BarbeiroDetalheView
        barberId={detailBarber.colaborador_id}
        barberName={detailBarber.colaborador_nome}
        barberSummary={detailBarber}
        clients={focusedRows ?? []}
        clientsLoading={focusLoading}
        filters={filters}
        onBack={handleBack}
      />
    );
  }

  /* ---- Overview ---- */
  return (
    <div className="space-y-4 min-w-0 w-full overflow-x-hidden">
      <HowToReadSection
        bullets={[
          'Clique no nome de um barbeiro para abrir a análise completa — segmentos, evolução 12m e todos os clientes.',
          'Fiel = 3+ visitas exclusivamente com o mesmo barbeiro (nunca foi a outro no período). Exclusivo = 2x só com ele.',
          'Rotativo = cliente que frequenta a barbearia mas divide entre 2+ barbeiros (inclui Convertendo, Saindo, One-shot com outro).',
          'Regular (perdidos) = era recorrente com múltiplos barbeiros mas saiu da janela de atividade.',
          'Clique em qualquer segmento no painel "Segmentos — visão geral" para filtrar a tabela de clientes.',
          'Cadência = intervalo médio habitual do cliente entre visitas. Amarelo = passando da hora. Vermelho = muito atrasado.',
          'Perdidos têm 4 subtipos: Era fiel, Era exclusivo, Regular, One-shot — clique no número em cada card para ver a lista.',
        ]}
        expandedText={[
          data?.meta ? `Período analisado: ${fmtD(data.meta.inicio)} – ${fmtD(data.meta.fim)}.` : null,
          `Janela de atividade: ${filters.janelaDias} dias — clientes com última visita dentro desse prazo são ativos; além disso são perdidos.`,
          'Os 7 segmentos ativos (Fiel, Exclusivo, Convertendo, Saindo, One-shot Aguardando/Não voltou/Com outro) descrevem o comportamento dentro da janela.',
          'Os 4 segmentos de perdidos (Era fiel, Era exclusivo, Regular, One-shot) mostram quem saiu — classificados pelo histórico que tinham.',
          kpis?.total_perdidos ? `Total de perdidos no período: ${kpis.total_perdidos.toLocaleString('pt-BR')} clientes.` : null,
        ].filter(Boolean).join(' ')}
      />

      {/* KPI Cards — linha 1: partição do total (Só 1 barb. + Multi = Total) */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Total — mostra a partição visualmente */}
          <Card className="bg-card/50 sm:col-span-1">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-[10px] text-muted-foreground">Total clientes</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="ml-auto inline-flex hover:opacity-70 transition-opacity">
                      <Badge variant="outline" className="inline-flex items-center gap-0.5 px-1 py-0 text-[10px] font-bold leading-tight rounded cursor-default select-none border-blue-400/60 bg-blue-500/10 text-blue-400 dark:text-blue-400"><Filter className="h-2.5 w-2.5" /></Badge>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="end" className="w-72 p-4 space-y-3 text-xs">
                    <p className="font-semibold text-foreground text-sm">Universo — Base Período</p>
                    <div className="space-y-1.5 text-muted-foreground">
                      <p>Clientes que realizaram <strong className="text-foreground/80">pelo menos 1 visita no período selecionado</strong>. Cada cliente é único, independente de quantas visitas teve.</p>
                      <p className="tabular-nums"><strong className="text-foreground/80">Período:</strong> {fmtD(periodoInicio)} – {fmtD(periodoFim)}</p>
                      <p><strong className="text-foreground/80">Janela ativa:</strong> {filters.janelaDias}d — clientes com última visita dentro desse prazo são ativos; além disso são perdidos.</p>
                      <p className="text-muted-foreground/60 text-[10px] border-t border-border/20 pt-1.5">O histórico de cada cliente (para classificar segmentos) é consultado nos últimos {baseCorteMeses}m via configuração de corte.</p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {loading ? '…' : (kpis?.total_clientes ?? 0).toLocaleString('pt-BR')}
              </p>
              {/* Mini barra de partição: Só 1 barbeiro | Multi-barbeiro */}
              {!loading && kpis && kpis.total_clientes > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex h-2 rounded-full overflow-hidden gap-px">
                    <div
                      className="bg-amber-400/70 rounded-l-full"
                      style={{ width: `${pctExclusivos}%` }}
                      title={`Só 1 barbeiro: ${pctExclusivos}%`}
                    />
                    <div
                      className="bg-sky-400/70 rounded-r-full flex-1"
                      title={`Multi-barbeiro: ${pctRotativos}%`}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground/70">
                    <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-amber-400/70" />Só 1 barb. {pctExclusivos}%</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-sky-400/70" />Multi {pctRotativos}%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Só 1 barbeiro — parte da partição */}
          <Card className="bg-card/50 border-amber-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <User className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <p className="text-[10px] text-muted-foreground">Só 1 barbeiro</p>
                <div className="ml-auto flex items-center gap-1">
                  <BaseBadge type="P" />
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                        <Info className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="end" className="w-72 p-4 space-y-3 text-xs">
                      <p className="font-semibold text-foreground text-sm">Só 1 barbeiro</p>
                      <p className="text-muted-foreground">Clientes que visitaram <strong className="text-foreground/80">apenas 1 barbeiro</strong> durante todo o período. Podem ter vindo 1x ou várias vezes — sempre com o mesmo profissional.</p>
                      <p className="text-muted-foreground">Junto com os Multi-barbeiro, forma o <strong className="text-foreground/80">total exato</strong> de clientes do período. São complementares: <span className="text-foreground/80">Só 1 + Multi = Total.</span></p>
                      <p className="text-amber-400/80 text-[10px]">Quanto maior esse %, mais os clientes estão se fidelizando a um profissional específico.</p>
                      <p className="text-muted-foreground/70 tabular-nums">Período: {fmtD(periodoInicio)} – {fmtD(periodoFim)}</p>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <p className="text-xl font-bold text-amber-400 tabular-nums">{loading ? '…' : (kpis?.exclusivos_1_barbeiro ?? 0).toLocaleString('pt-BR')}</p>
              <p className="text-[9px] text-muted-foreground">{pctExclusivos}% do total</p>
            </CardContent>
          </Card>

          {/* Multi-barbeiro — parte da partição */}
          <Card className="bg-card/50 border-sky-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Shuffle className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                <p className="text-[10px] text-muted-foreground">Multi-barbeiro</p>
                <div className="ml-auto flex items-center gap-1">
                  <BaseBadge type="P" />
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                        <Info className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="end" className="w-72 p-4 space-y-3 text-xs">
                      <p className="font-semibold text-foreground text-sm">Multi-barbeiro</p>
                      <p className="text-muted-foreground">Clientes que visitaram com <strong className="text-foreground/80">2 ou mais barbeiros distintos</strong> no período. Não têm preferência exclusiva.</p>
                      <p className="text-muted-foreground">Na tabela por barbeiro, esses clientes aparecem como <strong className="text-foreground/80">Convertendo</strong> (última visita com ele), <strong className="text-foreground/80">Saindo</strong> (última com outro) ou <strong className="text-foreground/80">One-shot · Com outro</strong>.</p>
                      <p className="text-amber-400/80 text-[10px]">Quanto menor esse %, mais fidelizada está a base — clientes escolhendo um barbeiro fixo.</p>
                      <p className="text-muted-foreground/70 tabular-nums">Período: {fmtD(periodoInicio)} – {fmtD(periodoFim)}</p>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <p className="text-xl font-bold text-sky-400 tabular-nums">{loading ? '…' : (kpis?.rotativos_2_plus ?? 0).toLocaleString('pt-BR')}</p>
              <p className="text-[9px] text-muted-foreground">{pctRotativos}% do total</p>
            </CardContent>
          </Card>
        </div>

        {/* linha 2: sub-métricas de apoio */}
        <div className="grid grid-cols-3 gap-2">
          {/* Voltaram 2x+ — retenção real, não confunde com segmento "Exclusivo" dos barbeiros */}
          <Card className="bg-card/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Repeat className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <p className="text-[10px] text-muted-foreground">Voltaram 2x+</p>
                <div className="ml-auto flex items-center gap-1">
                  <BaseBadge type="P" />
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                        <Info className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="end" className="w-72 p-4 space-y-3 text-xs">
                      <p className="font-semibold text-foreground text-sm">Voltaram 2x+ no período</p>
                      <p className="text-muted-foreground">Clientes que vieram à barbearia <strong className="text-foreground/80">pelo menos 2 vezes no período</strong> — independente do barbeiro. Sinal direto de retenção.</p>
                      <p className="text-muted-foreground">Em períodos curtos, a maioria dos clientes só aparece 1x. Este número mostra quem efetivamente voltou.</p>
                      <p className="text-muted-foreground/60 text-[10px] border-t border-border/20 pt-1.5 italic">Sub-métrica de retenção — não faz parte da partição Só 1 barb. + Multi.</p>
                      <p className="text-muted-foreground/70 tabular-nums">Período: {fmtD(periodoInicio)} – {fmtD(periodoFim)}</p>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <p className="text-xl font-bold text-emerald-400 tabular-nums">{loading ? '…' : voltaramCount.toLocaleString('pt-BR')}</p>
              <p className="text-[9px] text-muted-foreground">{pctVoltaram}% do total</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUpDown className="h-3.5 w-3.5 text-amber-400" />
                <p className="text-[10px] text-muted-foreground">Média barb./cliente</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="ml-auto text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                      <Info className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="end" className="w-80 p-4 space-y-3 text-xs">
                    <p className="font-semibold text-foreground text-sm">Média de barbeiros por cliente</p>
                    <p className="text-muted-foreground">
                      Para cada cliente, conta-se quantos <strong className="text-foreground/80">barbeiros distintos</strong> ele visitou no período. A média é a soma dividida pelo total.
                    </p>
                    <div className="rounded-md border border-border/30 bg-muted/10 px-3 py-2 space-y-1 text-muted-foreground">
                      <p className="font-semibold text-foreground/70 text-[10px] uppercase tracking-wide">Cálculo</p>
                      <p className="font-mono text-[10px] text-foreground/80">Σ (barb. distintos por cliente) ÷ total clientes</p>
                      <p className="text-[10px]">Ex: 80 com 1 barb. + 20 com 2 barb. → (80×1 + 20×2) ÷ 100 = <strong className="text-foreground/80">1,20</strong></p>
                    </div>
                    <div className="space-y-1 text-muted-foreground border border-border/30 rounded-md p-2 bg-muted/5">
                      <p className="font-semibold text-foreground/70 text-[10px] uppercase tracking-wide mb-0.5">Como ler</p>
                      <p><strong className="text-emerald-400">1,0</strong> — ideal: todos com 1 barbeiro fixo</p>
                      <p><strong className="text-amber-400">1,0 – 1,3</strong> — base saudável</p>
                      <p><strong className="text-amber-500">1,3 – 1,5</strong> — atenção: rotatividade relevante</p>
                      <p><strong className="text-rose-400">acima de 1,5</strong> — alerta: baixa fidelização</p>
                    </div>
                    {data?.meta && <p className="text-muted-foreground/60 tabular-nums border-t border-border/20 pt-2">Período: {fmtD(data.meta.inicio as string)} – {fmtD(data.meta.fim as string)}</p>}
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xl font-bold text-amber-400 tabular-nums">{loading ? '…' : (kpis?.media_barbeiros ?? 0)}</p>
              <p className="text-[9px] text-muted-foreground/70">Ideal: 1.0 (fidelizado)</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-rose-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                <p className="text-[10px] text-muted-foreground">Perdidos</p>
                <div className="ml-auto flex items-center gap-1">
                  <span className="flex items-center gap-1 rounded-md bg-muted/30 px-1.5 py-0.5">
                    <Clock className="h-2.5 w-2.5 text-rose-400/60" />
                    <span className="text-[9px] text-muted-foreground/70">{filters.janelaDias}d</span>
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="text-muted-foreground/40 hover:text-rose-400/70 transition-colors">
                        <Info className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="end" className="w-72 p-4 space-y-3 text-xs">
                      <p className="font-semibold text-foreground text-sm">Perdidos (fora da janela)</p>
                      <p className="text-muted-foreground">Clientes do período cuja <strong className="text-foreground/80">última visita foi há mais de {filters.janelaDias} dias</strong> a partir do fim do período.</p>
                      <div className="space-y-1 text-muted-foreground text-[10px] border border-border/30 rounded-md p-2 bg-muted/5">
                        <p><strong className="text-foreground/80">4 subtipos:</strong> Era fiel · Era exclusivo · Regular · One-shot</p>
                        <p>Classificados pelo histórico que tinham antes de sair.</p>
                      </div>
                      <p className="text-muted-foreground/60 text-[10px] border-t border-border/20 pt-1.5 italic">Sub-métrica de churn — um cliente pode ser perdido E ter sido Só 1 barb. ou Multi.</p>
                      <p className="text-muted-foreground/70 tabular-nums">Período: {fmtD(periodoInicio)} – {fmtD(periodoFim)}</p>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <p className="text-xl font-bold text-rose-400 tabular-nums">{loading ? '…' : (kpis?.total_perdidos ?? 0).toLocaleString('pt-BR')}</p>
              <p className="text-[9px] text-muted-foreground">{pctPerdidos}% · fora janela</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---- Evolution chart ---- */}
      <Card className="bg-card/50">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-semibold">Evolução de clientes</CardTitle>
            <select
              value={evoBarber ?? ''}
              onChange={e => setEvoBarber(e.target.value || null)}
              className="text-[10px] bg-card border border-border/40 rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 max-w-[180px]"
            >
              <option value="">Todos os barbeiros</option>
              {(data?.por_barbeiro ?? []).map(b => (
                <option key={b.colaborador_id} value={b.colaborador_id}>
                  {b.colaborador_nome}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <EvoChart data={evoData} loading={evoLoading} />
        </CardContent>
      </Card>

      {/* Barber cards */}
      {!loading && data && data.por_barbeiro.length > 0 && (() => {
        const visibleBarbers = data.por_barbeiro.filter(b => !hiddenBarbers.has(b.colaborador_id));
        const allBarbers     = data.por_barbeiro;
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Por Barbeiro
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] gap-1 ml-auto">
                    <SlidersHorizontal className="h-3 w-3" />
                    Exibir barbeiros
                    {hiddenBarbers.size > 0 && (
                      <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 text-[9px] font-bold">
                        {allBarbers.length - hiddenBarbers.size}/{allBarbers.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 space-y-2" align="end">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-foreground">Mostrar na análise</p>
                    <button className="text-[9px] text-primary hover:underline"
                      onClick={() => setHiddenBarbers(new Set())}>
                      Selecionar todos
                    </button>
                  </div>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {allBarbers.map(b => (
                      <label key={b.colaborador_id} className="flex items-center gap-2 cursor-pointer py-0.5">
                        <Checkbox
                          checked={!hiddenBarbers.has(b.colaborador_id)}
                          onCheckedChange={(checked) => {
                            setHiddenBarbers(prev => {
                              const next = new Set(prev);
                              if (checked) next.delete(b.colaborador_id);
                              else next.add(b.colaborador_id);
                              return next;
                            });
                          }}
                        />
                        <span className="text-[11px] text-foreground">{b.colaborador_nome}</span>
                        <span className="text-[9px] text-muted-foreground ml-auto">{b.total_atendidos}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground pt-1 border-t border-border/30">
                    Dica: desmarque recepção, caixa e outros não-barbeiros.
                  </p>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {visibleBarbers.map(b => (
                <BarberCard
                  key={b.colaborador_id}
                  barber={b}
                  janelaDias={filters.janelaDias}
                  onOpenDetail={handleOpenDetail}
                  onDrillSegment={handleDrillSegment}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* ---- Segment breakdown ---- */}
      {!loading && data && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Segmentos — visão geral
            </p>
            <span className="text-[9px] text-muted-foreground">
              Cada cliente classificado pelo seu barbeiro principal. Clique para filtrar a lista.
            </span>
            {filterMode !== 'todos' && filterMode !== 'exclusivos' && filterMode !== 'rotativos' && filterMode !== 'perdidos' && (
              <button
                onClick={() => { setFilterMode('todos'); setVisibleCount(PAGE_SIZE); }}
                className="ml-auto text-[9px] text-primary hover:underline flex items-center gap-1"
              >
                <X className="h-2.5 w-2.5" /> Limpar segmento
              </button>
            )}
          </div>

          {/* Active segments */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
            {ACTIVE_SEG_ORDER.map(seg => {
              const cfg     = SEGMENT_CONFIG[seg];
              const Icon    = cfg.icon;
              const count   = segmentCounts[seg] ?? 0;
              const isActive = filterMode === seg;
              return (
                <button
                  key={seg}
                  onClick={() => { setFilterMode(isActive ? 'todos' : seg); setVisibleCount(PAGE_SIZE); }}
                  className={`rounded-lg border p-2 text-left transition-colors space-y-1 ${
                    isActive
                      ? 'border-primary/50 bg-card ring-1 ring-primary/20'
                      : 'border-border/20 bg-card/30 hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Icon className={`h-3 w-3 shrink-0 ${cfg.color}`} />
                    <span className={`text-[8px] font-semibold leading-tight ${cfg.color} truncate`}>{cfg.label}</span>
                  </div>
                  <p className="text-lg font-bold text-foreground tabular-nums leading-none">{count}</p>
                  <p className="text-[8px] text-muted-foreground leading-tight line-clamp-2">{cfg.description}</p>
                </button>
              );
            })}
          </div>

          {/* Perdido segments */}
          {(data.kpis?.total_perdidos ?? 0) > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PERDIDO_SEG_ORDER.map(seg => {
                const cfg     = SEGMENT_CONFIG[seg];
                const Icon    = cfg.icon;
                const count   = segmentCounts[seg] ?? 0;
                const isActive = filterMode === seg;
                return (
                  <button
                    key={seg}
                    onClick={() => { setFilterMode(isActive ? 'todos' : seg); setVisibleCount(PAGE_SIZE); }}
                    className={`rounded-lg border p-2 text-left transition-colors space-y-1 opacity-80 ${
                      isActive
                        ? 'border-rose-500/40 bg-rose-950/20 ring-1 ring-rose-500/20'
                        : 'border-rose-500/10 bg-card/20 hover:bg-rose-950/10'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Icon className={`h-3 w-3 shrink-0 ${cfg.color}`} />
                      <span className={`text-[8px] font-semibold leading-tight ${cfg.color} truncate`}>{cfg.label}</span>
                    </div>
                    <p className="text-lg font-bold text-foreground tabular-nums leading-none">{count}</p>
                    <p className="text-[8px] text-muted-foreground leading-tight line-clamp-2">{cfg.description}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Overview table toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
            placeholder="Buscar cliente..."
            className="h-7 pl-6 pr-2 w-[160px] sm:w-[200px] text-[10px]"
            maxLength={100}
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 flex-wrap">
          {(['todos', 'exclusivos', 'rotativos', 'perdidos'] as FilterMode[]).map(m => (
            <button
              key={m as string}
              onClick={() => { setFilterMode(m); setVisibleCount(PAGE_SIZE); }}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                filterMode === m
                  ? m === 'perdidos'
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 font-medium'
                    : 'bg-primary/20 border-primary/40 text-primary font-medium'
                  : 'border-border/30 text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'todos' ? 'Todos' : m === 'exclusivos' ? 'Só 1 barbeiro' : m === 'rotativos' ? 'Multi-barbeiro' : 'Perdidos'}
            </button>
          ))}
          {/* Active segment filter badge */}
          {filterMode !== 'todos' && filterMode !== 'exclusivos' && filterMode !== 'rotativos' && filterMode !== 'perdidos' && SEGMENT_CONFIG[filterMode as BarberSegment] && (
            <button
              onClick={() => { setFilterMode('todos'); setVisibleCount(PAGE_SIZE); }}
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${SEGMENT_CONFIG[filterMode as BarberSegment].badgeClass}`}
            >
              {SEGMENT_CONFIG[filterMode as BarberSegment].label}
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {data && data.total > data.rows.length && (
            <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] gap-1"
              onClick={loadAll} disabled={allRowsLoading}>
              {allRowsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Carregar todos ({data.total})
            </Button>
          )}
          {filteredClients.length > 0 && (
            <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={handleExportCSV}>
              <Download className="h-3 w-3" /> CSV
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Loading / Error / Empty */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="text-sm text-destructive px-3 py-2 rounded border border-destructive/30 bg-destructive/5">
          Erro: {error}
        </div>
      )}
      {!loading && !error && filteredClients.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">
          Nenhum cliente encontrado com os filtros atuais.
        </p>
      )}

      {/* Client table */}
      {!loading && filteredClients.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground px-0.5">
            <span className="font-semibold text-foreground">{filteredClients.length}</span> cliente{filteredClients.length !== 1 ? 's' : ''}
            {data && data.total > data.rows.length && (
              <span className="text-amber-400"> · mostrando {data.rows.length} de {data.total} — use "Carregar todos"</span>
            )}
          </p>
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <Table>
              <TableHeader>
                <TableRow className="text-[10px] border-border/40 bg-muted/20">
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-center text-muted-foreground" title="Total de visitas à barbearia no período">Visitas</TableHead>
                  <TableHead className="text-center text-muted-foreground" title="Segmento de routing relativo ao barbeiro principal do cliente">Segmento</TableHead>
                  <TableHead className="hidden sm:table-cell text-muted-foreground" title="Último barbeiro que atendeu este cliente">Último barb.</TableHead>
                  <TableHead className="text-center text-muted-foreground" title="Dias desde a última visita, calculado a partir de hoje">Dias s/ vir</TableHead>
                  <TableHead className="hidden sm:table-cell text-center text-muted-foreground" title="Intervalo médio habitual entre visitas — se Dias s/vir > Cadência, o cliente está atrasado">Cadência</TableHead>
                  <TableHead className="hidden md:table-cell text-muted-foreground" title="Data da última visita registrada">Última visita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleClients.map(c => (
                  <ClientRow
                    key={c.cliente_id}
                    client={c}
                    highlightBarberId={null}
                    janelaDias={filters.janelaDias}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          {remaining > 0 && (
            <button
              className="w-full py-2 text-[10px] text-primary hover:underline text-center"
              onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
            >
              Ver mais {Math.min(remaining, PAGE_SIZE)} de {remaining} restantes →
            </button>
          )}
        </div>
      )}

      {drillSheet && (
        <RoutingDrillSheet
          open={drillSheet.open}
          onClose={() => setDrillSheet(null)}
          barberId={drillSheet.barberId}
          barberName={drillSheet.barberName}
          segment={drillSheet.segment}
          filters={filters}
          baseCorteMeses={baseCorteMeses}
        />
      )}
    </div>
  );
}

// ============================================================
// FILE: src/components/clientes/ClientesPerdasAnalise.tsx
// PROPÓSITO: Análise de clientes 1x e perdidos — drill inline agrupado por barbeiro
// ============================================================

import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { UserMinus, Users, Eye, ChevronDown, ChevronRight, Download, X, AlertTriangle, TrendingDown } from 'lucide-react';
import { fmtInt, fmtMoney } from '@/hooks/useClientes';
import { calcDiasSemVir } from '@/lib/diasSemVir';
import { InfoPopover } from './InfoPopover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarbeiroStackedBar } from './BarbeiroStackedBar';
import { EvolucaoMensalChart } from './EvolucaoMensalChart';

interface Props {
  perdasData: any;
  umaVezData: any;
  loading: boolean;
  periodoLabel: string;
  totalClientes: number;
  faixasFrequencia: any;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  try {
    const date = new Date(d + 'T00:00:00Z');
    return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
  } catch { return d; }
}

function downloadCsv(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(';'),
    ...rows.map(r => headers.map(h => {
      const v = r[h] ?? '';
      return typeof v === 'string' && v.includes(';') ? `"${v}"` : v;
    }).join(';'))
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* Mobile card for a single client in the drill */
function DrillClienteMobileCard({ c, tipo }: { c: any; tipo: 'perdido' | '1vez' }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground truncate max-w-[55%]">{c.cliente_nome || '—'}</span>
        <span className="text-xs font-semibold text-muted-foreground">{calcDiasSemVir(c.ultima_visita, c.dias_sem_vir ?? 0)}d</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        {tipo === '1vez' ? (
          <span>1ª: {formatDate(c.first_seen)}</span>
        ) : (
          <span>{c.dias_distintos ?? c.qtd_visitas ?? '—'} visitas</span>
        )}
        <span>{fmtMoney(c.valor_total)}</span>
      </div>
    </div>
  );
}

/* ---- Grouped inline drill view ---- */
function InlineDrillView({ rows, label, tipo, onClose }: {
  rows: any[];
  label: string;
  tipo: 'perdido' | '1vez';
  onClose: () => void;
}) {
  const [expandedBarbeiro, setExpandedBarbeiro] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, { nome: string; clientes: any[] }> = {};
    rows.forEach((r: any) => {
      const key = r.colaborador_nome || r.colaborador_nome_ultimo || 'Sem Barbeiro';
      if (!map[key]) map[key] = { nome: key, clientes: [] };
      map[key].clientes.push(r);
    });
    return Object.values(map).sort((a, b) => b.clientes.length - a.clientes.length);
  }, [rows]);

  const handleExportCsv = () => {
    const csvRows = rows.map((r: any) => ({
      Cliente: r.cliente_nome || '',
      Barbeiro: r.colaborador_nome || r.colaborador_nome_ultimo || '',
      Visitas: r.dias_distintos ?? r.qtd_visitas ?? 1,
      'Última Visita': r.ultima_visita || '',
      'Dias s/ vir': calcDiasSemVir(r.ultima_visita, r.dias_sem_vir ?? 0),
      Valor: r.valor_total ?? 0,
      Telefone: r.telefone || '',
    }));
    const safeName = label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    downloadCsv(csvRows, `${safeName}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <Card className="border-primary/30 mb-4">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-foreground">{label} ({fmtInt(rows.length)} clientes)</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-[10px]" onClick={handleExportCsv}>
              <Download className="h-3 w-3" /> CSV
            </Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {grouped.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">Nenhum cliente encontrado.</p>
        ) : (
          <div className="space-y-1">
            {grouped.map((g) => {
              const isOpen = expandedBarbeiro === g.nome;
              const sortedClientes = g.clientes.sort((a: any, b: any) => (b.valor_total ?? 0) - (a.valor_total ?? 0)).slice(0, 50);
              return (
                <div key={g.nome} className="border border-border/40 rounded">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedBarbeiro(isOpen ? null : g.nome)}
                  >
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {g.nome}
                    </span>
                    <span className="text-muted-foreground">{fmtInt(g.clientes.length)} clientes</span>
                  </button>
                  {isOpen && (
                    <div className="px-2 sm:px-3 pb-2">
                      {/* Mobile cards */}
                      <div className="md:hidden space-y-1 max-h-[250px] overflow-y-auto">
                        {sortedClientes.map((c: any, i: number) => (
                          <DrillClienteMobileCard key={c.cliente_id || i} c={c} tipo={tipo} />
                        ))}
                      </div>

                      {/* Desktop table */}
                      <div className="hidden md:block max-h-[250px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px] h-7">Cliente</TableHead>
                              {tipo === '1vez' && <TableHead className="text-[10px] h-7 text-right">1ª Visita</TableHead>}
                              {tipo === 'perdido' && <TableHead className="text-[10px] h-7 text-right">Visitas</TableHead>}
                              <TableHead className="text-[10px] h-7 text-right">Última Visita</TableHead>
                              <TableHead className="text-[10px] h-7 text-right">Dias s/ vir</TableHead>
                              <TableHead className="text-[10px] h-7 text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedClientes.map((c: any, i: number) => (
                              <TableRow key={c.cliente_id || i}>
                                <TableCell className="text-[11px] py-1.5 max-w-[120px] truncate">{c.cliente_nome || '—'}</TableCell>
                                {tipo === '1vez' && (
                                  <TableCell className="text-[11px] py-1.5 text-right">{formatDate(c.first_seen)}</TableCell>
                                )}
                                {tipo === 'perdido' && (
                                  <TableCell className="text-[11px] py-1.5 text-right">{c.dias_distintos ?? c.qtd_visitas ?? '—'}</TableCell>
                                )}
                                <TableCell className="text-[11px] py-1.5 text-right">{formatDate(c.ultima_visita)}</TableCell>
                                <TableCell className="text-[11px] py-1.5 text-right">{calcDiasSemVir(c.ultima_visita, c.dias_sem_vir ?? 0)}</TableCell>
                                <TableCell className="text-[11px] py-1.5 text-right">{fmtMoney(c.valor_total)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {g.clientes.length > 50 && (
                          <p className="text-[10px] text-muted-foreground text-center mt-1">Exibindo 50 de {fmtInt(g.clientes.length)}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---- Insights card for perdidos ---- */
function PerdidosInsightsCard({ stats }: { stats: any }) {
  if (!stats || stats.total === 0) return null;

  const pct1vis = stats.total > 0 ? ((stats.com1visita / stats.total) * 100).toFixed(0) : '0';
  const ticketMedio = stats.total > 0 ? stats.totalValor / stats.total : 0;

  const byBarbeiro: Record<string, { count: number; valor: number }> = {};
  (stats.rows ?? []).forEach((r: any) => {
    const name = r.colaborador_nome_ultimo || r.colaborador_nome || 'Sem Barbeiro';
    if (!byBarbeiro[name]) byBarbeiro[name] = { count: 0, valor: 0 };
    byBarbeiro[name].count++;
    byBarbeiro[name].valor += r.valor_total ?? 0;
  });
  const sorted = Object.entries(byBarbeiro).sort((a, b) => b[1].count - a[1].count);
  const topBarbeiro = sorted[0];
  const topPct = topBarbeiro && stats.total > 0
    ? ((topBarbeiro[1].count / stats.total) * 100).toFixed(0)
    : '0';

  return (
    <Card className="border-destructive/20 bg-destructive/5 mb-4">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          <p className="text-xs font-semibold text-foreground">Análise de Perdas</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Perfil de abandono</p>
            <p className="text-xs text-foreground">
              <span className="font-semibold">{pct1vis}%</span> dos perdidos tinham apenas 1 visita
            </p>
            <p className="text-[10px] text-muted-foreground">
              {stats.com2mais > 0 ? `${stats.com2mais} clientes abandonaram após 2+ visitas` : 'Nenhum com 2+ visitas'}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor perdido</p>
            <p className="text-xs text-foreground">
              Ticket médio: <span className="font-semibold">{fmtMoney(ticketMedio)}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              Total histórico: {fmtMoney(stats.totalValor)}
            </p>
          </div>
          {topBarbeiro && (
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Maior concentração</p>
              <p className="text-xs text-foreground">
                <span className="font-semibold">{topBarbeiro[0]}</span> — {topPct}% das perdas
              </p>
              <p className="text-[10px] text-muted-foreground">
                {topBarbeiro[1].count} clientes • {fmtMoney(topBarbeiro[1].valor)} em valor
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type UmaVezFilter = 'aguardando' | 'mais30d' | 'mais60d' | null;
type PerdidosFilter = 'com1visita' | 'com2mais' | 'total' | null;

export function ClientesPerdasAnalise({
  perdasData, umaVezData, loading, periodoLabel, totalClientes, faixasFrequencia,
}: Props) {
  const [umaVezFilter, setUmaVezFilter] = useState<UmaVezFilter>(null);
  const [perdidosFilter, setPerdidosFilter] = useState<PerdidosFilter>(null);
  const [drillBarbeiro, setDrillBarbeiro] = useState<string | null>(null);

  // ---- 1x stats ----
  const umaVezStats = useMemo(() => {
    if (!umaVezData?.rows) return null;
    const allRows = umaVezData.rows as any[];
    const aguardando = allRows.filter((r: any) => calcDiasSemVir(r.ultima_visita, r.dias_sem_vir ?? 0) <= 30).length;
    const mais30d = allRows.filter((r: any) => { const d = calcDiasSemVir(r.ultima_visita, r.dias_sem_vir ?? 0); return d > 30 && d <= 60; }).length;
    const mais60d = allRows.filter((r: any) => calcDiasSemVir(r.ultima_visita, r.dias_sem_vir ?? 0) > 60).length;
    const total = aguardando + mais30d + mais60d;
    const pctTotal = totalClientes > 0 ? ((total / totalClientes) * 100).toFixed(1) : '0';
    return { total, pctTotal, aguardando, mais30d, mais60d };
  }, [umaVezData, totalClientes]);

  // ---- Perdidos stats ----
  const perdasStats = useMemo(() => {
    if (!perdasData) return null;
    const rows = perdasData.rows ?? [];
    const total = rows.length;
    const porBarbeiro = (perdasData.por_barbeiro ?? []) as any[];
    const pctTotal = totalClientes > 0 ? ((total / totalClientes) * 100).toFixed(1) : '0';
    const totalValor = rows.reduce((s: number, r: any) => s + (r.valor_total ?? 0), 0);
    const totalVisitas = rows.reduce((s: number, r: any) => s + (r.dias_distintos ?? r.qtd_visitas ?? 0), 0);
    const mediaVisitas = total > 0 ? totalVisitas / total : 0;
    const mediaDiasSemVir = total > 0
      ? rows.reduce((s: number, r: any) => s + calcDiasSemVir(r.ultima_visita, r.dias_sem_vir ?? 0), 0) / total
      : 0;
    const com1visita = rows.filter((r: any) => (r.dias_distintos ?? r.qtd_visitas ?? 0) <= 1).length;
    const com2mais = total - com1visita;
    return { total, pctTotal, porBarbeiro, totalValor, mediaVisitas, mediaDiasSemVir, com1visita, com2mais, rows };
  }, [perdasData, totalClientes]);

  // ---- Filtered rows for 1x inline drill ----
  const filteredUmaVezRows = useMemo(() => {
    if (!umaVezFilter || !umaVezData?.rows) return [];
    const allRows = umaVezData.rows as any[];
    if (umaVezFilter === 'aguardando') return allRows.filter((r: any) => calcDiasSemVir(r.ultima_visita, r.dias_sem_vir ?? 0) <= 30);
    if (umaVezFilter === 'mais30d') return allRows.filter((r: any) => { const d = calcDiasSemVir(r.ultima_visita, r.dias_sem_vir ?? 0); return d > 30 && d <= 60; });
    if (umaVezFilter === 'mais60d') return allRows.filter((r: any) => calcDiasSemVir(r.ultima_visita, r.dias_sem_vir ?? 0) > 60);
    return [];
  }, [umaVezFilter, umaVezData]);

  // ---- Filtered rows for perdidos inline drill ----
  const filteredPerdidosRows = useMemo(() => {
    if (!perdidosFilter || !perdasStats?.rows) return [];
    if (perdidosFilter === 'com1visita') return perdasStats.rows.filter((r: any) => (r.dias_distintos ?? r.qtd_visitas ?? 0) <= 1);
    if (perdidosFilter === 'com2mais') return perdasStats.rows.filter((r: any) => (r.dias_distintos ?? r.qtd_visitas ?? 0) >= 2);
    if (perdidosFilter === 'total') return perdasStats.rows;
    return [];
  }, [perdidosFilter, perdasStats]);

  const toggleUmaVez = (f: UmaVezFilter) => setUmaVezFilter(prev => prev === f ? null : f);
  const togglePerdidos = (f: PerdidosFilter) => setPerdidosFilter(prev => prev === f ? null : f);

  // ---- Full CSV Export ----
  const handleExportCsv = useCallback(() => {
    const csvRows: any[] = [];
    (umaVezData?.rows ?? []).forEach((r: any) => {
      csvRows.push({
        Tipo: '1ª Vez', Cliente: r.cliente_nome || '', Barbeiro: r.colaborador_nome || '',
        Visitas: 1, 'Última Visita': r.ultima_visita || '', 'Dias s/ vir': calcDiasSemVir(r.ultima_visita, r.dias_sem_vir ?? 0), Valor: r.valor_total ?? 0,
      });
    });
    (perdasStats?.rows ?? []).forEach((r: any) => {
      csvRows.push({
        Tipo: 'Perdido', Cliente: r.cliente_nome || '', Barbeiro: r.colaborador_nome || '',
        Visitas: r.dias_distintos ?? r.qtd_visitas ?? '', 'Última Visita': r.ultima_visita || '', 'Dias s/ vir': calcDiasSemVir(r.ultima_visita, r.dias_sem_vir ?? 0), Valor: r.valor_total ?? 0,
      });
    });
    if (csvRows.length === 0) return;
    downloadCsv(csvRows, `clientes_1x_perdidos_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [umaVezData, perdasStats]);

  const umaVezFilterLabel: Record<string, string> = {
    aguardando: 'Aguardando ≤30 dias',
    mais30d: '1ª Vez >30 dias',
    mais60d: '1ª Vez >60 dias',
  };

  const perdidosFilterLabel: Record<string, string> = {
    com1visita: 'Perdidos com 1 visita',
    com2mais: 'Perdidos com 2+ visitas',
    total: 'Todos os Perdidos',
  };

  if (loading && !perdasData && !umaVezData) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-56 rounded-lg" />
      </div>
    );
  }

  const cardActive = (isActive: boolean) =>
    isActive
      ? 'border-primary/50 ring-1 ring-primary/20 cursor-pointer hover:border-primary/50 transition-colors'
      : 'border-border/50 cursor-pointer hover:border-primary/50 transition-colors';

  return (
    <div className="space-y-5">
      {/* Export button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          Exportar CSV Completo
        </Button>
      </div>

      {/* ====== SEÇÃO A: CLIENTES 1ª VEZ ====== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Clientes Novos de 1ª Vez</h3>
          <InfoPopover
            title="Novos clientes que ainda não retornaram"
            description="Clientes cuja primeira visita à barbearia (first_seen) ocorreu no período selecionado e ainda não retornaram. Não inclui clientes antigos que visitaram apenas 1 vez no período."
            periodLabel={periodoLabel}
          />
        </div>

        {umaVezStats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Card className="border-border/50">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Novos 1ª Vez</p>
                  <p className="text-xl font-bold text-foreground">{fmtInt(umaVezStats.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{umaVezStats.pctTotal}% da base</p>
                </CardContent>
              </Card>
              <Card className={cardActive(umaVezFilter === 'aguardando')} onClick={() => toggleUmaVez('aguardando')}>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Aguardando ≤30d</p>
                  <p className="text-xl font-bold text-emerald-600">{fmtInt(umaVezStats.aguardando)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {umaVezFilter === 'aguardando' ? '✕ Fechar lista' : 'Clique p/ ver 🔍'}
                  </p>
                </CardContent>
              </Card>
              <Card className={cardActive(umaVezFilter === 'mais30d')} onClick={() => toggleUmaVez('mais30d')}>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">&gt;30 dias</p>
                  <p className="text-xl font-bold text-orange-500">{fmtInt(umaVezStats.mais30d)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {umaVezFilter === 'mais30d' ? '✕ Fechar lista' : 'Em risco 🔍'}
                  </p>
                </CardContent>
              </Card>
              <Card className={cardActive(umaVezFilter === 'mais60d')} onClick={() => toggleUmaVez('mais60d')}>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">&gt;60 dias</p>
                  <p className="text-xl font-bold text-destructive">{fmtInt(umaVezStats.mais60d)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {umaVezFilter === 'mais60d' ? '✕ Fechar lista' : 'Provável perdido 🔍'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Inline drill for 1x */}
            {umaVezFilter && filteredUmaVezRows.length > 0 && (
              <InlineDrillView
                rows={filteredUmaVezRows}
                label={umaVezFilterLabel[umaVezFilter] || ''}
                tipo="1vez"
                onClose={() => setUmaVezFilter(null)}
              />
            )}
            {umaVezFilter && filteredUmaVezRows.length === 0 && (
              <Card className="border-primary/30 mb-4">
                <CardContent className="p-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Nenhum cliente encontrado para "{umaVezFilterLabel[umaVezFilter]}"</p>
                  <button onClick={() => setUmaVezFilter(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </CardContent>
              </Card>
            )}

            {/* Charts for 1x */}
            <BarbeiroStackedBar
              rows={umaVezData?.rows ?? []}
              barbeiroField="colaborador_nome"
              title="Distribuição por Barbeiro — Novos de 1ª Vez"
              description="Último barbeiro que atendeu cada cliente novo. Apenas clientes cuja primeira visita (first_seen) ocorreu no período."
              categorize={(r: any) => {
                const d = r.dias_sem_vir ?? 0;
                if (d <= 30) return 'ate30';
                if (d <= 60) return 'ate60';
                return 'mais60';
              }}
              categories={[
                { key: 'ate30', label: '≤30 dias (aguardando)', color: 'hsl(142, 71%, 45%)' },
                { key: 'ate60', label: '>30 dias (em risco)', color: 'hsl(32, 95%, 55%)' },
                { key: 'mais60', label: '>60 dias (provável perdido)', color: 'hsl(0, 68%, 52%)' },
              ]}
            />
            <EvolucaoMensalChart
              rows={umaVezData?.rows ?? []}
              barbeiroField="colaborador_nome"
              dateField="ultima_visita"
              title="Evolução Mensal — Novos de 1ª Vez"
              description="Mês da primeira visita de cada cliente novo que ainda não retornou."
              barColor="hsl(var(--primary))"
            />
          </>
        )}
      </div>

      {/* ====== SEÇÃO B: CLIENTES PERDIDOS ====== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <UserMinus className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold text-foreground">Clientes Perdidos</h3>
          <InfoPopover
            title="Clientes perdidos"
            description="Clientes classificados como 'Perdido'. Clique nos cards para ver a lista agrupada por barbeiro."
            periodLabel={periodoLabel}
          />
        </div>

        {perdasStats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Card className={cardActive(perdidosFilter === 'total')} onClick={() => togglePerdidos('total')}>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Perdidos</p>
                  <p className="text-xl font-bold text-destructive">{fmtInt(perdasStats.total)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {perdidosFilter === 'total' ? '✕ Fechar lista' : `${perdasStats.pctTotal}% da base 🔍`}
                  </p>
                </CardContent>
              </Card>
              <Card className={cardActive(perdidosFilter === 'com1visita')} onClick={() => togglePerdidos('com1visita')}>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Com 1 visita</p>
                  <p className="text-xl font-bold text-foreground">{fmtInt(perdasStats.com1visita)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {perdidosFilter === 'com1visita' ? '✕ Fechar lista' : 'Clique p/ ver 🔍'}
                  </p>
                </CardContent>
              </Card>
              <Card className={cardActive(perdidosFilter === 'com2mais')} onClick={() => togglePerdidos('com2mais')}>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Com 2+ visitas</p>
                  <p className="text-xl font-bold text-foreground">{fmtInt(perdasStats.com2mais)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {perdidosFilter === 'com2mais' ? '✕ Fechar lista' : 'Clique p/ ver 🔍'}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Valor Histórico</p>
                  <p className="text-xl font-bold text-foreground">{fmtMoney(perdasStats.totalValor)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Média {perdasStats.mediaVisitas.toFixed(1)} visitas • {perdasStats.mediaDiasSemVir.toFixed(0)}d s/ vir
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Inline drill for perdidos */}
            {perdidosFilter && filteredPerdidosRows.length > 0 && (
              <InlineDrillView
                rows={filteredPerdidosRows}
                label={perdidosFilterLabel[perdidosFilter] || ''}
                tipo="perdido"
                onClose={() => setPerdidosFilter(null)}
              />
            )}
            {perdidosFilter && filteredPerdidosRows.length === 0 && (
              <Card className="border-primary/30 mb-4">
                <CardContent className="p-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Nenhum cliente encontrado para "{perdidosFilterLabel[perdidosFilter]}"</p>
                  <button onClick={() => setPerdidosFilter(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </CardContent>
              </Card>
            )}

            {/* Drill by barbeiro from chart click */}
            {drillBarbeiro && perdasStats?.rows && (
              <InlineDrillView
                rows={perdasStats.rows.filter((r: any) => (r.colaborador_nome_ultimo || r.colaborador_nome || 'Sem Barbeiro') === drillBarbeiro)}
                label={`Perdidos — ${drillBarbeiro}`}
                tipo="perdido"
                onClose={() => setDrillBarbeiro(null)}
              />
            )}

            {/* Insights card perdidos */}
            <PerdidosInsightsCard stats={perdasStats} />

            {/* Charts for perdidos */}
            <BarbeiroStackedBar
              rows={perdasStats?.rows ?? []}
              barbeiroField="colaborador_nome_ultimo"
              title="Distribuição por Barbeiro — Clientes Perdidos"
              description="Último barbeiro que atendeu cada cliente perdido. Clique em uma barra para ver os clientes daquele barbeiro."
              onBarClick={(name) => setDrillBarbeiro(prev => prev === name ? null : name)}
              categorize={(r: any) => {
                const v = r.dias_distintos ?? r.qtd_visitas ?? 0;
                return v <= 1 ? 'vis1' : 'vis2mais';
              }}
              categories={[
                { key: 'vis1', label: '1 visita (não retornou)', color: 'hsl(32, 95%, 55%)' },
                { key: 'vis2mais', label: '2+ visitas (abandonou)', color: 'hsl(0, 68%, 52%)' },
              ]}
            />
            <EvolucaoMensalChart
              rows={perdasStats?.rows ?? []}
              barbeiroField="colaborador_nome_ultimo"
              dateField="ultima_visita"
              title="Evolução Mensal — Clientes Perdidos"
              description="Mês da última visita de cada cliente perdido. Mostra quando esses clientes deixaram de frequentar a barbearia."
              barColor="hsl(0, 68%, 52%)"
            />
          </>
        )}

        {!perdasStats && !loading && (
          <Card className="border-border/50">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">Nenhum dado de perdidos carregado.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

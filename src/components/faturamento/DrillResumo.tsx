// ============================================================
// FILE: src/components/faturamento/DrillResumo.tsx
// PROPÓSITO: Resumo executivo do faturamento (KPIs + comparações consolidadas + rankings)
// ============================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { DollarSign, Users, Package, Sparkles, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import type { DrillResponse, DrillComparacoes } from '@/hooks/useFaturamentoDrill';

function formatBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(n || 0);
}

function formatBRLCompact(n: number): string {
  if (n >= 1000) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }
  return formatBRL(n);
}

function formatPercent(n: number): string {
  return `${((n || 0) * 100).toFixed(1)}%`;
}

function formatDate(dateStr: string): string {
  try { return format(parseISO(dateStr), "dd MMM", { locale: ptBR }); } catch { return dateStr; }
}

function formatDateFull(dateStr: string): string {
  try { return format(parseISO(dateStr), "dd MMM yyyy", { locale: ptBR }); } catch { return dateStr; }
}

function formatMonthYear(dateStr: string): string {
  try { return format(parseISO(dateStr), "MMM yyyy", { locale: ptBR }); } catch { return dateStr; }
}

function sanitizeBucket(name: any): string {
  if (!name || (typeof name === 'string' && name.trim() === '')) return '(Não informado)';
  return String(name);
}

function calcVarPct(atual: number, ref: number): number | null {
  if (!ref || ref === 0) return null;
  return ((atual - ref) / ref) * 100;
}

function safeDivide(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

// ---- KPI Mini ----

interface KpiMiniProps { label: string; value: string; icon: React.ReactNode; highlight?: boolean; }

function KpiMini({ label, value, icon, highlight }: KpiMiniProps) {
  return (
    <div className={`p-2.5 sm:p-3 rounded-lg border min-w-0 overflow-hidden ${highlight ? 'bg-primary/10 border-primary/30' : 'bg-muted/20 border-border/30'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</span>
      </div>
      <p className={`text-sm sm:text-base font-bold truncate ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

// ---- VarBadge ----

function VarBadge({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-[10px] text-muted-foreground">—</span>;
  const isPositive = valor >= 0;
  return (
    <span className={`text-[10px] font-semibold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
      {isPositive ? '+' : ''}{valor.toFixed(1)}%
    </span>
  );
}

// ---- Period label helpers ----

function periodLabel(type: 'atual' | 'sply' | 'mom' | 'avg6m' | 'avg12m', comparacoes: DrillComparacoes): string {
  switch (type) {
    case 'atual':
      return `${formatDate(`${new Date().getFullYear()}-01-01`).split(' ')[1] || ''}`; // fallback
    case 'sply': {
      const p = comparacoes.sply_periodo;
      return `${formatDate(p.inicio)} – ${formatDateFull(p.fim)}`;
    }
    case 'mom': {
      const p = comparacoes.mom_periodo;
      return `${formatDate(p.inicio)} – ${formatDateFull(p.fim)}`;
    }
    case 'avg6m': {
      const p = comparacoes.avg_6m_periodo;
      return `${formatMonthYear(p.inicio)} – ${formatMonthYear(p.fim)}`;
    }
    case 'avg12m': {
      const p = comparacoes.avg_12m_periodo;
      return `${formatMonthYear(p.inicio)} – ${formatMonthYear(p.fim)}`;
    }
  }
}

// ---- Consolidated Comparison Table ----

interface ConsolidatedTableProps {
  comparacoes: DrillComparacoes;
  inicio: string;
  fim: string;
}

function ConsolidatedTable({ comparacoes, inicio, fim }: ConsolidatedTableProps) {
  const isMobile = useIsMobile();

  const atualTotal = comparacoes.atual ?? (comparacoes.atual_base + comparacoes.atual_extras + comparacoes.atual_produtos);
  const atualDiasTrab = comparacoes.atual_dias_trabalhados ?? 0;
  const splyDiasTrab = comparacoes.sply_dias_trabalhados ?? 0;
  const momDiasTrab = comparacoes.mom_dias_trabalhados ?? 0;
  const avg6mDiasTrab = comparacoes.avg_6m_dias_trabalhados ?? 0;
  const avg12mDiasTrab = comparacoes.avg_12m_dias_trabalhados ?? 0;

  const columns = [
    {
      key: 'atual',
      label: 'Atual',
      sublabel: `${formatDate(inicio)} – ${formatDateFull(fim)}`,
      base: comparacoes.atual_base,
      extras: comparacoes.atual_extras,
      produtos: comparacoes.atual_produtos,
      total: atualTotal,
      diasTrab: atualDiasTrab,
      fatDia: safeDivide(atualTotal, atualDiasTrab),
      showVar: false,
    },
    {
      key: 'mom',
      label: 'Per. Anterior',
      sublabel: periodLabel('mom', comparacoes),
      base: comparacoes.mom_base,
      extras: comparacoes.mom_extras,
      produtos: comparacoes.mom_produtos,
      total: comparacoes.mom_total,
      diasTrab: momDiasTrab,
      fatDia: safeDivide(comparacoes.mom_total, momDiasTrab),
      showVar: true,
    },
    {
      key: 'sply',
      label: 'Ano Anterior',
      sublabel: periodLabel('sply', comparacoes),
      base: comparacoes.sply_base,
      extras: comparacoes.sply_extras,
      produtos: comparacoes.sply_produtos,
      total: comparacoes.sply_total,
      diasTrab: splyDiasTrab,
      fatDia: safeDivide(comparacoes.sply_total, splyDiasTrab),
      showVar: true,
    },
    {
      key: 'avg6m',
      label: 'Méd. 6 meses',
      sublabel: periodLabel('avg6m', comparacoes),
      base: comparacoes.avg_6m_base,
      extras: comparacoes.avg_6m_extras,
      produtos: comparacoes.avg_6m_produtos,
      total: comparacoes.avg_6m,
      diasTrab: avg6mDiasTrab,
      fatDia: safeDivide(comparacoes.avg_6m, avg6mDiasTrab),
      showVar: true,
    },
    {
      key: 'avg12m',
      label: 'Méd. 12 meses',
      sublabel: periodLabel('avg12m', comparacoes),
      base: comparacoes.avg_12m_base,
      extras: comparacoes.avg_12m_extras,
      produtos: comparacoes.avg_12m_produtos,
      total: comparacoes.avg_12m,
      diasTrab: avg12mDiasTrab,
      fatDia: safeDivide(comparacoes.avg_12m, avg12mDiasTrab),
      showVar: true,
    },
  ];

  const rows = [
    { label: 'Fat. Base', field: 'base' as const },
    { label: 'Extras', field: 'extras' as const },
    { label: 'Produtos', field: 'produtos' as const },
    { label: 'Total', field: 'total' as const, isTotal: true },
    { label: 'Dias trab.', field: 'diasTrab' as const, isDias: true },
    { label: 'Fat/dia trab.', field: 'fatDia' as const, isFatDia: true },
  ];

  const atualCol = columns[0];

  if (isMobile) {
    // Mobile: card layout per comparison period
    return (
      <div className="space-y-2">
        {columns.map((col) => (
          <div key={col.key} className={`rounded-lg border p-2.5 ${col.key === 'atual' ? 'bg-primary/5 border-primary/20' : 'bg-muted/10 border-border/30'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-semibold ${col.key === 'atual' ? 'text-primary' : 'text-foreground'}`}>{col.label}</span>
              <div className="flex items-center gap-1">
                <span className={`text-xs font-bold ${col.key === 'atual' ? 'text-primary' : 'text-foreground'}`}>{formatBRLCompact(col.total)}</span>
                {col.showVar && <VarBadge valor={calcVarPct(atualCol.total, col.total)} />}
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground mb-1.5 truncate">{col.sublabel}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div>
                <span className="text-[10px] text-muted-foreground block">Base</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-medium text-foreground">{formatBRLCompact(col.base)}</span>
                  {col.showVar && <VarBadge valor={calcVarPct(atualCol.base, col.base)} />}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Extras</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-medium text-foreground">{formatBRLCompact(col.extras)}</span>
                  {col.showVar && <VarBadge valor={calcVarPct(atualCol.extras, col.extras)} />}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Produtos</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-medium text-foreground">{formatBRLCompact(col.produtos)}</span>
                  {col.showVar && <VarBadge valor={calcVarPct(atualCol.produtos, col.produtos)} />}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Dias trab.</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-medium text-foreground">{typeof col.diasTrab === 'number' ? (Number.isInteger(col.diasTrab) ? col.diasTrab : col.diasTrab.toFixed(1)) : col.diasTrab}</span>
                  {col.showVar && <VarBadge valor={calcVarPct(atualCol.diasTrab, col.diasTrab)} />}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Fat/dia</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-medium text-foreground">{formatBRLCompact(col.fatDia)}</span>
                  {col.showVar && <VarBadge valor={calcVarPct(atualCol.fatDia, col.fatDia)} />}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Desktop: full table
  return (
    <div className="rounded-lg border border-border/30 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/30 border-b border-border/30">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-24">Categoria</th>
            {columns.map((col) => (
              <th key={col.key} className={`text-right px-2 py-2 font-medium ${col.key === 'atual' ? 'text-primary' : 'text-muted-foreground'}`} colSpan={col.showVar ? 2 : 1}>
                <div className="text-right">
                  <div className="font-semibold">{col.label}</div>
                  <div className="text-[9px] font-normal opacity-70 leading-tight">{col.sublabel}</div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSeparator = row.isDias;
            return (
              <tr key={row.label} className={`border-b border-border/20 last:border-0 ${row.isTotal ? 'bg-muted/20 font-semibold' : ''} ${isSeparator ? 'border-t border-border/40' : ''}`}>
                <td className={`px-3 py-1.5 font-medium ${row.isTotal ? 'text-primary' : 'text-foreground'}`}>{row.label}</td>
                {columns.map((col) => {
                  const val = col[row.field];
                  const isAtual = col.key === 'atual';

                  if (row.isDias) {
                    const diasVal = typeof val === 'number' ? (Number.isInteger(val) ? val : (val as number).toFixed(1)) : val;
                    if (!col.showVar) {
                      return (
                        <td key={col.key} className="text-right px-2 py-1.5 font-bold text-foreground">
                          {diasVal}
                        </td>
                      );
                    }
                    const atualDias = atualCol.diasTrab;
                    return (
                      <React.Fragment key={col.key}>
                        <td className="text-right px-2 py-1.5 text-muted-foreground">{diasVal}</td>
                        <td className="text-right px-1 py-1.5"><VarBadge valor={calcVarPct(atualDias, col.diasTrab)} /></td>
                      </React.Fragment>
                    );
                  }

                  if (row.isFatDia) {
                    if (!col.showVar) {
                      return (
                        <td key={col.key} className="text-right px-2 py-1.5 font-bold text-foreground">
                          {formatBRLCompact(val as number)}
                        </td>
                      );
                    }
                    const atualFatDia = atualCol.fatDia;
                    return (
                      <React.Fragment key={col.key}>
                        <td className="text-right px-2 py-1.5 text-muted-foreground">{formatBRLCompact(val as number)}</td>
                        <td className="text-right px-1 py-1.5"><VarBadge valor={calcVarPct(atualFatDia, col.fatDia)} /></td>
                      </React.Fragment>
                    );
                  }

                  // Value columns (base, extras, produtos, total)
                  if (!col.showVar) {
                    return (
                      <td key={col.key} className={`text-right px-2 py-1.5 font-bold ${row.isTotal ? 'text-primary' : 'text-foreground'}`}>
                        {formatBRLCompact(val as number)}
                      </td>
                    );
                  }

                  // Comparison columns: value + var %
                  const atualVal = atualCol[row.field] as number;
                  return (
                    <React.Fragment key={col.key}>
                      <td className="text-right px-2 py-1.5 text-muted-foreground">{formatBRLCompact(val as number)}</td>
                      <td className="text-right px-1 py-1.5"><VarBadge valor={calcVarPct(atualVal, val as number)} /></td>
                    </React.Fragment>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Rankings ----

interface RankedListProps {
  title: string;
  icon: React.ReactNode;
  items: Array<{ bucket: string; valor: number; share?: number; grupo_de_produto?: string; qtd_registros?: number; itens_exemplo?: string[] }>;
  showExtra?: boolean;
}

function RankedList({ title, icon, items, showExtra }: RankedListProps) {
  if (!items || items.length === 0) return null;
  const maxValor = Math.max(...items.map(i => i.valor), 1);

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 border-b border-border/30">
        <div className="p-1 rounded bg-primary/10">{icon}</div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-3 space-y-2">
        {items.slice(0, 5).map((r, idx) => {
          const rankColors = ['text-amber-500', 'text-muted-foreground', 'text-amber-700'];
          const rankColor = idx < 3 ? rankColors[idx] : 'text-muted-foreground';
          const progressValue = (r.valor / maxValor) * 100;
          const label = sanitizeBucket(r.bucket);

          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-sm gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-xs font-bold w-5 text-right shrink-0 ${rankColor}`}>#{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground truncate block text-xs sm:text-sm">{label}</span>
                    {showExtra && r.grupo_de_produto && (
                      <span className="text-[10px] text-muted-foreground truncate block">
                        Grupo: {r.grupo_de_produto}
                      </span>
                    )}
                    {showExtra && r.itens_exemplo && r.itens_exemplo.length > 0 && (
                      <span className="text-[10px] text-muted-foreground truncate block">
                        Ex: {r.itens_exemplo.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-medium text-foreground text-xs sm:text-sm">{formatBRL(r.valor)}</span>
                  {r.share != null && (
                    <span className="text-[10px] text-muted-foreground w-10 text-right">{formatPercent(r.share)}</span>
                  )}
                </div>
              </div>
              <Progress value={progressValue} className="h-1.5" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Main Component ----

interface DrillResumoProps {
  resumo: DrillResponse | null;
  loading: boolean;
  error: string | null;
  inicio: string;
  fim: string;
  comparacoes?: DrillComparacoes | null;
  loadingComparacoes?: boolean;
}

export function DrillResumo({ resumo, loading, error, inicio, fim, comparacoes, loadingComparacoes }: DrillResumoProps) {
  if (loading) {
    return (
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 overflow-hidden">
        <CardContent className="p-4"><p className="text-sm text-destructive">Erro ao carregar resumo: {error}</p></CardContent>
      </Card>
    );
  }

  if (!resumo) return null;

  const meta = resumo.meta as any;
  const faturamentoBase = meta.faturamento_base ?? meta.total ?? 0;
  const extras = meta.extras_valor ?? 0;
  const produtos = meta.produtos_valor ?? 0;
  const total = meta.total ?? 0;

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 min-w-0">
            <DollarSign className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">Resumo Executivo</span>
          </CardTitle>
          <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{formatDate(inicio)} → {formatDateFull(fim)}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPIs */}
        {(() => {
          const outros = total - faturamentoBase - extras - produtos;
          const hasOutros = outros > 0.01;
          return (
            <div className={`grid grid-cols-2 ${hasOutros ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-4'} gap-2 sm:gap-3`}>
              <KpiMini label="Total Geral" value={formatBRL(total)} icon={<DollarSign className="h-3 w-3 text-primary" />} highlight />
              <KpiMini label="Fat. Base" value={formatBRL(faturamentoBase)} icon={<TrendingUp className="h-3 w-3 text-muted-foreground" />} />
              <KpiMini label="Extras" value={formatBRL(extras)} icon={<Sparkles className="h-3 w-3 text-muted-foreground" />} />
              <KpiMini label="Produtos" value={formatBRL(produtos)} icon={<Package className="h-3 w-3 text-muted-foreground" />} />
              {hasOutros && (
                <KpiMini label="Outros" value={formatBRL(outros)} icon={<Package className="h-3 w-3 text-muted-foreground" />} />
              )}
            </div>
          );
        })()}

        {/* Tabela de comparações consolidada */}
        {loadingComparacoes ? (
          <Skeleton className="h-40" />
        ) : comparacoes ? (
          <ConsolidatedTable comparacoes={comparacoes} inicio={inicio} fim={fim} />
        ) : null}

        {/* Rankings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RankedList title="Composição (grupo)" icon={<Package className="h-3.5 w-3.5" />}
            items={resumo.table?.mix_grupo_de_produto || []} showExtra />
          <RankedList title="Top barbeiros" icon={<Users className="h-3.5 w-3.5" />}
            items={resumo.table?.top_colaboradores || []} />
          <RankedList title="Top itens" icon={<Package className="h-3.5 w-3.5" />}
            items={resumo.table?.top_itens || []} showExtra />
        </div>
      </CardContent>
    </Card>
  );
}

import React, { useState } from 'react';
import {
  Scissors, Package, Coffee, Sparkles, ChevronDown, ChevronRight,
  TrendingUp, Hash, DollarSign, BarChart2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ServicoItem } from '@/hooks/useServicos';

interface ServicosCategoriasViewProps {
  items: ServicoItem[];
  onDrillDown?: (item: ServicoItem) => void;
}

// ─── VIP Palette — alinhada ao design system ──────────────────────────────────
// Usa as cores semânticas do projeto: primary (gold), success (emerald), info (blue)
interface CategoryConfig {
  colorVar: string;      // CSS variable name (without hsl())
  bg: string;            // Tailwind bg class with opacity
  label: string;
  icon: React.ElementType;
  order: number;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  // Serviços usam gold (primary) com variações de intensidade
  'Serviço Base':     { colorVar: '--primary',  bg: 'bg-primary/10',     label: 'Serviço Base',     icon: Scissors,  order: 1 },
  'Serviço Extra':    { colorVar: '--success',  bg: 'bg-success/10',     label: 'Serviço Extra',    icon: Scissors,  order: 2 },
  'Serviço Estética': { colorVar: '--info',     bg: 'bg-info/10',        label: 'Serviço Estética', icon: Sparkles,  order: 3 },
  'Serviço Feminino': { colorVar: '--warning',  bg: 'bg-warning/10',     label: 'Serviço Feminino', icon: Scissors,  order: 4 },
  // Produtos usam info/emerald
  'Produtos Cabelo':  { colorVar: '--info',     bg: 'bg-info/10',        label: 'Produtos Cabelo',  icon: Package,   order: 5 },
  'Produtos Barba':   { colorVar: '--success',  bg: 'bg-success/10',     label: 'Produtos Barba',   icon: Package,   order: 6 },
  'Acessórios':       { colorVar: '--warning',  bg: 'bg-warning/10',     label: 'Acessórios',       icon: Package,   order: 7 },
  'Bebida':           { colorVar: '--success',  bg: 'bg-success/10',     label: 'Bebida',           icon: Coffee,    order: 8 },
};

const DEFAULT_CONFIG: CategoryConfig = {
  colorVar: '--muted-foreground', bg: 'bg-muted', label: 'Outros', icon: Package, order: 99,
};

function getConfig(cat: string): CategoryConfig {
  return CATEGORY_CONFIG[cat] ?? { ...DEFAULT_CONFIG, label: cat };
}

function getCssColor(varName: string): string {
  return `hsl(var(${varName}))`;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtCur = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtCurFull = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

// ─── Group data ───────────────────────────────────────────────────────────────
interface CategoryGroup {
  cat: string;
  items: ServicoItem[];
  totalFat: number;
  totalQtd: number;
  ticketMedio: number;
  pctTotal: number;
  maxFat: number;
}

function buildGroups(items: ServicoItem[]): CategoryGroup[] {
  const grandTotal = items.reduce((s, i) => s + i.faturamento, 0) || 1;

  const map = new Map<string, ServicoItem[]>();
  for (const item of items) {
    const cat = item.categoria || 'N/A';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }

  return Array.from(map.entries())
    .map(([cat, grpItems]) => {
      const totalFat = grpItems.reduce((s, i) => s + i.faturamento, 0);
      const totalQtd = grpItems.reduce((s, i) => s + i.quantidade, 0);
      const ticketMedio = totalQtd > 0 ? totalFat / totalQtd : 0;
      const pctTotal = (totalFat / grandTotal) * 100;
      const maxFat = Math.max(...grpItems.map((i) => i.faturamento), 1);
      return { cat, items: grpItems, totalFat, totalQtd, ticketMedio, pctTotal, maxFat };
    })
    .sort((a, b) => {
      const oa = getConfig(a.cat).order;
      const ob = getConfig(b.cat).order;
      if (oa !== ob) return oa - ob;
      return b.totalFat - a.totalFat;
    });
}

// ─── KPI pill ─────────────────────────────────────────────────────────────────
function KpiPill({ icon: Icon, label, value, colorVar }: {
  icon: React.ElementType; label: string; value: string; colorVar: string;
}) {
  return (
    <div className="flex flex-col min-w-[70px] sm:min-w-[90px]">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground" />
        <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xs sm:text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────────────
function ItemRow({
  item, rank, colorVar, maxFat, grpTotal, onClick,
}: {
  item: ServicoItem;
  rank: number;
  colorVar: string;
  maxFat: number;
  grpTotal: number;
  onClick?: () => void;
}) {
  const pctBar = (item.faturamento / maxFat) * 100;
  const pctGrp = grpTotal > 0 ? (item.faturamento / grpTotal) * 100 : 0;
  const color = getCssColor(colorVar);

  return (
    <div
      className={`group flex items-start gap-2 sm:gap-3 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg transition-colors ${
        onClick ? 'cursor-pointer hover:bg-muted/40' : ''
      }`}
      onClick={onClick}
    >
      {/* Rank */}
      <span className="text-[10px] sm:text-xs font-bold text-muted-foreground w-4 sm:w-5 pt-0.5 flex-shrink-0 text-right">
        {rank}°
      </span>

      {/* Name + bar */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-1 sm:gap-2 mb-1">
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1 overflow-hidden">
            <span
              className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color, opacity: 0.85 }}
            />
            <span className="text-xs sm:text-sm font-medium text-foreground truncate" title={item.nome}>
              {item.nome}
            </span>
          </div>
          {/* Faturamento label */}
          <span className="text-xs sm:text-sm font-bold text-primary flex-shrink-0">
            {fmtCur(item.faturamento)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pctBar}%`, backgroundColor: color, opacity: 0.65 }}
          />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center gap-1">
            <Hash className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
            <span className="font-medium text-foreground">{fmtNum(item.quantidade)}</span>
            <span className="hidden sm:inline">&nbsp;atend.</span>
          </span>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
            <span className="hidden sm:inline">Ticket&nbsp;</span>
            <span className="font-medium text-foreground">{fmtCurFull(item.ticket_medio)}</span>
          </span>
          <Badge
            variant="outline"
            className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0 h-3.5 sm:h-4 border-border text-muted-foreground"
          >
            {fmtPct(pctGrp)} <span className="hidden sm:inline">do grupo</span>
          </Badge>
          <Badge
            variant="outline"
            className="hidden sm:inline-flex text-[9px] px-1.5 py-0 h-4 border-border text-muted-foreground"
          >
            {fmtPct(item.participacao_pct)} total
          </Badge>
        </div>
      </div>

      {/* Drill arrow */}
      {onClick && (
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

// ─── Category card ────────────────────────────────────────────────────────────
const INITIAL_VISIBLE = 5;

function CategoryCard({
  group, grandTotal, onDrillDown,
}: {
  group: CategoryGroup;
  grandTotal: number;
  onDrillDown?: (item: ServicoItem) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const cfg = getConfig(group.cat);
  const Icon = cfg.icon;
  const color = getCssColor(cfg.colorVar);
  const visibleItems = showAll ? group.items : group.items.slice(0, INITIAL_VISIBLE);
  const hasMore = group.items.length > INITIAL_VISIBLE;

  return (
    <div
      className="rounded-xl border border-border overflow-hidden card-vip"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      {/* ── Header ── */}
      <button
        className="w-full text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 hover:bg-muted/20 transition-colors">
          {/* Icon */}
          <div
            className="rounded-lg p-1.5 sm:p-2 flex-shrink-0 mt-0.5"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color }} />
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-foreground">{cfg.label}</span>
              <Badge
                variant="outline"
                className="text-[9px] sm:text-[10px] h-3.5 sm:h-4 px-1 sm:px-1.5 border-primary/30 text-primary"
              >
                {fmtPct(group.pctTotal)}
              </Badge>
              <Badge variant="outline" className="text-[9px] sm:text-[10px] h-3.5 sm:h-4 px-1 sm:px-1.5 text-muted-foreground border-border">
                {group.items.length} {group.items.length === 1 ? 'item' : 'itens'}
              </Badge>
            </div>

            {/* KPI row */}
            <div className="flex flex-wrap gap-3 sm:gap-4 mt-2">
              <KpiPill icon={DollarSign} label="Fat." value={fmtCur(group.totalFat)} colorVar={cfg.colorVar} />
              <KpiPill icon={Hash} label="Atend." value={fmtNum(group.totalQtd)} colorVar={cfg.colorVar} />
              <KpiPill icon={BarChart2} label="Ticket" value={fmtCurFull(group.ticketMedio)} colorVar={cfg.colorVar} />
            </div>
          </div>

          {/* Expand chevron */}
          <div className="flex-shrink-0 mt-1">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {/* ── Items ── */}
      {expanded && (
        <div className="border-t border-border bg-background/50">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border/50">
            <span className="w-5" />
            <span className="flex-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Nome / Métricas
            </span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Faturamento
            </span>
            {onDrillDown && <span className="w-3.5" />}
          </div>

          <div className="divide-y divide-border/40">
            {visibleItems.map((item, i) => (
              <ItemRow
                key={item.nome + i}
                item={item}
                rank={i + 1}
                colorVar={cfg.colorVar}
                maxFat={group.maxFat}
                grpTotal={group.totalFat}
                onClick={onDrillDown ? () => onDrillDown(item) : undefined}
              />
            ))}
          </div>

          {hasMore && (
            <div className="px-4 py-2.5 border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-muted-foreground hover:text-foreground w-full"
                onClick={() => setShowAll((s) => !s)}
              >
                {showAll
                  ? `Mostrar menos`
                  : `+ ${group.items.length - INITIAL_VISIBLE} itens`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function ServicosCategoriasView({ items, onDrillDown }: ServicosCategoriasViewProps) {
  const groups = buildGroups(items);
  const grandTotal = items.reduce((s, i) => s + i.faturamento, 0);

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhum dado para exibir.
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Grand total bar - horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-3 sm:gap-6 min-w-max sm:min-w-0 sm:flex-wrap">
          {groups.map((g) => {
            const cfg = getConfig(g.cat);
            const color = getCssColor(cfg.colorVar);
            return (
              <div key={g.cat} className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                <span
                  className="inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] sm:text-xs text-muted-foreground">{cfg.label}</span>
                <span className="text-[10px] sm:text-xs font-semibold text-foreground">{fmtCur(g.totalFat)}</span>
                <span className="text-[9px] sm:text-[10px] text-muted-foreground">({fmtPct(g.pctTotal)})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stacked participation bar */}
      <div className="h-2 rounded-full overflow-hidden flex gap-0.5 bg-muted/30">
        {groups.map((g) => {
          const cfg = getConfig(g.cat);
          const color = getCssColor(cfg.colorVar);
          return (
            <div
              key={g.cat}
              className="h-full rounded-sm transition-all"
              style={{ width: `${g.pctTotal}%`, backgroundColor: color, opacity: 0.8 }}
              title={`${cfg.label}: ${fmtPct(g.pctTotal)}`}
            />
          );
        })}
      </div>

      {/* Category cards */}
      {groups.map((g) => (
        <CategoryCard
          key={g.cat}
          group={g}
          grandTotal={grandTotal}
          onDrillDown={onDrillDown}
        />
      ))}
    </div>
  );
}

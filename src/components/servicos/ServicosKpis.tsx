import React, { useMemo } from 'react';
import { DollarSign, Hash, Calculator, Trophy, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/raiox-shared/KpiCard';
import { InfoIconTooltip } from '@/components/help/InfoIconTooltip';
import type { ServicosKpis } from '@/hooks/useServicos';
import type { ServicoItem } from '@/hooks/useServicos';

interface ServicosKpisProps {
  kpis: ServicosKpis;
  items?: ServicoItem[];
}

// VIP Design System — usa CSS variables
const CATEGORY_STYLES: Record<string, { colorVar: string; label: string }> = {
  'Serviço Base':     { colorVar: '--primary', label: 'Base' },
  'Serviço Extra':    { colorVar: '--success', label: 'Extra' },
  'Serviço Estética': { colorVar: '--info',    label: 'Estética' },
  'Serviço Feminino': { colorVar: '--warning', label: 'Feminino' },
  'Produtos Cabelo':  { colorVar: '--info',    label: 'Prod. Cabelo' },
  'Produtos Barba':   { colorVar: '--success', label: 'Prod. Barba' },
  'Acessórios':       { colorVar: '--warning', label: 'Acessórios' },
  'Bebida':           { colorVar: '--success', label: 'Bebida' },
};

// KPI Info definitions
const KPI_INFO = {
  faturamento: {
    title: 'Faturamento Total',
    short: 'Soma do valor de todos os serviços e produtos',
    details: (
      <>
        <p>Valor total faturado no período selecionado, incluindo todos os tipos de serviços e produtos vendidos.</p>
        <p className="mt-2"><strong>Fórmula:</strong> Σ (valor de cada item vendido)</p>
        <p className="mt-2"><strong>Benchmark:</strong> Compare com o mesmo período do ano anterior para avaliar crescimento.</p>
      </>
    ),
  },
  atendimentos: {
    title: 'Total de Atendimentos',
    short: 'Número de serviços/produtos realizados',
    details: (
      <>
        <p>Quantidade total de itens (serviços + produtos) vendidos no período.</p>
        <p className="mt-2"><strong>Nota:</strong> Um cliente pode gerar múltiplos itens (ex: corte + barba = 2 atendimentos).</p>
        <p className="mt-2"><strong>Dica:</strong> Use em conjunto com "Ticket Médio" para entender o mix.</p>
      </>
    ),
  },
  ticketMedio: {
    title: 'Ticket Médio por Item',
    short: 'Valor médio por serviço/produto',
    details: (
      <>
        <p>Valor médio de cada item vendido (serviço ou produto).</p>
        <p className="mt-2"><strong>Fórmula:</strong> Faturamento Total ÷ Total de Atendimentos</p>
        <p className="mt-2"><strong>Para aumentar:</strong> Incentive serviços extras e produtos de maior valor.</p>
      </>
    ),
  },
  topServico: {
    title: 'Serviço Mais Vendido',
    short: 'Item com maior faturamento no período',
    details: (
      <>
        <p>O serviço ou produto que gerou mais receita no período selecionado.</p>
        <p className="mt-2"><strong>Importante:</strong> Nem sempre é o mais vendido em quantidade — aqui consideramos o valor total.</p>
      </>
    ),
  },
  breakdown: {
    title: 'Breakdown por Categoria',
    short: 'Distribuição do faturamento por tipo',
    details: (
      <>
        <p><strong>Serviço Base:</strong> Serviços principais (corte, barba, acabamentos).</p>
        <p><strong>Serviço Extra:</strong> Tratamentos adicionais (selagem, hidratação, etc.).</p>
        <p><strong>Produtos:</strong> Itens vendidos (ceras, balms, shampoos, etc.).</p>
        <p className="mt-2"><strong>Meta saudável:</strong> ~70% Base, ~20% Extra, ~10% Produtos.</p>
      </>
    ),
  },
};

const fmtCur = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v);
const fmtCurFull = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function ServicosKpis({ kpis, items = [] }: ServicosKpisProps) {
  // Build category breakdown from items
  const catBreakdown = useMemo(() => {
    const map = new Map<string, { fat: number; qty: number }>();
    for (const item of items) {
      const cat = item.categoria || 'N/A';
      const prev = map.get(cat) ?? { fat: 0, qty: 0 };
      map.set(cat, { fat: prev.fat + item.faturamento, qty: prev.qty + item.quantidade });
    }
    const grandTotal = Array.from(map.values()).reduce((s, v) => s + v.fat, 0) || 1;
    return Array.from(map.entries())
      .map(([cat, data]) => ({
        cat,
        fat: data.fat,
        qty: data.qty,
        pct: (data.fat / grandTotal) * 100,
      }))
      .sort((a, b) => {
        const oa = Object.keys(CATEGORY_STYLES).indexOf(a.cat);
        const ob = Object.keys(CATEGORY_STYLES).indexOf(b.cat);
        if (oa !== -1 && ob !== -1) return oa - ob;
        return b.fat - a.fat;
      });
  }, [items]);

  const topServico = kpis.top_servicos?.[0];

  return (
    <div className="space-y-3">
      {/* Main KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <KpiCard
          label={
            <span className="flex items-center gap-0.5">
              <span className="truncate">Fat. Total</span>
              <InfoIconTooltip
                title={KPI_INFO.faturamento.title}
                short={KPI_INFO.faturamento.short}
                details={KPI_INFO.faturamento.details}
                size="sm"
              />
            </span>
          }
          value={fmtCur(kpis.faturamento_total)}
          suffix={<DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
          status="positive"
          className="bg-gradient-to-br from-background to-muted/20"
        />

        <KpiCard
          label={
            <span className="flex items-center gap-0.5">
              <span className="truncate">Atendimentos</span>
              <InfoIconTooltip
                title={KPI_INFO.atendimentos.title}
                short={KPI_INFO.atendimentos.short}
                details={KPI_INFO.atendimentos.details}
                size="sm"
              />
            </span>
          }
          value={fmtNum(kpis.quantidade_total)}
          suffix={<Hash className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
          status="neutral"
          className="bg-gradient-to-br from-background to-muted/20"
        />

        <KpiCard
          label={
            <span className="flex items-center gap-0.5">
              <span className="truncate">Ticket Médio</span>
              <InfoIconTooltip
                title={KPI_INFO.ticketMedio.title}
                short={KPI_INFO.ticketMedio.short}
                details={KPI_INFO.ticketMedio.details}
                size="sm"
              />
            </span>
          }
          value={fmtCurFull(kpis.ticket_medio)}
          suffix={<Calculator className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
          status="neutral"
          className="bg-gradient-to-br from-background to-muted/20"
        />

        <KpiCard
          label={
            <span className="flex items-center gap-0.5">
              <span className="truncate">Top Serviço</span>
              <InfoIconTooltip
                title={KPI_INFO.topServico.title}
                short={KPI_INFO.topServico.short}
                details={KPI_INFO.topServico.details}
                size="sm"
              />
            </span>
          }
          value={topServico?.nome || 'N/A'}
          subtitle={topServico ? fmtCur(topServico.faturamento) : undefined}
          suffix={<Trophy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
          status="neutral"
          className="bg-gradient-to-br from-background to-muted/20"
        />
      </div>

      {/* Category breakdown bar */}
      {catBreakdown.length > 0 && (
        <div className="rounded-lg border border-border bg-card px-3 sm:px-4 py-2.5 sm:py-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Breakdown por Categoria
            </span>
            <InfoIconTooltip
              title={KPI_INFO.breakdown.title}
              short={KPI_INFO.breakdown.short}
              details={KPI_INFO.breakdown.details}
              size="sm"
            />
          </div>

          {/* Stacked bar */}
          <div className="h-1.5 rounded-full flex gap-0.5 overflow-hidden bg-muted/30">
            {catBreakdown.map((c) => {
              const style = CATEGORY_STYLES[c.cat];
              const colorVar = style?.colorVar ?? '--muted-foreground';
              return (
                <div
                  key={c.cat}
                  className="h-full rounded-sm"
                  style={{
                    width: `${c.pct}%`,
                    backgroundColor: `hsl(var(${colorVar}))`,
                    opacity: 0.8,
                    minWidth: c.pct > 0 ? '2px' : 0,
                  }}
                  title={`${c.cat}: ${c.pct.toFixed(1)}%`}
                />
              );
            })}
          </div>

          {/* Legend pills - horizontal scroll on mobile */}
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <div className="flex gap-x-3 sm:gap-x-4 gap-y-1.5 sm:flex-wrap min-w-max sm:min-w-0">
              {catBreakdown.map((c) => {
                const style = CATEGORY_STYLES[c.cat];
                const colorVar = style?.colorVar ?? '--muted-foreground';
                const label = style?.label ?? c.cat;
                return (
                  <div key={c.cat} className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                    <span
                      className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: `hsl(var(${colorVar}))` }}
                    />
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground">{label}</span>
                    <span className="text-[10px] sm:text-[11px] font-semibold text-foreground">{fmtCur(c.fat)}</span>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground">({c.pct.toFixed(1)}%)</span>
                    <span className="hidden sm:inline text-[10px] text-muted-foreground">· {fmtNum(c.qty)} atend.</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

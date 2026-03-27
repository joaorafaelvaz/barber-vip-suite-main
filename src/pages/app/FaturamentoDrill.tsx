// ============================================================
// FILE: src/pages/app/FaturamentoDrill.tsx
// ROTA: /app/faturamento
// PROPÓSITO: Página de drilldown de faturamento
// ============================================================

import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ArrowLeft, FileDown, Loader2 } from 'lucide-react';
import { exportPageToPdf } from '@/lib/exportPdf';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFaturamentoDrill, VIEW_CONFIG } from '@/hooks/useFaturamentoDrill';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DrillResumo,
  DrillMenu,
  DrillChart,
  DrillTable,
  DrillInsights,
} from '@/components/faturamento';
import { FaturamentoPrintView } from '@/components/faturamento/FaturamentoPrintView';
import { HowToReadSection } from '@/components/help/HowToReadSection';
import type { RefLineConfig } from '@/components/faturamento/DrillChart';

function formatPeriodo(inicio: string, fim: string): string {
  try {
    const i = format(parseISO(inicio), "dd MMM", { locale: ptBR });
    const f = format(parseISO(fim), "dd MMM yyyy", { locale: ptBR });
    return `${i} — ${f}`;
  } catch {
    return `${inicio} — ${fim}`;
  }
}

export default function FaturamentoDrill() {
  const navigate = useNavigate();
  const {
    filters,
    resumo, loadingResumo, errorResumo,
    comparacoes, loadingComparacoes,
    selectedView, setSelectedView,
    viewData, loadingView, errorView,
    granularidade, setGranularidade,
    topLimit, setTopLimit,
  } = useFaturamentoDrill();

  const viewTitle = VIEW_CONFIG[selectedView]?.title || 'Série';

  // Build reference lines for periodo view
  const refLines = useMemo<RefLineConfig[]>(() => {
    if (selectedView !== 'periodo' || !comparacoes) return [];
    const lines: RefLineConfig[] = [];
    if (comparacoes.sply_total > 0 && comparacoes.sply_dias > 0) {
      lines.push({ value: comparacoes.sply_total / comparacoes.sply_dias, label: 'Méd. SPLY', color: '#f59e0b', dashArray: '6 3' });
    }
    if (comparacoes.avg_6m > 0) {
      lines.push({ value: comparacoes.avg_6m / 30, label: 'Méd. 6m', color: '#3b82f6', dashArray: '6 3' });
    }
    return lines;
  }, [selectedView, comparacoes]);

  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Create off-screen container
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.zIndex = '-9999';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);

      // Render PrintView
      const root = createRoot(container);
      root.render(
        <FaturamentoPrintView
          resumo={resumo}
          comparacoes={comparacoes}
          viewData={viewData}
          viewTitle={viewTitle}
          filters={{ inicio: filters.inicio, fim: filters.fim }}
        />
      );

      // Wait for render
      await new Promise((r) => setTimeout(r, 300));

      const printEl = container.firstElementChild as HTMLElement;
      if (printEl) {
        await exportPageToPdf(
          printEl,
          'Faturamento — Detalhamento',
          formatPeriodo(filters.inicio, filters.fim),
          `faturamento-${filters.inicio}-${filters.fim}.pdf`,
        );
      }

      // Cleanup
      root.unmount();
      document.body.removeChild(container);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 overflow-x-hidden max-w-full">
      <HowToReadSection
        bullets={[
          'Resumo executivo mostra faturamento total, ticket médio e variação vs período anterior.',
          'Use o menu de aberturas para fatiar por: período (diário/semanal), colaborador, produto, forma de pagamento.',
          'Gráfico + tabela são sincronizados — cada abertura mostra ranking e participação.',
          'Insights automáticos destacam concentrações e destaques relevantes.',
        ]}
        expandedText="O Faturamento Drill permite analisar a composição da receita por diferentes dimensões. Navegue pelas aberturas para entender de onde vem o faturamento, quem mais contribui e quais produtos/serviços lideram."
      />
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">
              Faturamento — Detalhamento
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatPeriodo(filters.inicio, filters.fim)}
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={handleExportPdf} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          <span className="hidden sm:inline ml-1">Exportar PDF</span>
        </Button>
      </div>

      {/* Resumo executivo */}
      <DrillResumo resumo={resumo} loading={loadingResumo} error={errorResumo} inicio={filters.inicio} fim={filters.fim} comparacoes={comparacoes} loadingComparacoes={loadingComparacoes} />

      {/* Menu de aberturas */}
      <DrillMenu selectedView={selectedView} onSelectView={setSelectedView} granularidade={granularidade} onGranularidade={setGranularidade} topLimit={topLimit} onTopLimit={setTopLimit} />

      {/* Resultado */}
      {loadingView ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" />
          </div>
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      ) : errorView ? (
        <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
          <p className="text-sm text-destructive">Erro: {errorView}</p>
        </div>
      ) : viewData ? (
        <div className="space-y-4">
          <DrillChart series={viewData.series} title={viewTitle} allowPie={selectedView !== 'periodo'} refLines={selectedView === 'periodo' ? refLines : undefined} />
          <DrillTable table={viewData.table} />
          <DrillInsights insights={viewData.insights} />
        </div>
      ) : null}
    </div>
  );
}

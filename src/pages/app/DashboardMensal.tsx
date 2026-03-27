import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AlertCircle, RefreshCw, CalendarRange } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

import { DashboardKpiCards, DashboardBarberTable } from '@/components/dashboard';
import { MensalFilters, MensalCharts } from '@/components/dashboard-mensal';
import { useDashboardMensal, type DashboardMensalFilters } from '@/hooks/useDashboardMensal';
import { HowToReadSection } from '@/components/help/HowToReadSection';

function MensalSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

// (MensalInitialState removed — auto-fetch on mount)

export default function DashboardMensal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error, colaboradores, fetchDashboard, fetchColaboradores, clearError } = useDashboardMensal();
  const [hasApplied, setHasApplied] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<DashboardMensalFilters | null>(null);

  // Ler filtros da URL
  const urlAnoInicio = searchParams.get('anoInicio');
  const urlMesInicio = searchParams.get('mesInicio');
  const urlAnoFim = searchParams.get('anoFim');
  const urlMesFim = searchParams.get('mesFim');
  const urlColaboradorId = searchParams.get('colaboradorId');
  const urlTipoColaborador = searchParams.get('tipoColaborador');

  const handleApplyFilters = useCallback((filters: DashboardMensalFilters) => {
    setHasApplied(true);
    setCurrentFilters(filters);
    clearError();
    fetchDashboard(filters);
    
    // Persistir na URL
    const params = new URLSearchParams();
    params.set('anoInicio', String(filters.anoInicio));
    params.set('mesInicio', String(filters.mesInicio));
    params.set('anoFim', String(filters.anoFim));
    params.set('mesFim', String(filters.mesFim));
    if (filters.colaboradorId) params.set('colaboradorId', filters.colaboradorId);
    if (filters.tipoColaborador) params.set('tipoColaborador', filters.tipoColaborador);
    setSearchParams(params, { replace: true });
  }, [fetchDashboard, clearError, setSearchParams]);

  // Auto-fetch: prioriza params da URL
  const autoFetched = useRef(false);
  useEffect(() => {
    if (!autoFetched.current) {
      autoFetched.current = true;
      const now = new Date();
      handleApplyFilters({
        anoInicio: urlAnoInicio ? Number(urlAnoInicio) : now.getFullYear(),
        mesInicio: urlMesInicio ? Number(urlMesInicio) : 1,
        anoFim: urlAnoFim ? Number(urlAnoFim) : now.getFullYear(),
        mesFim: urlMesFim ? Number(urlMesFim) : now.getMonth() + 1,
        colaboradorId: urlColaboradorId || null,
        tipoColaborador: (urlTipoColaborador as 'barbeiro' | 'recepcao') || null,
      });
    }
  }, [handleApplyFilters, urlAnoInicio, urlMesInicio, urlAnoFim, urlMesFim, urlColaboradorId, urlTipoColaborador]);

  const handleTipoChange = useCallback((tipo: string | null) => {
    fetchColaboradores(tipo);
  }, [fetchColaboradores]);

  const handleRetry = useCallback(() => {
    if (currentFilters) {
      clearError();
      fetchDashboard(currentFilters);
    }
  }, [currentFilters, fetchDashboard, clearError]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-2">
        <CalendarRange className="h-5 w-5 text-primary" />
        <h1 className="text-lg sm:text-xl font-semibold text-foreground">Dashboard Mensal</h1>
      </div>

      <HowToReadSection
        bullets={[
          'Selecione o intervalo de meses (início/fim) para comparar evolução.',
          'KPIs mostram o acumulado do período com variação vs período anterior.',
          'Gráficos de linha mostram tendência mês a mês — procure direção, não valores isolados.',
          'Tabela por colaborador = ranking acumulado no período selecionado.',
        ]}
        expandedText="O Dashboard Mensal permite análise evolutiva de múltiplos meses. Ideal para identificar tendências de crescimento ou queda. Compare períodos equivalentes (ex: Jan-Mar 2025 vs Jan-Mar 2024) para análises sazonais."
      />

      <MensalFilters
        onApply={handleApplyFilters}
        colaboradores={colaboradores}
        loading={loading}
        onTipoChange={handleTipoChange}
        initialAnoInicio={urlAnoInicio ? Number(urlAnoInicio) : undefined}
        initialMesInicio={urlMesInicio ? Number(urlMesInicio) : undefined}
        initialAnoFim={urlAnoFim ? Number(urlAnoFim) : undefined}
        initialMesFim={urlMesFim ? Number(urlMesFim) : undefined}
        initialColaboradorId={urlColaboradorId}
        initialTipoColaborador={urlTipoColaborador}
      />

      <div className="space-y-4">
        {error && (
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar dados</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {loading && <MensalSkeleton />}

        {!loading && !error && !hasApplied && <MensalSkeleton />}

        {!loading && !error && hasApplied && data && currentFilters && (() => {
          const dateFrom = `${currentFilters.anoInicio}-${String(currentFilters.mesInicio).padStart(2, '0')}-01`;
          const dateTo = new Date(currentFilters.anoFim, currentFilters.mesFim, 0).toISOString().split('T')[0];
          return (
          <>
            <DashboardKpiCards
              kpis={data.kpis}
              comparacoes={data.comparacoes}
              dateFrom={dateFrom}
              dateTo={dateTo}
              colaboradorId={currentFilters.colaboradorId}
              tipoColaborador={currentFilters.tipoColaborador}
            />
            <MensalCharts monthly={data.monthly} />
            <DashboardBarberTable data={data.by_colaborador || []} />
          </>
          );
        })()}

        {!loading && !error && hasApplied && !data && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Nenhum dado encontrado para os filtros selecionados.</p>
          </div>
        )}
      </div>
    </div>
  );
}

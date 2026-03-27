// ============================================================
// FILE: src/pages/app/Dashboard.tsx
// PROPÓSITO: Página principal do Dashboard (mobile-first)
// FONTE DE DADOS: public.rpc_dashboard_period (Supabase RPC)
// COMPORTAMENTO:
//   - Carrega dados ao clicar em "Aplicar Filtros"
//   - NÃO dispara automaticamente ao carregar a página
//   - Data início: primeiro dia do mês atual
//   - Data fim: última data com faturamento no mês
// ============================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AlertCircle, RefreshCw, LayoutDashboard } from 'lucide-react';
import { startOfMonth, format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

import { 
  DashboardFilters, 
  DashboardKpiCards, 
  DashboardCharts,
  DashboardBarberTable,
  type DashboardFiltersType 
} from '@/components/dashboard';
import { useDashboard } from '@/hooks/useDashboard';
import { HowToReadSection } from '@/components/help/HowToReadSection';

// ============================================================
// COMPONENTE: LOADING SKELETON
// ============================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* KPI Cards Skeleton (10 cards now) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      
      {/* Chart Skeleton */}
      <Skeleton className="h-96" />
    </div>
  );
}

// (DashboardInitialState removed — auto-fetch on mount)

// ============================================================
// COMPONENTE: ESTADO DE ERRO
// ============================================================

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function DashboardErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Erro ao carregar dados</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">{message}</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRetry}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { 
    data, 
    loading, 
    error, 
    colaboradores,
    lastFaturamentoDate,
    lastDateLoading,
    fetchDashboard, 
    fetchColaboradores,
    clearError 
  } = useDashboard();

  const [hasApplied, setHasApplied] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<DashboardFiltersType | null>(null);

  // Ler filtros da URL
  const urlDateFrom = searchParams.get('dateFrom');
  const urlDateTo = searchParams.get('dateTo');
  const urlColaboradorId = searchParams.get('colaboradorId');
  const urlTipoColaborador = searchParams.get('tipoColaborador');

  const handleApplyFilters = useCallback((filters: DashboardFiltersType) => {
    setHasApplied(true);
    setCurrentFilters(filters);
    clearError();
    fetchDashboard(filters);
    
    // Persistir na URL
    const params = new URLSearchParams();
    params.set('dateFrom', format(filters.dateFrom, 'yyyy-MM-dd'));
    params.set('dateTo', format(filters.dateTo, 'yyyy-MM-dd'));
    if (filters.colaboradorId) params.set('colaboradorId', filters.colaboradorId);
    if (filters.tipoColaborador) params.set('tipoColaborador', filters.tipoColaborador);
    setSearchParams(params, { replace: true });
  }, [fetchDashboard, clearError, setSearchParams]);

  // Auto-fetch: prioriza params da URL, senão usa defaults
  const autoFetched = useRef(false);
  useEffect(() => {
    if (!autoFetched.current && !lastDateLoading) {
      if (urlDateFrom && urlDateTo) {
        autoFetched.current = true;
        handleApplyFilters({
          dateFrom: new Date(urlDateFrom + 'T12:00:00'),
          dateTo: new Date(urlDateTo + 'T12:00:00'),
          colaboradorId: urlColaboradorId || null,
          tipoColaborador: (urlTipoColaborador as 'barbeiro' | 'recepcao') || null,
        });
      } else if (lastFaturamentoDate) {
        autoFetched.current = true;
        handleApplyFilters({
          dateFrom: startOfMonth(new Date(lastFaturamentoDate)),
          dateTo: new Date(lastFaturamentoDate),
          colaboradorId: null,
          tipoColaborador: null,
        });
      }
    }
  }, [lastFaturamentoDate, lastDateLoading, handleApplyFilters, urlDateFrom, urlDateTo, urlColaboradorId, urlTipoColaborador]);

  // Handler para recarregar colaboradores quando muda o tipo
  const handleTipoChange = useCallback((tipo: string | null) => {
    fetchColaboradores(tipo);
  }, [fetchColaboradores]);

  // Handler para retry após erro
  const handleRetry = useCallback(() => {
    if (currentFilters) {
      clearError();
      fetchDashboard(currentFilters);
    }
  }, [currentFilters, fetchDashboard, clearError]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <LayoutDashboard className="h-5 w-5 text-primary" />
        <h1 className="text-lg sm:text-xl font-semibold text-foreground">
          Dashboard
        </h1>
      </div>

      <HowToReadSection
        bullets={[
          'Faturamento = soma dos valores líquidos das vendas no período selecionado.',
          'Ticket médio = faturamento ÷ número de atendimentos (vendas com valor > 0).',
          'Atendimentos = total de vendas/serviços realizados no período.',
          'Comparação (▲▼) mostra variação vs período anterior de mesmo tamanho.',
          'Tabela por barbeiro = ranking de performance individual no período.',
        ]}
        expandedText="O Dashboard é a visão rápida do período selecionado. Use os filtros de data e colaborador para focar. Os KPIs comparam automaticamente com o período anterior de mesmo tamanho. Para análise mensal evolutiva, use o Dashboard Mensal."
      />

      {/* Filtros */}
      <DashboardFilters
        onApply={handleApplyFilters}
        colaboradores={colaboradores}
        loading={loading || lastDateLoading}
        onTipoChange={handleTipoChange}
        initialDateTo={urlDateTo ? new Date(urlDateTo + 'T12:00:00') : lastFaturamentoDate || undefined}
        initialDateFrom={urlDateFrom ? new Date(urlDateFrom + 'T12:00:00') : undefined}
        initialColaboradorId={urlColaboradorId}
        initialTipoColaborador={urlTipoColaborador}
      />

      {/* Título contextual dos filtros aplicados */}
      {!loading && !error && hasApplied && currentFilters && (
        <div className="px-1">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {format(currentFilters.dateFrom, 'dd/MM/yyyy')} a {format(currentFilters.dateTo, 'dd/MM/yyyy')}
            </span>
            {' · '}
            {currentFilters.colaboradorId
              ? colaboradores.find(c => c.colaborador_id === currentFilters.colaboradorId)?.colaborador_nome || 'Colaborador'
              : currentFilters.tipoColaborador === 'barbeiro'
                ? 'Barbeiros'
                : currentFilters.tipoColaborador === 'recepcao'
                  ? 'Recepção'
                  : 'Todos os colaboradores'}
          </p>
        </div>
      )}

      {/* Conteúdo */}
      <div className="space-y-4">
        {/* Estado de erro */}
        {error && (
          <DashboardErrorState 
            message={error} 
            onRetry={handleRetry} 
          />
        )}

        {/* Estado de loading */}
        {loading && <DashboardSkeleton />}

        {/* Loading exibido antes do primeiro fetch também */}
        {!loading && !error && !hasApplied && !lastDateLoading && (
          <DashboardSkeleton />
        )}

        {/* Estado de sucesso (com dados) */}
        {!loading && !error && hasApplied && data && (
          <>
            {/* Grid de KPIs */}
            <DashboardKpiCards
              kpis={data.kpis}
              comparacoes={data.comparacoes}
              dateFrom={data.periodo?.inicio}
              dateTo={data.periodo?.fim}
              colaboradorId={currentFilters?.colaboradorId}
              tipoColaborador={currentFilters?.tipoColaborador}
            />

            {/* Gráficos */}
            <DashboardCharts daily={data.daily} />

            {/* Tabela por Barbeiro */}
            <DashboardBarberTable data={data.by_colaborador || []} />
          </>
        )}

        {/* Estado sem dados */}
        {!loading && !error && hasApplied && !data && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              Nenhum dado encontrado para os filtros selecionados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AlertCircle, RefreshCw, LayoutGrid, BarChart3, TableIcon, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import {
  ServicosFilters, ServicosKpis, ServicosCharts,
  ServicosTable, ServicosDrillSheet, ServicosCategoriasView,
  ServicosBarbeiroView,
} from '@/components/servicos';
import { useServicos, type ServicosFilters as IServicosFilters } from '@/hooks/useServicos';
import type { ServicoItem } from '@/hooks/useServicos';

function ServicosSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80" />)}
      </div>
    </div>
  );
}

export default function Servicos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error, colaboradores, fetchServicos, clearError } = useServicos();
  const [hasApplied, setHasApplied] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<IServicosFilters | null>(null);
  const [activeView, setActiveView] = useState<'categoria' | 'barbeiros' | 'graficos' | 'tabela'>('categoria');

  // Drill-down state
  const [drillItem, setDrillItem] = useState<ServicoItem | null>(null);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillBarbeiro, setDrillBarbeiro] = useState<any>(null);

  // Read filters from URL
  const urlDataInicio = searchParams.get('dataInicio');
  const urlDataFim = searchParams.get('dataFim');
  const urlColaboradorId = searchParams.get('colaboradorId');
  const urlTipoServico = searchParams.get('tipoServico');
  const urlAgrupamento = searchParams.get('agrupamento');

  const handleApplyFilters = useCallback((filters: IServicosFilters) => {
    setHasApplied(true);
    setCurrentFilters(filters);
    clearError();
    fetchServicos(filters);

    const params = new URLSearchParams();
    params.set('dataInicio', filters.dataInicio);
    params.set('dataFim', filters.dataFim);
    if (filters.colaboradorId) params.set('colaboradorId', filters.colaboradorId);
    if (filters.tipoServico) params.set('tipoServico', filters.tipoServico);
    params.set('agrupamento', filters.agrupamento);
    setSearchParams(params, { replace: true });
  }, [fetchServicos, clearError, setSearchParams]);

  const autoFetched = useRef(false);
  useEffect(() => {
    if (!autoFetched.current) {
      autoFetched.current = true;
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      handleApplyFilters({
        dataInicio: urlDataInicio || firstDay.toISOString().split('T')[0],
        dataFim: urlDataFim || lastDay.toISOString().split('T')[0],
        colaboradorId: urlColaboradorId || null,
        tipoServico: (urlTipoServico as any) || null,
        agrupamento: (urlAgrupamento as any) || 'servico',
      });
    }
  }, [handleApplyFilters, urlDataInicio, urlDataFim, urlColaboradorId, urlTipoServico, urlAgrupamento]);

  const handleRetry = useCallback(() => {
    if (currentFilters) { clearError(); fetchServicos(currentFilters); }
  }, [currentFilters, fetchServicos, clearError]);

  const handleDrillDown = useCallback((item: ServicoItem) => {
    setDrillItem(item);
    setDrillBarbeiro(null);
    setDrillOpen(true);
  }, []);

  const handleBarbeiroDrill = useCallback((barbeiro: any) => {
    setDrillItem(null);
    setDrillBarbeiro(barbeiro);
    setDrillOpen(true);
  }, []);

  const currentAgrupamento = (data?.filtros?.agrupamento as any) || currentFilters?.agrupamento || 'servico';
  const isServicoView = currentAgrupamento === 'servico';

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-6">
      {/* Header with Collapsible Filters */}
      <ServicosFilters
        onApply={handleApplyFilters}
        colaboradores={colaboradores}
        loading={loading}
        initialDataInicio={urlDataInicio || undefined}
        initialDataFim={urlDataFim || undefined}
        initialColaboradorId={urlColaboradorId}
        initialTipoServico={urlTipoServico}
        initialAgrupamento={urlAgrupamento || undefined}
      />

      <div className="space-y-6">
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

        {loading && <ServicosSkeleton />}
        {!loading && !error && !hasApplied && <ServicosSkeleton />}

        {!loading && !error && hasApplied && data && (
          <>
            <ServicosKpis kpis={data.kpis} items={data.items || []} />

            {isServicoView ? (
              /* ── Tabbed view for "servico" grouping ── */
              <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
                <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                  <TabsList className="h-8 sm:h-9 min-w-max sm:min-w-0">
                    <TabsTrigger value="categoria" className="gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-3">
                      <LayoutGrid className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span className="hidden sm:inline">Por </span>Categoria
                    </TabsTrigger>
                    <TabsTrigger value="barbeiros" className="gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-3">
                      <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span className="hidden sm:inline">Por </span>Barbeiro
                    </TabsTrigger>
                    <TabsTrigger value="graficos" className="gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-3">
                      <BarChart3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Gráficos
                    </TabsTrigger>
                    <TabsTrigger value="tabela" className="gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-3">
                      <TableIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Tabela
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="categoria" className="mt-4">
                  <ServicosCategoriasView
                    items={data.items || []}
                    onDrillDown={handleDrillDown}
                  />
                </TabsContent>

                <TabsContent value="barbeiros" className="mt-4">
                  <ServicosBarbeiroView
                    baseFilters={currentFilters}
                    onDrillDown={handleBarbeiroDrill}
                  />
                </TabsContent>

                <TabsContent value="graficos" className="mt-4">
                  <ServicosCharts
                    items={data.items || []}
                    agrupamento={currentAgrupamento}
                    onDrillDown={handleDrillDown}
                  />
                </TabsContent>

                <TabsContent value="tabela" className="mt-4">
                  <ServicosTable
                    items={data.items || []}
                    agrupamento={currentAgrupamento}
                    onDrillDown={handleDrillDown}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              /* ── No tabs for barbeiro / mes grouping ── */
              <>
                <ServicosCharts
                  items={data.items || []}
                  agrupamento={currentAgrupamento}
                  onDrillDown={handleDrillDown}
                />
                <ServicosTable
                  items={data.items || []}
                  agrupamento={currentAgrupamento}
                  onDrillDown={handleDrillDown}
                />
              </>
            )}
          </>
        )}

        {!loading && !error && hasApplied && !data && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Nenhum dado encontrado para os filtros selecionados.</p>
          </div>
        )}
      </div>

      {currentFilters && (
        <ServicosDrillSheet
          open={drillOpen}
          onClose={() => { setDrillOpen(false); setDrillBarbeiro(null); }}
          item={drillItem}
          agrupamento={currentAgrupamento}
          baseFilters={currentFilters}
          barbeiro={drillBarbeiro}
        />
      )}
    </div>
  );
}

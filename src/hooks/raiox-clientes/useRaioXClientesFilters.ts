import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { RaioXPeriodo, RaioXFilters, RaioXComputedFilters } from '@/pages/app/raiox-clientes/raioxTypes';
import { buildDateStart, buildDateEnd, calcPeriodoLabel } from '@/pages/app/raiox-clientes/raioxUtils';

function defaultPeriodo(): { inicio: RaioXPeriodo; fim: RaioXPeriodo } {
  const now = new Date();
  return {
    inicio: { year: now.getFullYear(), month: 1 },
    fim: { year: now.getFullYear(), month: now.getMonth() + 1 },
  };
}

export function useRaioXClientesFilters() {
  const [filters, setFilters] = useState<RaioXFilters>({
    periodo: defaultPeriodo(),
    janelaDias: 60,
    excluirSemCadastro: true,
    filtroColaborador: { id: null, nome: '' },
    lastRefetchAt: null,
    autoAtualizar: false,
  });

  const refetchCallbackRef = useRef<(() => void) | null>(null);

  const computed = useMemo<RaioXComputedFilters>(() => ({
    ...filters,
    dataInicioISO: buildDateStart(filters.periodo.inicio),
    dataFimISO: buildDateEnd(filters.periodo.fim),
    periodoLabel: calcPeriodoLabel(filters.periodo.inicio, filters.periodo.fim),
  }), [filters]);

  const handleRefetch = useCallback(() => {
    setFilters(prev => ({ ...prev, lastRefetchAt: new Date().toISOString() }));
    refetchCallbackRef.current?.();
  }, []);

  const setInicio = useCallback((p: RaioXPeriodo) => {
    setFilters(prev => ({ ...prev, periodo: { ...prev.periodo, inicio: p } }));
  }, []);

  const setFim = useCallback((p: RaioXPeriodo) => {
    setFilters(prev => ({ ...prev, periodo: { ...prev.periodo, fim: p } }));
  }, []);

  const setJanelaDias = useCallback((v: number) => {
    setFilters(prev => ({ ...prev, janelaDias: v }));
  }, []);

  const setExcluirSemCadastro = useCallback((v: boolean) => {
    setFilters(prev => ({ ...prev, excluirSemCadastro: v }));
  }, []);

  const setFiltroColaborador = useCallback((id: string | null, nome: string) => {
    setFilters(prev => ({ ...prev, filtroColaborador: { id, nome } }));
  }, []);

  const clearColaborador = useCallback(() => {
    setFilters(prev => ({ ...prev, filtroColaborador: { id: null, nome: '' } }));
  }, []);

  const setAutoAtualizar = useCallback((v: boolean) => {
    setFilters(prev => ({ ...prev, autoAtualizar: v }));
  }, []);

  // Auto-refetch when filters change and autoAtualizar is ON
  const prevFiltersRef = useRef(filters);
  useEffect(() => {
    const prev = prevFiltersRef.current;
    prevFiltersRef.current = filters;
    if (!filters.autoAtualizar) return;
    // Only auto-refetch on filter changes (not on lastRefetchAt/autoAtualizar changes)
    const changed =
      prev.periodo !== filters.periodo ||
      prev.janelaDias !== filters.janelaDias ||
      prev.excluirSemCadastro !== filters.excluirSemCadastro ||
      prev.filtroColaborador !== filters.filtroColaborador;
    if (changed) {
      handleRefetch();
    }
  }, [filters, handleRefetch]);

  return {
    filters: computed,
    setInicio,
    setFim,
    setJanelaDias,
    setExcluirSemCadastro,
    setFiltroColaborador,
    clearColaborador,
    setAutoAtualizar,
    handleRefetch,
    registerRefetchCallback: (cb: () => void) => { refetchCallbackRef.current = cb; },
  };
}

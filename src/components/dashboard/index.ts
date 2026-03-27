// ============================================================
// FILE: src/components/dashboard/index.ts
// PROPÓSITO: Barrel exports dos componentes do Dashboard
// ============================================================

// Componentes
export { DashboardFilters } from './DashboardFilters';
export { DashboardKpiCard } from './DashboardKpiCard';
export { DashboardKpiCards } from './DashboardKpiCards';
export { DashboardCharts } from './DashboardCharts';
export { DashboardBarberTable } from './DashboardBarberTable';

// Tipos
export type {
  DashboardFilters as DashboardFiltersType,
  DashboardKpis,
  DashboardDaily,
  DashboardColaborador,
  DashboardData,
  DashboardIndicator,
  IndicatorConfig,
  DashboardStats,
  KpiDetails,
  KpiComparisons,
  ByColaborador
} from './types';

// ============================================================
// FILE: src/components/dashboard/types.ts
// PROPÓSITO: Tipos TypeScript para o Dashboard
// FONTE DE DADOS: public.rpc_dashboard_period (Supabase)
// ============================================================

/**
 * Filtros do Dashboard
 * Usados para chamar a RPC e controlar o estado local
 */
export interface DashboardFilters {
  dateFrom: Date;
  dateTo: Date;
  colaboradorId: string | null;
  tipoColaborador: 'barbeiro' | 'recepcao' | null;
}

/**
 * Comparações para KPIs
 * #* = Dado não disponível no backend ainda
 */
export interface KpiComparisons {
  sply?: number | null;      // Same Period Last Year
  mom?: number | null;       // Month over Month
  avg_12m?: number | null;   // Média últimos 12 meses
  avg_6m?: number | null;    // Média últimos 6 meses
}

/**
 * KPIs agregados do período
 * FONTE: Retorno da RPC rpc_dashboard_period -> kpis
 */
export interface DashboardKpis {
  faturamento: number;
  atendimentos: number;
  ticket_medio: number;
  clientes: number;
  clientes_novos: number;
  extras_qtd: number;
  extras_valor: number;
  servicos_totais: number;
  dias_trabalhados: number;
  faturamento_por_dia: number;
}

/**
 * Dados diários para gráficos
 * FONTE: Retorno da RPC rpc_dashboard_period -> daily[]
 */
export interface DashboardDaily {
  dia: string;
  faturamento: number;
  atendimentos: number;
  ticket_medio: number;
  clientes: number;
  clientes_novos: number;
  extras_qtd: number;
  extras_valor: number;
  servicos_totais: number;
}

/**
 * Colaborador para select
 * FONTE: Retorno da RPC rpc_dashboard_period -> colaboradores_periodo[]
 */
export interface DashboardColaborador {
  colaborador_id: string;
  colaborador_nome: string;
}

/**
 * Breakdown por colaborador
 * FONTE: Retorno da RPC rpc_dashboard_period -> by_colaborador[]
 */
export interface ByColaborador {
  colaborador_id: string;
  colaborador_nome: string;
  faturamento: number;
  atendimentos: number;
  ticket_medio: number;
  extras_qtd: number;
  extras_valor: number;
  dias_trabalhados: number;
  servicos_totais: number;
  clientes: number;
  clientes_novos: number;
  faturamento_por_dia_trabalhado: number;
  comissao_pct: number;
  comissao: number;
  bonus: number;
  // Breakdown opcional (preenchido no relatório semanal)
  faturamento_produtos?: number;
  faturamento_servicos_base?: number;
  comissao_servicos?: number;
  comissao_produtos?: number;
  comissao_extras?: number;
  comissao_pct_servicos?: number;
  comissao_pct_produtos?: number;
}

/**
 * Período de comparação
 */
export interface ComparacaoPeriodo {
  inicio: string;
  fim: string;
}

/**
 * Dados de comparação SPLY ou MOM
 */
export interface ComparacaoData {
  periodo: ComparacaoPeriodo;
  faturamento: number;
  faturamento_var_pct: number | null;
  atendimentos: number;
  atendimentos_var_pct: number | null;
  clientes: number;
  clientes_var_pct: number | null;
  dias_trabalhados: number;
  faturamento_por_dia: number;
  faturamento_por_dia_var_pct: number | null;
}

/**
 * Bloco de comparações retornado pela RPC
 */
export interface DashboardComparacoes {
  sply: ComparacaoData;
  mom: ComparacaoData;
}

/**
 * Retorno completo da RPC rpc_dashboard_period
 */
export interface DashboardData {
  periodo: {
    inicio: string;
    fim: string;
  };
  filtros: {
    colaborador_id: string | null;
    tipo_colaborador: string | null;
  };
  kpis: DashboardKpis;
  daily: DashboardDaily[];
  colaboradores_periodo: DashboardColaborador[];
  by_colaborador: ByColaborador[];
  comparacoes: DashboardComparacoes;
}

/**
 * Indicadores disponíveis para gráficos
 */
export type DashboardIndicator = 
  | 'faturamento' 
  | 'atendimentos' 
  | 'ticket_medio' 
  | 'clientes' 
  | 'clientes_novos' 
  | 'extras_qtd' 
  | 'extras_valor' 
  | 'servicos_totais';

/**
 * Configuração de indicador para display
 */
export interface IndicatorConfig {
  label: string;
  format: 'currency' | 'number' | 'decimal';
  icon: string;
}

/**
 * Detalhes de um KPI para exibição expandida
 */
export interface KpiDetails {
  description: string;
  formula: string;
  source: string;
}

/**
 * Estatísticas calculadas do período
 * NOTA: Calculadas no frontend a partir do array daily
 */
export interface DashboardStats {
  total: number;
  average: number;
  max: number;
  min: number;
  maxDay: string | null;
  minDay: string | null;
}

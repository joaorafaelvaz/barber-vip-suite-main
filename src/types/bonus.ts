/**
 * Tipos para o sistema de bônus
 */

/** Tipos de bônus suportados */
export type TipoBonus =
  | 'percentual_extra'       // +X% sobre comissão
  | 'percentual_faturamento' // X% sobre faturamento total/extras/base
  | 'valor_fixo'             // R$ X fixo
  | 'valor_por_unidade';     // R$ X por unidade de KPI acima da meta

/** Bases de cálculo para percentual_faturamento */
export type BaseCalculo =
  | 'faturamento_total'
  | 'faturamento_extras'
  | 'faturamento_base'
  | 'comissao_total';

/** Operadores de meta */
export type MetaOperador = '>=' | '>' | '=' | 'faixa';

/** KPIs disponíveis (vindos da RPC rpc_dashboard_period) */
export const KPI_CATALOGO = {
  faturamento: { label: 'Faturamento Total', tipo: 'moeda' },
  atendimentos: { label: 'Atendimentos', tipo: 'numero' },
  clientes: { label: 'Clientes Únicos', tipo: 'numero' },
  clientes_novos: { label: 'Clientes Novos', tipo: 'numero' },
  servicos_totais: { label: 'Serviços (qtd)', tipo: 'numero' },
  extras_qtd: { label: 'Extras (qtd)', tipo: 'numero' },
  extras_valor: { label: 'Extras (valor)', tipo: 'moeda' },
  dias_trabalhados: { label: 'Dias Trabalhados', tipo: 'numero' },
  ticket_medio: { label: 'Ticket Médio', tipo: 'moeda' },
  faturamento_por_dia: { label: 'Faturamento/Dia', tipo: 'moeda' },
  item_qtd: { label: 'Item Específico (qtd)', tipo: 'numero', requerItemAlvo: true },
  item_valor: { label: 'Item Específico (valor)', tipo: 'moeda', requerItemAlvo: true },
} as const;

export type KpiKey = keyof typeof KPI_CATALOGO;

/**
 * Regra de bônus cadastrada
 */
export interface BonusRegra {
  id: string;
  nome_bonus: string;
  descricao_regra: string | null;
  colaborador_id: string | null; // NULL = GLOBAL
  ativo: boolean;
  tipo_bonus: TipoBonus;
  base_calculo: BaseCalculo | null;
  bonus_valor: number | null;
  depende_meta: boolean;
  kpi_key: KpiKey | null;
  item_alvo: string | null;
  meta_operador: MetaOperador;
  meta_valor: number | null;
  usa_escalonamento: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Faixa de escalonamento de bônus
 */
export interface BonusFaixa {
  id: string;
  regra_id: string;
  faixa_ordem: number;
  valor_minimo: number;
  valor_maximo: number | null;
  bonus_valor: number;
  nome: string | null;
  created_at: string;
}

/**
 * Período em que a regra está ativa
 */
export interface BonusRegraPeriodo {
  id: string;
  regra_id: string;
  ano: number;
  mes: number;
  created_at: string;
}

/**
 * Resultado histórico de bônus (congelado)
 */
export interface BonusHistoricoResultado {
  id: string;
  regra_id: string;
  colaborador_id: string;
  colaborador_nome: string | null;
  ano: number;
  mes: number;
  kpi_realizado: number | null;
  meta: number | null;
  atingiu: boolean;
  bonus_calculado: number;
  detalhes: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Regra completa com faixas e períodos
 */
export interface BonusRegraCompleta {
  regra: BonusRegra;
  faixas: BonusFaixa[];
  periodos: BonusRegraPeriodo[];
}

/**
 * Resultado do cálculo de bônus para um colaborador
 */
export interface BonusResultado {
  regra_id: string;
  nome_bonus: string;
  descricao: string | null;
  aplicavel: boolean;
  atingiu: boolean;
  kpi_realizado: number;
  meta: number | null;
  bonus_calculado: number;
  faixa_atual?: BonusFaixa | null;
  proxima_faixa?: BonusFaixa | null;
  progresso_meta: number; // 0-100%
  meta_por_dia?: number;
  realizado_por_dia?: number;
  diferenca_meta?: number; // + = frente, - = atrás
}

/**
 * Dados para criar/editar uma regra de bônus
 */
export interface BonusRegraInput {
  nome_bonus: string;
  descricao_regra?: string;
  colaborador_id?: string | null;
  ativo?: boolean;
  tipo_bonus: TipoBonus;
  base_calculo?: BaseCalculo | null;
  bonus_valor?: number;
  depende_meta?: boolean;
  kpi_key?: KpiKey | null;
  item_alvo?: string | null;
  meta_operador?: MetaOperador;
  meta_valor?: number;
  usa_escalonamento?: boolean;
  faixas?: Omit<BonusFaixa, 'id' | 'regra_id' | 'created_at'>[];
  periodos?: { ano: number; mes: number }[];
}

/**
 * KPIs de um colaborador (vindos da RPC)
 */
export interface ColaboradorKpis {
  colaborador_id: string;
  colaborador_nome: string;
  faturamento: number;
  atendimentos: number;
  clientes: number;
  clientes_novos: number;
  servicos_totais: number;
  extras_qtd: number;
  extras_valor: number;
  dias_trabalhados: number;
  ticket_medio: number;
  faturamento_por_dia: number;
  comissao_total?: number;
  faturamento_base?: number;
  faturamento_extras?: number;
  // Para itens específicos (preenchido conforme necessário)
  item_qtd?: number;
  item_valor?: number;
}

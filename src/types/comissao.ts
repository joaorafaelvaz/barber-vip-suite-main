/**
 * Tipos para o sistema de comissões
 */

export type TipoComissao = 'SERVICO' | 'PRODUTO';

/**
 * Regra de comissão por período (ano/mês)
 * colaborador_id = null significa regra global
 */
export interface RegraComissaoPeriodo {
  id: string;
  ano: number;
  mes: number;
  tipo: TipoComissao;
  colaborador_id: string | null;
  usa_escalonamento: boolean;
  percentual_fixo: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Faixa de comissão escalonada
 */
export interface FaixaComissaoPeriodo {
  id: string;
  regra_id: string;
  faixa_ordem: number;
  nome: string;
  valor_minimo: number;
  valor_maximo: number | null;
  percentual: number;
  cor: string;
  created_at: string;
}

/**
 * Regra completa com suas faixas
 */
export interface RegraComissaoCompleta {
  regra: RegraComissaoPeriodo;
  faixas: FaixaComissaoPeriodo[];
}

/**
 * Resultado do cálculo de comissão detalhado
 */
export interface ResultadoComissaoDetalhado {
  tipo: TipoComissao;
  faturamento: number;
  faixa: FaixaComissaoPeriodo | null;
  percentual: number;
  comissao: number;
  progressoProximaFaixa: number;
  proximaFaixa: FaixaComissaoPeriodo | null;
}

/**
 * Comissão calculada de um colaborador
 *
 * IMPORTANTE (conceitos):
 * - faturamento_servicos_total = base + extras
 * - faturamento_servicos_base  = somente base
 * - faturamento_extras         = somente extras
 *
 * Compatibilidade:
 * - faturamento_servicos (antigo) agora representa "Serviços TOTAL"
 */
export interface ComissaoColaborador {
  colaborador_id: string;
  colaborador_nome: string;

  // ✅ NOVOS (conceito correto)
  faturamento_servicos_total: number; // base + extras
  faturamento_servicos_base: number;  // somente base

  // ✅ Já existiam
  faturamento_produtos: number;
  faturamento_extras: number;         // somente extras
  faturamento_total: number;

  // ✅ Compat (não quebrar código antigo)
  faturamento_servicos: number;       // agora = SERVIÇOS TOTAL (base + extras)

  // Objetos detalhados de comissão (card usa isso)
  servicos: ResultadoComissaoDetalhado; // aqui vamos usar como "S. Base"
  produtos: ResultadoComissaoDetalhado;
  extras: ResultadoComissaoDetalhado;

  comissao_total: number;
  dias_trabalhados: number;
  faturamento_por_dia: number;

  // ✅ KPIs para cálculo de bônus (vindos da RPC)
  atendimentos: number;
  clientes: number;
  clientes_novos: number;
  servicos_totais: number;
  extras_qtd: number;
  ticket_medio: number;
}

/**
 * Resumo geral das comissões do período
 */
export interface ResumoComissoes {
  total_faturamento: number;

  // ✅ Mantidos + coerentes
  total_faturamento_servicos: number; // SERVIÇOS TOTAL (base+extras)
  total_faturamento_extras: number;   // somente extras
  total_faturamento_produtos: number;

  total_comissoes: number;
  total_comissoes_servicos: number; // comissão S. Base
  total_comissoes_produtos: number;
  total_comissoes_extras: number;

  percentual_medio: number;
  total_colaboradores: number;
  media_por_colaborador: number;
}

/**
 * Dados para configuração de regras do mês
 */
export interface ConfiguracaoRegraData {
  usa_escalonamento: boolean;
  percentual_fixo: number | null;
  faixas: Omit<FaixaComissaoPeriodo, 'id' | 'regra_id' | 'created_at'>[];
}

export interface ConfiguracaoMesData {
  servicos: ConfiguracaoRegraData;
  produtos: ConfiguracaoRegraData;
}

/**
 * Item do histórico de regras
 */
export interface HistoricoRegraItem {
  regra: RegraComissaoPeriodo;
  faixas: FaixaComissaoPeriodo[];
  colaborador_nome?: string;
}

/**
 * Cores das faixas de comissão
 */
export const CORES_FAIXAS = [
  'tier-1', // Bronze
  'tier-2', // Prata
  'tier-3', // Ouro
  'tier-4', // Platina
  'tier-5', // Diamante
] as const;

/**
 * Nomes padrão das faixas
 */
export const NOMES_FAIXAS_PADRAO = [
  'Bronze',
  'Prata',
  'Ouro',
  'Platina',
  'Diamante',
];

/**
 * Faixas padrão para inicialização
 */
export const FAIXAS_PADRAO: Omit<FaixaComissaoPeriodo, 'id' | 'regra_id' | 'created_at'>[] = [
  { faixa_ordem: 1, nome: 'Bronze', valor_minimo: 0, valor_maximo: 30000, percentual: 30, cor: 'tier-1' },
  { faixa_ordem: 2, nome: 'Prata', valor_minimo: 30001, valor_maximo: 45000, percentual: 35, cor: 'tier-2' },
  { faixa_ordem: 3, nome: 'Ouro', valor_minimo: 45001, valor_maximo: 60000, percentual: 40, cor: 'tier-3' },
  { faixa_ordem: 4, nome: 'Platina', valor_minimo: 60001, valor_maximo: null, percentual: 45, cor: 'tier-4' },
];

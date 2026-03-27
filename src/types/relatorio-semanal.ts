// ============================================================
// FILE: src/types/relatorio-semanal.ts
// PROPÓSITO: Tipos TypeScript para Relatórios Semanais
// ============================================================

/**
 * Dados de uma semana individual
 */
export interface SemanaData {
  semana_numero: number;
  data_inicio: Date;
  data_fim: Date;
  dias_na_semana: number;
  label: string; // "01/02 - 07/02 (7 dias)"
  parcial: boolean; // true se a semana não tem 7 dias completos
  
  // KPIs da semana
  faturamento: number;
  atendimentos: number;
  clientes: number;
  clientes_novos: number;
  extras_qtd: number;
  extras_valor: number;
  ticket_medio: number;
  servicos_totais: number;
  
  // Calculados
  comissao: number;
  bonus: number;
  media_dia: number;
  
  // Comparação com semana anterior
  var_faturamento_pct: number | null;
  var_atendimentos_pct: number | null;
  var_ticket_pct: number | null;
  var_extras_pct: number | null;
  
  // Tendência
  tendencia: 'up' | 'down' | 'stable';
}

/**
 * Projeção do mês baseada no ritmo atual
 * Projeta para o FIM DO MÊS de referência (data_fim do filtro)
 */
export interface ProjecaoMes {
  // Mês de referência (da data_fim)
  mes_referencia: number;        // 1-12
  ano_referencia: number;
  mes_nome: string;              // "Fevereiro/2026"
  
  // Dias do mês de referência
  dias_trabalhados_mes: number;  // Dias com faturamento NO MÊS de referência
  dias_restantes_mes: number;    // Até o fim do mês
  dias_totais_mes: number;       // Total de dias no mês
  
  // Faturamento (do mês de referência)
  media_dia_atual: number;
  faturamento_acumulado_mes: number;
  faturamento_projetado_mes: number;
  
  // Comissão (projetada baseada no percentual atual)
  comissao_acumulada_mes: number;
  comissao_projetada_mes: number;
  percentual_comissao: number;   // % atual para projetar
  
  // Atendimentos
  atendimentos_acumulados_mes: number;
  atendimentos_projetados_mes: number;
}

/**
 * KPIs acumulados do mês
 */
export interface AcumuladoMes {
  faturamento: number;
  atendimentos: number;
  clientes: number;
  clientes_novos: number;
  extras_qtd: number;
  extras_valor: number;
  ticket_medio: number;
  servicos_totais: number;
  dias_trabalhados: number;
  comissao: number;
  bonus: number;
}

/**
 * Orientação automática baseada nos dados
 */
export interface Orientacao {
  tipo: 'destaque' | 'atencao' | 'alerta';
  texto: string;
  dica?: string;
}

/**
 * Filtros do relatório semanal
 */
export interface RelatorioSemanalFilters {
  data_inicio: Date;
  data_fim: Date;
  colaborador_id: string | null;
  inicio_semana: 'dom' | 'seg';
}

/**
 * Comentário de relatório (persistido no banco)
 */
export interface RelatorioComentario {
  id: string;
  tipo: string;
  colaborador_id: string | null;
  ano: number;
  semana_inicio: string;
  semana_fim: string;
  comentario: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Retorno do hook useRelatorioSemanal
 */
export interface RelatorioSemanalData {
  semanas: SemanaData[];
  acumulado: AcumuladoMes;
  projecao: ProjecaoMes;
  colaboradores: { colaborador_id: string; colaborador_nome: string }[];
  medias: {
    faturamento: number;
    atendimentos: number;
    ticket_medio: number;
    extras_qtd: number;
  };
}

/**
 * Indicadores disponíveis para gráficos
 */
export type SemanalIndicator = 
  | 'faturamento' 
  | 'atendimentos' 
  | 'ticket_medio' 
  | 'extras_qtd' 
  | 'comissao';

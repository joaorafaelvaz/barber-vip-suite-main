// Tipos para o módulo de Colaboradores

export interface Colaborador {
  colaborador_id: string;
  colaborador_nome: string | null;
  tipo_colaborador: string | null;
  ativo: boolean;
  first_seen: string | null;
  last_seen: string | null;
}

export interface ColaboradorFolga {
  id: string;
  colaborador_id: string;
  data: string; // date
  motivo: string | null;
  tipo: 'avulsa' | 'folga_fixa'; // tipo de folga
  created_at: string;
  updated_at: string;
}

export interface ColaboradorFolgaFixa {
  id: string;
  colaborador_id: string;
  dia_semana: number; // 0=Dom, 1=Seg, 2=Ter...
  ativo: boolean;
  vigencia_inicio: string; // date - início da vigência
  vigencia_fim: string | null; // date - fim da vigência (null = vigente)
  created_at: string;
}

/**
 * Histórico de alterações de folgas fixas
 */
export interface FolgaFixaHistorico {
  dia_semana: number;
  dia_semana_nome: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativo: boolean;
}

export interface Feriado {
  id: string;
  data: string; // date
  nome: string;
  tipo: 'nacional' | 'local' | 'especial';
  barbearia_fecha: boolean;
  created_at: string;
}

export interface BarbeariaConfig {
  id: string;
  chave: string;
  valor: Record<string, unknown>;
  updated_at: string;
}

export interface DiasFechadosConfig {
  domingo: boolean;
  segunda: boolean;
  terca: boolean;
  quarta: boolean;
  quinta: boolean;
  sexta: boolean;
  sabado: boolean;
}

// Cálculo de dias trabalhados
export interface DiasTrabalhoCalculo {
  diasReaisTrabalhados: number;      // Dias com faturamento real
  diasProgramadosTrabalhados: number; // Programados que já passaram
  diasRestantesMes: number;          // Até o fim do mês
  diasProgramadosRestantes: number;  // Descontando folgas/feriados
  totalDiasProjetados: number;       // reais + programados restantes
}

// Projeção para subir de faixa
export interface ProjecaoFaixa {
  faixaAtual: {
    nome: string;
    percentual: number;
    cor: string;
    valor_minimo: number;
    valor_maximo: number | null;
  } | null;
  proximaFaixa: {
    nome: string;
    percentual: number;
    cor: string;
    valor_minimo: number;
    valor_maximo: number | null;
  } | null;
  faturamentoAtual: number;
  faturamentoNecessario: number;
  diasRestantes: number;
  mediaDiaNecessaria: number;
  ehPossivel: boolean;
}

// Calendário individual do colaborador
export interface DiaCalendarioColaborador {
  data: Date;
  dataStr: string; // yyyy-MM-dd
  diaSemana: number;
  
  // Status do dia
  ehPassado: boolean;
  ehHoje: boolean;
  ehFuturo: boolean;
  
  // Situação da barbearia
  barbeariaFechada: boolean;
  ehFeriado: boolean;
  nomeFeriado?: string;
  
  // Situação do colaborador
  temFolgaFixa: boolean;
  temFolgaAvulsa: boolean;
  motivoFolga?: string; // 'ferias', 'falta', 'atestado', etc.
  
  // Status calculado
  trabalhou: boolean;    // dias passados com faturamento
  trabalha: boolean;     // dias futuros programado para trabalhar
  
  // Dados de faturamento (apenas dias passados)
  faturamento?: number;
  atendimentos?: number;
}

export interface CalendarioColaboradorMensal {
  ano: number;
  mes: number;
  colaboradorId: string;
  colaboradorNome: string;
  dias: DiaCalendarioColaborador[];
  resumo: {
    diasTrabalhados: number;
    diasDeFolga: number;
    diasFaltados: number;
    faturamentoTotal: number;
    mediaFaturamentoDia: number;
    diasRestantes: number;
    diasProgramadosRestantes: number;
  };
}

export interface HistoricoFolgaMes {
  data: string;
  diaSemana: number;
  diaSemanaLabel: string;
  tipo: 'fixa' | 'avulsa' | 'feriado' | 'fechado';
  descricao: string;
}

// Calendário operacional
export interface ColaboradorDiaCalendario {
  id: string;
  nome: string;
  iniciais: string;
  temFolgaFixa: boolean;
  temFolgaAvulsa: boolean;
  trabalha: boolean;
}

export interface DiaCalendario {
  data: Date;
  diaSemana: number;
  ehFeriado: boolean;
  nomeFeriado?: string;
  ehDomingo: boolean;
  barbeariaFecha: boolean;
  colaboradoresTrabalham: ColaboradorDiaCalendario[];
}

export interface CalendarioMensal {
  ano: number;
  mes: number;
  dias: DiaCalendario[];
  resumo: {
    totalDias: number;
    diasUteis: number;
    feriados: number;
    domingosFechados: number;
  };
}

// Colaborador com dados do período
export interface ColaboradorComDados extends Colaborador {
  faturamento: number;
  comissao: number;
  bonus: number;
  totalReceber: number;
  percentualTotal: number;
  diasTrabalhados: number;
  faixa: {
    nome: string;
    cor: string;
    percentual: number;
  } | null;
}

// Filtros da tela de colaboradores
export interface ColaboradoresFilters {
  mes: number;
  ano: number;
  tipo: string | null;
  apenasAtivos: boolean;
}

// Dia da semana helpers
export const DIAS_SEMANA = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda', short: 'Seg' },
  { value: 2, label: 'Terça', short: 'Ter' },
  { value: 3, label: 'Quarta', short: 'Qua' },
  { value: 4, label: 'Quinta', short: 'Qui' },
  { value: 5, label: 'Sexta', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
] as const;

export function getIniciais(nome: string | null): string {
  if (!nome) return '?';
  const partes = nome.trim().split(' ').filter(Boolean);
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

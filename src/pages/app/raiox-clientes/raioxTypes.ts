export interface RaioXPeriodo {
  year: number;
  month: number;
}

export interface RaioXFilters {
  periodo: {
    inicio: RaioXPeriodo;
    fim: RaioXPeriodo;
  };
  janelaDias: number;
  excluirSemCadastro: boolean;
  filtroColaborador: {
    id: string | null;
    nome: string;
  };
  lastRefetchAt: string | null;
  autoAtualizar: boolean;
}

export type RaioXTab =
  | 'geral'
  | 'relatorio'
  | 'oneshot'
  | 'cadencia'
  | 'churn'
  | 'cohort'
  | 'barbeiros'
  | 'routing'
  | 'acoes'
  | 'config'
  | 'diagnostico';

export type RaioXScreen =
  | 'PAINEL'
  | 'BARBEIRO'
  | 'DRILLDOWN'
  | 'DRILL_FAIXA'
  | 'LISTA_NOVOS'
  | 'DRILL_RETENCAO_NOVOS';

export interface RaioXExportState {
  exportando: boolean;
  ultimoExport: {
    tipo: 'geral' | 'barbeiro' | 'lista';
    at: string;
  } | null;
}

export interface RaioXComputedFilters extends RaioXFilters {
  dataInicioISO: string;
  dataFimISO: string;
  periodoLabel: string;
}

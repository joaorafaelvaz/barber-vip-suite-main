export interface RaioxClientesConfigJson {
  // PREFERÊNCIAS
  excluir_sem_cadastro: boolean;
  janela_dias_padrao: number;
  auto_refetch: boolean;

  // CHURN / RISCO (legado — mantidos por retrocompatibilidade)
  churn_dias_sem_voltar: number;
  risco_min_dias: number;
  risco_max_dias: number;
  churn_modo: 'MENSAL_CLASSICO' | 'JANELA_FIXA';
  resgate_dias_minimos: number;
  resgate_janela_max_dias: number;

  // NOVO / ATIVO (legado)
  ativo_def: 'ATIVO_NA_JANELA' | 'ATIVO_NO_MES' | 'ATIVO_NO_PERIODO';

  // COHORT (legado)
  cohort_meses_max: number;

  // CADÊNCIA (legado)
  cadencia_meses_analise: number;
  cadencia_min_visitas: number;

  // @deprecated → use perfil_fiel_max_dias (v4.2)
  perfil_fiel_max: number;
  // @deprecated → use perfil_recorrente_max_dias (v4.2)
  perfil_recorrente_max: number;
  // @deprecated — sem equivalente direto v4.2
  perfil_irregular_max: number;
  // @deprecated — sem equivalente direto v4.2
  perfil_ocasional_max: number;

  // RATIO (legado)
  ratio_muito_frequente_max: number;
  ratio_regular_max: number;
  ratio_espacando_max: number;
  ratio_risco_max: number;

  // ONE SHOT (legado)
  one_shot_aguardando_max_dias: number;
  one_shot_risco_max_dias: number;

  // ──────────────────────────────────────────────
  // NOVOS CAMPOS (v4.2)
  // ──────────────────────────────────────────────

  // REFERÊNCIA (REF)
  ref_mode: 'FIM_FILTRO' | 'HOJE';

  // BASE PRINCIPAL (UNIVERSO)
  base_mode: 'JANELA' | 'PERIODO_FILTRADO' | 'TOTAL' | 'TOTAL_COM_CORTE';
  base_corte_meses: number;
  excluir_sem_cliente_id: boolean;

  // PERFIL (volume + recência) — novos campos misto
  perfil_fiel_min_visitas: number;
  perfil_recorrente_min_visitas: number;
  perfil_regular_min_visitas: number;
  perfil_ocasional_min_visitas: number;
  perfil_fiel_max_dias: number;
  perfil_recorrente_max_dias: number;
  perfil_regular_max_dias: number;

  // STATUS 12M (substitui "Macro")
  status12m_enabled: boolean;
  status12m_meses: number;

  // ONE-SHOT (novo)
  one_shot_apenas_base_principal: boolean;

  // ATRIBUIÇÃO BARBEIRO
  atribuicao_modo: 'ULTIMO' | 'MAIS_FREQUENTE' | 'MAIOR_FATURAMENTO' | 'MULTI';
  atribuicao_janela_meses: number;

  // BASE POR VISUALIZAÇÃO
  base_perfil: 'P' | 'S' | 'T' | 'J';
  base_cadencia: 'P' | 'S' | 'T' | 'J';
  base_status12m: 'P' | 'S' | 'T' | 'J';
  base_oneshot: 'P' | 'S' | 'T' | 'J';
  base_resgatados: 'P' | 'S' | 'T' | 'J';
  base_churn: 'P' | 'S' | 'T' | 'J';

  // CADÊNCIA FIXA — intervalos por dias (labels editáveis)
  cadencia_fixa_faixas: Array<{ min: number; max: number | null; label: string }>;

  // CADÊNCIA INDIVIDUAL — labels editáveis
  cadencia_individual_labels: {
    assiduo: string;
    regular: string;
    espacando: string;
    em_risco: string;
    perdido: string;
    primeira_vez: string;
  };

  // CADÊNCIA EVOLUÇÃO
  cadencia_evolution_grain: 'MENSAL' | 'SEMANAL';
  cadencia_evolution_range_months: number;
}

export const defaultRaioxClientesConfig: RaioxClientesConfigJson = {
  // PREFERÊNCIAS
  excluir_sem_cadastro: true,
  janela_dias_padrao: 60,
  auto_refetch: false,

  // CHURN / RISCO (legado)
  churn_dias_sem_voltar: 90,
  risco_min_dias: 45,
  risco_max_dias: 90,
  churn_modo: 'MENSAL_CLASSICO',
  resgate_dias_minimos: 90,
  resgate_janela_max_dias: 360,

  // NOVO / ATIVO (legado)
  ativo_def: 'ATIVO_NA_JANELA',

  // COHORT (legado)
  cohort_meses_max: 12,

  // CADÊNCIA (legado)
  cadencia_meses_analise: 12,
  cadencia_min_visitas: 3,

  // @deprecated → use perfil_fiel_max_dias (v4.2)
  perfil_fiel_max: 30,
  // @deprecated → use perfil_recorrente_max_dias (v4.2)
  perfil_recorrente_max: 45,
  // @deprecated — sem equivalente direto v4.2
  perfil_irregular_max: 75,
  // @deprecated — sem equivalente direto v4.2
  perfil_ocasional_max: 90,

  // RATIO (legado)
  ratio_muito_frequente_max: 0.8,
  ratio_regular_max: 1.2,
  ratio_espacando_max: 1.8,
  ratio_risco_max: 2.5,

  // ONE SHOT (legado)
  one_shot_aguardando_max_dias: 45,
  one_shot_risco_max_dias: 90,

  // ──────────────────────────────────────────────
  // NOVOS CAMPOS (v4.2)
  // ──────────────────────────────────────────────

  // REFERÊNCIA
  ref_mode: 'FIM_FILTRO',

  // BASE PRINCIPAL
  base_mode: 'TOTAL_COM_CORTE',
  base_corte_meses: 24,
  excluir_sem_cliente_id: true,

  // PERFIL (volume + recência)
  perfil_fiel_min_visitas: 12,
  perfil_recorrente_min_visitas: 6,
  perfil_regular_min_visitas: 3,
  perfil_ocasional_min_visitas: 2,
  perfil_fiel_max_dias: 45,
  perfil_recorrente_max_dias: 60,
  perfil_regular_max_dias: 90,

  // STATUS 12M
  status12m_enabled: true,
  status12m_meses: 12,

  // ONE-SHOT
  one_shot_apenas_base_principal: true,

  // ATRIBUIÇÃO BARBEIRO
  atribuicao_modo: 'ULTIMO',
  atribuicao_janela_meses: 12,

  // BASE POR VISUALIZAÇÃO
  base_perfil: 'S',
  base_cadencia: 'S',
  base_status12m: 'S',
  base_oneshot: 'S',
  base_resgatados: 'P',
  base_churn: 'P',

  // CADÊNCIA FIXA
  cadencia_fixa_faixas: [
    { min: 0, max: 30, label: 'Muito frequente' },
    { min: 31, max: 45, label: 'Regular' },
    { min: 46, max: 60, label: 'Espaçando' },
    { min: 61, max: 90, label: 'Em risco' },
    { min: 91, max: null, label: 'Perdido' },
  ],

  // CADÊNCIA INDIVIDUAL — labels
  cadencia_individual_labels: {
    assiduo: 'Assíduo',
    regular: 'Regular',
    espacando: 'Espaçando',
    em_risco: 'Em Risco',
    perdido: 'Perdido',
    primeira_vez: '1ª Vez',
  },

  // CADÊNCIA EVOLUÇÃO
  cadencia_evolution_grain: 'MENSAL',
  cadencia_evolution_range_months: 12,
};

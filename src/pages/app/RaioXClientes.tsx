import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { RaioXTab, RaioXScreen } from './raiox-clientes/raioxTypes';
import { RaioXClientesHeader } from './raiox-clientes/RaioXClientesHeader';
import { RaioXClientesTabs } from './raiox-clientes/RaioXClientesTabs';
import { RaioXClientesScreens } from './raiox-clientes/RaioXClientesScreens';
import {
  useRaioXClientesFilters,
  useRaioXClientesResumo,
  useRaioXClientesChurn,
  useRaioXClientesCohort,
  useRaioXClientesCarteira,
  useRaioXClientesExport,
  useRaioXClientesOverview,
  useRaioxClientesConfig,
  useRaioXClientesCadencia,
  useRaioXClientesChurnEvolucao,
  useRaioXClientesChurnEvolucaoBarbeiro,
} from '@/hooks/raiox-clientes';

export default function RaioXClientes() {
  const {
    filters, setInicio, setFim, setJanelaDias, setExcluirSemCadastro,
    setFiltroColaborador, clearColaborador, setAutoAtualizar, handleRefetch, registerRefetchCallback,
  } = useRaioXClientesFilters();

  const raioxConfig = useRaioxClientesConfig();
  const { config } = raioxConfig;

  const configParams = useMemo(() => ({
    ref_mode: config.ref_mode,
    base_mode: config.base_mode,
    base_corte_meses: config.base_corte_meses,
    status12m_meses: config.status12m_meses,
    status12m_enabled: config.status12m_enabled,
  }), [config.ref_mode, config.base_mode, config.base_corte_meses, config.status12m_meses, config.status12m_enabled]);

  const cadenciaConfigParams = useMemo(() => ({
    ref_mode: config.ref_mode,
    base_mode: config.base_mode,
    base_corte_meses: config.base_corte_meses,
    cadencia_meses_analise: config.cadencia_meses_analise,
    cadencia_min_visitas: config.cadencia_min_visitas,
    ratio_muito_frequente_max: config.ratio_muito_frequente_max,
    ratio_regular_max: config.ratio_regular_max,
    ratio_espacando_max: config.ratio_espacando_max,
    ratio_risco_max: config.ratio_risco_max,
    one_shot_aguardando_max_dias: config.one_shot_aguardando_max_dias,
    one_shot_risco_max_dias: config.one_shot_risco_max_dias,
    atribuicao_modo: config.atribuicao_modo,
    atribuicao_janela_meses: config.atribuicao_janela_meses,
    cadencia_evolution_grain: config.cadencia_evolution_grain,
    cadencia_evolution_range_months: config.cadencia_evolution_range_months,
  }), [
    config.ref_mode, config.base_mode, config.base_corte_meses,
    config.cadencia_meses_analise, config.cadencia_min_visitas,
    config.ratio_muito_frequente_max, config.ratio_regular_max,
    config.ratio_espacando_max, config.ratio_risco_max,
    config.one_shot_aguardando_max_dias, config.one_shot_risco_max_dias,
    config.atribuicao_modo, config.atribuicao_janela_meses,
    config.cadencia_evolution_grain, config.cadencia_evolution_range_months,
  ]);

  const [activeTab, setActiveTab] = useState<RaioXTab>('geral');
  const [screen, setScreen] = useState<RaioXScreen>('PAINEL');
  const [screenContext, setScreenContext] = useState<Record<string, unknown>>({});

  const churnConfigParams = useMemo(() => ({
    ref_mode: config.ref_mode,
    base_mode: config.base_mode,
    base_corte_meses: config.base_corte_meses,
    churn_dias_sem_voltar: config.churn_dias_sem_voltar,
    risco_min_dias: config.risco_min_dias,
    risco_max_dias: config.risco_max_dias,
    cadencia_min_visitas: config.cadencia_min_visitas,
    resgate_dias_minimos: config.resgate_dias_minimos,
    atribuicao_modo: config.atribuicao_modo,
    atribuicao_janela_meses: config.atribuicao_janela_meses,
  }), [
    config.ref_mode, config.base_mode, config.base_corte_meses,
    config.churn_dias_sem_voltar, config.risco_min_dias, config.risco_max_dias,
    config.cadencia_min_visitas, config.resgate_dias_minimos,
    config.atribuicao_modo, config.atribuicao_janela_meses,
  ]);

  const resumo = useRaioXClientesResumo(filters, configParams);
  const churn = useRaioXClientesChurn(filters, churnConfigParams);
  const cohort = useRaioXClientesCohort(filters);
  const carteira = useRaioXClientesCarteira(filters);
  const exportState = useRaioXClientesExport();
  const overview = useRaioXClientesOverview(filters, configParams);
  // Carrega cadencia só quando a aba for acessada pela primeira vez
  const cadencia = useRaioXClientesCadencia(filters, cadenciaConfigParams, activeTab === 'cadencia');
  // Carrega evolução de churn só quando a aba churn for acessada
  const churnEvolucao = useRaioXClientesChurnEvolucao(filters, churnConfigParams, activeTab === 'churn');
  const churnEvolucaoBarbeiro = useRaioXClientesChurnEvolucaoBarbeiro(filters, churnConfigParams, activeTab === 'churn');

  // Ref que aponta sempre para as funções de refetch mais recentes,
  // sem re-registrar o callback a cada render.
  // Nota: resumo, cohort e carteira são stubs (mock) — excluídos do refetch.
  const refetchRef = useRef({
    overview: overview.refetch,
    cadencia: cadencia.refetch,
    churnEvolucao: churnEvolucao.refetch,
    churnEvolucaoBarbeiro: churnEvolucaoBarbeiro.refetch,
  });
  refetchRef.current = {
    overview: overview.refetch,
    cadencia: cadencia.refetch,
    churnEvolucao: churnEvolucao.refetch,
    churnEvolucaoBarbeiro: churnEvolucaoBarbeiro.refetch,
  };

  useEffect(() => {
    registerRefetchCallback(() => {
      const r = refetchRef.current;
      r.overview(); r.cadencia(); r.churnEvolucao(); r.churnEvolucaoBarbeiro();
    });
  }, [registerRefetchCallback]);

  const handleBack = useCallback(() => {
    setScreen('PAINEL');
    setScreenContext({});
  }, []);

  return (
    <div className="space-y-4">
      <RaioXClientesHeader
        filters={filters}
        onSetInicio={setInicio}
        onSetFim={setFim}
        onSetJanelaDias={setJanelaDias}
        onSetExcluirSemCadastro={setExcluirSemCadastro}
        onSetFiltroColaborador={setFiltroColaborador}
        onClearColaborador={clearColaborador}
        onRefetch={handleRefetch}
        onSetAutoAtualizar={setAutoAtualizar}
        onExport={exportState.exportPdfGeral}
        onTabChange={setActiveTab}
        raioxConfig={raioxConfig}
        overviewData={overview.data}
        overviewLoading={overview.loading}
        cadenciaData={cadencia.data}
        cadenciaLoading={cadencia.loading}
        churnEvolucaoData={churnEvolucao.data}
      />

      {screen === 'PAINEL' ? (
        <RaioXClientesTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          filters={filters}
          overviewData={overview.data}
          overviewLoading={overview.loading}
          overviewError={overview.error}
          cadenciaData={cadencia.data}
          cadenciaLoading={cadencia.loading}
          cadenciaError={cadencia.error}
          churnEvolucaoData={churnEvolucao.data}
          churnEvolucaoLoading={churnEvolucao.loading}
          churnEvolucaoError={churnEvolucao.error}
          churnEvolucaoBarbeiroData={churnEvolucaoBarbeiro.data}
          churnEvolucaoBarbeiroLoading={churnEvolucaoBarbeiro.loading}
          churnEvolucaoBarbeiroError={churnEvolucaoBarbeiro.error}
          raioxConfig={raioxConfig}
        />
      ) : (
        <RaioXClientesScreens
          screen={screen}
          screenContext={screenContext}
          onBack={handleBack}
        />
      )}
    </div>
  );
}

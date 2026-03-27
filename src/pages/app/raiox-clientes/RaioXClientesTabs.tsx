import React, { useState } from 'react';
import type { RaioXTab, RaioXComputedFilters } from './raioxTypes';
import type { OverviewData } from '@/hooks/raiox-clientes/useRaioXClientesOverview';
import type { CadenciaData } from '@/hooks/raiox-clientes/useRaioXClientesCadencia';
import type { ChurnEvolucaoData } from '@/hooks/raiox-clientes/useRaioXClientesChurnEvolucao';
import type { ChurnEvolucaoBarbeiroData } from '@/hooks/raiox-clientes/useRaioXClientesChurnEvolucaoBarbeiro';
import type { useRaioxClientesConfig } from '@/hooks/raiox-clientes/useRaioxClientesConfig';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  TabConfig, TabVisaoGeral, TabRelatorio, TabOneShot, TabCadenciaPerfil, TabChurn,
  TabCohort, TabBarbeiros, TabAcoesCRM, TabRoutingBarbeiros, TabDiagnostico,
} from './tabs';

export type RaioxConfigInstance = ReturnType<typeof useRaioxClientesConfig>;

interface Props {
  activeTab: RaioXTab;
  onTabChange: (tab: RaioXTab) => void;
  filters: RaioXComputedFilters;
  overviewData: OverviewData | null;
  overviewLoading: boolean;
  overviewError: string | null;
  cadenciaData: CadenciaData | null;
  cadenciaLoading: boolean;
  cadenciaError: string | null;
  churnEvolucaoData: ChurnEvolucaoData | null;
  churnEvolucaoLoading: boolean;
  churnEvolucaoError: string | null;
  churnEvolucaoBarbeiroData: ChurnEvolucaoBarbeiroData | null;
  churnEvolucaoBarbeiroLoading: boolean;
  churnEvolucaoBarbeiroError: string | null;
  raioxConfig: RaioxConfigInstance;
}

const TAB_CONFIG: { value: RaioXTab; label: string }[] = [
  { value: 'geral', label: 'Visão Geral' },
  { value: 'relatorio', label: 'Relatório' },
  { value: 'oneshot', label: 'One-Shot' },
  { value: 'cadencia', label: 'Cadência' },
  { value: 'churn', label: 'Churn' },
  { value: 'cohort', label: 'Cohort' },
  { value: 'barbeiros', label: 'Barbeiros' },
  { value: 'routing', label: 'Routing' },
  { value: 'acoes', label: 'Ações' },
  { value: 'config', label: 'Config' },
  { value: 'diagnostico', label: 'Diagnóstico' },
];

export function RaioXClientesTabs({
  activeTab, onTabChange, filters,
  overviewData, overviewLoading, overviewError,
  cadenciaData, cadenciaLoading, cadenciaError,
  churnEvolucaoData, churnEvolucaoLoading, churnEvolucaoError,
  churnEvolucaoBarbeiroData, churnEvolucaoBarbeiroLoading, churnEvolucaoBarbeiroError,
  raioxConfig,
}: Props) {
  // Track which heavy tabs have been visited so their components stay mounted
  // once loaded (prevents re-fetching on every tab switch)
  const [visitedTabs, setVisitedTabs] = useState<Set<RaioXTab>>(new Set([activeTab]));

  const handleTabChange = (v: string) => {
    const tab = v as RaioXTab;
    setVisitedTabs(prev => new Set([...prev, tab]));
    onTabChange(tab);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="w-full justify-start h-auto gap-1 p-1 overflow-x-auto scrollbar-hide whitespace-nowrap flex-nowrap">
        {TAB_CONFIG.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="px-2.5 py-1 text-[11px] sm:text-sm shrink-0">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="geral">
        <TabVisaoGeral
          data={overviewData}
          loading={overviewLoading}
          error={overviewError}
          filters={filters}
          onTabChange={onTabChange}
          raioxConfig={raioxConfig}
          cadenciaData={cadenciaData}
          cadenciaLoading={cadenciaLoading}
          churnEvolucaoData={churnEvolucaoData}
          churnEvolucaoLoading={churnEvolucaoLoading}
        />
      </TabsContent>

      <TabsContent value="relatorio">
        <TabRelatorio
          data={overviewData}
          loading={overviewLoading}
          error={overviewError}
          filters={filters}
          raioxConfig={raioxConfig}
          cadenciaData={cadenciaData}
          cadenciaLoading={cadenciaLoading}
          onTabChange={onTabChange}
        />
      </TabsContent>

      <TabsContent value="oneshot">
        <TabOneShot
          data={overviewData}
          loading={overviewLoading}
          error={overviewError}
          filters={filters}
          raioxConfig={raioxConfig}
          onTabChange={onTabChange}
        />
      </TabsContent>

      <TabsContent value="cadencia">
        <TabCadenciaPerfil
          filters={filters}
          cadenciaData={cadenciaData}
          cadenciaLoading={cadenciaLoading}
          cadenciaError={cadenciaError}
          overviewData={overviewData}
          overviewLoading={overviewLoading}
          raioxConfig={raioxConfig}
        />
      </TabsContent>

      <TabsContent value="churn">
        <TabChurn
          filters={filters}
          raioxConfig={raioxConfig}
          evolucaoData={churnEvolucaoData}
          evolucaoLoading={churnEvolucaoLoading}
          evolucaoError={churnEvolucaoError}
          evolucaoBarbeiroData={churnEvolucaoBarbeiroData}
          evolucaoBarbeiroLoading={churnEvolucaoBarbeiroLoading}
          evolucaoBarbeiroError={churnEvolucaoBarbeiroError}
        />
      </TabsContent>

      {/* Heavy tabs — forceMount keeps them alive after first visit to avoid re-fetching */}
      <TabsContent value="cohort" forceMount className={activeTab !== 'cohort' ? 'hidden' : ''}>
        {visitedTabs.has('cohort') && <TabCohort filters={filters} raioxConfig={raioxConfig} />}
      </TabsContent>

      <TabsContent value="barbeiros" forceMount className={activeTab !== 'barbeiros' ? 'hidden' : ''}>
        {visitedTabs.has('barbeiros') && (
          <TabBarbeiros
            filters={filters}
            raioxConfig={raioxConfig}
            churnEvolucaoBarbeiroData={churnEvolucaoBarbeiroData}
            churnEvolucaoBarbeiroLoading={churnEvolucaoBarbeiroLoading}
            overviewData={overviewData}
          />
        )}
      </TabsContent>

      <TabsContent value="routing" forceMount className={activeTab !== 'routing' ? 'hidden' : ''}>
        {visitedTabs.has('routing') && (
          <TabRoutingBarbeiros
            filters={filters}
            raioxConfig={raioxConfig}
            baseDistTotal={(overviewData?.meta?.base_distribuicao_total as number) ?? 0}
          />
        )}
      </TabsContent>

      <TabsContent value="acoes" forceMount className={activeTab !== 'acoes' ? 'hidden' : ''}>
        {visitedTabs.has('acoes') && <TabAcoesCRM filters={filters} raioxConfig={raioxConfig} />}
      </TabsContent>

      <TabsContent value="config">
        <TabConfig raioxConfig={raioxConfig} />
      </TabsContent>

      <TabsContent value="diagnostico">
        <TabDiagnostico />
      </TabsContent>
    </Tabs>
  );
}

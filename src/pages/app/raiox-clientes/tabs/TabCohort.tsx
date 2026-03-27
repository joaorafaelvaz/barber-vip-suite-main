import React, { useState, useEffect } from 'react';
import { HelpBox, SegmentedToggle } from '@/components/raiox-shared';
import { HowToReadSection } from '@/components/help';
import { Loader2, RefreshCw, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ClientesCohortGeral,
  ClientesCohortBarbeiros,
  ClientesDrillDialog,
  type DrillDialogState,
} from '@/components/clientes';
import {
  ClientesNovosKpis,
  ClientesNovosRetencaoChart,
  ClientesNovosCohort,
} from '@/components/clientes-novos';
import { useClientesCohortGeral } from '@/hooks/useClientesCohortGeral';
import { useClientesNovos } from '@/hooks/useClientesNovos';
import type { RaioXComputedFilters } from '../raioxTypes';
import type { RaioxConfigInstance } from '../RaioXClientesTabs';

interface Props {
  filters: RaioXComputedFilters;
  raioxConfig: RaioxConfigInstance;
}

function fmtD(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

export function TabCohort({ filters, raioxConfig }: Props) {
  const [visao, setVisao] = useState<'geral' | 'barbeiro'>('geral');
  const [drillDialog, setDrillDialog] = useState<DrillDialogState>({
    open: false, title: '', tipo: '', valor: '',
  });

  const cohort = useClientesCohortGeral({
    dataInicio: filters.dataInicioISO,
    dataFim: filters.dataFimISO,
    excluirSemCadastro: filters.excluirSemCadastro,
    enabled: true,
  });

  const novos = useClientesNovos();

  useEffect(() => {
    novos.setDataInicio(filters.dataInicioISO);
    novos.setDataFim(filters.dataFimISO);
  }, [filters.dataInicioISO, filters.dataFimISO]);

  const periodoLabel = `${fmtD(filters.dataInicioISO)} – ${fmtD(filters.dataFimISO)}`;

  const openDrill = (tipo: string, valor: string, title: string, colaboradorId?: string) => {
    setDrillDialog({ open: true, title, tipo, valor, colaboradorId });
  };

  return (
    <div className="space-y-3 min-w-0 w-full overflow-x-hidden">

      <HowToReadSection
        bullets={[
          'Cohort = clientes agrupados pelo mês da 1ª visita — mostra retenção ao longo do tempo.',
          'Cada linha é uma coorte. Cada coluna mostra quantos clientes voltaram N meses depois da 1ª visita.',
          'Visão por barbeiro exibe a performance de retenção de cada profissional.',
          'Tendência de novos mostra aquisição mês a mês e o quanto retornou nos meses seguintes.',
        ]}
      />

      {/* Cabeçalho de contexto */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-border/40 bg-muted/15 text-[10px] text-muted-foreground">
        <BarChart3 className="h-3 w-3 text-primary shrink-0" />
        <span><strong className="text-foreground">Período:</strong> {periodoLabel}</span>
        <span className="text-muted-foreground">Cohort = clientes agrupados pelo mês da 1ª visita</span>
        <Button variant="ghost" size="sm" className="h-5 px-1.5 ml-auto text-[10px]"
          onClick={() => cohort.reload()} disabled={cohort.loading}>
          <RefreshCw className={`h-3 w-3 ${cohort.loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {cohort.error && <HelpBox variant="warning">Erro ao carregar cohort: {cohort.error}</HelpBox>}

      {/* Toggle visão */}
      <div className="flex items-center gap-2 flex-wrap">
        <SegmentedToggle
          value={visao}
          onValueChange={(v) => setVisao(v as 'geral' | 'barbeiro')}
          options={[
            { value: 'geral', label: 'Visão Geral' },
            { value: 'barbeiro', label: 'Por Barbeiro' },
          ]}
        />
      </div>

      {/* Cohort Geral */}
      {visao === 'geral' && (
        <>
          <ClientesCohortGeral
            loading={cohort.loading}
            data={cohort.cohortGeral}
            onDrillCohort={(month, size) =>
              openDrill('COHORT', month, `Cohort ${month} — ${size} clientes`)}
          />

          {/* Módulo Novos — KPIs e Retenção */}
          {(novos.loading || novos.resumo) && (
            <div className="space-y-3 border-t border-border/30 pt-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground">Análise de Clientes Novos</span>
                <span className="text-[10px] text-muted-foreground">retenção e fidelização</span>
              </div>

              {novos.loading && !novos.resumo && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {novos.resumo && (
                <>
                  <ClientesNovosKpis
                    kpis={novos.resumo.kpis}
                    periodoLabel={periodoLabel}
                  />
                  <ClientesNovosRetencaoChart
                    data={novos.resumo.retencao_distribuicao || []}
                    periodoLabel={periodoLabel}
                    onDrillFaixa={(_faixa, label) =>
                      openDrill('RETENCAO', _faixa, label)}
                  />
                  <ClientesNovosCohort
                    data={novos.resumo.cohort_mensal}
                    periodoLabel={periodoLabel}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Cohort por Barbeiro */}
      {visao === 'barbeiro' && (
        <ClientesCohortBarbeiros
          loading={cohort.loading}
          data={cohort.cohortPorBarbeiro}
        />
      )}

      <ClientesDrillDialog
        state={drillDialog}
        onClose={() => setDrillDialog((p) => ({ ...p, open: false }))}
        dataInicio={filters.dataInicioISO}
        dataFim={filters.dataFimISO}
        refDate={filters.dataFimISO}
      />
    </div>
  );
}

// ============================================================
// FILE: src/pages/app/Clientes.tsx
// ROTA: /app/clientes
// PROPÓSITO: Painel de Clientes — 6 abas: Geral, Churn, Cohort, Barbeiros, Ações, Listas
// ============================================================

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Users, RefreshCw, X, ArrowLeft, BookOpen, FileText, ChevronDown, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useClientes, calcPeriodoLabel } from '@/hooks/useClientes';
import { useClientesNovos } from '@/hooks/useClientesNovos';
import { useClientesChurn } from '@/hooks/useClientesChurn';
import { useClientesCohortGeral } from '@/hooks/useClientesCohortGeral';
import { supabase } from '@/integrations/supabase/client';
import {
  ClientesPainelKpis,
  ClientesStatusCards,
  ClientesEvolucaoMensal,
  ClientesFaixaDias,
  ClientesFrequenciaChart,
  ClientesBarbeirosVisaoGeral,
  ClientesDrilldown,
  ClientesBarbeiroView,
  ClientesDrillFaixa,
  ClientesPerdasAnalise,
  InfoPopover,
  ClientesChurnResumo,
  ClientesChurnBarbeirosTable,
  ClientesCohortGeral,
  ClientesCohortBarbeiros,
  ClientesAcoesCRM,
  ClientesDrillDialog,
  type DrillDialogState,
  ClientesSaldoBase,
} from '@/components/clientes';
import { ClientesGlossario } from '@/components/clientes/ClientesGlossario';
import { ClientesRelatorioView } from '@/components/clientes/ClientesRelatorioView';
import { exportPageToPdf } from '@/lib/exportPdf';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SharedStatusBar,
  SharedComposicaoStatus,
  SharedFrequenciaChart as SharedFreqChart,
  SharedEvolucaoMensalChart,
  SharedTopClientesTable,
  MiniKpi,
} from '@/components/clientes/ClientesSharedCharts';
import { HowToReadSection } from '@/components/help/HowToReadSection';
import {
  ClientesNovosKpis,
  ClientesNovosTendencia,
  ClientesNovosBarbeirosTable,
  ClientesNovosCohort,
  ClientesNovosLista,
  ClientesNovosRetencaoChart,
  ClientesNovosRetencaoDrill,
} from '@/components/clientes-novos';

// ---- Period selector helpers ----
const MONTHS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

function getYears() {
  const now = new Date().getFullYear();
  const years: string[] = [];
  for (let y = now; y >= now - 3; y--) years.push(String(y));
  return years;
}

function parsePeriod(dateStr: string) {
  const [y, m] = dateStr.split('-');
  return { year: y, month: m };
}

function buildDateStart(year: string, month: string) {
  return `${year}-${month}-01`;
}

function buildDateEnd(year: string, month: string) {
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
}

export default function Clientes() {
  const [glossarioOpen, setGlossarioOpen] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [pdfBarbeiroId, setPdfBarbeiroId] = useState<string | null>(null);
  const [pdfBarbeiroNome, setPdfBarbeiroNome] = useState<string>('');
  const [pdfBarbeiroDetalhe, setPdfBarbeiroDetalhe] = useState<any>(null);
  const [pdfCarteira, setPdfCarteira] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // ---- Global controls (v2) ----
  const [janelaDias, setJanelaDias] = useState(60);
  const [excluirSemCadastro, setExcluirSemCadastro] = useState(true);
  const [drillDialog, setDrillDialog] = useState<DrillDialogState>({ open: false, title: '', tipo: '', valor: '' });

  const openDrillDialog = useCallback((tipo: string, valor: string, title: string, colaboradorId?: string) => {
    setDrillDialog({ open: true, title, tipo, valor, colaboradorId });
  }, []);

  const {
    dataInicio, setDataInicio,
    dataFim, setDataFim,
    periodoLabel,
    screen, setScreen,
    activeTab, setActiveTab,
    filtroColaboradorId, filtroColaboradorNome, filterByBarbeiro,
    loading, error,
    painel,
    barbeariadetalhe,
    perdasData, umaVezData, perdasLoading, loadPerdasAnalise,
    carteira, barbeiroDetalhe,
    drillBarbeiroNome, drillBarbeiroId,
    drillModo, setDrillModo,
    drillPage, setDrillPage,
    drill, drillTotalPages,
    drillFaixaTipo, drillFaixaLabel, drillFaixaData,
    drillFaixaColaboradorId, screenBeforeDrill,
    openDrillFaixa,
    loadPainel, loadDrilldown, selectBarbeiro, openDrilldown, exportDrilldownCsv,
  } = useClientes();

  // Novos hook — synced with same period
  const novos = useClientesNovos();

  // ---- NEW HOOKS (v2) ----
  const churn = useClientesChurn({
    refDate: dataFim,
    dataInicio,
    dataFim,
    janelaDias,
    excluirSemCadastro,
    enabled: activeTab === 'churn' || activeTab === 'acoes',
  });

  const cohort = useClientesCohortGeral({
    dataInicio,
    dataFim,
    excluirSemCadastro,
    enabled: activeTab === 'cohort',
  });

  // Sync novos period with main period
  useEffect(() => {
    novos.setDataInicio(dataInicio);
    novos.setDataFim(dataFim);
  }, [dataInicio, dataFim]);

  // Load perdas data when Ações tab is selected
  useEffect(() => {
    if (activeTab === 'acoes' && !perdasData && !perdasLoading) {
      loadPerdasAnalise();
    }
  }, [activeTab, perdasData, perdasLoading, loadPerdasAnalise]);

  const inicio = parsePeriod(dataInicio);
  const fim = parsePeriod(dataFim);
  const years = getYears();

  const handleInicioChange = (year: string, month: string) => {
    setDataInicio(buildDateStart(year, month));
  };

  const handleFimChange = (year: string, month: string) => {
    setDataFim(buildDateEnd(year, month));
  };

  const handleExportPdf = useCallback(async (barbeiroId?: string | null, barbeiroNome?: string) => {
    if (!painel || !printRef.current) return;
    setExportando(true);

    try {
      if (barbeiroId) {
        setPdfBarbeiroId(barbeiroId);
        setPdfBarbeiroNome(barbeiroNome || '');

        const di = new Date(dataInicio);
        const df = new Date(dataFim);
        const diffDays = Math.round((df.getTime() - di.getTime()) / (1000 * 60 * 60 * 24));
        const janela = Math.max(30, diffDays);

        const [detalheRes, carteiraRes] = await Promise.all([
          supabase.rpc('rpc_clientes_barbeiro_detalhe' as any, {
            p_data_inicio: dataInicio,
            p_data_fim: dataFim,
            p_ref_date: dataFim,
            p_colaborador_id: barbeiroId,
          }),
          supabase.rpc('rpc_clientes_carteira_compartilhada' as any, {
            p_ref: dataFim,
            p_janelas: [janela],
          }),
        ]);

        if (detalheRes.data) setPdfBarbeiroDetalhe(detalheRes.data);
        const carteiraData = carteiraRes.data as any;
        const row = (carteiraData?.table ?? []).find((x: any) => x.colaborador_id === barbeiroId);
        setPdfCarteira(row ?? null);

        await new Promise(r => setTimeout(r, 300));
      } else {
        setPdfBarbeiroId(null);
        setPdfBarbeiroNome('');
        setPdfBarbeiroDetalhe(null);
        setPdfCarteira(null);
        await new Promise(r => setTimeout(r, 150));
      }

      const title = barbeiroId
        ? `Relatório Analítico — ${barbeiroNome}`
        : 'Relatório Analítico — Painel de Clientes';
      const safeName = barbeiroNome?.replace(/\s+/g, '_') || 'geral';
      const filename = barbeiroId
        ? `relatorio_${safeName}_${dataInicio}_${dataFim}.pdf`
        : `relatorio_clientes_${dataInicio}_${dataFim}.pdf`;

      await exportPageToPdf(printRef.current, title, periodoLabel, filename);
    } catch (e) {
      console.error('Erro ao exportar PDF:', e);
    } finally {
      setExportando(false);
    }
  }, [painel, periodoLabel, dataInicio, dataFim]);

  // ---- DRILL RETENCAO NOVOS ----
  if (screen === 'DRILL_RETENCAO_NOVOS') {
    return (
      <div className="space-y-4 overflow-x-hidden max-w-full">
        <ClientesNovosRetencaoDrill
          data={novos.drillRetencaoData}
          faixaLabel={novos.drillRetencaoLabel}
          periodoLabel={periodoLabel}
          loading={novos.loading}
          onBack={() => setScreen('PAINEL')}
        />
      </div>
    );
  }

  // ---- LISTA NOVOS SCREEN ----
  if (screen === 'LISTA_NOVOS') {
    return (
      <div className="space-y-4 overflow-x-hidden max-w-full">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setScreen('PAINEL'); novos.setFiltroBarbeiroId(null); novos.setFiltroBarbeiroNome(''); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Clientes Novos • Lista</h1>
        </div>
        <ClientesNovosLista
          data={novos.lista}
          modo={novos.listaModo}
          onSetModo={novos.setListaModo}
          page={novos.listaPage}
          onSetPage={novos.setListaPage}
          totalPages={novos.listaTotalPages}
          filtroBarbeiroNome={novos.filtroBarbeiroNome}
          onClearBarbeiro={() => { novos.setFiltroBarbeiroId(null); novos.setFiltroBarbeiroNome(''); }}
          onExport={novos.exportListaCsv}
          loading={novos.loading}
          periodoLabel={periodoLabel}
        />
      </div>
    );
  }

  // ---- DRILL FAIXA ----
  if (screen === 'DRILL_FAIXA') {
    return (
      <div className="space-y-4 overflow-x-hidden max-w-full">
        <ClientesDrillFaixa
          data={drillFaixaData}
          label={drillFaixaLabel}
          tipo={drillFaixaTipo}
          periodoLabel={periodoLabel}
          loading={loading}
          onBack={() => setScreen(screenBeforeDrill || 'PAINEL')}
        />
      </div>
    );
  }

  // ---- DRILLDOWN ----
  if (screen === 'DRILLDOWN') {
    return (
      <div className="space-y-4 overflow-x-hidden max-w-full">
        <ClientesDrilldown
          barbeiroNome={drillBarbeiroNome}
          janela={30}
          modo={drillModo}
          periodo={{ atual: { de: periodoLabel.split(' – ')[0], ate: periodoLabel.split(' – ')[1] || '' }, anterior: { de: '', ate: '' } }}
          onSetModo={(m) => {
            setDrillModo(m);
            setDrillPage(0);
            loadDrilldown({ modo: m, page: 0 });
          }}
          page={drillPage}
          onSetPage={(p) => {
            setDrillPage(p);
            loadDrilldown({ page: p });
          }}
          data={drill}
          totalPages={drillTotalPages}
          onExport={exportDrilldownCsv}
          onRefresh={() => loadDrilldown()}
          onBack={() => setScreen('BARBEIRO')}
          loading={loading}
        />
      </div>
    );
  }

  // ---- BARBEIRO DETAIL ----
  if (screen === 'BARBEIRO') {
    const novosBarb = novos.resumo?.por_barbeiro_aquisicao?.find(
      (b: any) => b.colaborador_id === (carteira?.colaborador_id || drillBarbeiroId)
    ) ?? null;

    return (
      <div className="space-y-4 overflow-x-hidden max-w-full">
        <ClientesBarbeiroView
          barbeiroNome={drillBarbeiroNome || filtroColaboradorNome}
          carteira={carteira}
          unicos={null}
          janela={30}
          periodo={{ atual: { de: periodoLabel.split(' – ')[0], ate: periodoLabel.split(' – ')[1] || '' }, anterior: { de: '', ate: '' } }}
          onBack={() => setScreen('PAINEL')}
          onOpenDrilldown={(modo) => openDrilldown(
            carteira?.colaborador_id || '',
            carteira?.colaborador_nome || drillBarbeiroNome,
            modo
          )}
          onDrillFaixa={(tipo, valor, label) => openDrillFaixa(tipo, valor, label, drillBarbeiroId || carteira?.colaborador_id)}
          barbeiroDetalhe={barbeiroDetalhe}
          novosBarb={novosBarb}
        />
      </div>
    );
  }

  // ---- PAINEL PRINCIPAL ----
  return (
    <div className="space-y-4 overflow-x-hidden max-w-full">
      <HowToReadSection
        bullets={[
          'Base ativa = clientes que voltaram dentro da janela de dias configurada.',
          'Churn = clientes que pararam de vir (última visita acima do limite).',
          'Evolução mensal mostra tendência — se ativos caem enquanto novos sobem, há rotatividade.',
          'Use as abas Churn e Cohort para análises profundas de retenção.',
          'Ações CRM = lista de clientes para contato proativo (recuperação/fidelização).',
        ]}
        expandedText="O Painel de Clientes é o centro de análise de retenção. Selecione o período e use as 6 abas para investigar desde o panorama geral até ações específicas por cliente. Combine com o RaioX Clientes para análise ainda mais detalhada."
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Users className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <h1 className="text-lg sm:text-xl font-semibold text-foreground">
                Painel de Clientes
              </h1>
              <InfoPopover
                title="Painel de Clientes"
                description="Painel completo da base de clientes da barbearia. Selecione o período desejado (mês/ano início e fim) para analisar a evolução, distribuição por status, e métricas por barbeiro."
                example="Selecione Jan/2025 a Fev/2026 para ver 14 meses de evolução."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {periodoLabel}
              {filtroColaboradorId && (
                <span> • Filtrado: {filtroColaboradorNome}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setGlossarioOpen(true)}>
                <BookOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Glossário de Métricas</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 px-2" disabled={!painel || exportando}>
                <FileText className={`h-4 w-4 ${exportando ? 'animate-pulse' : ''}`} />
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleExportPdf(null)} className="text-xs">
                📄 Relatório Geral
              </DropdownMenuItem>
              {painel && painel.por_barbeiro.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-[10px] text-muted-foreground font-medium">Por Barbeiro:</div>
                  {painel.por_barbeiro
                    .filter(b => b.colaborador_id)
                    .sort((a, b) => b.valor_total - a.valor_total)
                    .map(b => (
                      <DropdownMenuItem
                        key={b.colaborador_id}
                        onClick={() => handleExportPdf(b.colaborador_id, b.colaborador_nome)}
                        className="text-xs"
                      >
                        📋 {b.colaborador_nome}
                      </DropdownMenuItem>
                    ))
                  }
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => {
            loadPainel();
            if (activeTab === 'cohort') { novos.loadResumo(); cohort.reload(); }
            if (activeTab === 'churn') churn.reload();
            if (activeTab === 'acoes') loadPerdasAnalise();
          }} disabled={loading || novos.loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${(loading || novos.loading) ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Period Selectors + Global Controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">De:</span>
        <Select value={inicio.month} onValueChange={(m) => handleInicioChange(inicio.year, m)}>
          <SelectTrigger className="w-[90px] sm:w-[110px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={inicio.year} onValueChange={(y) => handleInicioChange(y, inicio.month)}>
          <SelectTrigger className="w-[70px] sm:w-[80px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground">Até:</span>
        <Select value={fim.month} onValueChange={(m) => handleFimChange(fim.year, m)}>
          <SelectTrigger className="w-[90px] sm:w-[110px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fim.year} onValueChange={(y) => handleFimChange(y, fim.month)}>
          <SelectTrigger className="w-[70px] sm:w-[80px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Excluir sem cadastro */}
        <div className="flex items-center gap-1.5 ml-1">
          <Switch
            id="excluir-sem-cadastro"
            checked={excluirSemCadastro}
            onCheckedChange={setExcluirSemCadastro}
            className="scale-75"
          />
          <Label htmlFor="excluir-sem-cadastro" className="text-xs text-muted-foreground cursor-pointer">
            Excluir s/ cadastro
          </Label>
        </div>

        {filtroColaboradorId && (
          <Badge variant="secondary" className="ml-2 gap-1 text-xs cursor-pointer" onClick={() => filterByBarbeiro(null)}>
            {filtroColaboradorNome}
            <X className="h-3 w-3" />
          </Badge>
        )}
      </div>

      {(error || novos.error || churn.error || cohort.error) && (
        <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
          <p className="text-sm text-destructive">Erro: {error || novos.error || churn.error || cohort.error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !painel ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      ) : painel ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="churn">Churn & Risco</TabsTrigger>
            <TabsTrigger value="cohort">Cohort & Retenção</TabsTrigger>
            <TabsTrigger value="barbeiros">Por Barbeiro</TabsTrigger>
            <TabsTrigger value="acoes">Ações (CRM)</TabsTrigger>
            <TabsTrigger value="listas">Listas & Export</TabsTrigger>
          </TabsList>

          {/* ====== ABA VISÃO GERAL ====== */}
          <TabsContent value="geral" className="space-y-4 mt-4">
            <ClientesPainelKpis kpis={painel.kpis} periodoLabel={periodoLabel} refDate={dataFim} novosResumo={novos.resumo} onDrillFaixa={openDrillFaixa} />
            <ClientesStatusCards
              distribuicao={painel.status_distribuicao}
              total={painel.kpis.total_clientes}
              periodoLabel={periodoLabel}
              refDate={dataFim}
              onDrillFaixa={openDrillFaixa}
            />
            
            {barbeariadetalhe && (
              <SharedStatusBar
                distribuicao={barbeariadetalhe.status_distribuicao}
                total={barbeariadetalhe.total_clientes}
                periodLabel={periodoLabel}
              />
            )}

            {barbeariadetalhe && (
              <SharedComposicaoStatus
                detalhe={barbeariadetalhe}
                periodLabel={periodoLabel}
                contextLabel="na barbearia"
              />
            )}

            <ClientesFaixaDias faixas={painel.faixas_dias} periodoLabel={periodoLabel} onDrillFaixa={openDrillFaixa} />
            <ClientesFrequenciaChart faixas={painel.faixas_frequencia} periodoLabel={periodoLabel} onDrillFaixa={openDrillFaixa} />
            <ClientesEvolucaoMensal data={painel.evolucao_mensal} periodoLabel={periodoLabel} />
            
            {barbeariadetalhe && (
              <SharedTopClientesTable
                topClientes={barbeariadetalhe.top_clientes_valor}
                contextLabel="na barbearia"
                periodLabel={periodoLabel}
              />
            )}
          </TabsContent>

          {/* ====== ABA CHURN & RISCO ====== */}
          <TabsContent value="churn" className="space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Janela:</span>
              <Select value={String(janelaDias)} onValueChange={(v) => setJanelaDias(Number(v))}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300].map(d => (
                    <SelectItem key={d} value={String(d)}>Janela {d}d</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ClientesChurnResumo
              loading={churn.loading}
              janelaDias={janelaDias}
              resumo={churn.resumo}
              onDrill={openDrillDialog}
            />
            <ClientesChurnBarbeirosTable
              loading={churn.loading}
              data={churn.porBarbeiro}
              onOpenBarbeiro={(id, nome) => selectBarbeiro(id, nome)}
              onDrill={openDrillDialog}
              janelaDias={janelaDias}
            />
            <ClientesSaldoBase
              loading={churn.loading}
              data={churn.saldoBase}
              janelaDias={janelaDias}
            />
          </TabsContent>

          {/* ====== ABA COHORT & RETENÇÃO ====== */}
          <TabsContent value="cohort" className="space-y-4 mt-4">
            <ClientesCohortGeral
              loading={cohort.loading}
              data={cohort.cohortGeral}
              onDrillCohort={(month, size) => openDrillDialog('COHORT', month, `Cohort ${month} — ${size} clientes`)}
            />
            <ClientesCohortBarbeiros
              loading={cohort.loading}
              data={cohort.cohortPorBarbeiro}
            />

            {/* Reaproveitar módulo Novos: KPIs, Retenção, Tendência, Cohort mensal */}
            {novos.resumo && (
              <>
                <ClientesNovosKpis kpis={novos.resumo.kpis} periodoLabel={periodoLabel} />
                <ClientesNovosRetencaoChart
                  data={novos.resumo.retencao_distribuicao || []}
                  periodoLabel={periodoLabel}
                  onDrillFaixa={(faixa, label) => {
                    novos.loadDrillRetencao(faixa, label);
                    setScreen('DRILL_RETENCAO_NOVOS');
                  }}
                />
                <ClientesNovosTendencia data={novos.resumo.tendencia_semanal} periodoLabel={periodoLabel} />
                <ClientesNovosCohort data={novos.resumo.cohort_mensal} periodoLabel={periodoLabel} />
              </>
            )}
          </TabsContent>

          {/* ====== ABA POR BARBEIRO (comparativo) ====== */}
          <TabsContent value="barbeiros" className="space-y-4 mt-4">
            <ClientesBarbeirosVisaoGeral
              barbeiros={painel.por_barbeiro}
              periodoLabel={periodoLabel}
              dataInicio={dataInicio}
              dataFim={dataFim}
              refDate={dataFim}
              onSelectBarbeiro={selectBarbeiro}
              novosData={novos.resumo?.por_barbeiro_aquisicao}
              onDrillFaixa={openDrillFaixa}
              painelKpis={painel.kpis}
            />
          </TabsContent>

          {/* ====== ABA AÇÕES (CRM) ====== */}
          <TabsContent value="acoes" className="space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Janela:</span>
              <Select value={String(janelaDias)} onValueChange={(v) => setJanelaDias(Number(v))}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300].map(d => (
                    <SelectItem key={d} value={String(d)}>Janela {d}d</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ClientesAcoesCRM
              periodoLabel={periodoLabel}
              janelaDias={janelaDias}
              perdasData={perdasData}
              umaVezData={umaVezData}
              churnBarbeiros={churn.porBarbeiro}
            />
            <ClientesPerdasAnalise
              perdasData={perdasData}
              umaVezData={umaVezData}
              loading={perdasLoading}
              periodoLabel={periodoLabel}
              totalClientes={painel.kpis.total_clientes}
              faixasFrequencia={painel.faixas_frequencia}
            />
          </TabsContent>

          {/* ====== ABA LISTAS & EXPORT ====== */}
          <TabsContent value="listas" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col gap-1"
                onClick={() => {
                  novos.setScreen('LISTA');
                  setScreen('LISTA_NOVOS');
                }}
              >
                <List className="h-5 w-5" />
                <span className="text-sm font-medium">Lista de Novos</span>
                <span className="text-xs text-muted-foreground">Abrir lista completa de clientes novos</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col gap-1"
                onClick={() => {
                  if (painel.por_barbeiro.length > 0) {
                    const first = painel.por_barbeiro[0];
                    selectBarbeiro(first.colaborador_id, first.colaborador_nome);
                  }
                }}
              >
                <Users className="h-5 w-5" />
                <span className="text-sm font-medium">Carteira do Barbeiro</span>
                <span className="text-xs text-muted-foreground">Selecione um barbeiro na aba "Por Barbeiro"</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col gap-1"
                onClick={() => exportDrilldownCsv()}
              >
                <FileText className="h-5 w-5" />
                <span className="text-sm font-medium">Exportar CSV</span>
                <span className="text-xs text-muted-foreground">Exportar dados do drill atual</span>
              </Button>
            </div>

            {/* Barbeiros table for quick access */}
            {novos.resumo?.por_barbeiro_aquisicao && (
              <ClientesNovosBarbeirosTable
                barbeiros={novos.resumo.por_barbeiro_aquisicao}
                periodoLabel={periodoLabel}
                onSelectBarbeiro={(id, nome) => {
                  novos.openListaPorBarbeiro(id, nome);
                  setScreen('LISTA_NOVOS');
                }}
              />
            )}
          </TabsContent>
        </Tabs>
      ) : null}

      {/* Glossário */}
      <ClientesGlossario open={glossarioOpen} onOpenChange={setGlossarioOpen} />

      {/* Off-screen print view for PDF export */}
      {painel && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
          <ClientesRelatorioView
            ref={printRef}
            painel={painel}
            novos={novos.resumo}
            periodoLabel={periodoLabel}
            filtroBarbeiroId={pdfBarbeiroId}
            filtroBarbeiroNome={pdfBarbeiroNome}
            barbeiroDetalhe={pdfBarbeiroDetalhe}
            carteira={pdfCarteira}
          />
        </div>
      )}

      {/* Drill Dialog */}
      <ClientesDrillDialog
        state={drillDialog}
        onClose={() => setDrillDialog(prev => ({ ...prev, open: false }))}
        dataInicio={dataInicio}
        dataFim={dataFim}
        refDate={dataFim}
      />
    </div>
  );
}

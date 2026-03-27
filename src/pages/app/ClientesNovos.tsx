import React from 'react';
import { UserPlus, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClientesNovos } from '@/hooks/useClientesNovos';
import { HowToReadSection } from '@/components/help/HowToReadSection';
import {
  ClientesNovosKpis,
  ClientesNovosTendencia,
  ClientesNovosBarbeirosTable,
  ClientesNovosCohort,
  ClientesNovosLista,
} from '@/components/clientes-novos';

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
  return Array.from({ length: 4 }, (_, i) => String(now - i));
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

export default function ClientesNovos() {
  const {
    dataInicio, setDataInicio,
    dataFim, setDataFim,
    periodoLabel,
    screen, setScreen,
    listaModo, setListaModo,
    filtroBarbeiroNome, setFiltroBarbeiroId, setFiltroBarbeiroNome,
    resumo, lista,
    listaPage, setListaPage,
    listaTotalPages,
    loadResumo, exportListaCsv, openListaPorBarbeiro,
    loading, error,
  } = useClientesNovos();

  const inicio = parsePeriod(dataInicio);
  const fim = parsePeriod(dataFim);
  const years = getYears();

  // ---- LISTA SCREEN ----
  if (screen === 'LISTA') {
    return (
      <div className="space-y-4 overflow-x-hidden max-w-full">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setScreen('RESUMO'); setFiltroBarbeiroId(null); setFiltroBarbeiroNome(''); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Clientes Novos • Lista</h1>
        </div>
        <ClientesNovosLista
          data={lista}
          modo={listaModo}
          onSetModo={setListaModo}
          page={listaPage}
          onSetPage={setListaPage}
          totalPages={listaTotalPages}
          filtroBarbeiroNome={filtroBarbeiroNome}
          onClearBarbeiro={() => { setFiltroBarbeiroId(null); setFiltroBarbeiroNome(''); }}
          onExport={exportListaCsv}
          loading={loading}
          periodoLabel={periodoLabel}
        />
      </div>
    );
  }

  // ---- RESUMO (default) ----
  return (
    <div className="space-y-4 overflow-x-hidden max-w-full">
      <HowToReadSection
        bullets={[
          'Novos = clientes cuja primeira visita (first_seen) está dentro do período.',
          'Retenção = % de novos que voltaram pelo menos 1 vez após a 1ª visita.',
          'Cohort mostra mês a mês quantos novos de cada safra continuam voltando.',
          'Barbeiros de aquisição = quem atendeu o cliente na 1ª visita (responsável pela captação).',
        ]}
        expandedText="A tela de Clientes Novos foca em aquisição e conversão. Compare o volume de novos com a retenção: de nada adianta muitos novos se poucos voltam (porta giratória). Use a lista para identificar novos que ainda não retornaram."
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <UserPlus className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-foreground">Clientes Novos</h1>
            <p className="text-xs text-muted-foreground">{periodoLabel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setScreen('LISTA')}>
            Ver Lista
          </Button>
          <Button variant="outline" size="sm" onClick={loadResumo} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Period Selectors */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">De:</span>
        <Select value={inicio.month} onValueChange={(m) => setDataInicio(buildDateStart(inicio.year, m))}>
          <SelectTrigger className="w-[90px] sm:w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={inicio.year} onValueChange={(y) => setDataInicio(buildDateStart(y, inicio.month))}>
          <SelectTrigger className="w-[70px] sm:w-[80px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">Até:</span>
        <Select value={fim.month} onValueChange={(m) => setDataFim(buildDateEnd(fim.year, m))}>
          <SelectTrigger className="w-[90px] sm:w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fim.year} onValueChange={(y) => setDataFim(buildDateEnd(y, fim.month))}>
          <SelectTrigger className="w-[70px] sm:w-[80px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
          <p className="text-sm text-destructive">Erro: {error}</p>
        </div>
      )}

      {loading && !resumo ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      ) : resumo ? (
        <Tabs defaultValue="visao-geral">
          <TabsList>
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="cohort">Cohort</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="space-y-4 mt-4">
            <ClientesNovosKpis kpis={resumo.kpis} periodoLabel={periodoLabel} />
            <ClientesNovosTendencia data={resumo.tendencia_semanal} periodoLabel={periodoLabel} cohortData={resumo.cohort_mensal} />
            <ClientesNovosBarbeirosTable
              barbeiros={resumo.por_barbeiro_aquisicao}
              periodoLabel={periodoLabel}
              onSelectBarbeiro={openListaPorBarbeiro}
            />
          </TabsContent>

          <TabsContent value="cohort" className="space-y-4 mt-4">
            <ClientesNovosCohort data={resumo.cohort_mensal} periodoLabel={periodoLabel} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

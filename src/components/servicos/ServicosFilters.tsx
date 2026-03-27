import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Wrench, RefreshCw, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SegmentedToggle, type SegmentOption } from '@/components/raiox-shared';
import { InfoIconTooltip } from '@/components/help/InfoIconTooltip';
import type { ServicosFilters as IServicosFilters } from '@/hooks/useServicos';
import type { DashboardColaborador } from '@/components/dashboard/types';
import {
  MONTHS,
  getYears,
  buildDateStart,
  buildDateEnd,
  parseDateToPeriodo,
  formatPeriodoLabel,
  getCurrentPeriodo,
  CATEGORIAS,
  AGRUPAMENTOS,
  type ServicosPeriodo,
} from './servicosUtils';

interface ServicosFiltersProps {
  onApply: (filters: IServicosFilters) => void;
  colaboradores: DashboardColaborador[];
  loading?: boolean;
  initialDataInicio?: string;
  initialDataFim?: string;
  initialColaboradorId?: string | null;
  initialTipoServico?: string | null;
  initialAgrupamento?: string;
}

const AGRUPAMENTO_OPTIONS: SegmentOption[] = AGRUPAMENTOS.map((a) => ({
  value: a.value,
  label: a.label,
}));

// Info content for filters
const FILTER_INFO = {
  periodo: {
    title: 'Período de Análise',
    short: 'Define o intervalo de datas para a análise',
    details: (
      <>
        <p>Selecione o mês/ano inicial e final para filtrar os dados de serviços realizados.</p>
        <p className="mt-2"><strong>Dica:</strong> Para análise mensal, mantenha início e fim no mesmo mês. Para tendências, expanda o período.</p>
      </>
    ),
  },
  barbeiro: {
    title: 'Filtro por Barbeiro',
    short: 'Filtra dados de um barbeiro específico',
    details: (
      <>
        <p>Selecione um barbeiro para ver apenas os serviços realizados por ele.</p>
        <p className="mt-2"><strong>"Todos":</strong> Mostra a visão consolidada de toda a equipe.</p>
      </>
    ),
  },
  categoria: {
    title: 'Categoria de Serviço',
    short: 'Filtra por tipo de serviço ou produto',
    details: (
      <>
        <p><strong>Serviço Base:</strong> Cortes, barbas e acabamentos principais.</p>
        <p><strong>Serviço Extra:</strong> Tratamentos adicionais (selagem, hidratação, etc.).</p>
        <p><strong>Produtos:</strong> Venda de produtos (ceras, balms, etc.).</p>
      </>
    ),
  },
  agrupamento: {
    title: 'Modo de Agrupamento',
    short: 'Define como os dados são organizados',
    details: (
      <>
        <p><strong>Por Serviço:</strong> Agrupa por nome do serviço/produto.</p>
        <p><strong>Por Barbeiro:</strong> Mostra totais por profissional.</p>
        <p><strong>Por Mês:</strong> Exibe evolução temporal.</p>
      </>
    ),
  },
};

export function ServicosFilters({
  onApply,
  colaboradores,
  loading = false,
  initialDataInicio,
  initialDataFim,
  initialColaboradorId,
  initialTipoServico,
  initialAgrupamento = 'servico',
}: ServicosFiltersProps) {
  // Start collapsed by default for cleaner UX
  const [isOpen, setIsOpen] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const initialFetchDone = useRef(false);
  const prevFiltersRef = useRef<string>('');

  // Parse initial dates or use current month
  const defaultPeriodo = getCurrentPeriodo();
  const [periodoInicio, setPeriodoInicio] = useState<ServicosPeriodo>(
    initialDataInicio ? parseDateToPeriodo(initialDataInicio) : defaultPeriodo
  );
  const [periodoFim, setPeriodoFim] = useState<ServicosPeriodo>(
    initialDataFim ? parseDateToPeriodo(initialDataFim) : defaultPeriodo
  );

  const [colaboradorId, setColaboradorId] = useState<string | null>(initialColaboradorId || null);
  const [tipoServico, setTipoServico] = useState<string | null>(initialTipoServico || null);
  const [agrupamento, setAgrupamento] = useState<'servico' | 'barbeiro' | 'mes'>(
    (initialAgrupamento as any) || 'servico'
  );

  const years = getYears(5);

  // Build filters object - stable key for comparison
  const currentFiltersKey = `${periodoInicio.month}-${periodoInicio.year}-${periodoFim.month}-${periodoFim.year}-${colaboradorId}-${tipoServico}-${agrupamento}`;
  
  const buildFilters = useCallback((): IServicosFilters => ({
    dataInicio: buildDateStart(periodoInicio),
    dataFim: buildDateEnd(periodoFim),
    colaboradorId,
    tipoServico: tipoServico as any,
    agrupamento,
  }), [periodoInicio, periodoFim, colaboradorId, tipoServico, agrupamento]);

  // Auto-update effect - only triggers when filters actually change
  useEffect(() => {
    // Skip first render - parent handles initial fetch
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      prevFiltersRef.current = currentFiltersKey;
      return;
    }
    
    // Only update if filters actually changed
    if (autoUpdate && currentFiltersKey !== prevFiltersRef.current) {
      prevFiltersRef.current = currentFiltersKey;
      const timer = setTimeout(() => {
        onApply(buildFilters());
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoUpdate, currentFiltersKey, buildFilters, onApply]);

  const handleManualRefresh = () => {
    onApply(buildFilters());
  };

  const handleClearFilters = () => {
    const now = getCurrentPeriodo();
    setPeriodoInicio(now);
    setPeriodoFim(now);
    setColaboradorId(null);
    setTipoServico(null);
    setAgrupamento('servico');
  };

  // Build summary label
  const colaboradorNome = colaboradorId
    ? colaboradores.find((c) => c.colaborador_id === colaboradorId)?.colaborador_nome || 'Barbeiro'
    : null;
  const categoriaNome = tipoServico
    ? CATEGORIAS.find((c) => c.value === tipoServico)?.label || tipoServico
    : null;

  const periodoLabel =
    periodoInicio.month === periodoFim.month && periodoInicio.year === periodoFim.year
      ? formatPeriodoLabel(periodoInicio)
      : `${formatPeriodoLabel(periodoInicio)} – ${formatPeriodoLabel(periodoFim)}`;

  const agrupamentoLabel = AGRUPAMENTOS.find((a) => a.value === agrupamento)?.label || 'Serviço';

  const hasActiveFilters = colaboradorId || tipoServico;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <h1 className="text-lg sm:text-xl font-semibold text-foreground">Análise de Serviços</h1>
            </div>
            {loading && (
              <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleManualRefresh}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar dados</TooltipContent>
            </Tooltip>

            {hasActiveFilters && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={handleClearFilters}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Limpar filtros</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Collapsible Filter Section */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          {/* Full-width clickable trigger bar */}
          <CollapsibleTrigger asChild>
            <button
              className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border transition-colors cursor-pointer text-left ${
                isOpen
                  ? 'bg-muted/20 border-border/50'
                  : 'bg-muted/8 border-border/25 hover:bg-muted/15 hover:border-border/40'
              }`}
            >
              <SlidersHorizontal
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isOpen ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
              <span className="flex-1 min-w-0 text-xs sm:text-sm text-foreground/90">
                {isOpen ? (
                  'Fechar filtros'
                ) : (
                  <span className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-1">
                    <span className="truncate">
                      <span className="text-muted-foreground">Período:</span> {periodoLabel}
                    </span>
                    <span className="hidden sm:inline text-muted-foreground"> · </span>
                    <span className="truncate">
                      <span className="text-muted-foreground">Barbeiro:</span> {colaboradorNome || 'Todos'}
                      <span className="text-muted-foreground"> · Categoria:</span> {categoriaNome || 'Todas'}
                    </span>
                    <span className="hidden sm:inline text-muted-foreground"> · </span>
                    <span className="truncate">
                      <span className="text-muted-foreground">Agrupar:</span> {agrupamentoLabel}
                    </span>
                  </span>
                )}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-3 rounded-lg border bg-card/50 p-4 space-y-4">
              {/* Active filter badges */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-border/30">
                  <span className="text-xs text-muted-foreground">Filtros ativos:</span>
                  {colaboradorNome && (
                    <Badge variant="outline" className="gap-1 text-xs pr-1">
                      {colaboradorNome}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => setColaboradorId(null)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {categoriaNome && (
                    <Badge variant="outline" className="gap-1 text-xs pr-1">
                      {categoriaNome}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => setTipoServico(null)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Period + Filters Row */}
              {/* Period + Filters Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Período Início */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs font-medium text-muted-foreground">Período Início</Label>
                    <InfoIconTooltip
                      title={FILTER_INFO.periodo.title}
                      short={FILTER_INFO.periodo.short}
                      details={FILTER_INFO.periodo.details}
                      size="sm"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <Select
                      value={String(periodoInicio.month)}
                      onValueChange={(v) =>
                        setPeriodoInicio((p) => ({ ...p, month: Number(v) }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i} value={String(i + 1)}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={String(periodoInicio.year)}
                      onValueChange={(v) =>
                        setPeriodoInicio((p) => ({ ...p, year: Number(v) }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Período Fim */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Período Fim</Label>
                  <div className="flex gap-1.5">
                    <Select
                      value={String(periodoFim.month)}
                      onValueChange={(v) =>
                        setPeriodoFim((p) => ({ ...p, month: Number(v) }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i} value={String(i + 1)}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={String(periodoFim.year)}
                      onValueChange={(v) =>
                        setPeriodoFim((p) => ({ ...p, year: Number(v) }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Barbeiro */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs font-medium text-muted-foreground">Barbeiro</Label>
                    <InfoIconTooltip
                      title={FILTER_INFO.barbeiro.title}
                      short={FILTER_INFO.barbeiro.short}
                      details={FILTER_INFO.barbeiro.details}
                      size="sm"
                    />
                  </div>
                  <Select
                    value={colaboradorId || 'todos'}
                    onValueChange={(v) => setColaboradorId(v === 'todos' ? null : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {colaboradores.map((c) => (
                        <SelectItem key={c.colaborador_id} value={c.colaborador_id}>
                          {c.colaborador_nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Categoria */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
                    <InfoIconTooltip
                      title={FILTER_INFO.categoria.title}
                      short={FILTER_INFO.categoria.short}
                      details={FILTER_INFO.categoria.details}
                      size="sm"
                    />
                  </div>
                  <Select
                    value={tipoServico || 'todas'}
                    onValueChange={(v) => setTipoServico(v === 'todas' ? null : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Bottom Row: Agrupamento + Auto-update */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-border/50">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs font-medium text-muted-foreground">Agrupar por</Label>
                    <InfoIconTooltip
                      title={FILTER_INFO.agrupamento.title}
                      short={FILTER_INFO.agrupamento.short}
                      details={FILTER_INFO.agrupamento.details}
                      size="sm"
                    />
                  </div>
                  <SegmentedToggle
                    options={AGRUPAMENTO_OPTIONS}
                    value={agrupamento}
                    onValueChange={(v) => setAgrupamento(v as 'servico' | 'barbeiro' | 'mes')}
                    size="sm"
                  />
                  <Switch
                    id="auto-update"
                    checked={autoUpdate}
                    onCheckedChange={setAutoUpdate}
                  />
                  <Label htmlFor="auto-update" className="text-xs text-muted-foreground cursor-pointer">
                    Auto-atualizar
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-[10px] text-muted-foreground/60 border border-border/50 rounded px-1">
                        ?
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p className="text-xs">
                        Quando ativo, os dados atualizam automaticamente ao alterar filtros.
                        Desative para melhor controle em conexões lentas.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </TooltipProvider>
  );
}

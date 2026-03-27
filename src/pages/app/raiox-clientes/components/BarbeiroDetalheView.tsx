import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RaioXComputedFilters } from '../raioxTypes';
import type { BarberSummary, RoutingClient, BarberSegment } from '../routingTypes';
import {
  SEGMENT_CONFIG, SEG_COUNT_KEY, ACTIVE_SEG_ORDER, PERDIDO_SEG_ORDER,
  classifyForBarber, fmtD, diasColor, totalPerdidos,
} from '../routingTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft, Loader2, Star, Users, TrendingDown, TrendingUp,
  Search, Download, X, Shuffle, Repeat, Clock, Info, Filter, ChevronDown,
} from 'lucide-react';
import { calcDiasSemVir } from '@/lib/diasSemVir';
import { HowToReadSection } from '@/components/help';
import { BaseBadge } from '@/components/raiox-shared';
import { EvoChart } from './EvoChart';
import type { EvolucaoMes } from './EvoChart';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EvolucaoKpis {
  total_receita: number;
  total_atendimentos: number;
  ticket_medio: number;
  media_clientes_mes: number;
  media_novos_mes: number;
}

export interface BarbeiroDetalheViewProps {
  barberId: string;
  barberName: string;
  barberSummary: BarberSummary;
  clients: RoutingClient[];
  clientsLoading: boolean;
  filters: RaioXComputedFilters;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtR(val: number) {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function BarbeiroDetalheView({
  barberId, barberName, barberSummary, clients, clientsLoading, filters, onBack,
}: BarbeiroDetalheViewProps) {
  const [evolucao, setEvolucao] = useState<EvolucaoMes[]>([]);
  const [evoKpis, setEvoKpis] = useState<EvolucaoKpis | null>(null);
  const [evoLoading, setEvoLoading] = useState(false);

  const [activeSegment, setActiveSegment] = useState<BarberSegment | null>(null);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(30);
  const [showPerdidosSection, setShowPerdidosSection] = useState(false);

  /* ---- Load evolution data ---- */
  useEffect(() => {
    setEvoLoading(true);
    supabase
      .rpc('rpc_raiox_routing_barbeiro_evolucao_v1' as any, {
        p_colaborador_id: barberId,
        p_fim:            filters.dataFimISO,
        p_meses:          13,
      })
      .then(({ data, error }) => {
        if (!error && data) {
          const d = data as any;
          const sorted = (d.evolucao ?? []).slice().sort((a: EvolucaoMes, b: EvolucaoMes) =>
            a.mes.localeCompare(b.mes)
          );
          setEvolucao(sorted);
          setEvoKpis(d.kpis ?? null);
        }
        setEvoLoading(false);
      });
  }, [barberId, filters.dataFimISO]);

  /* ---- Client segments (active + perdidos) ---- */
  const segments = useMemo(() => {
    const map: Record<BarberSegment, RoutingClient[]> = {
      fiel: [], exclusivo: [], oneshot_sem_retorno: [], oneshot_aguardando: [],
      oneshot_com_outro: [], convertendo: [], saindo: [],
      perdido_fiel: [], perdido_exclusivo: [], perdido_oneshot: [], perdido_regular: [],
    };
    clients.forEach(c => {
      map[classifyForBarber(c, barberId, filters.janelaDias)].push(c);
    });
    return map;
  }, [clients, barberId, filters.janelaDias]);

  /* ---- Filtered client list ---- */
  const filteredClients = useMemo(() => {
    let list: RoutingClient[] = activeSegment ? segments[activeSegment] : clients;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.cliente_nome || '').toLowerCase().includes(q) ||
        (c.telefone || '').includes(q)
      );
    }
    return list;
  }, [clients, segments, activeSegment, search]);

  /* ---- CSV export ---- */
  const handleExportCSV = useCallback(() => {
    if (!filteredClients.length) return;
    const headers = ['Cliente', 'Telefone', 'Segmento', 'Ativo/Perdido', 'Visitas total', 'Visitas com barbeiro', 'Último barbeiro', 'Dias sem vir', 'Última visita'];
    const csvRows = filteredClients.map(c => {
      const seg = classifyForBarber(c, barberId, filters.janelaDias);
      const bv  = c.barbeiros?.find(b => b.colaborador_id === barberId);
      return [
        c.cliente_nome || '',
        c.telefone || '',
        SEGMENT_CONFIG[seg].label,
        SEGMENT_CONFIG[seg].isPerdido ? 'Perdido' : 'Ativo',
        c.visitas_total,
        bv?.visitas ?? 0,
        c.ultimo_colaborador_nome || '',
        calcDiasSemVir(c.ultima_visita, c.dias_sem_vir),
        c.ultima_visita || '',
      ];
    });
    const csv  = [headers, ...csvRows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `barbeiro_${barberName.replace(/\s+/g, '_')}_${activeSegment ?? 'todos'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredClients, barberName, barberId, activeSegment, filters.janelaDias]);

  /* ---- KPI calculations ---- */
  const perdidos  = totalPerdidos(barberSummary);
  const total     = barberSummary.total_atendidos || clients.length;
  const ativos    = total - perdidos;
  const pctFieis  = ativos > 0 ? Math.round((barberSummary.fieis + barberSummary.exclusivos) / ativos * 100) : 0;
  const pctSaindo = ativos > 0 ? Math.round(barberSummary.saindo / ativos * 100) : 0;
  const atRisk    = barberSummary.saindo + barberSummary.oneshot_sem_retorno;

  /* ---- Loyalty breakdown ---- */
  const loyaltyBreakdown = useMemo(() => {
    const leais      = barberSummary.fieis + barberSummary.exclusivos;
    const rotativos  = barberSummary.convertendo + barberSummary.saindo + barberSummary.oneshot_com_outro;
    const oneshots   = barberSummary.oneshot_aguardando + barberSummary.oneshot_sem_retorno;
    const perdidosV  = totalPerdidos(barberSummary);
    const totalAll   = leais + rotativos + oneshots + perdidosV || 1;
    return {
      leais, rotativos, oneshots, perdidosV, totalAll,
      pctLeais:      Math.round(leais     / totalAll * 100),
      pctRotativos:  Math.round(rotativos / totalAll * 100),
      pctOneshots:   Math.round(oneshots  / totalAll * 100),
      pctPerdidos:   Math.round(perdidosV / totalAll * 100),
    };
  }, [barberSummary]);

  /* ---- Action alerts ---- */
  const ALERT_SEGS: { seg: BarberSegment; urgency: 'high' | 'medium' | 'perdido' }[] = ([
    { seg: 'saindo' as const,              urgency: 'high' as const    },
    { seg: 'oneshot_sem_retorno' as const, urgency: 'high' as const    },
    { seg: 'perdido_fiel' as const,        urgency: 'perdido' as const },
    { seg: 'perdido_exclusivo' as const,   urgency: 'perdido' as const },
    { seg: 'convertendo' as const,         urgency: 'medium' as const  },
    { seg: 'oneshot_aguardando' as const,  urgency: 'medium' as const  },
    { seg: 'oneshot_com_outro' as const,   urgency: 'medium' as const  },
    { seg: 'perdido_regular' as const,     urgency: 'perdido' as const },
    { seg: 'perdido_oneshot' as const,     urgency: 'perdido' as const },
  ] as const).filter(({ seg }) => (barberSummary[SEG_COUNT_KEY[seg]] as number) > 0);

  /* ---- Trend: last 3m vs previous 3m ---- */
  const trend = useMemo(() => {
    if (evolucao.length < 6) return null;
    const recent = evolucao.slice(-3).reduce((s, m) => s + m.clientes_unicos, 0);
    const prev   = evolucao.slice(-6, -3).reduce((s, m) => s + m.clientes_unicos, 0);
    if (prev === 0) return null;
    return Math.round((recent - prev) / prev * 100);
  }, [evolucao]);


  return (
    <div className="space-y-5">
      {/* ---- Header ---- */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="ghost" size="sm" onClick={onBack}
          className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs">Routing</span>
        </Button>
        <div className="h-4 w-px bg-border/40" />
        <div>
          <h2 className="text-base font-bold text-foreground leading-tight">{barberName}</h2>
          <p className="text-[10px] text-muted-foreground">
            {fmtD(filters.dataInicioISO)} – {fmtD(filters.dataFimISO)}
            {' · '}Janela de atividade: <span className="text-foreground font-medium">{filters.janelaDias} dias</span>
          </p>
        </div>
        {trend !== null && (
          <div className={`ml-auto flex items-center gap-1 text-xs font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {trend >= 0 ? '+' : ''}{trend}% clientes (últimos 3m vs 3m ant.)
          </div>
        )}
      </div>

      {/* ---- How to read ---- */}
      <HowToReadSection
        bullets={[
          `Fiel = 3+ visitas consecutivas, exclusivamente com este barbeiro (barbeiros_distintos = 1). Se o cliente foi a outro no período, não é fiel — cai em Convertendo ou Saindo.`,
          `Exclusivo = veio 2x e só com este barbeiro (mas ainda não atingiu 3 visitas para ser fiel).`,
          `Rotativo = frequenta a barbearia com 2+ barbeiros: pode estar Convertendo (última visita foi com ele), Saindo (última foi com outro) ou One-shot com outro.`,
          `Regular (nos perdidos) = era recorrente com múltiplos barbeiros mas saiu da janela de atividade — não era fiel nem exclusivo de ninguém.`,
          `Lealdade & Rotatividade: o bloco colorido divide todos os clientes em 4 grupos para ver a saúde da carteira de um relance.`,
          `Evolução 12m: novos = 1ª visita na barbearia no mês. Recorrentes = já haviam visitado antes. Queda de recorrentes = sinal de alerta.`,
          `Clique em qualquer segmento ativo para filtrar a tabela. A ação recomendada aparece no painel da direita.`,
          `Cadência = intervalo médio habitual entre visitas. Amarelo = passando da hora. Vermelho = muito atrasado.`,
        ]}
      />

      {/* ---- Context strip (period + window explanation) ---- */}
      <div className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground items-center">
        <div className="flex items-center gap-1.5">
          <BaseBadge type="P" />
          <span className="font-medium text-foreground/80">Base Período:</span>
          <span className="text-foreground font-semibold">{fmtD(filters.dataInicioISO)} – {fmtD(filters.dataFimISO)}</span>
        </div>
        <span className="text-border/50">·</span>
        <span>
          Janela ativa: <span className="text-foreground font-medium">{filters.janelaDias}d</span>
          <span className="ml-1 opacity-60">(última visita há +{filters.janelaDias}d = perdido)</span>
        </span>
        <span className="ml-auto">
          <span className="text-emerald-400 font-medium">{ativos} ativos</span>
          {perdidos > 0 && <> · <span className="text-rose-400 font-medium">{perdidos} perdidos</span></>}
        </span>
      </div>

      {/* ---- KPI strip ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* Total clientes — Base Período (Filter badge opens popover) */}
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="h-3 w-3 text-primary shrink-0" />
              <p className="text-[9px] text-muted-foreground">Total clientes</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="ml-auto inline-flex hover:opacity-70 transition-opacity">
                    <Badge variant="outline" className="inline-flex items-center gap-0.5 px-1 py-0 text-[10px] font-bold leading-tight rounded cursor-pointer select-none border-blue-400/60 bg-blue-500/10 text-blue-400 dark:text-blue-400">
                      <Filter className="h-2.5 w-2.5" />
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-72 p-4 space-y-3 text-xs">
                  <p className="font-semibold text-foreground text-sm">Universo — Base Período</p>
                  <div className="space-y-1.5 text-muted-foreground">
                    <p>Clientes que realizaram <strong className="text-foreground/80">pelo menos 1 visita com este barbeiro no período selecionado</strong>. Cada cliente é único, independente de quantas visitas teve.</p>
                    <p className="tabular-nums"><strong className="text-foreground/80">Período:</strong> {fmtD(filters.dataInicioISO)} – {fmtD(filters.dataFimISO)}</p>
                    <p><strong className="text-foreground/80">Janela ativa:</strong> {filters.janelaDias}d — clientes com última visita dentro desse prazo são ativos; além disso são perdidos.</p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-xl font-bold text-foreground">{clientsLoading ? '…' : total}</p>
            <p className="text-[9px] text-muted-foreground">{ativos} ativos · {perdidos} perdidos</p>
          </CardContent>
        </Card>

        {/* Fiéis + Exclusivos */}
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Star className="h-3 w-3 text-emerald-400 shrink-0" />
              <p className="text-[9px] text-muted-foreground">Fiéis + Exclusivos</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="ml-auto text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                    <Info className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-72 p-4 space-y-2 text-xs">
                  <p className="font-semibold text-foreground text-sm">Fiéis + Exclusivos</p>
                  <p className="text-muted-foreground"><strong className="text-foreground/80">Fiel:</strong> 3+ visitas no período, todas exclusivamente com este barbeiro (nunca foi a outro). Vínculo sólido e consolidado.</p>
                  <p className="text-muted-foreground"><strong className="text-foreground/80">Exclusivo:</strong> 2 visitas no período, só com este barbeiro. Preferência clara — ainda pode se tornar fiel.</p>
                  <p className="text-muted-foreground">Quanto maior esse número, mais estável e previsível é a carteira.</p>
                  <p className="text-muted-foreground/70 tabular-nums">Período: {fmtD(filters.dataInicioISO)} – {fmtD(filters.dataFimISO)}</p>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-xl font-bold text-emerald-400">
              {clientsLoading ? '…' : barberSummary.fieis + barberSummary.exclusivos}
            </p>
            <p className="text-[9px] text-muted-foreground">{pctFieis}% dos ativos</p>
          </CardContent>
        </Card>

        {/* Em risco */}
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3 w-3 text-rose-400 shrink-0" />
              <p className="text-[9px] text-muted-foreground">Em risco</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="ml-auto text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                    <Info className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-72 p-4 space-y-2 text-xs">
                  <p className="font-semibold text-foreground text-sm">Em risco (ativos)</p>
                  <p className="text-muted-foreground">Clientes ainda dentro da janela de atividade ({filters.janelaDias}d) mas com sinais de abandono:</p>
                  <p className="text-muted-foreground"><strong className="text-foreground/80">Saindo:</strong> foi com outro barbeiro na última visita — migrando a fidelidade.</p>
                  <p className="text-muted-foreground"><strong className="text-foreground/80">1-shot sem retorno:</strong> veio uma vez, ainda dentro do prazo, mas não voltou — janela de conversão fechando.</p>
                  <p className="text-amber-400/80">Ação imediata: contato proativo antes que cruzem o limiar de perdido.</p>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-xl font-bold text-rose-400">{clientsLoading ? '…' : atRisk}</p>
            <p className="text-[9px] text-muted-foreground">{pctSaindo}% saindo</p>
          </CardContent>
        </Card>

        {/* Perdidos */}
        <Card className="bg-card/50 border-rose-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3 w-3 text-rose-400 shrink-0" />
              <p className="text-[9px] text-muted-foreground">Perdidos</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="ml-auto text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                    <Info className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-72 p-4 space-y-2 text-xs">
                  <p className="font-semibold text-foreground text-sm">Perdidos</p>
                  <p className="text-muted-foreground">Clientes cuja <strong className="text-foreground/80">última visita foi há mais de {filters.janelaDias} dias</strong> a partir do fim do período. Saíram da janela de atividade.</p>
                  <p className="text-muted-foreground">São classificados pelo perfil que tinham <em>antes</em> de sair: fiéis e exclusivos perdidos têm maior potencial de resgate — o vínculo era real.</p>
                  <p className="text-muted-foreground/70 tabular-nums">Fim do período: {fmtD(filters.dataFimISO)} · Janela: {filters.janelaDias}d</p>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-xl font-bold text-rose-400">{clientsLoading ? '…' : perdidos}</p>
            <p className="text-[9px] text-muted-foreground">fora dos {filters.janelaDias}d</p>
          </CardContent>
        </Card>

        {/* Rotativos */}
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Shuffle className="h-3 w-3 text-sky-400 shrink-0" />
              <p className="text-[9px] text-muted-foreground">Rotativos</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="ml-auto text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                    <Info className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-72 p-4 space-y-2 text-xs">
                  <p className="font-semibold text-foreground text-sm">Rotativos (ativos)</p>
                  <p className="text-muted-foreground">Clientes que visitaram com <strong className="text-foreground/80">2+ barbeiros distintos</strong> no período. Inclui: Convertendo, Saindo, e One-shot com outro.</p>
                  <p className="text-muted-foreground"><strong className="text-foreground/80">Convertendo:</strong> última visita foi com este barbeiro — tendência positiva.</p>
                  <p className="text-muted-foreground"><strong className="text-foreground/80">Saindo:</strong> última visita foi com outro barbeiro — migração em andamento.</p>
                  <p className="text-muted-foreground">Oportunidade: converter Convertendo em Exclusivos com consistência de atendimento.</p>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-xl font-bold text-sky-400">{clientsLoading ? '…' : loyaltyBreakdown.rotativos}</p>
            <p className="text-[9px] text-muted-foreground">{loyaltyBreakdown.pctRotativos}% dos ativos</p>
          </CardContent>
        </Card>

        {/* Atendimentos 12m */}
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Repeat className="h-3 w-3 text-slate-400 shrink-0" />
              <p className="text-[9px] text-muted-foreground">Atend. (12m)</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="ml-auto text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                    <Info className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-64 p-4 space-y-2 text-xs">
                  <p className="font-semibold text-foreground text-sm">Atendimentos 12 meses</p>
                  <p className="text-muted-foreground">Total de atendimentos realizados por este barbeiro nos últimos 12 meses a partir do fim do período.</p>
                  <p className="text-muted-foreground">Média de clientes/mês = atendimentos únicos por mês (excluindo retornos no mesmo mês).</p>
                </PopoverContent>
              </Popover>
            </div>
            {evoLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
            ) : (
              <>
                <p className="text-xl font-bold text-slate-300">{fmtR(evoKpis?.total_atendimentos ?? 0)}</p>
                <p className="text-[9px] text-muted-foreground">~{fmtR(evoKpis?.media_clientes_mes ?? 0)} clientes/mês</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Lealdade & Rotatividade ---- */}
      <div className="rounded-lg border border-border/30 bg-card/50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-foreground">Lealdade & Rotatividade</p>
            <p className="text-[10px] text-muted-foreground">Como os clientes se relacionam com este barbeiro vs a barbearia</p>
          </div>
          <span className="text-[10px] text-muted-foreground">{clientsLoading ? '…' : total} clientes · {ativos} ativos · {perdidos} perdidos</span>
        </div>

        {/* Stacked bar */}
        <div className="flex rounded-full overflow-hidden h-3 gap-px bg-muted/10">
          {loyaltyBreakdown.leais > 0 && (
            <div className="bg-emerald-500 transition-all" style={{ width: `${loyaltyBreakdown.pctLeais}%` }} title={`Leais: ${loyaltyBreakdown.leais}`} />
          )}
          {loyaltyBreakdown.rotativos > 0 && (
            <div className="bg-sky-500 transition-all" style={{ width: `${loyaltyBreakdown.pctRotativos}%` }} title={`Rotativos: ${loyaltyBreakdown.rotativos}`} />
          )}
          {loyaltyBreakdown.oneshots > 0 && (
            <div className="bg-amber-500 transition-all" style={{ width: `${loyaltyBreakdown.pctOneshots}%` }} title={`One-shot: ${loyaltyBreakdown.oneshots}`} />
          )}
          {loyaltyBreakdown.perdidosV > 0 && (
            <div className="bg-rose-500/60 transition-all" style={{ width: `${loyaltyBreakdown.pctPerdidos}%` }} title={`Perdidos: ${loyaltyBreakdown.perdidosV}`} />
          )}
        </div>

        {/* Breakdown cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Leais */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[10px] font-semibold text-emerald-400">Leais</span>
              <span className="text-sm font-bold text-foreground ml-auto tabular-nums">{clientsLoading ? '…' : loyaltyBreakdown.leais}</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-snug pl-3.5">
              Fiéis (3+ visitas) e exclusivos (só com ele, 2x). São a base sólida da carteira — têm preferência clara por este barbeiro.
            </p>
            <p className="text-[9px] text-emerald-400/80 font-medium pl-3.5">{loyaltyBreakdown.pctLeais}% do total</p>
          </div>

          {/* Rotativos */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
              <span className="text-[10px] font-semibold text-sky-400">Rotativos</span>
              <span className="text-sm font-bold text-foreground ml-auto tabular-nums">{clientsLoading ? '…' : loyaltyBreakdown.rotativos}</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-snug pl-3.5">
              Vão com múltiplos barbeiros (convertendo, saindo, ou foram com outro após 1ª visita). Podem ser conquistados ou migrar de vez.
            </p>
            <p className="text-[9px] text-sky-400/80 font-medium pl-3.5">{loyaltyBreakdown.pctRotativos}% do total</p>
          </div>

          {/* One-shot */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-[10px] font-semibold text-amber-400">One-shot</span>
              <span className="text-sm font-bold text-foreground ml-auto tabular-nums">{clientsLoading ? '…' : loyaltyBreakdown.oneshots}</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-snug pl-3.5">
              Primeira visita na barbearia foi com ele — ainda não retornaram. Janela de conversão aberta.
            </p>
            <p className="text-[9px] text-amber-400/80 font-medium pl-3.5">{loyaltyBreakdown.pctOneshots}% do total</p>
          </div>

          {/* Perdidos */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-rose-500/70 shrink-0" />
              <span className="text-[10px] font-semibold text-rose-400">Perdidos</span>
              <span className="text-sm font-bold text-foreground ml-auto tabular-nums">{clientsLoading ? '…' : loyaltyBreakdown.perdidosV}</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-snug pl-3.5">
              Fora da janela de {filters.janelaDias} dias. Priorize resgate dos fiéis e exclusivos perdidos — maior potencial de retorno.
            </p>
            <p className="text-[9px] text-rose-400/80 font-medium pl-3.5">{loyaltyBreakdown.pctPerdidos}% do total</p>
          </div>
        </div>
      </div>

      {/* ---- Evolution chart (interactive) + Alerts ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: configurable chart */}
        <Card className="bg-card/50 lg:col-span-2">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">Evolução 12 meses</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <EvoChart data={evolucao} loading={evoLoading} />
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="bg-card/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">Ações recomendadas</CardTitle>
            <p className="text-[10px] text-muted-foreground">Clique para filtrar a tabela</p>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1.5">
            {ALERT_SEGS.length === 0 ? (
              <p className="text-xs text-muted-foreground">Carteira saudável — nenhuma ação urgente.</p>
            ) : (
              ALERT_SEGS.map(({ seg, urgency }) => {
                const cfg   = SEGMENT_CONFIG[seg];
                const Icon  = cfg.icon;
                const count = barberSummary[SEG_COUNT_KEY[seg]] as number;
                const isActive = activeSegment === seg;
                const borderCls = urgency === 'high'
                  ? 'border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10'
                  : urgency === 'perdido'
                  ? 'border-rose-800/20 bg-rose-900/5 hover:bg-rose-900/10'
                  : 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10';
                return (
                  <button
                    key={seg}
                    onClick={() => setActiveSegment(isActive ? null : seg)}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${borderCls} ${isActive ? 'ring-1 ring-primary/40' : ''}`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                        {cfg.isPerdido && (
                          <span className="text-[8px] text-rose-500/70 font-medium">(perdido)</span>
                        )}
                        <span className="text-xs font-bold text-foreground ml-auto tabular-nums">{count}</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{cfg.action}</p>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Portfolio profile — Active segments ---- */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Carteira ativa — {ativos} clientes
          </p>
          <span className="text-[9px] text-muted-foreground">
            última visita dentro de {filters.janelaDias}d · clique num segmento para filtrar
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {ACTIVE_SEG_ORDER.map(seg => {
            const cfg     = SEGMENT_CONFIG[seg];
            const Icon    = cfg.icon;
            const count   = clientsLoading ? 0 : segments[seg].length;
            const pct     = ativos > 0 ? Math.round(count / ativos * 100) : 0;
            const isActive = activeSegment === seg;
            return (
              <button
                key={seg}
                onClick={() => !clientsLoading && setActiveSegment(isActive ? null : seg)}
                disabled={clientsLoading}
                title={`${cfg.label}\n\nDefinição: ${cfg.description}\n\nAção: ${cfg.action}`}
                className={`rounded-xl border p-3 text-left transition-colors space-y-1 ${
                  isActive ? 'border-primary/50 bg-card' : 'border-border/30 bg-card/50 hover:bg-muted/20'
                } ${clientsLoading ? 'opacity-50 cursor-wait' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                  <span className={`text-[9px] font-semibold ${cfg.color} leading-tight`}>{cfg.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{clientsLoading ? '…' : count}</p>
                <p className="text-[9px] text-muted-foreground">{pct}% dos ativos</p>
                <p className="text-[9px] text-muted-foreground leading-snug">{cfg.description}</p>
                <p className="text-[8px] text-primary/70 leading-snug mt-0.5">{cfg.action}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Perdidos section ---- */}
      {perdidos > 0 && (
        <div className="space-y-2">
          <button
            className="flex items-center gap-2 w-full text-left group"
            onClick={() => setShowPerdidosSection(v => !v)}
          >
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wide">
              Perdidos — {perdidos} clientes ({Math.round(perdidos / total * 100)}% do total)
            </p>
            <span className="text-[9px] text-muted-foreground">fora da janela de {filters.janelaDias}d</span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform duration-200 ${showPerdidosSection ? 'rotate-180' : ''}`} />
          </button>

          {showPerdidosSection && (
            <>
              <p className="text-[9px] text-muted-foreground leading-relaxed px-0.5">
                Clientes classificados pelo perfil que tinham <span className="italic">antes</span> de sair da janela.
                Use para priorizar ações de resgate: fiéis e exclusivos perdidos têm maior potencial de retorno.
              </p>
              <div className="text-[9px] bg-rose-950/10 border border-rose-500/10 rounded-md p-2 space-y-0.5 text-muted-foreground">
                <p><span className="font-semibold text-rose-400">Era fiel</span> — vinha 3+ vezes, só com este barbeiro. Vínculo forte. Prioridade máxima de resgate.</p>
                <p><span className="font-semibold text-rose-400">Era exclusivo</span> — vinha 2x, só com este barbeiro. Tinha preferência clara mas ainda sem fidelidade consolidada.</p>
                <p><span className="font-semibold text-slate-300">Regular</span> — frequentava a barbearia com múltiplos barbeiros (rotativo) mas parou de vir. Não tinha preferência específica por este barbeiro.</p>
                <p><span className="font-semibold text-slate-300">One-shot</span> — veio uma única vez e não retornou. Mais difícil de resgatar; campanha massiva de reativação.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PERDIDO_SEG_ORDER.map(seg => {
                  const cfg     = SEGMENT_CONFIG[seg];
                  const Icon    = cfg.icon;
                  const count   = clientsLoading ? 0 : segments[seg].length;
                  const pct     = perdidos > 0 ? Math.round(count / perdidos * 100) : 0;
                  const isActive = activeSegment === seg;
                  return (
                    <button
                      key={seg}
                      onClick={() => !clientsLoading && setActiveSegment(isActive ? null : seg)}
                      disabled={clientsLoading}
                      title={`${cfg.label}\n\nDefinição: ${cfg.description}\n\nAção: ${cfg.action}`}
                      className={`rounded-xl border p-3 text-left transition-colors space-y-1 opacity-90 ${
                        isActive
                          ? 'border-rose-500/40 bg-rose-950/20'
                          : 'border-rose-500/10 bg-card/30 hover:bg-rose-950/10'
                      } ${clientsLoading ? 'cursor-wait' : ''}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                        <span className={`text-[9px] font-semibold ${cfg.color} leading-tight`}>{cfg.label}</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{clientsLoading ? '…' : count}</p>
                      <p className="text-[9px] text-muted-foreground">{pct}% dos perdidos</p>
                      <p className="text-[9px] text-muted-foreground leading-snug">{cfg.description}</p>
                      <p className="text-[8px] text-rose-400/60 leading-snug mt-0.5">{cfg.action}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Active segment action hint */}
      {activeSegment && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-card/80 border border-border/30">
          {(() => { const cfg = SEGMENT_CONFIG[activeSegment]; const Icon = cfg.icon; return <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />; })()}
          <p className="text-[10px] text-muted-foreground flex-1">
            <span className={`font-semibold ${SEGMENT_CONFIG[activeSegment].color}`}>
              {SEGMENT_CONFIG[activeSegment].label}:
            </span>{' '}
            {SEGMENT_CONFIG[activeSegment].action}
          </p>
          <button onClick={() => setActiveSegment(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ---- Client table ---- */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clientes</p>
          {activeSegment && (
            <Badge variant="outline" className={`text-[10px] ${SEGMENT_CONFIG[activeSegment].badgeClass}`}>
              {SEGMENT_CONFIG[activeSegment].label}
            </Badge>
          )}
          <div className="relative ml-auto">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setVisibleCount(30); }}
              placeholder="Buscar cliente..."
              className="h-7 pl-6 pr-2 w-[160px] text-[10px]"
              maxLength={100}
            />
          </div>
          {activeSegment && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setActiveSegment(null)}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
          {filteredClients.length > 0 && (
            <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={handleExportCSV}>
              <Download className="h-3 w-3" /> CSV
            </Button>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground">{filteredClients.length}</span>{' '}
          cliente{filteredClients.length !== 1 ? 's' : ''}
          {!activeSegment && perdidos > 0 && (
            <span className="text-rose-400"> · inclui {perdidos} perdidos</span>
          )}
        </p>

        {/* Column legend */}
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <span className="italic">Legenda das colunas</span>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                <Info className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-80 p-4 space-y-2 text-xs">
              <p className="font-semibold text-foreground">Colunas da tabela</p>
              <div className="space-y-1.5 text-muted-foreground">
                <p><strong className="text-foreground/80">Segmento</strong> — classificação do cliente nesta carteira (Fiel, Exclusivo, Convertendo…)</p>
                <p><strong className="text-foreground/80">V. Total</strong> — total de visitas à barbearia no período selecionado</p>
                <p><strong className="text-foreground/80">V. Barb.</strong> — visitas realizadas especificamente com {barberName}</p>
                <p><strong className="text-foreground/80">Dias s/ vir</strong> — dias desde a última visita do cliente (qualquer barbeiro)</p>
                <p><strong className="text-foreground/80">Cadência</strong> — intervalo médio habitual entre visitas. <span className="text-amber-400">Amarelo</span> = passando da hora. <span className="text-rose-400">Vermelho</span> = muito atrasado.</p>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {clientsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredClients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente encontrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <Table>
              <TableHeader>
                <TableRow className="text-[10px] border-border/40 bg-muted/20">
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-center text-muted-foreground">Segmento</TableHead>
                  <TableHead className="text-center text-muted-foreground">V. Total</TableHead>
                  <TableHead className="text-center text-muted-foreground">V. Barb.</TableHead>
                  <TableHead className="text-center text-muted-foreground">Dias s/ vir</TableHead>
                  <TableHead className="text-center text-muted-foreground hidden sm:table-cell">Cadência</TableHead>
                  <TableHead className="hidden sm:table-cell text-muted-foreground">Telefone</TableHead>
                  <TableHead className="hidden md:table-cell text-muted-foreground">Última visita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.slice(0, visibleCount).map(c => {
                  const seg    = classifyForBarber(c, barberId, filters.janelaDias);
                  const segCfg = SEGMENT_CONFIG[seg];
                  const bv     = c.barbeiros?.find(b => b.colaborador_id === barberId);
                  const dias   = calcDiasSemVir(c.ultima_visita, c.dias_sem_vir);
                  const isPerdido = segCfg.isPerdido;
                  return (
                    <TableRow
                      key={c.cliente_id}
                      className={`text-[11px] hover:bg-muted/10 ${isPerdido ? 'opacity-70' : ''}`}
                    >
                      <TableCell className="font-medium text-foreground max-w-[160px] truncate">
                        {c.cliente_nome || 'Sem nome'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[8px] h-4 ${segCfg.badgeClass}`}>
                          {segCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground tabular-nums">{c.visitas_total}</TableCell>
                      <TableCell className="text-center text-muted-foreground tabular-nums">{bv?.visitas ?? 0}</TableCell>
                      <TableCell className={`text-center font-semibold tabular-nums ${diasColor(dias)}`}>{dias}d</TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        {c.cadencia_media_dias != null ? (
                          <span className={`text-[10px] tabular-nums ${dias > c.cadencia_media_dias * 1.5 ? 'text-rose-400' : dias > c.cadencia_media_dias ? 'text-amber-400' : 'text-muted-foreground'}`}>
                            {c.cadencia_media_dias}d
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 text-[10px]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {c.telefone ? (
                          <div className="flex items-center gap-1.5">
                            <a href={`tel:${c.telefone}`} className="text-primary hover:underline text-[10px]">{c.telefone}</a>
                            <a
                              href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-[9px] text-emerald-400 hover:underline"
                            >WA</a>
                          </div>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-[10px]">
                        {fmtD(c.ultima_visita)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {filteredClients.length > visibleCount && (
          <button
            className="w-full py-2 text-[10px] text-primary hover:underline text-center"
            onClick={() => setVisibleCount(v => v + 30)}
          >
            Ver mais {Math.min(filteredClients.length - visibleCount, 30)} de {filteredClients.length - visibleCount} restantes →
          </button>
        )}
      </div>
    </div>
  );
}

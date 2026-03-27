import React, { useState } from 'react';
import { HelpBox, EmptyState, BaseBadge } from '@/components/raiox-shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Target, AlertTriangle, Users, TrendingDown, Clock, Zap, ChevronRight,
  ChevronDown, Copy, CheckCircle2, Activity, Star, BarChart3, RefreshCw,
  ArrowUpRight, Flame, Shield,
} from 'lucide-react';
import { InfoIconTooltip } from '@/components/help/InfoIconTooltip';
import { HowToReadSection } from '@/components/help/HowToReadSection';
import { RaioXDrillSheet, type DrillRequest } from '../components/RaioXDrillSheet';
import type { RaioXComputedFilters, RaioXTab } from '../raioxTypes';
import type { OverviewData } from '@/hooks/raiox-clientes/useRaioXClientesOverview';
import type { CadenciaData, CadenciaBarbeiroItem } from '@/hooks/raiox-clientes/useRaioXClientesCadencia';
import type { RaioxConfigInstance } from '../RaioXClientesTabs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtD(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR'); }
function fmtN(n: number) { return n.toLocaleString('pt-BR'); }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }

import { computeScore, scoreLabel } from '../raioxScoreUtils';

// ─── Grupos de Ação ───────────────────────────────────────────────────────────

interface GrupoAcao {
  id: string;
  label: string;
  sublabel: string;
  count: number;
  urgencia: 'critica' | 'alta' | 'media' | 'oportunidade';
  drillTipo: DrillRequest['tipo'];
  drillValor: string;
  descricao: string;
  potencial: string;
  msgTemplate: string;
  tab?: RaioXTab;
}

function buildGrupos(
  kpis: OverviewData['kpis'] | undefined,
  cadKpis: CadenciaData['kpis'] | undefined,
  allCadencia: any[],
  thresholds: { risco_min_dias: number; risco_max_dias: number; one_shot_aguardando_max_dias: number; one_shot_risco_max_dias: number; churn_dias_sem_voltar: number },
  filters: RaioXComputedFilters,
): GrupoAcao[] {
  if (!kpis) return [];

  const osAguardando = allCadencia.find((i: any) => i.status === 'ONE_SHOT_AGUARDANDO')?.qtd ?? 0;
  const osRisco = kpis.one_shot_em_risco ?? 0;
  const osPerdido = kpis.one_shot_perdido ?? 0;
  const emRiscoRecorr = Math.max(0, (kpis.clientes_em_risco_macro ?? 0) - osRisco);
  const perdidosRecorr = Math.max(0, (kpis.clientes_perdidos_macro ?? 0) - osPerdido);
  const espacando = cadKpis?.espacando ?? 0;
  const resgatados = kpis.clientes_resgatados_periodo ?? 0;

  return ([
    {
      id: 'oneshot_risco',
      label: 'One-shot em risco',
      sublabel: `${thresholds.one_shot_aguardando_max_dias + 1}–${thresholds.one_shot_risco_max_dias}d sem retornar`,
      count: osRisco,
      urgencia: 'critica' as const,
      drillTipo: 'CADENCIA',
      drillValor: 'ONE_SHOT_RISCO',
      descricao: `1ª visita, passaram do prazo ideal sem retornar. Ainda recuperáveis com incentivo.`,
      potencial: osRisco > 0 ? `~${Math.round(osRisco * 0.3)} clientes podem retornar com contato` : '—',
      msgTemplate: `Oi [nome]! 👋 Aqui é da [barbearia]. Notamos que faz um tempo desde sua primeira visita e ficamos na saudade! Temos uma condição especial esperando por você: [oferta]. Quando podemos te ver por aqui? 💈`,
      tab: 'oneshot',
    },
    {
      id: 'em_risco_recorr',
      label: 'Em risco (recorrentes)',
      sublabel: `${thresholds.risco_min_dias + 1}–${thresholds.risco_max_dias}d sem vir`,
      count: emRiscoRecorr,
      urgencia: 'critica' as const,
      drillTipo: 'RISCO',
      drillValor: '',
      descricao: `Clientes habituais que estão demorando mais que o normal. Já conhecem a barbearia — retenção mais fácil.`,
      potencial: emRiscoRecorr > 0 ? `~${Math.round(emRiscoRecorr * 0.45)} podem ser retidos com um simples contato` : '—',
      msgTemplate: `Oi [nome]! 😊 Sumiu! Já faz um tempo que não te vemos por aqui na [barbearia]. Tudo bem? Quando quiser agendar, é só chamar! Temos horários disponíveis essa semana. 💈`,
      tab: 'acoes',
    },
    {
      id: 'oneshot_aguardando',
      label: 'One-shot aguardando',
      sublabel: `≤${thresholds.one_shot_aguardando_max_dias}d após 1ª visita`,
      count: osAguardando,
      urgencia: 'alta' as const,
      drillTipo: 'CADENCIA',
      drillValor: 'ONE_SHOT_AGUARDANDO',
      descricao: `1ª visita recente, ainda dentro do prazo. Contato proativo agora tem a maior taxa de conversão para recorrente.`,
      potencial: osAguardando > 0 ? `~${Math.round(osAguardando * 0.5)} podem se tornar clientes regulares` : '—',
      msgTemplate: `Oi [nome]! 🙌 Foi um prazer te atender aqui na [barbearia]! Espero que tenha gostado. Quando quiser voltar, já sabe onde nos encontrar! Qualquer dia é dia de se cuidar. 💈`,
      tab: 'oneshot',
    },
    {
      id: 'espacando',
      label: 'Cadência espaçando',
      sublabel: 'Demorando mais que o habitual',
      count: espacando,
      urgencia: 'alta' as const,
      drillTipo: 'ESPACANDO',
      drillValor: '',
      descricao: `Ratio de cadência acima do padrão individual — o cliente está demorando mais que seu histórico. Sinal precoce de risco.`,
      potencial: espacando > 0 ? `Antecipar contato pode evitar que ${Math.round(espacando * 0.4)} entrem na faixa de risco` : '—',
      msgTemplate: `Oi [nome]! Passando para lembrar que já está na hora de renovar o visual! 😄 Aqui na [barbearia] temos horários disponíveis. Quando posso agendar para você? ✂️`,
      tab: 'cadencia',
    },
    {
      id: 'perdidos_recorr',
      label: 'Perdidos (recorrentes)',
      sublabel: `+${thresholds.risco_max_dias}d · clientes habituais`,
      count: perdidosRecorr,
      urgencia: 'media' as const,
      drillTipo: 'PERDIDOS',
      drillValor: '',
      descricao: `Clientes que costumavam ir regularmente mas ultrapassaram o limiar de churn. Resgate possível com oferta especial.`,
      potencial: perdidosRecorr > 0 ? `~${Math.round(perdidosRecorr * 0.15)} podem ser resgatados com campanha dedicada` : '—',
      msgTemplate: `Oi [nome]! 🌟 Faz um tempinho que não te vemos e sentimos sua falta! A [barbearia] preparou uma condição especial para clientes que queremos de volta: [oferta exclusiva]. Que tal dar uma chance? 💈`,
      tab: 'churn',
    },
    {
      id: 'resgatados',
      label: 'Resgatados — fidelizar',
      sublabel: 'Voltaram após ausência longa',
      count: resgatados,
      urgencia: 'oportunidade' as const,
      drillTipo: 'RESGATADOS',
      drillValor: '',
      descricao: `Clientes que retornaram após mais de ${thresholds.churn_dias_sem_voltar}d de ausência. Crucial garantir que virem recorrentes desta vez.`,
      potencial: resgatados > 0 ? `Fidelizar agora pode evitar nova perda de ${resgatados} clientes` : '—',
      msgTemplate: `Oi [nome]! 🎉 Que ótimo ter você de volta! Ficamos muito felizes com sua visita. Para garantir que a experiência foi ótima, gostaríamos de saber: como foi seu atendimento? E já que voltou, que tal agendar o próximo? 💈`,
      tab: 'churn',
    },
  ] as GrupoAcao[]).filter(g => g.count > 0);
}

const URGENCIA_CONFIG = {
  critica: { label: 'Crítica', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/25', dot: 'bg-rose-400', order: 0 },
  alta: { label: 'Alta', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25', dot: 'bg-orange-400', order: 1 },
  media: { label: 'Média', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25', dot: 'bg-amber-400', order: 2 },
  oportunidade: { label: 'Oportunidade', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25', dot: 'bg-emerald-400', order: 3 },
};

// ─── GrupoCard ────────────────────────────────────────────────────────────────

function GrupoCard({ grupo, onDrill, onTabChange }: {
  grupo: GrupoAcao; onDrill: (req: DrillRequest) => void; onTabChange: (tab: RaioXTab) => void;
}) {
  const [showMsg, setShowMsg] = useState(false);
  const [copied, setCopied] = useState(false);
  const urg = URGENCIA_CONFIG[grupo.urgencia];

  const handleCopy = () => {
    navigator.clipboard.writeText(grupo.msgTemplate).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`rounded-xl border ${urg.bg} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`h-2 w-2 rounded-full shrink-0 ${urg.dot}`} />
            <p className="text-[11px] font-semibold text-foreground">{grupo.label}</p>
            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${urg.color} border-current`}>
              {urg.label}
            </Badge>
          </div>
          <p className="text-[9px] text-muted-foreground">{grupo.sublabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-bold tabular-nums ${urg.color}`}>{fmtN(grupo.count)}</p>
          <p className="text-[9px] text-muted-foreground">clientes</p>
        </div>
      </div>

      {/* Descrição + potencial */}
      <div className="px-3 pb-2 space-y-1">
        <p className="text-[10px] text-foreground/80 leading-relaxed">{grupo.descricao}</p>
        <p className="text-[9px] text-primary/70 font-medium">↗ {grupo.potencial}</p>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 px-3 pb-3 flex-wrap">
        <Button size="sm" className="h-7 text-[10px] gap-1"
          onClick={() => onDrill({ tipo: grupo.drillTipo, valor: grupo.drillValor, label: grupo.label })}>
          <Users className="h-3 w-3" /> Ver {fmtN(grupo.count)} clientes
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1"
          onClick={() => setShowMsg(v => !v)}>
          Sugestão de msg {showMsg ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
        {grupo.tab && (
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 ml-auto"
            onClick={() => onTabChange(grupo.tab!)}>
            Análise detalhada <ArrowUpRight className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Mensagem template */}
      {showMsg && (
        <div className="mx-3 mb-3 rounded-lg bg-muted/30 border border-border/40 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Sugestão de mensagem (WhatsApp)</p>
            <button type="button" onClick={handleCopy}
              className="flex items-center gap-1 text-[9px] text-primary hover:text-primary/80 transition-colors">
              {copied ? <><CheckCircle2 className="h-3 w-3" /> Copiado!</> : <><Copy className="h-3 w-3" /> Copiar</>}
            </button>
          </div>
          <p className="text-[10px] text-foreground leading-relaxed whitespace-pre-wrap">{grupo.msgTemplate}</p>
          <p className="text-[9px] text-muted-foreground">Substitua [nome], [barbearia] e [oferta] antes de enviar.</p>
        </div>
      )}
    </div>
  );
}

// ─── Diagnóstico por Barbeiro ─────────────────────────────────────────────────

function barbeiroScore(b: CadenciaBarbeiroItem): number {
  if (!b.total) return 0;
  const pSaude = pct((b.assiduo ?? 0) + (b.regular ?? 0), b.total);
  const pRisco = pct((b.em_risco ?? 0) + (b.perdido ?? 0), b.total);
  return Math.max(0, Math.min(100, pSaude - pRisco / 2));
}

function DiagnosticoBarbeiros({ porBarbeiro, loading, onDrill }: {
  porBarbeiro: CadenciaBarbeiroItem[]; loading: boolean;
  onDrill: (req: DrillRequest) => void;
}) {
  if (loading) return <div className="h-32 animate-pulse bg-muted rounded-xl" />;
  if (!porBarbeiro || porBarbeiro.length === 0) {
    return (
      <div className="rounded-xl border border-border/30 bg-muted/10 p-4 text-center">
        <p className="text-[10px] text-muted-foreground">
          Dados por barbeiro não disponíveis — acesse a aba Cadência para carregar.
        </p>
      </div>
    );
  }

  const sorted = [...porBarbeiro]
    .filter(b => b.total > 0)
    .sort((a, b) => barbeiroScore(a) - barbeiroScore(b)); // pior primeiro

  const mediaTotal = sorted.reduce((s, b) => s + b.total, 0);
  const mediaEmRisco = sorted.reduce((s, b) => s + (b.em_risco ?? 0) + (b.perdido ?? 0), 0);
  const mediaRiscoPct = pct(mediaEmRisco, mediaTotal);

  return (
    <div className="space-y-2">
      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 text-[9px] text-muted-foreground px-0.5">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Assíduo</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> Regular</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Espaçando</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> 1ª Vez</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> Em risco</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Perdido</span>
        <span className="ml-auto text-muted-foreground/60">Média da barbearia: {mediaRiscoPct}% em risco+perdido</span>
      </div>

      {sorted.map((b) => {
        const score = barbeiroScore(b);
        const sl = scoreLabel(score);
        const pEmRisco = pct((b.em_risco ?? 0) + (b.perdido ?? 0), b.total);
        const acimaDaMedia = pEmRisco > mediaRiscoPct + 10;

        const bars = [
          { key: 'assiduo', val: b.assiduo ?? 0, color: 'bg-emerald-400/80' },
          { key: 'regular', val: b.regular ?? 0, color: 'bg-blue-400/80' },
          { key: 'espacando', val: b.espacando ?? 0, color: 'bg-amber-400/80' },
          { key: 'primeira_vez', val: b.primeira_vez ?? 0, color: 'bg-slate-400/70' },
          { key: 'em_risco', val: b.em_risco ?? 0, color: 'bg-orange-400/80' },
          { key: 'perdido', val: b.perdido ?? 0, color: 'bg-rose-400/80' },
        ].filter(x => x.val > 0);

        return (
          <div key={b.colaborador_id} className={`rounded-xl border ${sl.bg} ${sl.border} overflow-hidden`}>
            {/* Header */}
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[11px] font-semibold text-foreground truncate">{b.colaborador_nome || 'Sem barbeiro'}</p>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${sl.bg} ${sl.color} border ${sl.border}`}>
                    {sl.label} · {score}pts
                  </span>
                  {acimaDaMedia && (
                    <span className="text-[9px] text-rose-400 flex items-center gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" /> Acima da média
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {fmtN(b.total)} clientes · {pEmRisco}% em risco+perdido · {pct((b.assiduo ?? 0) + (b.regular ?? 0), b.total)}% saudável
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button"
                  onClick={() => onDrill({ tipo: 'EM_RISCO', valor: b.colaborador_id, label: `Em risco — ${b.colaborador_nome}` })}
                  className="text-[9px] text-orange-400 hover:text-orange-300 transition-colors px-2 py-1 rounded-md hover:bg-orange-500/10 border border-orange-500/20">
                  {fmtN((b.em_risco ?? 0))} risco
                </button>
                <button type="button"
                  onClick={() => onDrill({ tipo: 'PERDIDO', valor: b.colaborador_id, label: `Perdidos — ${b.colaborador_nome}` })}
                  className="text-[9px] text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 rounded-md hover:bg-rose-500/10 border border-rose-500/20">
                  {fmtN((b.perdido ?? 0))} perd.
                </button>
              </div>
            </div>

            {/* Barra de composição */}
            <div className="mx-3 mb-2.5 h-3 rounded-full overflow-hidden bg-muted/50 flex">
              {bars.map(bar => (
                <div key={bar.key} className={`h-full ${bar.color} transition-all duration-500`}
                  style={{ width: `${pct(bar.val, b.total)}%` }}
                  title={`${bar.key}: ${fmtN(bar.val)} (${pct(bar.val, b.total)}%)`}
                />
              ))}
            </div>

            {/* Insights automáticos */}
            {(acimaDaMedia || (b.espacando ?? 0) > (b.assiduo ?? 0) || (b.perdido ?? 0) > (b.regular ?? 0)) && (
              <div className="mx-3 mb-2.5 space-y-1">
                {acimaDaMedia && (
                  <p className="text-[9px] text-rose-400 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                    Taxa de risco+perdido ({pEmRisco}%) está {pEmRisco - mediaRiscoPct}pp acima da média da barbearia ({mediaRiscoPct}%).
                  </p>
                )}
                {(b.espacando ?? 0) > (b.assiduo ?? 0) && (
                  <p className="text-[9px] text-amber-400 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                    Mais clientes espaçando ({fmtN(b.espacando)}) do que assíduos ({fmtN(b.assiduo)}) — tendência de saída.
                  </p>
                )}
                {(b.perdido ?? 0) > (b.regular ?? 0) && (
                  <p className="text-[9px] text-rose-400 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                    Perdidos ({fmtN(b.perdido)}) superam regulares ({fmtN(b.regular)}) — base em deterioração.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Resumo de Oportunidades ─────────────────────────────────────────────────

function ResumoOportunidades({ grupos }: { grupos: GrupoAcao[] }) {
  const totalContactavel = grupos.reduce((s, g) => s + g.count, 0);
  const criticos = grupos.filter(g => g.urgencia === 'critica').reduce((s, g) => s + g.count, 0);
  const estimativaRetorno = Math.round(
    grupos.reduce((s, g) => {
      const rate = g.urgencia === 'critica' ? 0.35 : g.urgencia === 'alta' ? 0.45 : g.urgencia === 'media' ? 0.15 : 0.5;
      return s + g.count * rate;
    }, 0)
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {[
        { label: 'Total contactável', value: fmtN(totalContactavel), desc: 'Clientes em todos os grupos', color: 'text-foreground', icon: Users },
        { label: 'Ação urgente', value: fmtN(criticos), desc: 'Críticos + alta urgência', color: 'text-rose-400', icon: Flame },
        { label: 'Retorno estimado', value: fmtN(estimativaRetorno), desc: 'Estimativa com taxas históricas', color: 'text-emerald-400', icon: Target },
      ].map(item => (
        <div key={item.label} className="rounded-xl border border-border/40 bg-card/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  data: OverviewData | null;
  loading: boolean;
  error: string | null;
  filters: RaioXComputedFilters;
  raioxConfig: RaioxConfigInstance;
  cadenciaData: CadenciaData | null;
  cadenciaLoading: boolean;
  onTabChange: (tab: RaioXTab) => void;
}

export function TabRelatorio({ data, loading, error, filters, raioxConfig, cadenciaData, cadenciaLoading, onTabChange }: Props) {
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillReq, setDrillReq] = useState<DrillRequest | null>(null);
  const [secao, setSecao] = useState<'grupos' | 'barbeiros'>('grupos');

  const cfg = raioxConfig?.config;
  const meses = cfg?.status12m_meses ?? 12;

  const thresholds = {
    risco_min_dias: cfg?.risco_min_dias ?? 45,
    risco_max_dias: cfg?.risco_max_dias ?? 90,
    one_shot_aguardando_max_dias: cfg?.one_shot_aguardando_max_dias ?? 45,
    one_shot_risco_max_dias: cfg?.one_shot_risco_max_dias ?? 90,
    churn_dias_sem_voltar: cfg?.churn_dias_sem_voltar ?? 90,
  };

  const kpis = data?.kpis;
  const baseTotal = (data?.meta?.base_distribuicao_total as number) ?? 0;
  const allCadencia = data?.distribuicoes?.por_cadencia_momento ?? [];

  const healthScore = computeScore(kpis, cadenciaData?.kpis, baseTotal);
  const sl = scoreLabel(healthScore);

  const grupos = buildGrupos(kpis, cadenciaData?.kpis, allCadencia, thresholds, filters);

  const handleDrill = (req: DrillRequest) => { setDrillReq(req); setDrillOpen(true); };

  return (
    <div className="space-y-3 min-w-0 w-full overflow-x-hidden">
      <HowToReadSection
        bullets={[
          'Relatório cruza todos os dados do RaioX e gera grupos de ação priorizados.',
          'Clique em "Ver clientes" em qualquer grupo para abrir a lista e exportar.',
          'Cada grupo tem uma sugestão de mensagem para WhatsApp — copie e adapte.',
          'O diagnóstico por barbeiro usa dados de Cadência — carregue a aba Cadência primeiro se estiver vazio.',
        ]}
        expandedText="Esta aba transforma os dados em plano de ação. Os grupos são ordenados por urgência: Crítico (ação imediata) → Alta → Média → Oportunidade. O retorno estimado usa taxas históricas de reengajamento. O diagnóstico por barbeiro mostra quem precisa de atenção gerencial. Todos os números são clicáveis."
      />

      {error && <HelpBox variant="warning">Erro ao carregar: {error}</HelpBox>}

      {/* Score + Período */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Score geral */}
        <div className={`flex-1 rounded-xl border ${sl.border} ${sl.bg} p-3 flex items-center gap-3`}>
          <div className={`h-14 w-14 rounded-xl border ${sl.border} flex flex-col items-center justify-center shrink-0`}>
            <p className={`text-xl font-bold tabular-nums ${sl.color}`}>{healthScore}</p>
            <p className="text-[8px] text-muted-foreground">/ 100</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[11px] font-semibold text-foreground">Score de saúde da base</p>
              <InfoIconTooltip title="Score de saúde"
                short="Pontuação composta: ativos na janela (30) + perdidos (25) + em risco (20) + cadência (25)."
                details={<div className="space-y-1.5 text-[10px]">
                  <p>Score composto de 4 dimensões, cada uma alimentada por bases distintas:</p>
                  <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 space-y-1">
                    <p><strong>Ativos na janela (30pts):</strong> <span className="text-muted-foreground">Base Principal (P) · % na janela</span></p>
                    <p><strong>Perdidos (25pts):</strong> <span className="text-muted-foreground">Base Status (S) · inversamente proporcional</span></p>
                    <p><strong>Em risco (20pts):</strong> <span className="text-muted-foreground">Base Status (S) · inversamente proporcional</span></p>
                    <p><strong>Cadência saudável (25pts):</strong> <span className="text-muted-foreground">Cadência individual · % assíduo + regular</span></p>
                  </div>
                  <p className="text-muted-foreground">≥75 = Saudável · ≥50 = Atenção · ≥25 = Em risco · &lt;25 = Crítico</p>
                </div>}
              />
            </div>
            <p className={`text-sm font-bold ${sl.color}`}>{sl.label}</p>
            <p className="text-[9px] text-muted-foreground">{fmtD(filters.dataInicioISO)} – {fmtD(filters.dataFimISO)}</p>
          </div>
        </div>

        {/* Resumo rápido */}
        <div className="flex-1 rounded-xl border border-border/40 bg-card/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Ativos', value: kpis?.clientes_ativos_janela ?? 0, color: 'text-emerald-400' },
            { label: 'Em risco', value: kpis?.clientes_em_risco_macro ?? 0, color: 'text-orange-400' },
            { label: 'Perdidos', value: kpis?.clientes_perdidos_macro ?? 0, color: 'text-rose-400' },
            { label: 'Resgatados', value: kpis?.clientes_resgatados_periodo ?? 0, color: 'text-blue-400' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
              {loading ? <div className="h-6 w-12 mx-auto animate-pulse bg-muted rounded mt-1" /> :
                <p className={`text-lg font-bold tabular-nums ${item.color}`}>{fmtN(item.value)}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Resumo de oportunidades */}
      {!loading && grupos.length > 0 && <ResumoOportunidades grupos={grupos} />}

      {/* Toggle Grupos / Barbeiros */}
      <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
        <button type="button"
          onClick={() => setSecao('grupos')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-medium py-1.5 rounded-md transition-all ${secao === 'grupos' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Zap className="h-3 w-3" /> Grupos de Ação
        </button>
        <button type="button"
          onClick={() => setSecao('barbeiros')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-medium py-1.5 rounded-md transition-all ${secao === 'barbeiros' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Users className="h-3 w-3" /> Diagnóstico por Barbeiro
        </button>
      </div>

      {/* Seção: Grupos de Ação */}
      {secao === 'grupos' && (
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse bg-muted rounded-xl" />)}</div>
          ) : grupos.length === 0 ? (
            <EmptyState description="Nenhum grupo de ação identificado — base em excelente saúde!" />
          ) : (
            grupos
              .sort((a, b) => URGENCIA_CONFIG[a.urgencia].order - URGENCIA_CONFIG[b.urgencia].order)
              .map(grupo => (
                <GrupoCard key={grupo.id} grupo={grupo} onDrill={handleDrill} onTabChange={onTabChange} />
              ))
          )}
        </div>
      )}

      {/* Seção: Diagnóstico por Barbeiro */}
      {secao === 'barbeiros' && (
        <div className="space-y-2">
          {cadenciaLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse bg-muted rounded-xl" />)}</div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-0.5">
                <p className="text-[9px] text-muted-foreground">
                  Ordenado por saúde (pior primeiro) · Clique em "risco" ou "perd." para ver os clientes de cada barbeiro.
                </p>
                {!cadenciaData && (
                  <Button variant="outline" size="sm" className="h-6 text-[9px] ml-auto gap-1"
                    onClick={() => onTabChange('cadencia')}>
                    <RefreshCw className="h-3 w-3" /> Carregar dados
                  </Button>
                )}
              </div>
              <DiagnosticoBarbeiros
                porBarbeiro={cadenciaData?.por_barbeiro ?? []}
                loading={cadenciaLoading}
                onDrill={handleDrill}
              />
            </>
          )}
        </div>
      )}

      <RaioXDrillSheet open={drillOpen} onClose={() => setDrillOpen(false)} request={drillReq} filters={filters} />
    </div>
  );
}

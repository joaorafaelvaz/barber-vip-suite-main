import React, { useState } from 'react';
import { HelpBox, KpiCard, EmptyState, BaseBadge } from '@/components/raiox-shared';
import type { BaseType } from '@/components/raiox-shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Target, AlertTriangle, ArrowRight, Users, TrendingDown, Clock, Zap, Info,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Cell } from 'recharts';
import { InfoIconTooltip } from '@/components/help/InfoIconTooltip';
import { HowToReadSection } from '@/components/help/HowToReadSection';
import { RaioXDrillSheet, type DrillRequest } from '../components/RaioXDrillSheet';
import type { RaioXComputedFilters, RaioXTab } from '../raioxTypes';
import type { OverviewData, OverviewDistItem } from '@/hooks/raiox-clientes/useRaioXClientesOverview';
import type { RaioxConfigInstance } from '../RaioXClientesTabs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtD(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR'); }
function fmtN(n: number) { return n.toLocaleString('pt-BR'); }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }

// ─── Funil One-Shot ───────────────────────────────────────────────────────────

interface FunilProps {
  items: OverviewDistItem[];
  loading: boolean;
  cfg: { one_shot_aguardando_max_dias: number; one_shot_risco_max_dias: number };
  filters: RaioXComputedFilters;
  meses: number;
  onDrill: (req: DrillRequest) => void;
}

function FunilOneShot({ items, loading, cfg, filters, meses, onDrill }: FunilProps) {
  const aq = cfg.one_shot_aguardando_max_dias;
  const rq = cfg.one_shot_risco_max_dias;

  const aguardando = items.find((i: any) => i.status === 'ONE_SHOT_AGUARDANDO')?.qtd ?? 0;
  const risco = items.find((i: any) => i.status === 'ONE_SHOT_RISCO')?.qtd ?? 0;
  const perdido = items.find((i: any) => i.status === 'ONE_SHOT_PERDIDO')?.qtd ?? 0;
  const total = aguardando + risco + perdido;

  const slots = [
    {
      key: 'ONE_SHOT_AGUARDANDO', label: 'Aguardando retorno', range: `≤${aq} dias`,
      sub: 'Dentro do prazo normal · contato preventivo recomendado',
      value: aguardando, color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/20',
      bar: 'bg-blue-400', dot: 'bg-blue-400',
      acao: 'Contate com mensagem de boas-vindas ou cupom de retorno.',
      info: `Clientes com exatamente 1 visita histórica, que foram vistos há no máximo ${aq} dias. Ainda dentro do ciclo esperado — um contato proativo agora tem alta chance de converter em recorrente.`,
    },
    {
      key: 'ONE_SHOT_RISCO', label: 'Em risco de perda', range: `${aq + 1}–${rq} dias`,
      sub: 'Passaram do prazo ideal · ação urgente necessária',
      value: risco, color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/25 hover:bg-orange-500/20',
      bar: 'bg-orange-400', dot: 'bg-orange-400',
      acao: 'Ofereça incentivo (desconto, agendamento prioritário) por WhatsApp.',
      info: `Clientes com 1 visita, sem retorno entre ${aq + 1} e ${rq} dias. A janela ideal de retorno passou — ainda recuperáveis, mas requerem esforço maior.`,
    },
    {
      key: 'ONE_SHOT_PERDIDO', label: 'Provavelmente perdido', range: `+${rq + 1} dias`,
      sub: 'Muito difícil recuperação · avaliar custo-benefício',
      value: perdido, color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/20',
      bar: 'bg-rose-400', dot: 'bg-rose-400',
      acao: 'Campanha de reativação especial ou aceite a perda e foque nos demais.',
      info: `Clientes com 1 visita, sem retorno há mais de ${rq} dias. Alta probabilidade de terem migrado para outro estabelecimento. Custo de resgate elevado.`,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {[1, 2, 3].map(i => <div key={i} className="h-36 animate-pulse bg-muted rounded-xl" />)}
      </div>
    );
  }

  if (total === 0) {
    return <EmptyState className="py-8" description="Nenhum cliente one-shot encontrado no período." />;
  }

  return (
    <div className="space-y-2">
      {/* Funil visual — barra de distribuição */}
      <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden">
        {slots.map(s => s.value > 0 && (
          <div
            key={s.key}
            className={`h-full ${s.bar} transition-all duration-700`}
            style={{ width: `${pct(s.value, total)}%` }}
            title={`${s.label}: ${fmtN(s.value)} (${pct(s.value, total)}%)`}
          />
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {slots.map(s => {
          const p = pct(s.value, total);
          return (
            <button
              key={s.key} type="button"
              onClick={() => onDrill({ tipo: 'CADENCIA', valor: s.key, label: s.label })}
              className={`rounded-xl border p-3 text-left transition-all duration-200 active:scale-[0.98] ${s.bg} flex flex-col gap-2`}
              title={`Ver clientes: ${s.label}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${s.color}`}>{s.label}</p>
                  </div>
                  <p className="text-[9px] text-muted-foreground">{s.range}</p>
                </div>
                <InfoIconTooltip
                  title={s.label}
                  short={`${s.range} sem retornar · ${fmtD(filters.dataFimISO)}`}
                  details={
                    <div className="space-y-1.5 text-[10px]">
                      <p>{s.info}</p>
                      <div className="border-t border-border/20 pt-1.5">
                        <p className="text-primary/80 font-medium">Ação recomendada:</p>
                        <p>{s.acao}</p>
                      </div>
                    </div>
                  }
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{fmtN(s.value)}</p>
                <p className="text-[9px] text-muted-foreground tabular-nums">{p}% dos one-shots · {s.sub}</p>
              </div>
              <div className="h-1 bg-muted/60 rounded-full overflow-hidden">
                <div className={`h-full ${s.bar} rounded-full`} style={{ width: `${Math.max(p, 3)}%` }} />
              </div>
              <p className="text-[9px] text-primary/70 font-medium flex items-center gap-1">
                <Users className="h-3 w-3 shrink-0" /> Ver lista de clientes →
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tabela por Barbeiro ───────────────────────────────────────────────────────

interface BarbeiroRow {
  colaborador_id: string;
  nome: string;
  aguardando: number;
  risco: number;
  perdido: number;
  total: number;
}

interface TabelaBarbeirosProps {
  data: OverviewData | null;
  loading: boolean;
  onDrill: (req: DrillRequest) => void;
}

function TabelaBarbeiros({ data, loading, onDrill }: TabelaBarbeirosProps) {
  const rows: BarbeiroRow[] = React.useMemo(() => {
    if (!data?.distribuicoes) return [];
    const byBarbeiro = (data.distribuicoes as any).oneshot_por_barbeiro as any[] | undefined;
    if (!byBarbeiro) return [];
    return byBarbeiro
      .map((b: any) => ({
        colaborador_id: b.colaborador_id ?? '',
        nome: b.nome ?? 'Sem barbeiro',
        aguardando: b.aguardando ?? 0,
        risco: b.risco ?? 0,
        perdido: b.perdido ?? 0,
        total: (b.aguardando ?? 0) + (b.risco ?? 0) + (b.perdido ?? 0),
      }))
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [data]);

  if (loading) return <div className="h-24 animate-pulse bg-muted rounded-xl" />;
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border/30 bg-muted/10 p-4 text-center">
        <p className="text-[10px] text-muted-foreground">
          Breakdown por barbeiro não disponível — verifique a configuração de atribuição em Config.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/30 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Barbeiro</th>
              <th className="text-right px-2 py-2 font-medium text-blue-400">Aguard.</th>
              <th className="text-right px-2 py-2 font-medium text-orange-400">Risco</th>
              <th className="text-right px-2 py-2 font-medium text-rose-400">Perdido</th>
              <th className="text-right px-2 py-2 font-medium text-muted-foreground">Total</th>
              <th className="text-right px-3 py-2 font-medium text-orange-400">% Risco+</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const pRisco = pct(r.risco + r.perdido, r.total);
              return (
                <tr key={r.colaborador_id || idx} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="px-3 py-2 font-medium text-foreground truncate max-w-[120px]">{r.nome}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-blue-400">{fmtN(r.aguardando)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-orange-400">{fmtN(r.risco)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-rose-400">{fmtN(r.perdido)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-foreground">{fmtN(r.total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={`font-semibold ${pRisco > 50 ? 'text-rose-400' : pRisco > 30 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                      {pRisco}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Gráfico tendência mensal ─────────────────────────────────────────────────

function OneShotTrendChart({ data, loading }: { data: { mes: number; ano: number; aguardando: number; risco: number; perdido: number }[] | undefined; loading: boolean }) {
  if (loading) return <div className="h-32 animate-pulse bg-muted rounded-md" />;
  if (!data || data.length === 0) {
    return <EmptyState className="py-6" description="Sem dados de tendência de one-shot." />;
  }
  const chartData = data.map(d => ({
    name: `${d.mes}/${String(d.ano).slice(2)}`,
    aguardando: d.aguardando,
    risco: d.risco,
    perdido: d.perdido,
  }));
  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={chartData} margin={{ top: 2, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
        <XAxis dataKey="name" tick={{ fontSize: 9 }} className="fill-muted-foreground" interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 9 }} width={36} className="fill-muted-foreground" />
        <RechartsTooltip contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
        <Bar dataKey="aguardando" stackId="a" fill="rgba(96,165,250,0.7)" name="Aguardando" radius={[0,0,0,0]} />
        <Bar dataKey="risco" stackId="a" fill="rgba(251,146,60,0.7)" name="Em risco" radius={[0,0,0,0]} />
        <Bar dataKey="perdido" stackId="a" fill="rgba(251,113,133,0.7)" name="Perdido" radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Dicas de ação ────────────────────────────────────────────────────────────

function DicasAcao({ aguardando, risco, perdido, total, aq, rq }: {
  aguardando: number; risco: number; perdido: number; total: number; aq: number; rq: number;
}) {
  if (total === 0) return null;
  const pRiscoMais = pct(risco + perdido, total);
  const dicas = [];
  if (aguardando > 0) dicas.push({ color: 'text-blue-400', bg: 'bg-blue-500/8 border-blue-500/20', icon: Clock, texto: `${fmtN(aguardando)} clientes aguardando — contato proativo agora converte com baixo esforço.` });
  if (risco > 0) dicas.push({ color: 'text-orange-400', bg: 'bg-orange-500/8 border-orange-500/20', icon: AlertTriangle, texto: `${fmtN(risco)} em risco — ofereça incentivo (desconto, cortesia) para garantir 2ª visita.` });
  if (pRiscoMais > 40) dicas.push({ color: 'text-rose-400', bg: 'bg-rose-500/8 border-rose-500/20', icon: TrendingDown, texto: `${pRiscoMais}% já passaram do prazo. Verifique se a experiência da 1ª visita está boa.` });

  return (
    <div className="space-y-1.5">
      {dicas.map((d, i) => (
        <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${d.bg}`}>
          <d.icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${d.color}`} />
          <p className="text-[10px] text-foreground leading-relaxed">{d.texto}</p>
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
  onTabChange: (tab: RaioXTab) => void;
}

export function TabOneShot({ data, loading, error, filters, raioxConfig, onTabChange }: Props) {
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillReq, setDrillReq] = useState<DrillRequest | null>(null);

  const cfg = raioxConfig?.config;
  const meses = cfg?.status12m_meses ?? 12;
  const aq = cfg?.one_shot_aguardando_max_dias ?? 45;
  const rq = cfg?.one_shot_risco_max_dias ?? 90;
  const oneShotBase: BaseType = ((cfg as any)?.base_oneshot ?? 'S') as BaseType;

  const allCadencia = data?.distribuicoes?.por_cadencia_momento || [];
  const oneShotItems = allCadencia.filter((i: any) =>
    ['ONE_SHOT_AGUARDANDO', 'ONE_SHOT_RISCO', 'ONE_SHOT_PERDIDO'].includes(i.status)
  );

  const aguardando = oneShotItems.find((i: any) => i.status === 'ONE_SHOT_AGUARDANDO')?.qtd ?? 0;
  const risco = oneShotItems.find((i: any) => i.status === 'ONE_SHOT_RISCO')?.qtd ?? 0;
  const perdido = oneShotItems.find((i: any) => i.status === 'ONE_SHOT_PERDIDO')?.qtd ?? 0;
  const totalOneShot = aguardando + risco + perdido;

  const baseTotal = (data?.meta?.base_distribuicao_total as number) ?? null;
  const pctDaBase = baseTotal && baseTotal > 0 ? pct(totalOneShot, baseTotal) : null;

  const oneShotTrend = (data?.tendencias as any)?.oneshot_mensal as any[] | undefined;

  const handleDrill = (req: DrillRequest) => { setDrillReq(req); setDrillOpen(true); };

  return (
    <div className="space-y-3 min-w-0 w-full overflow-x-hidden">
      <HowToReadSection
        bullets={[
          'One-shot = cliente com exatamente 1 visita em todo o histórico.',
          `Divididos em 3 grupos por recência: Aguardando (≤${aq}d) · Em risco (${aq+1}–${rq}d) · Perdido (+${rq}d).`,
          'Clique em qualquer card para ver a lista de clientes e exportar.',
          'Em risco e Perdidos também aparecem nos KPIs da Visão Geral.',
        ]}
        expandedText={`One-shots não têm cadência calculável pois têm apenas 1 visita — são monitorados separadamente por recência (dias desde a visita). O funil mostra a jornada: Aguardando (dentro do prazo) → Em risco (passaram do prazo) → Perdido (muito tempo sem contato). Configure os prazos em Config → Seção 5. A atribuição por barbeiro usa o modo configurado em Config → Seção 7 (padrão: último atendimento).`}
      />

      {/* Meta bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 rounded-xl border border-border/30 bg-muted/15 text-[10px] text-muted-foreground">
        <span><strong className="text-foreground">REF:</strong> {fmtD(filters.dataFimISO)}</span>
        <span className="flex items-center gap-1"><BaseBadge type={oneShotBase} meses={meses} /> universo one-shots</span>
        <span>Aguardando ≤{aq}d · Risco {aq+1}–{rq}d · Perdido +{rq}d</span>
        {baseTotal && <span className="ml-auto font-medium text-foreground">{fmtN(baseTotal)} na base principal</span>}
      </div>

      {error && <HelpBox variant="warning">Erro ao carregar: {error}</HelpBox>}

      {/* KPIs resumidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard
          label="Total one-shots" loading={loading}
          value={loading ? '--' : fmtN(totalOneShot)}
          suffix={<InfoIconTooltip title="Total one-shots" short="Clientes com exatamente 1 visita no histórico."
            details={<div className="space-y-1.5 text-[10px]">
              <p>Soma de Aguardando + Em risco + Perdido. Clientes com mais de 1 visita <strong>não</strong> entram aqui.</p>
              <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 space-y-0.5">
                <p className="text-muted-foreground font-medium text-[9px]">Fonte: <span className="text-foreground/80 font-medium">Base Status {meses}m (S)</span> {baseTotal && <span>· {fmtN(baseTotal)} na base</span>}</p>
              </div>
            </div>} />}
        />
        <KpiCard
          label="% da base" loading={loading}
          value={loading ? '--' : (pctDaBase != null ? `${pctDaBase}%` : '--')}
          suffix={<InfoIconTooltip title="% da base" short="Proporção de one-shots em relação à base de distribuição."
            details={<div className="space-y-1.5 text-[10px]">
              <p>One-shots ÷ base de distribuição total. Acima de 20% indica alto churn de 1ª visita — verifique qualidade do atendimento inicial.</p>
              <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 space-y-0.5">
                <p className="text-muted-foreground font-medium text-[9px]">Fonte: <span className="text-foreground/80 font-medium">Base Status {meses}m (S)</span> {baseTotal && <span>· {fmtN(baseTotal)} na base</span>}</p>
              </div>
            </div>} />}
        />
        <KpiCard
          label="Em risco + perdido" loading={loading}
          value={loading ? '--' : fmtN(risco + perdido)}
          status="warning"
          suffix={<InfoIconTooltip title="Em risco + perdido" short={`Passaram do prazo de ${aq}d sem retornar.`}
            details={<div className="space-y-1.5 text-[10px]">
              <p>Clientes que estão em risco de nunca mais voltar. Ação urgente pode ainda recuperar parte deles.</p>
              <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 space-y-0.5">
                <p className="text-muted-foreground font-medium text-[9px]">Fonte: <span className="text-foreground/80 font-medium">Base Status {meses}m (S)</span> · risco {aq+1}–{rq}d · perdido +{rq}d</p>
              </div>
            </div>} />}
        />
        <KpiCard
          label="Aguardando" loading={loading}
          value={loading ? '--' : fmtN(aguardando)}
          status="positive"
          suffix={<InfoIconTooltip title="Aguardando" short={`≤${aq}d sem retornar · janela ideal de contato.`}
            details={<div className="space-y-1.5 text-[10px]">
              <p>Dentro do prazo esperado. Contato proativo agora tem a maior taxa de conversão para recorrente.</p>
              <div className="rounded-md bg-muted/40 px-2 py-1.5 border border-border/30 space-y-0.5">
                <p className="text-muted-foreground font-medium text-[9px]">Fonte: <span className="text-foreground/80 font-medium">Base Status {meses}m (S)</span> · ≤{aq}d sem retornar</p>
              </div>
            </div>} />}
        />
      </div>

      {/* Dicas de ação */}
      <DicasAcao aguardando={aguardando} risco={risco} perdido={perdido} total={totalOneShot} aq={aq} rq={rq} />

      {/* Funil */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-1">
          <Target className="h-3.5 w-3.5 text-violet-400 shrink-0" />
          <p className="text-[11px] font-semibold text-foreground">Funil de conversão</p>
          <span className="text-[9px] text-muted-foreground ml-1">Clique em qualquer card para ver os clientes</span>
        </div>
        <FunilOneShot
          items={oneShotItems} loading={loading} cfg={{ one_shot_aguardando_max_dias: aq, one_shot_risco_max_dias: rq }}
          filters={filters} meses={meses} onDrill={handleDrill}
        />
      </div>

      {/* Tendência mensal */}
      {oneShotTrend && (
        <Card className="border-border/40 min-w-0 overflow-hidden">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
              One-shots por mês (evolução)
              <InfoIconTooltip title="Evolução mensal de one-shots"
                short="Quantidade de one-shots em cada mês por faixa."
                details={<p className="text-[10px]">Barras empilhadas: azul = aguardando, laranja = risco, rosa = perdido. Crescimento de "perdido" indica problema de retenção de 1ª visita.</p>}
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <OneShotTrendChart data={oneShotTrend} loading={loading} />
          </CardContent>
        </Card>
      )}

      {/* Por barbeiro */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-1">
          <Users className="h-3.5 w-3.5 text-primary shrink-0" />
          <p className="text-[11px] font-semibold text-foreground">Por barbeiro</p>
          <InfoIconTooltip title="One-shots por barbeiro"
            short="Distribuição dos one-shots por colaborador responsável."
            details={<p className="text-[10px]">Atribuição conforme configurado em Config → Seção 7. Um barbeiro com alto % de one-shots pode indicar problema na experiência ou perfil de clientes captados.</p>}
          />
        </div>
        <TabelaBarbeiros data={data} loading={loading} onDrill={handleDrill} />
      </div>

      {/* Atalhos */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => onTabChange('acoes')}>
          <Zap className="h-3 w-3 mr-1" /> Ir para Ações CRM
        </Button>
        <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => onTabChange('barbeiros')}>
          <Users className="h-3 w-3 mr-1" /> Ver por barbeiro
        </Button>
        <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => onTabChange('config')}>
          <Info className="h-3 w-3 mr-1" /> Configurar prazos (Config → Seção 5)
        </Button>
      </div>

      <RaioXDrillSheet open={drillOpen} onClose={() => setDrillOpen(false)} request={drillReq} filters={filters} />
    </div>
  );
}

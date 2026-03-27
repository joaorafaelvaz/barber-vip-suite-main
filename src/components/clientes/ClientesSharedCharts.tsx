// ============================================================
// FILE: src/components/clientes/ClientesSharedCharts.tsx
// PROPÓSITO: Sub-componentes compartilhados entre BarbeiroView e BarbeirosVisaoGeral
// ============================================================

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users, UserCheck, UsersRound, UserPlus, Heart, TrendingUp, DollarSign,
  AlertTriangle, UserMinus, Clock, ShieldAlert, Eye, BarChart3, Star, Hash,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Line, ComposedChart, Legend,
} from 'recharts';
import { fmtInt, fmtPct, fmtMoney, fmtMesAno, STATUS_CONFIG } from '@/hooks/useClientes';
import { InfoPopover } from './InfoPopover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ---- Inline insight trigger+content for section headers ----
function InlineInsightToggle({ text, label }: { text?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const buttonLabel = label ? `📊 ${label}` : (open ? 'Ocultar resumo' : 'Ver resumo');
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/50 shrink-0 whitespace-nowrap"
      >
        <span>{buttonLabel}</span>
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="col-span-full w-full mt-1">
          <div className="bg-muted/50 border border-border/50 rounded-md p-3">
            <p className="text-[11px] text-foreground/80 leading-relaxed">{text}</p>
          </div>
        </div>
      )}
    </>
  );
}

// ---- Mini KPI Card ----
export function MiniKpi({
  icon: Icon, label, value, sub, info, accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  info?: { title: string; description: string; example?: string; periodLabel?: string };
  accent?: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center gap-1 mb-1">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${accent || 'text-primary'}`} />
         <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex-1 min-w-0 truncate">
            {label}
          </span>
          {info && (
            <InfoPopover
              title={info.title}
              description={info.description}
              example={info.example}
              periodLabel={info.periodLabel}
            />
          )}
        </div>
        <div className="text-lg sm:text-xl font-bold text-foreground">{value}</div>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-border/50 bg-popover p-2 shadow-md text-xs">
      <span className="font-medium text-foreground">{d.name}: {fmtInt(d.value)}</span>
    </div>
  );
}

export function MultiTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-popover p-2 shadow-md text-xs space-y-0.5">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ backgroundColor: p.color }} />
          {p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('valor') ? fmtMoney(p.value) : fmtInt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ---- Status Bar ----
export function SharedStatusBar({ distribuicao, total, periodLabel, insightText, insightLabel }: {
  distribuicao: any[]; total: number; periodLabel: string;
  insightText?: string; insightLabel?: string;
}) {
  if (!distribuicao?.length || total === 0) return null;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-1 mb-1">
          <p className="text-xs font-medium text-muted-foreground flex-1">Status da carteira</p>
          <InfoPopover
            title="Distribuição de status da carteira"
            description="Cada cliente é classificado automaticamente pela cadência de visitas: Assíduo = frequência alta, vem antes do esperado. Regular = no ritmo normal. Espaçando = visitas mais distantes mas ainda ativo. Em Risco = ultrapassou a cadência esperada. Perdido = não retornou há muito tempo. A barra mostra a proporção visual de cada grupo."
            example="Se 70% Assíduo+Regular, a carteira é saudável e a receita previsível. Se >30% Em Risco+Perdido, é necessário ação de resgate urgente. Meta ideal: manter Assíduo+Regular acima de 60%."
            periodLabel={`Período: ${periodLabel}`}
          />
          <InlineInsightToggle text={insightText} label={insightLabel} />
        </div>
        <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-2 truncate">Período: {periodLabel} • Cadência de visitas</p>
        <div className="flex w-full h-7 rounded-md overflow-hidden">
          {distribuicao.map((item) => {
            const cfg = STATUS_CONFIG[item.status];
            if (!cfg || item.count === 0) return null;
            const pct = (item.count / total) * 100;
            return (
              <div
                key={item.status}
                className="h-full flex items-center justify-center transition-opacity"
                style={{ width: `${pct}%`, backgroundColor: cfg.color, minWidth: pct > 0 ? '2px' : 0 }}
                title={`${cfg.label}: ${item.count} (${pct.toFixed(0)}%)`}
              >
                {pct >= 10 && (
                  <span className="text-[9px] font-bold text-white drop-shadow-sm">
                    {pct.toFixed(0)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2">
          {distribuicao.map((item) => {
            const cfg = STATUS_CONFIG[item.status];
            if (!cfg) return null;
            return (
              <div key={item.status} className="flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm shrink-0" style={{ backgroundColor: cfg.color }} />
                {cfg.label}: {fmtInt(item.count)} ({total > 0 ? ((item.count / total) * 100).toFixed(0) : 0}%)
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Composição por Status (Horizontal bars) ----
export function SharedComposicaoStatus({
  detalhe, periodLabel, contextLabel, insightText, insightLabel,
}: {
  detalhe: any;
  periodLabel: string;
  contextLabel: string;
  insightText?: string;
  insightLabel?: string;
}) {
  const dist = detalhe.status_distribuicao ?? [];
  const total = detalhe.total_clientes;
  const freqDist = detalhe.frequencia_dist ?? [];
  const soUmaVez = freqDist.find((f: any) => f.faixa === '1 vez')?.count ?? 0;

  const statusData = dist
    .filter((d: any) => STATUS_CONFIG[d.status])
    .map((d: any) => ({
      name: STATUS_CONFIG[d.status].label,
      value: d.count,
      color: STATUS_CONFIG[d.status].color,
      pct: total > 0 ? ((d.count / total) * 100).toFixed(0) : '0',
    }))
    .sort((a: any, b: any) => b.value - a.value);

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-1 mb-1">
          <BarChart3 className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs font-medium text-foreground flex-1">Composição por Status</p>
          <InfoPopover
            title="Composição detalhada da carteira"
            description="Barras horizontais proporcionais ao total de clientes. Cada status representa um nível de engajamento: Assíduo (frequência alta, vem antes do esperado), Regular (no ritmo normal), Espaçando (visitas mais distantes), Em Risco (ultrapassou cadência), Perdido (sem retorno há muito tempo). Também mostra Novos (primeira visita no período), Só 1 vez (não retornaram) e Fiéis (3+ visitas exclusivas)."
            example={`Se Assíduo mostra 155 (40%), significa que 155 clientes ${contextLabel} mantêm frequência alta. Assíduo+Regular > 60% = carteira saudável. Novos alto + Só 1 vez alto = problema de conversão. Fiéis alto = base estável e previsível.`}
            periodLabel={`Período: ${periodLabel}`}
          />
          <InlineInsightToggle text={insightText} label={insightLabel} />
        </div>
        <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-2 truncate">Período: {periodLabel} • Barras proporcionais ao total</p>
        <div className="space-y-2">
          {statusData.map((item: any) => (
            <div key={item.name} className="space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium text-foreground">{fmtInt(item.value)} ({item.pct}%)</span>
              </div>
              <div className="h-4 w-full rounded-sm overflow-hidden bg-muted/30">
                <div
                  className="h-full rounded-sm transition-all"
                  style={{
                    width: `${total > 0 ? (item.value / total) * 100 : 0}%`,
                    backgroundColor: item.color,
                    minWidth: item.value > 0 ? '4px' : 0,
                  }}
                />
              </div>
            </div>
          ))}
          {[
            { name: 'Novos', value: detalhe.novos_no_periodo, color: 'hsl(280, 70%, 60%)' },
            { name: 'Só 1 vez', value: soUmaVez, color: 'hsl(0, 60%, 50%)' },
            { name: 'Fiéis (3+ excl.)', value: detalhe.fieis, color: 'hsl(142, 60%, 40%)' },
          ].filter(x => x.value > 0).map((item) => (
            <div key={item.name} className="space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium text-foreground">{fmtInt(item.value)} ({total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div className="h-4 w-full rounded-sm overflow-hidden bg-muted/30">
                <div
                  className="h-full rounded-sm transition-all"
                  style={{
                    width: `${total > 0 ? (item.value / total) * 100 : 0}%`,
                    backgroundColor: item.color,
                    minWidth: item.value > 0 ? '4px' : 0,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Frequência Distribuição ----
export function SharedFrequenciaChart({ freqDist, total, periodLabel, insightText, insightLabel }: {
  freqDist: any[]; total: number; periodLabel: string;
  insightText?: string; insightLabel?: string;
}) {
  if (!freqDist?.length) return null;

  const FREQ_COLORS = [
    'hsl(0, 84%, 60%)',    // 1 vez
    'hsl(25, 95%, 53%)',   // 2x
    'hsl(45, 93%, 47%)',   // 3-4x
    'hsl(217, 91%, 60%)',  // 5-9x
    'hsl(200, 80%, 50%)',  // 10-12x
    'hsl(180, 70%, 45%)',  // 13-15x
    'hsl(160, 65%, 42%)',  // 16-20x
    'hsl(142, 71%, 45%)',  // 21-30x
    'hsl(120, 60%, 38%)',  // 30+
  ];

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-1 mb-1">
          <Hash className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs font-medium text-foreground flex-1">Frequência de Visitas</p>
          <InfoPopover
            title="Distribuição de frequência de visitas"
            description="Mostra quantas vezes cada cliente visitou no período selecionado, agrupado por faixas (1 vez, 2 vezes, 3 vezes, 4 vezes, 5+). Alta concentração em '1 vez' indica baixa recorrência e falha na retenção. Concentração em '5+' indica base fiel e receita previsível."
            example="Se 40% veio só 1 vez, novos não estão retornando — invista em follow-up pós primeiro corte. Se 30%+ está em '5+', a base é muito fiel. Benchmark ideal: menos de 25% na faixa '1 vez' e mais de 20% na faixa '5+'. Compare mês a mês para ver se a recorrência está melhorando."
            periodLabel={`Período: ${periodLabel}`}
          />
          <InlineInsightToggle text={insightText} label={insightLabel} />
        </div>
        <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-2 truncate">Período: {periodLabel} • Nº de visitas no período</p>
        <div className="space-y-1.5">
          {freqDist.map((item: any, i: number) => (
            <div key={item.faixa} className="space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{item.faixa}</span>
                <span className="font-medium text-foreground">{fmtInt(item.count)} ({total > 0 ? ((item.count / total) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div className="h-3.5 w-full rounded-sm overflow-hidden bg-muted/30">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${total > 0 ? (item.count / total) * 100 : 0}%`,
                    backgroundColor: FREQ_COLORS[i % FREQ_COLORS.length],
                    minWidth: item.count > 0 ? '3px' : 0,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Evolução Mensal ----
export function SharedEvolucaoMensalChart({ evolucao, periodLabel, insightText, insightLabel }: {
  evolucao: any[]; periodLabel: string;
  insightText?: string; insightLabel?: string;
}) {
  if (!evolucao?.length) return null;

  const data = evolucao.map((e: any) => ({
    mes: fmtMesAno(e.ano_mes),
    'Clientes Únicos': e.clientes_unicos,
    Novos: e.novos,
    Valor: e.valor,
  }));

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-1 mb-1">
          <TrendingUp className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs font-medium text-foreground flex-1">Evolução Mensal</p>
          <InfoPopover
            title="Evolução mensal de clientes e receita"
            description="Gráfico combinado mês a mês: Barras azuis = clientes únicos atendidos no mês (volume). Barras roxas = novos captados pela primeira vez (captação). Linha verde = faturamento total do mês (receita). Use para identificar tendências de crescimento, sazonalidade e correlação entre volume de clientes e receita."
            example="Se barras azuis sobem e roxas ficam estáveis, a retenção está melhorando (mais clientes antigos voltando). Se azuis caem mas roxas sobem, está captando novos mas perdendo antigos — sinal de alerta. Se a linha verde sobe mais que as barras, o ticket médio está aumentando. Ideal: crescimento consistente nos 3 indicadores."
            periodLabel={`Período: ${periodLabel}`}
          />
          <InlineInsightToggle text={insightText} label={insightLabel} />
        </div>
        <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-2 truncate">Período: {periodLabel} • Barras = clientes/novos | Linha = valor</p>
        <div className="h-[200px] sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="mes" tick={{ fontSize: 9 }} className="fill-muted-foreground" interval={data.length > 6 ? 1 : 0} />
              <YAxis yAxisId="left" tick={{ fontSize: 9 }} className="fill-muted-foreground" width={35} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} className="fill-muted-foreground" width={35} hide={data.length <= 3} />
              <Tooltip content={<MultiTooltip />} />
              <Legend wrapperStyle={{ fontSize: '9px' }} />
              <Bar yAxisId="left" dataKey="Clientes Únicos" fill="hsl(217, 91%, 60%)" radius={[2, 2, 0, 0]} barSize={16} />
              <Bar yAxisId="left" dataKey="Novos" fill="hsl(280, 70%, 60%)" radius={[2, 2, 0, 0]} barSize={16} />
              <Line yAxisId="right" type="monotone" dataKey="Valor" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 3 }} name="Valor" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Top 10 Clientes ----
export function SharedTopClientesTable({ topClientes, contextLabel, periodLabel, insightText, insightLabel }: {
  topClientes: any[]; contextLabel: string; periodLabel: string;
  insightText?: string; insightLabel?: string;
}) {
  if (!topClientes?.length) return null;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-1 mb-1">
          <Star className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs font-medium text-foreground flex-1">Top 10 Clientes por Valor</p>
          <InfoPopover
            title="Top 10 clientes por valor gasto"
            description={`Os 10 clientes que mais gastaram ${contextLabel} no período, ordenados por valor total. A coluna Status mostra a saúde do relacionamento e "Dias s/ vir" indica há quanto tempo não retornam. Cruze as duas informações para priorizar ações.`}
            example="Um cliente VIP com alto valor e 5 dias sem vir é o mais valioso e está engajado — mantenha a qualidade. Um cliente Em Risco com R$ 500+ merece resgate prioritário (mensagem personalizada, desconto). Clientes Perdidos com alto valor histórico são oportunidades de reconquista de alto impacto."
            periodLabel={`Período: ${periodLabel}`}
          />
          <InlineInsightToggle text={insightText} label={insightLabel} />
        </div>
        <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-2 truncate">Período: {periodLabel} • Ordenado por valor total</p>

        {/* Mobile: card list */}
        <div className="space-y-2 sm:hidden">
          {topClientes.map((c: any, i: number) => {
            const cfg = STATUS_CONFIG[c.status];
            return (
              <div key={c.cliente_id} className="flex flex-col gap-0.5 p-2 rounded-md bg-muted/20 border border-border/30">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] text-muted-foreground font-medium shrink-0">#{i + 1}</span>
                  <span className="text-xs font-medium text-foreground truncate flex-1">{c.cliente_nome}</span>
                  {cfg && (
                    <Badge className={`text-[9px] px-1.5 py-0 shrink-0 ${cfg.bgClass}`}>
                      {cfg.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{c.visitas} visitas</span>
                  <span>•</span>
                  <span>{c.dias_sem_vir}d sem vir</span>
                  <span className="ml-auto font-medium text-foreground">{fmtMoney(c.valor)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto -mx-4 px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] h-8 min-w-[90px]">Cliente</TableHead>
                <TableHead className="text-[10px] h-8 text-center">Status</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Visitas</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Valor</TableHead>
                <TableHead className="text-[10px] h-8 text-right hidden md:table-cell">Dias s/ vir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topClientes.map((c: any, i: number) => {
                const cfg = STATUS_CONFIG[c.status];
                return (
                  <TableRow key={c.cliente_id}>
                    <TableCell className="text-xs py-1.5 text-foreground font-medium max-w-[120px]">
                      <span className="text-[10px] text-muted-foreground mr-1">#{i + 1}</span>
                      <span className="truncate inline-block max-w-[100px] md:max-w-[160px] align-bottom">{c.cliente_nome}</span>
                    </TableCell>
                    <TableCell className="text-center py-1.5">
                      {cfg && (
                        <Badge className={`text-[9px] px-1.5 py-0 ${cfg.bgClass}`}>
                          {cfg.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right py-1.5 text-foreground">{c.visitas}</TableCell>
                    <TableCell className="text-xs text-right py-1.5 text-foreground font-medium">{fmtMoney(c.valor)}</TableCell>
                    <TableCell className="text-xs text-right py-1.5 text-foreground hidden md:table-cell">{c.dias_sem_vir}d</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

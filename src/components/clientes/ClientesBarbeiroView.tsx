// ============================================================
// FILE: src/components/clientes/ClientesBarbeiroView.tsx
// PROPÓSITO: Nível 2 — visão detalhada completa da carteira do barbeiro
// ============================================================

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ArrowLeft, Users, UserCheck, UsersRound, ChevronRight, ChevronDown, ChevronUp,
  UserPlus, Heart, TrendingUp, DollarSign, AlertTriangle, UserMinus, FileText,
  Clock, ShieldAlert, Eye, BarChart3, Star, Hash,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Line, ComposedChart, Legend,
} from 'recharts';
import type { CarteiraItem, UnicosTableItem, DrillModo, PeriodoInfo } from '@/hooks/useClientes';
import { fmtInt, fmtPct, fmtMoney, fmtMesAno, STATUS_CONFIG } from '@/hooks/useClientes';
import { InfoPopover } from './InfoPopover';
import { calcDiasSemVir } from '@/lib/diasSemVir';
import { SharedFrequenciaChart } from './ClientesSharedCharts';
import { gerarAnaliseBarbeiro, type BarbeiroDetalheData } from './ClientesRelatorioGenerator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface ClientesBarbeiroViewProps {
  barbeiroNome: string;
  carteira: CarteiraItem | null;
  unicos: UnicosTableItem | null;
  janela: number;
  periodo?: PeriodoInfo;
  onBack: () => void;
  onOpenDrilldown: (modo: DrillModo) => void;
  barbeiroDetalhe?: BarbeiroDetalheData | null;
  novosBarb?: any | null;
  onDrillFaixa?: (tipo: string, valor: string, label: string) => void;
}

// ---- Mini KPI Card ----
function MiniKpi({
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
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex-1 min-w-0">
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
        <div className="text-xl font-bold text-foreground">{value}</div>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-border/50 bg-popover p-2 shadow-md text-xs">
      <span className="font-medium text-foreground">{d.name}: {fmtInt(d.value)}</span>
    </div>
  );
}

function MultiTooltip({ active, payload, label }: any) {
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
function StatusBar({ distribuicao, total, periodLabel }: { distribuicao: any[]; total: number; periodLabel: string }) {
  if (!distribuicao?.length || total === 0) return null;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-1 mb-1">
          <p className="text-xs font-medium text-muted-foreground flex-1">Status da carteira</p>
          <InfoPopover
            title="Distribuição de status"
            description="Cada cliente é classificado pela cadência de visitas. Assíduo = frequência alta, vem antes do esperado. Regular = no ritmo normal. Espaçando = visitas mais distantes. Em Risco = ultrapassou a cadência esperada. Perdido = não retornou há muito tempo."
            example="70% Assíduo+Regular indica carteira saudável. >30% Em Risco+Perdido requer ação de resgate."
            periodLabel={`Período: ${periodLabel}`}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">Período: {periodLabel} • Clientes classificados pela cadência de visitas</p>
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
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {distribuicao.map((item) => {
            const cfg = STATUS_CONFIG[item.status];
            if (!cfg) return null;
            return (
              <div key={item.status} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: cfg.color }} />
                {cfg.label}: {fmtInt(item.count)} ({total > 0 ? ((item.count / total) * 100).toFixed(0) : 0}%)
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Retenção de Novos Mini (expandida) ----
function RetencaoNovosMini({ novosBarb, periodLabel }: { novosBarb: any; periodLabel: string }) {
  if (!novosBarb || novosBarb.novos === 0) return null;

  const ret30 = novosBarb.retencao_30d ?? 0;
  const ret60 = novosBarb.retencao_60d ?? 0;
  const naoRetornou = 100 - ret60;

  // Subdividir "não retornou" em 3 faixas
  // Usando dados granulares se disponíveis, senão estima proporcionalmente
  const pctAguardando = novosBarb.pct_aguardando ?? Math.min(naoRetornou, naoRetornou * 0.3);
  const pctNao30 = novosBarb.pct_nao_30d ?? Math.min(naoRetornou - pctAguardando, (naoRetornou - pctAguardando) * 0.4);
  const pctNao60 = Math.max(0, naoRetornou - pctAguardando - pctNao30);

  const segments = [
    { label: 'Retornou ≤30d', pct: ret30, color: 'hsl(142, 71%, 45%)' },
    { label: 'Retornou 31-60d', pct: Math.max(0, ret60 - ret30), color: 'hsl(217, 91%, 60%)' },
    { label: 'Aguardando (≤30d)', pct: pctAguardando, color: 'hsl(45, 93%, 47%)' },
    { label: 'Não retornou >30d', pct: pctNao30, color: 'hsl(25, 95%, 53%)' },
    { label: 'Não retornou >60d', pct: pctNao60, color: 'hsl(0, 84%, 60%)' },
  ].filter(s => s.pct > 0.5);

  let interpretacao = '';
  if (ret30 >= 35) interpretacao = '✅ Excelente retenção de novos — acima do benchmark (30-35%).';
  else if (ret30 >= 25) interpretacao = '📊 Retenção de novos dentro da média de mercado.';
  else interpretacao = '⚠️ Retenção abaixo do ideal — investigar experiência do primeiro atendimento.';

  if (pctNao60 > 30) {
    interpretacao += ` 🚨 ${pctNao60.toFixed(0)}% dos novos não retornaram há mais de 60 dias — provavelmente perdidos.`;
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-1 mb-1">
          <TrendingUp className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs font-medium text-foreground flex-1">Retenção de Novos Captados</p>
          <InfoPopover
            title="Retenção de novos do barbeiro"
            description="Mostra como os clientes novos captados por este barbeiro se comportam após a primeira visita: quantos retornaram em 30 e 60 dias, e quantos não voltaram — subdividido em aguardando (≤30d desde 1ª visita), não retornou >30d e não retornou >60d."
            example="Se 35% retornaram em 30 dias, está acima do benchmark de mercado (30-35%). Abaixo de 25% requer atenção."
            periodLabel={`Período: ${periodLabel}`}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">Período: {periodLabel} • Análise do comportamento pós-primeira visita</p>

        {/* KPIs row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{novosBarb.novos}</p>
            <p className="text-[10px] text-muted-foreground">Novos captados</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{ret30.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">Ret. 30d</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{ret60.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">Ret. 60d</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{(novosBarb.pct_fieis ?? 0).toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">% Fiéis</p>
          </div>
        </div>

        {/* Bar segmentada */}
        <div className="flex w-full h-6 rounded-md overflow-hidden mb-2">
          {segments.map((s, i) => (
            <div
              key={i}
              className="h-full flex items-center justify-center"
              style={{ width: `${s.pct}%`, backgroundColor: s.color, minWidth: s.pct > 0 ? '2px' : 0 }}
              title={`${s.label}: ${s.pct.toFixed(0)}%`}
            >
              {s.pct >= 10 && (
                <span className="text-[9px] font-bold text-white drop-shadow-sm">{s.pct.toFixed(0)}%</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
              {s.label}: {s.pct.toFixed(0)}%
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{interpretacao}</p>

        {novosBarb.ticket_medio_novo > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Ticket médio do novo: {fmtMoney(novosBarb.ticket_medio_novo)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Composição da Carteira (Horizontal bar) ----
function ComposicaoCarteira({
  barbeiroDetalhe, carteira, barbeiroNome, periodLabel,
}: {
  barbeiroDetalhe: BarbeiroDetalheData;
  carteira: CarteiraItem | null;
  barbeiroNome: string;
  periodLabel: string;
}) {
  const dist = barbeiroDetalhe.status_distribuicao ?? [];
  const total = barbeiroDetalhe.total_clientes;
  const freqDist = (barbeiroDetalhe as any).frequencia_dist ?? [];
  const soUmaVez = freqDist.find((f: any) => f.faixa === '1 vez')?.count ?? 0;

  const statusData = dist
    .filter(d => STATUS_CONFIG[d.status])
    .map(d => ({
      name: STATUS_CONFIG[d.status].label,
      value: d.count,
      color: STATUS_CONFIG[d.status].color,
      pct: total > 0 ? ((d.count / total) * 100).toFixed(0) : '0',
    }))
    .sort((a, b) => b.value - a.value);

  // Donut de fidelização
  const donutData = [
    { name: 'Exclusivos', value: carteira?.unicos_exclusivos ?? 0, color: 'hsl(var(--primary))' },
    { name: 'Compartilhados', value: carteira?.unicos_compartilhados ?? 0, color: 'hsl(217, 91%, 60%)' },
    { name: 'Fiéis (3+)', value: barbeiroDetalhe.fieis, color: 'hsl(142, 71%, 45%)' },
    { name: 'Só 1 vez', value: soUmaVez, color: 'hsl(0, 84%, 60%)' },
  ].filter(d => d.value > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Composição por Status */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-1 mb-1">
            <BarChart3 className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs font-medium text-foreground flex-1">Composição por Status</p>
            <InfoPopover
              title="Composição da carteira por status"
            description="Assíduo = frequência alta, vem antes do esperado. Regular = no ritmo normal. Espaçando = visitas mais distantes. Em Risco = ultrapassou a cadência. Perdido = sem retorno há muito tempo. Novos = primeira visita no período. Fiéis = 3+ visitas exclusivas."
            example="Se Assíduo mostra 155 (40%), significa que 155 clientes (40% do total) mantêm frequência alta e regular com este barbeiro no período."
              periodLabel={`Período: ${periodLabel}`}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">Período: {periodLabel} • Barras proporcionais ao total de clientes</p>
          <div className="space-y-2">
            {statusData.map((item) => (
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
            {/* Extras */}
            {[
              { name: 'Novos', value: barbeiroDetalhe.novos_no_periodo, color: 'hsl(280, 70%, 60%)' },
              { name: 'Só 1 vez', value: soUmaVez, color: 'hsl(0, 60%, 50%)' },
              { name: 'Fiéis (3+ excl.)', value: barbeiroDetalhe.fieis, color: 'hsl(142, 60%, 40%)' },
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

      {/* Donut de Fidelização */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-1 mb-1">
            <Heart className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs font-medium text-foreground flex-1">Fidelização</p>
            <InfoPopover
              title="Perfil de fidelização"
              description="Exclusivos = só vieram com este barbeiro no período. Compartilhados = foram atendidos por outros barbeiros também. Fiéis = 3+ visitas exclusivas com este barbeiro. Só 1 vez = vieram apenas uma vez — precisam de follow-up."
              example="Se o donut mostra 60% Exclusivos e 25% Fiéis, indica boa retenção. Muitos 'Só 1 vez' sugere que novos não estão retornando."
              periodLabel={`Período: ${periodLabel}`}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">Período: {periodLabel} • Segmentação por vínculo com o barbeiro</p>
          {donutData.length > 0 && (
            <>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    {d.name}: {fmtInt(d.value)}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// FrequenciaChart removed — now uses SharedFrequenciaChart from ClientesSharedCharts

// ---- Evolução Mensal ----
function EvolucaoMensalChart({ evolucao, periodLabel }: { evolucao: any[]; periodLabel: string }) {
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
        <div className="flex items-center gap-1 mb-1">
          <TrendingUp className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs font-medium text-foreground flex-1">Evolução Mensal</p>
          <InfoPopover
            title="Evolução mensal do barbeiro"
            description="Barras azuis = clientes únicos atendidos no mês. Barras roxas = novos captados (primeira visita). Linha verde = faturamento total. Permite identificar tendências de crescimento ou queda ao longo do tempo."
            example="Se as barras azuis estão subindo e as roxas estáveis, o barbeiro está retendo melhor. Se a linha verde sobe mais que as barras, o ticket médio está aumentando."
            periodLabel={`Período: ${periodLabel}`}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">Período: {periodLabel} • Barras = clientes/novos | Linha = faturamento</p>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <Tooltip content={<MultiTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
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
function TopClientesTable({ topClientes, barbeiroNome, periodLabel }: { topClientes: any[]; barbeiroNome: string; periodLabel: string }) {
  if (!topClientes?.length) return null;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-1 mb-1">
          <Star className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs font-medium text-foreground flex-1">Top 10 Clientes por Valor</p>
          <InfoPopover
            title="Clientes mais valiosos"
            description={`Os 10 clientes que mais gastaram com ${barbeiroNome} no período, ordenados por valor total. Inclui status de fidelidade, número de visitas e quantos dias desde a última visita.`}
            example="Um cliente VIP com alto valor e poucos dias sem vir é o mais valioso. Um cliente Em Risco com alto valor merece ação de resgate prioritária."
            periodLabel={`Período: ${periodLabel}`}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">Período: {periodLabel} • Ordenado por valor total gasto</p>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] h-8">Cliente</TableHead>
                <TableHead className="text-[10px] h-8 text-center">Status</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Visitas</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Valor</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Dias s/ vir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topClientes.map((c: any, i: number) => {
                const cfg = STATUS_CONFIG[c.status];
                return (
                  <TableRow key={c.cliente_id}>
                    <TableCell className="text-xs py-1.5 text-foreground font-medium">
                      <span className="text-[10px] text-muted-foreground mr-1">#{i + 1}</span>
                      {c.cliente_nome}
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
                    <TableCell className="text-xs text-right py-1.5 text-foreground">{calcDiasSemVir(c.ultima_visita, c.dias_sem_vir)}d</TableCell>
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

// ---- Main Component ----
export function ClientesBarbeiroView({
  barbeiroNome, carteira, unicos, janela, periodo,
  onBack, onOpenDrilldown, onDrillFaixa,
  barbeiroDetalhe, novosBarb,
}: ClientesBarbeiroViewProps) {
  const [showAnalise, setShowAnalise] = useState(false);

  const periodLabel = periodo
    ? `${periodo.atual.de} – ${periodo.atual.ate}`
    : `${janela}d`;

  // Extract status counts
  const statusCounts = useMemo(() => {
    if (!barbeiroDetalhe?.status_distribuicao) return { perdido: 0, emRisco: 0, ativoLeve: 0 };
    const dist = barbeiroDetalhe.status_distribuicao;
    return {
      perdido: dist.find((d: any) => d.status === 'PERDIDO')?.count ?? 0,
      emRisco: dist.find((d: any) => d.status === 'EM_RISCO')?.count ?? 0,
      ativoLeve: dist.find((d: any) => d.status === 'ATIVO_LEVE')?.count ?? 0,
    };
  }, [barbeiroDetalhe]);

  const pctExclusividade = carteira && carteira.unicos_total > 0
    ? ((carteira.unicos_exclusivos / carteira.unicos_total) * 100).toFixed(0)
    : '0';

  // Derived data
  const freqDist = (barbeiroDetalhe as any)?.frequencia_dist ?? [];
  const evolucao = (barbeiroDetalhe as any)?.evolucao_mensal ?? [];
  const topClientes = (barbeiroDetalhe as any)?.top_clientes_valor ?? [];
  const soUmaVez = freqDist.find((f: any) => f.faixa === '1 vez')?.count ?? 0;

  const analise = useMemo(() => {
    if (!barbeiroDetalhe) return [];
    return gerarAnaliseBarbeiro({
      nome: barbeiroNome,
      detalhe: barbeiroDetalhe,
      carteira,
      novosBarb,
    });
  }, [barbeiroDetalhe, barbeiroNome, carteira, novosBarb]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground truncate">
            {barbeiroNome}
          </h2>
          <p className="text-xs text-muted-foreground">
            Detalhes da carteira • {periodLabel}
          </p>
        </div>
      </div>

      {/* KPI Cards Row 1 — Carteira base */}
      <div className="grid grid-cols-3 gap-3">
        <MiniKpi
          icon={Users} label="Total" value={fmtInt(carteira?.unicos_total)}
          sub={unicos ? `Δ ${fmtPct(unicos.delta_pct)}` : undefined}
          info={{ title: 'Total de clientes únicos', description: 'Todos os clientes distintos atendidos por este barbeiro no período.', periodLabel }}
        />
        <MiniKpi
          icon={UserCheck} label="Exclusivos" value={fmtInt(carteira?.unicos_exclusivos)}
          info={{ title: 'Clientes exclusivos', description: 'Clientes atendidos SOMENTE por este barbeiro no período.', periodLabel }}
        />
        <MiniKpi
          icon={UsersRound} label="Compartilhados" value={fmtInt(carteira?.unicos_compartilhados)}
          sub={carteira ? `${fmtPct(carteira.pct_compartilhados)} do total` : undefined}
          info={{ title: 'Clientes compartilhados', description: 'Clientes também atendidos por outros barbeiros no período.', periodLabel }}
        />
      </div>

      {/* KPI Cards Row 2 — Performance */}
      {barbeiroDetalhe && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <MiniKpi
            icon={UserPlus} label="Novos" value={fmtInt(barbeiroDetalhe.novos_no_periodo)}
            info={{ title: 'Clientes novos captados', description: 'Clientes cuja primeira visita histórica ocorreu no período.', periodLabel }}
          />
          <MiniKpi
            icon={Heart} label="Fiéis" value={fmtInt(barbeiroDetalhe.fieis)}
            sub={barbeiroDetalhe.total_clientes > 0 ? `${((barbeiroDetalhe.fieis / barbeiroDetalhe.total_clientes) * 100).toFixed(0)}%` : undefined}
            info={{ title: 'Clientes fiéis', description: 'Clientes com 3+ visitas exclusivas com este barbeiro.', periodLabel }}
          />
          <MiniKpi
            icon={TrendingUp} label="Retenção 30d" value={`${barbeiroDetalhe.retencao_30d.toFixed(0)}%`}
            sub={barbeiroDetalhe.retencao_30d >= 35 ? '✓ Acima' : barbeiroDetalhe.retencao_30d >= 25 ? 'Na média' : '⚠️ Abaixo'}
            info={{ title: 'Retenção de novos em 30 dias', description: 'Benchmark: 30-35% é bom.', periodLabel }}
          />
          <MiniKpi
            icon={DollarSign} label="Ticket Médio" value={fmtMoney(barbeiroDetalhe.valor_medio_cliente)}
            info={{ title: 'Ticket médio por cliente', description: 'Valor médio gasto por cada cliente com este barbeiro.', periodLabel }}
          />
          <MiniKpi
            icon={DollarSign} label="Valor Total" value={fmtMoney((carteira?.unicos_total ?? 0) * (barbeiroDetalhe.valor_medio_cliente ?? 0))}
            info={{ title: 'Faturamento total estimado', description: 'Total aproximado gerado pela carteira.', periodLabel }}
          />
        </div>
      )}

      {/* KPI Cards Row 3 — Alertas */}
      {barbeiroDetalhe && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <MiniKpi
            icon={UserMinus} label="Perdidos" value={fmtInt(statusCounts.perdido)}
            accent="text-destructive"
            sub={barbeiroDetalhe.total_clientes > 0 ? `${((statusCounts.perdido / barbeiroDetalhe.total_clientes) * 100).toFixed(0)}%` : undefined}
            info={{ title: 'Clientes perdidos', description: 'Não retornaram há muito tempo.', periodLabel }}
          />
          <MiniKpi
            icon={ShieldAlert} label="Em Risco" value={fmtInt(statusCounts.emRisco)}
            accent="text-warning"
            sub={barbeiroDetalhe.total_clientes > 0 ? `${((statusCounts.emRisco / barbeiroDetalhe.total_clientes) * 100).toFixed(0)}%` : undefined}
            info={{ title: 'Clientes em risco', description: 'Espaçando visitas além do normal.', periodLabel }}
          />
          <MiniKpi
            icon={Clock} label="Aguardando" value={fmtInt(statusCounts.ativoLeve)}
            accent="text-yellow-500"
            sub="Retorno espaçando"
            info={{ title: 'Aguardando retorno', description: 'Clientes ATIVO_LEVE — grupo estratégico para ações preventivas.', periodLabel }}
          />
          <MiniKpi
            icon={UserCheck} label="% Exclusividade" value={`${pctExclusividade}%`}
            sub={parseInt(pctExclusividade) >= 70 ? '✓ Alta' : parseInt(pctExclusividade) >= 50 ? 'Moderada' : '⚠️ Baixa'}
            info={{ title: 'Taxa de exclusividade', description: 'Acima de 70% = excelente.', periodLabel }}
          />
          <MiniKpi
            icon={Eye} label="Só 1 vez" value={fmtInt(soUmaVez)}
            accent="text-destructive"
            sub={barbeiroDetalhe.total_clientes > 0 ? `${((soUmaVez / barbeiroDetalhe.total_clientes) * 100).toFixed(0)}%` : undefined}
            info={{ title: 'Vieram só 1 vez', description: 'Clientes com apenas 1 visita — precisam de follow-up.', periodLabel }}
          />
        </div>
      )}

      {/* Status Bar */}
      {barbeiroDetalhe?.status_distribuicao && (
        <StatusBar distribuicao={barbeiroDetalhe.status_distribuicao} total={barbeiroDetalhe.total_clientes} periodLabel={periodLabel} />
      )}

      {/* Perdidos + Aguardando Card */}
      {barbeiroDetalhe && (statusCounts.perdido > 0 || statusCounts.emRisco > 0 || statusCounts.ativoLeve > 0) && (
        <Card className="border-border/50 border-l-4 border-l-destructive/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs font-medium text-foreground flex-1">Análise de Perdidos e Atenção</p>
              <InfoPopover
                title="Análise de perdidos e atenção"
                description="Mostra clientes que saíram da barbearia (não voltaram a nenhum barbeiro) vs. os que migraram para outro barbeiro internamente. Também destaca clientes Em Risco e Aguardando que precisam de ação preventiva."
                example="Se 'Migraram' > 'Saíram', o problema pode ser de agenda. Se 'Saíram' é alto, pode ser insatisfação ou concorrência externa."
                periodLabel={`Período: ${periodLabel}`}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">Período: {periodLabel} • Clientes que não retornaram ou estão espaçando visitas</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div
                className="space-y-1 cursor-pointer rounded-md p-2 -m-2 transition-colors hover:bg-muted/50"
                onClick={() => onDrillFaixa?.('STATUS', 'PERDIDO', `Perdidos — Saíram da barbearia — ${barbeiroNome}`)}
              >
                <div className="flex items-center gap-1.5">
                  <UserMinus className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-medium text-foreground">Saíram da barbearia</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
                </div>
                <p className="text-2xl font-bold text-destructive">{fmtInt(barbeiroDetalhe.perdidos_barbearia)}</p>
                <p className="text-[10px] text-muted-foreground">Não voltaram a nenhum barbeiro</p>
              </div>
              <div
                className="space-y-1 cursor-pointer rounded-md p-2 -m-2 transition-colors hover:bg-muted/50"
                onClick={() => onDrillFaixa?.('STATUS', 'PERDIDO', `Perdidos — Migraram — ${barbeiroNome}`)}
              >
                <div className="flex items-center gap-1.5">
                  <UsersRound className="h-3.5 w-3.5 text-warning" />
                  <span className="text-xs font-medium text-foreground">Migraram</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
                </div>
                <p className="text-2xl font-bold text-warning">{fmtInt(barbeiroDetalhe.perdidos_para_outro)}</p>
                <p className="text-[10px] text-muted-foreground">Última visita com outro barbeiro</p>
              </div>
              <div
                className="space-y-1 cursor-pointer rounded-md p-2 -m-2 transition-colors hover:bg-muted/50"
                onClick={() => onDrillFaixa?.('STATUS', 'EM_RISCO', `Em Risco — ${barbeiroNome}`)}
              >
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs font-medium text-foreground">Em Risco</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
                </div>
                <p className="text-2xl font-bold text-foreground">{fmtInt(statusCounts.emRisco)}</p>
                <p className="text-[10px] text-muted-foreground">Espaçando além do normal</p>
              </div>
              <div
                className="space-y-1 cursor-pointer rounded-md p-2 -m-2 transition-colors hover:bg-muted/50"
                onClick={() => onDrillFaixa?.('STATUS', 'ATIVO_LEVE', `Espaçando — ${barbeiroNome}`)}
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-yellow-500" />
                  <span className="text-xs font-medium text-foreground">Aguardando</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
                </div>
                <p className="text-2xl font-bold text-foreground">{fmtInt(statusCounts.ativoLeve)}</p>
                <p className="text-[10px] text-muted-foreground">Visitas espaçando levemente</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border/30 space-y-1">
              {barbeiroDetalhe.perdidos_para_outro > barbeiroDetalhe.perdidos_barbearia && barbeiroDetalhe.perdidos_para_outro > 0 && (
                <p className="text-xs text-muted-foreground">
                  ⚠️ Maioria dos perdidos migrou internamente ({fmtInt(barbeiroDetalhe.perdidos_para_outro)} vs {fmtInt(barbeiroDetalhe.perdidos_barbearia)}) — avaliar disponibilidade de agenda.
                </p>
              )}
              {barbeiroDetalhe.perdidos_barbearia > barbeiroDetalhe.perdidos_para_outro && barbeiroDetalhe.perdidos_barbearia > 0 && (
                <p className="text-xs text-muted-foreground">
                  🚨 Maioria saiu da barbearia ({fmtInt(barbeiroDetalhe.perdidos_barbearia)}) — pode ser externo ou insatisfação geral.
                </p>
              )}
              {statusCounts.emRisco > 5 && (
                <p className="text-xs text-muted-foreground">
                  🟠 {fmtInt(statusCounts.emRisco)} em risco — enviar lembrete de agendamento via WhatsApp.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Retenção de Novos */}
      <RetencaoNovosMini novosBarb={novosBarb} periodLabel={periodLabel} />

      {/* Composição da Carteira + Fidelização */}
      {barbeiroDetalhe && (
        <ComposicaoCarteira barbeiroDetalhe={barbeiroDetalhe} carteira={carteira} barbeiroNome={barbeiroNome} periodLabel={periodLabel} />
      )}

      {/* Frequência de Visitas */}
      {freqDist.length > 0 && (
        <SharedFrequenciaChart freqDist={freqDist} total={barbeiroDetalhe?.total_clientes ?? 0} periodLabel={periodLabel} />
      )}

      {/* Evolução Mensal */}
      {evolucao.length > 0 && (
        <EvolucaoMensalChart evolucao={evolucao} periodLabel={periodLabel} />
      )}

      {/* Top 10 Clientes */}
      {topClientes.length > 0 && (
        <TopClientesTable topClientes={topClientes} barbeiroNome={barbeiroNome} periodLabel={periodLabel} />
      )}

      {/* Drill Buttons */}
      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Explorar clientes</p>
          <p className="text-[10px] text-muted-foreground mb-1">Clique para ver a lista detalhada • {periodLabel}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" className="justify-between h-11 text-sm" onClick={() => onOpenDrilldown('COMPARTILHADOS')}>
              <span className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-info" />
                <span className="text-foreground">Compartilhados</span>
                <Badge variant="secondary" className="text-[10px]">{fmtInt(carteira?.unicos_compartilhados)}</Badge>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="outline" className="justify-between h-11 text-sm" onClick={() => onOpenDrilldown('EXCLUSIVOS')}>
              <span className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                <span className="text-foreground">Exclusivos</span>
                <Badge variant="secondary" className="text-[10px]">{fmtInt(carteira?.unicos_exclusivos)}</Badge>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
            {statusCounts.perdido > 0 && onDrillFaixa && (
              <Button
                variant="outline"
                className="justify-between h-11 text-sm border-destructive/30"
                onClick={() => onDrillFaixa('STATUS', 'PERDIDO', `Perdidos — ${barbeiroNome}`)}
              >
                <span className="flex items-center gap-2">
                  <UserMinus className="h-4 w-4 text-destructive" />
                  <span className="text-foreground">Perdidos</span>
                  <Badge variant="destructive" className="text-[10px]">{fmtInt(statusCounts.perdido)}</Badge>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            {statusCounts.emRisco > 0 && onDrillFaixa && (
              <Button
                variant="outline"
                className="justify-between h-11 text-sm border-warning/30"
                onClick={() => onDrillFaixa('STATUS', 'EM_RISCO', `Em Risco — ${barbeiroNome}`)}
              >
                <span className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-warning" />
                  <span className="text-foreground">Em risco</span>
                  <Badge variant="secondary" className="text-[10px]">{fmtInt(statusCounts.emRisco)}</Badge>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            {statusCounts.ativoLeve > 0 && onDrillFaixa && (
              <Button
                variant="outline"
                className="justify-between h-11 text-sm border-yellow-500/30"
                onClick={() => onDrillFaixa('STATUS', 'ATIVO_LEVE', `Aguardando — ${barbeiroNome}`)}
              >
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-foreground">Aguardando</span>
                  <Badge variant="secondary" className="text-[10px]">{fmtInt(statusCounts.ativoLeve)}</Badge>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            {soUmaVez > 0 && onDrillFaixa && (
              <Button
                variant="outline"
                className="justify-between h-11 text-sm border-destructive/20"
                onClick={() => onDrillFaixa('FREQUENCIA', '1', `Só 1 vez — ${barbeiroNome}`)}
              >
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-destructive" />
                  <span className="text-foreground">Só 1 vez</span>
                  <Badge variant="secondary" className="text-[10px]">{fmtInt(soUmaVez)}</Badge>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            {barbeiroDetalhe && barbeiroDetalhe.fieis > 0 && onDrillFaixa && (
              <Button
                variant="outline"
                className="justify-between h-11 text-sm"
                onClick={() => onDrillFaixa('FREQUENCIA', '3+excl', `Fiéis — ${barbeiroNome}`)}
              >
                <span className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" />
                  <span className="text-foreground">Fiéis</span>
                  <Badge variant="secondary" className="text-[10px]">{fmtInt(barbeiroDetalhe.fieis)}</Badge>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Relatório Analítico */}
      {analise.length > 0 && (
        <Collapsible open={showAnalise} onOpenChange={setShowAnalise}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between h-10 text-sm">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-foreground">{showAnalise ? 'Ocultar relatório analítico' : 'Ver relatório analítico completo'}</span>
              </span>
              {showAnalise ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-3 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-1 mb-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Relatório Analítico — {barbeiroNome}</p>
                </div>
                <div className="space-y-2">
                  {analise.map((line, i) => (
                    <p key={i} className={`text-xs leading-relaxed ${line.startsWith('📌') ? 'font-semibold text-foreground mt-3' : line === '' ? '' : 'text-muted-foreground'}`}>
                      {line}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

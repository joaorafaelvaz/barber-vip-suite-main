// ============================================================
// FILE: src/components/relatorios/SemanalPainelExecutivo.tsx
// PROPÓSITO: Painel executivo da semana corrente vs anterior
// ============================================================

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Eye, EyeOff, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';
import type { SemanaData } from '@/types/relatorio-semanal';

// ── Props ──────────────────────────────────────────────────
interface Props {
  semanas: SemanaData[];
  medias: {
    faturamento: number;
    atendimentos: number;
    ticket_medio: number;
    extras_qtd: number;
  };
  open: boolean;
  onToggle: (v: boolean) => void;
}

// ── Helpers ────────────────────────────────────────────────
function fmt(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(v);
}

function fmtN(v: number, decimals = 1): string {
  return v.toFixed(decimals).replace('.', ',');
}

function delta(atual: number, anterior: number) {
  const diff = atual - anterior;
  const pct = anterior !== 0 ? (diff / anterior) * 100 : atual !== 0 ? 100 : 0;
  return { diff, pct };
}

function deltaColor(diff: number): string {
  if (diff > 0) return 'text-emerald-400';
  if (diff < 0) return 'text-red-400';
  return 'text-muted-foreground';
}

function deltaIcon(diff: number) {
  if (diff > 0) return <TrendingUp className="h-3.5 w-3.5 inline" />;
  if (diff < 0) return <TrendingDown className="h-3.5 w-3.5 inline" />;
  return <Minus className="h-3.5 w-3.5 inline" />;
}

function deltaStr(diff: number, isCurrency: boolean): string {
  const sign = diff > 0 ? '+' : '';
  return isCurrency ? `${sign}${fmt(diff)}` : `${sign}${fmtN(diff, 0)}`;
}

function media8(semanas: SemanaData[], key: keyof SemanaData): number {
  const slice = semanas.slice(-8);
  if (slice.length === 0) return 0;
  const sum = slice.reduce((a, s) => a + (Number(s[key]) || 0), 0);
  return sum / slice.length;
}

// ── Análise automática ─────────────────────────────────────
function gerarAnalise(
  atual: SemanaData | null,
  anterior: SemanaData | null,
  med8Ticket: number,
  med8Atend: number
): string[] {
  if (!atual) return ['Sem dados para análise.'];
  const bullets: string[] = [];

  // Comissão
  if (atual.comissao > 0) {
    if (anterior && anterior.comissao > 0) {
      const d = delta(atual.comissao, anterior.comissao);
      bullets.push(
        `Comissão: ${fmt(atual.comissao)} ${d.pct > 3 ? `↗ +${fmtN(d.pct,0)}% vs anterior` : d.pct < -3 ? `↘ ${fmtN(d.pct,0)}% vs anterior` : '(estável)'}`
      );
    } else {
      bullets.push(`Comissão: ${fmt(atual.comissao)}`);
    }
  }

  // Extras
  if (anterior) {
    const d = delta(atual.extras_qtd, anterior.extras_qtd);
    if (Math.abs(d.pct) > 10) {
      bullets.push(
        `Extras: ${d.pct > 0 ? 'alta' : 'queda'} de ${fmtN(Math.abs(d.pct), 0)}% vs anterior (${atual.extras_qtd} vs ${anterior.extras_qtd})`
      );
    } else if (Math.abs(d.pct) <= 3) {
      bullets.push(`Extras: estável em ${atual.extras_qtd} unidades`);
    } else {
      bullets.push(
        `Extras: variação moderada de ${d.pct > 0 ? '+' : ''}${fmtN(d.pct, 0)}% (${atual.extras_qtd} vs ${anterior.extras_qtd})`
      );
    }
  } else {
    bullets.push(`Extras: ${atual.extras_qtd} unidades (sem semana anterior para comparação)`);
  }

  // Ticket
  if (anterior) {
    const d = delta(atual.ticket_medio, anterior.ticket_medio);
    const vsMedia = med8Ticket > 0 ? ((atual.ticket_medio - med8Ticket) / med8Ticket) * 100 : 0;
    const mediaRef = med8Ticket > 0 ? `, média 8 sem. ${fmt(med8Ticket)}` : '';
    if (Math.abs(d.pct) <= 3) {
      bullets.push(`Ticket Médio: estável em ${fmt(atual.ticket_medio)}${mediaRef}`);
    } else {
      bullets.push(
        `Ticket Médio: ${d.pct > 0 ? 'alta' : 'queda'} de ${fmtN(Math.abs(d.pct), 1)}% para ${fmt(atual.ticket_medio)}${mediaRef}`
      );
    }
  } else {
    bullets.push(`Ticket Médio: ${fmt(atual.ticket_medio)}`);
  }

  // Clientes
  if (anterior) {
    const d = delta(atual.atendimentos, anterior.atendimentos);
    if (Math.abs(d.pct) <= 3) {
      bullets.push(`Clientes: estável em ${atual.atendimentos} atendimentos`);
    } else {
      bullets.push(
        `Clientes: ${d.pct > 0 ? 'crescimento' : 'queda'} de ${fmtN(Math.abs(d.pct), 0)}% (${atual.atendimentos} vs ${anterior.atendimentos})`
      );
    }
  } else {
    bullets.push(`Clientes: ${atual.atendimentos} atendimentos`);
  }

  // Relação
  if (anterior) {
    const dFat = delta(atual.faturamento, anterior.faturamento);
    const dAtend = delta(atual.atendimentos, anterior.atendimentos);
    if (dFat.pct > 5 && dAtend.pct > 5) {
      bullets.push('Relação: faturamento e volume crescendo juntos — semana positiva');
    } else if (dFat.pct > 5 && dAtend.pct < -3) {
      bullets.push('Relação: faturamento subiu com menos atendimentos — ticket maior compensou');
    } else if (dFat.pct < -5 && dAtend.pct > 5) {
      bullets.push('Relação: mais atendimentos com menor faturamento — ticket caiu');
    } else if (dFat.pct < -5 && dAtend.pct < -5) {
      bullets.push('Relação: queda em faturamento e volume — atenção redobrada');
    } else {
      bullets.push('Relação: indicadores dentro da normalidade');
    }
  }

  return bullets;
}

// ── Bloco de indicador ─────────────────────────────────────
function IndicatorRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm ${className || ''}`}>
      <span className="text-muted-foreground text-xs shrink-0">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

function DeltaInline({ diff, pct, isCurrency }: { diff: number; pct: number; isCurrency: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${deltaColor(diff)}`}>
      {deltaIcon(diff)} Δ {deltaStr(diff, isCurrency)}{' '}
      <span className="opacity-70">({diff > 0 ? '+' : ''}{fmtN(pct, 1)}%)</span>
    </span>
  );
}

// ── Componente Principal ───────────────────────────────────
export function SemanalPainelExecutivo({ semanas, medias, open, onToggle }: Props) {
  if (semanas.length === 0) return null;

  const atual = semanas[semanas.length - 1];
  const anterior = semanas.length >= 2 ? semanas[semanas.length - 2] : null;

  const med8Ticket = media8(semanas, 'ticket_medio');
  const med8Atend = media8(semanas, 'atendimentos');
  const med8Extras = media8(semanas, 'extras_qtd');

  const pctExtrasAtual = atual.servicos_totais > 0 ? (atual.extras_qtd / atual.servicos_totais) * 100 : 0;
  const pctExtrasAnt = anterior && anterior.servicos_totais > 0
    ? (anterior.extras_qtd / anterior.servicos_totais) * 100 : null;

  const analise = gerarAnalise(atual, anterior, med8Ticket, med8Atend);

  const dComissao = anterior ? delta(atual.comissao, anterior.comissao) : null;
  const dExtrasQtd = anterior ? delta(atual.extras_qtd, anterior.extras_qtd) : null;
  const dExtrasVal = anterior ? delta(atual.extras_valor, anterior.extras_valor) : null;
  const dTicket = anterior ? delta(atual.ticket_medio, anterior.ticket_medio) : null;
  const dAtend = anterior ? delta(atual.atendimentos, anterior.atendimentos) : null;

  return (
    <Card className="bg-card/60 border-border/40 backdrop-blur-sm overflow-hidden">
      <Collapsible open={open} onOpenChange={onToggle}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-foreground">
              📊 Painel da Semana
            </h3>
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
              Sem. {atual.semana_numero} ({format(atual.data_inicio, 'dd/MM')} – {format(atual.data_fim, 'dd/MM')})
              {atual.parcial && ' · Parcial'}
            </Badge>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              {open ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <CardContent className="px-4 pt-0 pb-5 sm:px-5 space-y-4">
            {/* ─── COMISSÃO ─── */}
            <section className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                Comissão
              </h4>
              {atual.comissao > 0 ? (
                <>
                  <IndicatorRow label="Total:" value={
                    <span className="text-amber-400 font-semibold">{fmt(atual.comissao)}</span>
                  } />
                  {anterior && dComissao && (
                    <IndicatorRow
                      label="Anterior:"
                      value={
                        <>
                          {fmt(anterior.comissao)}{' '}
                          <DeltaInline diff={dComissao.diff} pct={dComissao.pct} isCurrency />
                        </>
                      }
                    />
                  )}
                  <IndicatorRow
                    label="Média/dia:"
                    value={
                      <>
                        {fmt(atual.dias_na_semana > 0 ? atual.comissao / atual.dias_na_semana : 0)}{' '}
                        <span className="text-muted-foreground text-[10px]">({atual.dias_na_semana} dias)</span>
                      </>
                    }
                  />
                  {atual.bonus > 0 && (
                    <IndicatorRow label="Bônus:" value={
                      <span className="text-emerald-400 font-semibold">{fmt(atual.bonus)}</span>
                    } />
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Sem regras de comissão configuradas para este período.</p>
              )}
            </section>

            <Separator className="bg-border/30" />

            {/* ─── SERVIÇOS EXTRAS ─── */}
            <section className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400/90 flex items-center gap-1.5">
                ✂️ Serviços Extras
              </h4>
              <IndicatorRow
                label="Qtd:"
                value={
                  <>
                    {atual.extras_qtd}
                    {anterior && dExtrasQtd && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        Anterior: {anterior.extras_qtd}{' '}
                        <span className={deltaColor(dExtrasQtd.diff)}>
                          (Δ {deltaStr(dExtrasQtd.diff, false)})
                        </span>
                      </span>
                    )}
                  </>
                }
              />
              <IndicatorRow
                label="Valor:"
                value={
                  <>
                    {fmt(atual.extras_valor)}
                    {anterior && dExtrasVal && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        Anterior: {fmt(anterior.extras_valor)}{' '}
                        <DeltaInline diff={dExtrasVal.diff} pct={dExtrasVal.pct} isCurrency />
                      </span>
                    )}
                  </>
                }
              />
              <IndicatorRow
                label="Média/dia:"
                value={
                  <>
                    {fmt(atual.dias_na_semana > 0 ? atual.extras_valor / atual.dias_na_semana : 0)}{' '}
                    <span className="text-muted-foreground text-[10px]">({atual.dias_na_semana} dias)</span>
                  </>
                }
              />
              <IndicatorRow
                label="% extras:"
                value={
                  <>
                    {fmtN(pctExtrasAtual, 1)}%
                    {pctExtrasAnt !== null && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        Anterior: {fmtN(pctExtrasAnt, 1)}%{' '}
                        <span className={deltaColor(pctExtrasAtual - pctExtrasAnt)}>
                          (Δ {(pctExtrasAtual - pctExtrasAnt) > 0 ? '+' : ''}{fmtN(pctExtrasAtual - pctExtrasAnt, 1)} p.p.)
                        </span>
                      </span>
                    )}
                  </>
                }
              />
            </section>

            <Separator className="bg-border/30" />

            {/* ─── TICKET MÉDIO ─── */}
            <section className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400/90 flex items-center gap-1.5">
                🎟️ Ticket Médio
              </h4>
              <IndicatorRow label="Ticket:" value={fmt(atual.ticket_medio)} />
              {anterior && dTicket && (
                <IndicatorRow
                  label="Anterior:"
                  value={
                    <>
                      {fmt(anterior.ticket_medio)}{' '}
                      <DeltaInline diff={dTicket.diff} pct={dTicket.pct} isCurrency />
                    </>
                  }
                />
              )}
              <IndicatorRow
                label="Média 8 sem.:"
                value={
                  <>
                    {fmt(med8Ticket)}
                    <span className="ml-2 text-muted-foreground text-xs">
                      Média anual: <span className="text-muted-foreground">—</span>
                    </span>
                  </>
                }
              />
            </section>

            <Separator className="bg-border/30" />

            {/* ─── CLIENTES ─── */}
            <section className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400/90 flex items-center gap-1.5">
                👥 Clientes
              </h4>
              <IndicatorRow
                label="Atendimentos:"
                value={
                  <>
                    {atual.atendimentos}
                    {anterior && dAtend && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        Anterior: {anterior.atendimentos}{' '}
                        <span className={deltaColor(dAtend.diff)}>
                          (Δ {deltaStr(dAtend.diff, false)})
                        </span>
                      </span>
                    )}
                  </>
                }
              />
              <IndicatorRow
                label="Média/dia:"
                value={
                  <>
                    {fmtN(atual.dias_na_semana > 0 ? atual.atendimentos / atual.dias_na_semana : 0, 1)}{' '}
                    <span className="text-muted-foreground text-[10px]">({atual.dias_na_semana} dias)</span>
                    <span className="ml-2 text-muted-foreground text-xs">
                      Média 8 sem.: {fmtN(med8Atend, 1)}
                    </span>
                  </>
                }
              />
            </section>

            <Separator className="bg-border/30" />

            {/* ─── ANÁLISE ─── */}
            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary/90 flex items-center gap-1.5">
                🧠 Análise
              </h4>
              <ul className="space-y-1">
                {analise.map((line, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                    <span className="text-primary/60 mt-0.5">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default SemanalPainelExecutivo;

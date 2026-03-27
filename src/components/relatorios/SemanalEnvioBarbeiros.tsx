// ============================================================
// FILE: src/components/relatorios/SemanalEnvioBarbeiros.tsx
// PROPÓSITO: Painel completo de gestão semanal por barbeiro
//   - Resumo de KPIs por barbeiro com comparativo semana anterior
//   - Gráfico de ranking + tabela de evolução
//   - Geração de mensagem personalizada e orientativa
//   - Templates configuráveis
//   - Histórico de envios
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import {
  MessageCircle, Send, CheckCircle2,
  History, Settings, ExternalLink, RefreshCw, Loader2,
  TrendingUp, TrendingDown, Trash2, Plus, Star,
  Copy, Users, BarChart2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SemanaData } from '@/types/relatorio-semanal';
import type { ByColaborador } from '@/components/dashboard/types';
import { useRelatorioSemanalBarbeiros } from '@/hooks/useRelatorioSemanalBarbeiros';
import {
  useRelatorioSemanalMensagens,
  fillTemplate,
  type SemanalTemplate,
  type SemanalEnvio,
} from '@/hooks/useRelatorioSemanalMensagens';

// ── Helpers ──────────────────────────────────────────────────

function fmtMoney(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}
function fmtN(v: number, d = 1) { return v.toFixed(d).replace('.', ','); }

function varPct(atual: number, anterior: number | null) {
  if (anterior === null || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

function VarBadge({ pct, size = 'sm' }: { pct: number | null; size?: 'sm' | 'xs' }) {
  if (pct === null) return null;
  const cls = size === 'xs' ? 'text-[10px]' : 'text-[11px]';
  if (Math.abs(pct) < 1) return <span className={`${cls} text-muted-foreground`}>—</span>;
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 ${cls} font-medium ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {up ? '+' : ''}{fmtN(Math.abs(pct), 0)}%
    </span>
  );
}

function cleanPhone(p: string | null) { return p ? p.replace(/\D/g, '') : ''; }
function whatsappUrl(phone: string | null, msg: string) {
  const d = cleanPhone(phone);
  if (!d || d.length < 10) return null;
  const n = d.startsWith('55') ? d : '55' + d;
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}

// ── BarbeiroPill ─────────────────────────────────────────────

function BarbeiroPill({ b, bAnt, enviado, onClick, rank, totalFaturamento, showFaturamento }: {
  b: ByColaborador; bAnt: ByColaborador | null; enviado: boolean; onClick: () => void;
  rank: number; totalFaturamento: number; showFaturamento: boolean;
}) {
  const varComissao = varPct(b.comissao, bAnt?.comissao ?? null);
  const nome = b.colaborador_nome?.split(' ')[0] || b.colaborador_nome || '—';
  const pctTotal = totalFaturamento > 0 ? (b.faturamento / totalFaturamento) * 100 : 0;
  const rankColors = ['text-amber-400', 'text-slate-300', 'text-amber-600/80'];
  const rankColor = rank <= 3 ? rankColors[rank - 1] : 'text-muted-foreground';

  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all hover:border-primary/40 hover:bg-muted/20 ${
        enviado ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/40 bg-card/50'
      }`}
    >
      {/* Header: rank + name + check */}
      <div className="flex items-center justify-between gap-1 pr-4">
        <span className={`text-[10px] font-bold ${rankColor}`}>#{rank}</span>
        <span className="text-xs font-semibold text-foreground truncate flex-1 ml-1">{nome}</span>
      </div>
      {enviado && <CheckCircle2 className="absolute right-2 top-2.5 h-3.5 w-3.5 text-emerald-400" />}

      {/* Comissão — valor principal */}
      {b.comissao > 0 ? (
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-amber-400 leading-none">{fmtMoney(b.comissao)}</span>
          <VarBadge pct={varComissao} size="xs" />
        </div>
      ) : (
        <span className="text-xs text-muted-foreground italic">sem comissão</span>
      )}
      <span className="text-[9px] text-muted-foreground -mt-0.5">
        Comissão{b.bonus > 0 ? ` · ${fmtMoney(b.bonus)} bônus` : ''}
      </span>
      {/* Breakdown serviços/produtos */}
      {(b.comissao_servicos != null || b.comissao_produtos != null) && b.comissao > 0 && (
        <span className="text-[9px] text-muted-foreground -mt-0.5">
          Serv: {fmtMoney(b.comissao_servicos ?? b.comissao)} · Prod: {fmtMoney(b.comissao_produtos ?? 0)}
        </span>
      )}

      {/* Faturamento (opcional) */}
      {showFaturamento && (
        <span className="text-[10px] text-muted-foreground">Fat.: {fmtMoney(b.faturamento)}</span>
      )}

      {/* Barra de contribuição */}
      <div className="w-full h-1 rounded-full bg-muted/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/60 transition-all"
          style={{ width: `${Math.min(100, pctTotal)}%` }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground">{fmtN(pctTotal, 0)}% do total</span>

      {/* KPIs */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-muted-foreground">{b.atendimentos} atend. · {fmtMoney(b.ticket_medio)} TM</span>
        <span className="text-[10px] text-muted-foreground">{b.extras_qtd} extras · {fmtMoney(b.extras_valor)}</span>
        <span className="text-[10px] text-muted-foreground">{b.clientes_novos} novos clientes</span>
      </div>

      <span className="mt-0.5 text-[9px] text-primary/60 group-hover:text-primary transition-colors">
        {enviado ? '✓ Enviado · ver' : '→ Mensagem'}
      </span>
    </button>
  );
}

// ── SendDialog ───────────────────────────────────────────────

interface SendDialogProps {
  open: boolean;
  onClose: () => void;
  barbeiro: ByColaborador | null;
  barbeiroAnterior: ByColaborador | null;
  semanaAtual: SemanaData;
  template: SemanalTemplate | null;
  enviados: SemanalEnvio[];
  onSent: (mensagem: string, telefone: string, notas: string, templateId: string | null) => Promise<void>;
  saving: boolean;
  initialTelefone: string;
}

function SendDialog({ open, onClose, barbeiro, barbeiroAnterior, semanaAtual, template, enviados, onSent, saving, initialTelefone }: SendDialogProps) {
  const [mensagem, setMensagem] = useState('');
  const [telefone, setTelefone] = useState(initialTelefone);
  const [notas, setNotas] = useState('');
  const [tab, setTab] = useState<'mensagem' | 'historico'>('mensagem');
  const [fatLine, setFatLine] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !barbeiro || !template) return;
    setTelefone(initialTelefone);
    setNotas('');
    setTab('mensagem');
    setFatLine(null);
    const msg = fillTemplate(template.corpo, barbeiro, barbeiroAnterior, semanaAtual.data_inicio, semanaAtual.data_fim);
    setMensagem(msg);
  }, [open, barbeiro, barbeiroAnterior, semanaAtual, template, initialTelefone]);

  if (!barbeiro) return null;

  const waUrl = whatsappUrl(telefone, mensagem);
  const nomeCompleto = barbeiro.colaborador_nome || 'Barbeiro';

  const handleToggleFat = () => {
    if (fatLine) {
      setMensagem(m => m.replace('\n' + fatLine, '').replace(fatLine + '\n', '').replace(fatLine, ''));
      setFatLine(null);
    } else {
      const line = `💰 *Faturamento:* ${fmtMoney(barbeiro.faturamento)}`;
      setMensagem(m => {
        // Insere acima da linha de comissão
        const marker = '💰 *Comissão:*';
        const idx = m.indexOf(marker);
        if (idx >= 0) return m.slice(0, idx) + line + '\n' + m.slice(idx);
        // Fallback: após o primeiro separador
        const sepIdx = m.indexOf('━━━');
        if (sepIdx >= 0) {
          const lineEnd = m.indexOf('\n', sepIdx);
          return m.slice(0, lineEnd + 1) + line + '\n' + m.slice(lineEnd + 1);
        }
        return line + '\n' + m;
      });
      setFatLine(line);
    }
  };

  const comServ = barbeiro.comissao_servicos ?? barbeiro.comissao;
  const comProd = barbeiro.comissao_produtos ?? 0;
  const fatProd = barbeiro.faturamento_produtos ?? 0;
  const fatServ = barbeiro.faturamento - fatProd;

  const kpis: { label: string; val: string | number; key: keyof ByColaborador; highlight?: string }[] = [
    { label: 'Comissão', val: fmtMoney(barbeiro.comissao), key: 'comissao' as keyof ByColaborador, highlight: 'text-amber-400' },
    { label: 'Com. Serviços', val: fmtMoney(comServ), key: 'comissao_servicos' as keyof ByColaborador, highlight: 'text-amber-400/70' },
    ...(comProd > 0 ? [{ label: 'Com. Produtos', val: fmtMoney(comProd), key: 'comissao_produtos' as keyof ByColaborador, highlight: 'text-purple-400' }] : []),
    { label: 'Faturamento', val: fmtMoney(barbeiro.faturamento), key: 'faturamento' as keyof ByColaborador },
    { label: 'Fat. Serviços', val: fmtMoney(fatServ), key: 'faturamento_servicos_base' as keyof ByColaborador },
    ...(fatProd > 0 ? [{ label: 'Fat. Produtos', val: fmtMoney(fatProd), key: 'faturamento_produtos' as keyof ByColaborador }] : []),
    ...(barbeiro.bonus > 0 ? [{ label: 'Bônus', val: fmtMoney(barbeiro.bonus), key: 'bonus' as keyof ByColaborador, highlight: 'text-emerald-400' }] : []),
    { label: 'Atendimentos', val: barbeiro.atendimentos, key: 'atendimentos' as keyof ByColaborador },
    { label: 'Ticket Médio', val: fmtMoney(barbeiro.ticket_medio), key: 'ticket_medio' as keyof ByColaborador },
    { label: 'Extras qtd', val: barbeiro.extras_qtd, key: 'extras_qtd' as keyof ByColaborador },
    { label: 'Extras R$', val: fmtMoney(barbeiro.extras_valor), key: 'extras_valor' as keyof ByColaborador, highlight: 'text-purple-400' },
    { label: 'Novos', val: barbeiro.clientes_novos, key: 'clientes_novos' as keyof ByColaborador },
  ];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="h-4 w-4 text-primary" />
            Mensagem para {nomeCompleto}
            <Badge variant="outline" className="text-[10px] ml-1">
              {format(semanaAtual.data_inicio, 'dd/MM')} – {format(semanaAtual.data_fim, 'dd/MM')}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="mensagem" className="text-xs">Mensagem</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs gap-1">
              <History className="h-3 w-3" /> Histórico {enviados.length > 0 && `(${enviados.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mensagem" className="space-y-3 mt-3">
            {/* KPI grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {kpis.map(k => (
                <div key={k.label} className="rounded-lg border border-border/30 bg-muted/10 px-2 py-1.5 text-center">
                  <div className="text-[9px] text-muted-foreground">{k.label}</div>
                  <div className={`text-xs font-semibold ${k.highlight ?? 'text-foreground'}`}>{k.val}</div>
                  {barbeiroAnterior && !k.highlight && (
                    <VarBadge
                      pct={varPct(barbeiro[k.key] as number, barbeiroAnterior[k.key] as number)}
                      size="xs"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">WhatsApp (com DDD)</label>
              <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(47) 99999-9999" className="h-8 text-sm" />
            </div>

            {/* Message */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
                  <button
                    onClick={handleToggleFat}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      fatLine
                        ? 'border-primary/40 text-primary bg-primary/5'
                        : 'border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70'
                    }`}
                  >
                    {fatLine ? '× faturamento' : '+ faturamento'}
                  </button>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(mensagem); toast.success('Copiado!'); }}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </button>
              </div>
              <Textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={16} className="text-xs font-mono leading-relaxed" />
              <p className="text-[10px] text-muted-foreground">{mensagem.length} caracteres</p>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Observação interna (opcional)</label>
              <Input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Anotação para o histórico..." className="h-8 text-xs" />
            </div>
          </TabsContent>

          <TabsContent value="historico" className="mt-3">
            {enviados.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhum envio registrado para este barbeiro.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {enviados.map(e => (
                  <div key={e.id} className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-foreground">Semana {e.semana_inicio} – {e.semana_fim}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(e.enviado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {e.notas && <p className="text-[10px] text-amber-400/80 italic">{e.notas}</p>}
                    <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/5 rounded p-2 max-h-24 overflow-y-auto">{e.mensagem_final}</pre>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Cancelar</Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" disabled={!waUrl} onClick={() => waUrl && window.open(waUrl, '_blank')}>
            <ExternalLink className="h-3 w-3" /> Abrir WhatsApp
          </Button>
          <Button size="sm" className="text-xs gap-1" disabled={saving || !mensagem.trim()} onClick={async () => { await onSent(mensagem, telefone, notas, template?.id ?? null); onClose(); }}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Registrar Envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ComparativoTab ────────────────────────────────────────────

const CHART_COLORS = {
  atual: 'hsl(var(--primary))',
  anterior: 'hsl(217 19% 35%)',
};

function ComparativoTab({ barbeiros, barbeirosAnterior }: { barbeiros: ByColaborador[]; barbeirosAnterior: ByColaborador[] }) {
  const sorted = [...barbeiros].sort((a, b) => b.faturamento - a.faturamento);

  const chartData = sorted.map(b => {
    const ant = barbeirosAnterior.find(x => x.colaborador_id === b.colaborador_id);
    return {
      nome: b.colaborador_nome?.split(' ')[0] || '—',
      atual: Math.round(b.faturamento),
      anterior: ant ? Math.round(ant.faturamento) : 0,
    };
  });

  const getAnt = (id: string) => barbeirosAnterior.find(x => x.colaborador_id === id) ?? null;

  const metricCols: { label: string; key: keyof ByColaborador; fmt: (v: number) => string; highlight?: string }[] = [
    { label: 'Faturamento', key: 'faturamento', fmt: fmtMoney },
    { label: 'Atend.', key: 'atendimentos', fmt: v => String(v) },
    { label: 'Ticket', key: 'ticket_medio', fmt: fmtMoney },
    { label: 'Extras', key: 'extras_qtd', fmt: v => String(v) },
    { label: 'Novos', key: 'clientes_novos', fmt: v => String(v) },
    ...(barbeiros.some(b => b.comissao > 0)
      ? [{ label: 'Comissão', key: 'comissao' as keyof ByColaborador, fmt: fmtMoney, highlight: 'text-amber-400' }]
      : []
    ),
    ...(barbeiros.some(b => b.bonus > 0)
      ? [{ label: 'Bônus', key: 'bonus' as keyof ByColaborador, fmt: fmtMoney, highlight: 'text-emerald-400' }]
      : []
    ),
  ];

  return (
    <div className="space-y-5">
      {/* Bar chart */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <h4 className="text-xs font-semibold text-foreground">Faturamento por Barbeiro</h4>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.atual }} /> Esta semana
            </span>
            {barbeirosAnterior.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.anterior }} /> Semana anterior
              </span>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="nome" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              formatter={(value: number, name: string) => [fmtMoney(value), name === 'atual' ? 'Esta semana' : 'Anterior']}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
            />
            <Bar dataKey="anterior" fill={CHART_COLORS.anterior} radius={[3, 3, 0, 0]} />
            <Bar dataKey="atual" fill={CHART_COLORS.atual} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">#</th>
              <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Barbeiro</th>
              {metricCols.map(c => (
                <th key={c.key} className="text-right py-1.5 px-2 text-muted-foreground font-medium whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((b, i) => {
              const ant = getAnt(b.colaborador_id);
              return (
                <tr key={b.colaborador_id} className="border-b border-border/20 hover:bg-muted/5">
                  <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-3 font-semibold text-foreground whitespace-nowrap">
                    {b.colaborador_nome?.split(' ').slice(0, 2).join(' ') || '—'}
                  </td>
                  {metricCols.map(c => {
                    const curr = b[c.key] as number;
                    const prev = ant ? ant[c.key] as number : null;
                    const pct = c.highlight ? null : varPct(curr, prev);
                    return (
                      <td key={c.key} className="py-2 px-2 text-right">
                        <div className={`font-medium ${c.highlight ?? 'text-foreground'}`}>{c.fmt(curr)}</div>
                        <VarBadge pct={pct} size="xs" />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {/* Totals row */}
          {sorted.length > 1 && (() => {
            const totalFat = sorted.reduce((s, b) => s + b.faturamento, 0);
            const totalAtend = sorted.reduce((s, b) => s + b.atendimentos, 0);
            const totalExtras = sorted.reduce((s, b) => s + b.extras_qtd, 0);
            const totalNovos = sorted.reduce((s, b) => s + b.clientes_novos, 0);
            const totalComissao = sorted.reduce((s, b) => s + (b.comissao ?? 0), 0);
            const totalBonus = sorted.reduce((s, b) => s + (b.bonus ?? 0), 0);
            const antFat = barbeirosAnterior.reduce((s, b) => s + b.faturamento, 0);
            const antAtend = barbeirosAnterior.reduce((s, b) => s + b.atendimentos, 0);
            const hasComissao = barbeiros.some(b => b.comissao > 0);
            const hasBonus = barbeiros.some(b => b.bonus > 0);
            return (
              <tfoot>
                <tr className="border-t border-border/40 bg-muted/5">
                  <td className="py-2 pr-3 text-muted-foreground" colSpan={2}>
                    <span className="font-semibold text-foreground">Total</span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="font-bold text-foreground">{fmtMoney(totalFat)}</div>
                    <VarBadge pct={varPct(totalFat, antFat || null)} size="xs" />
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="font-bold text-foreground">{totalAtend}</div>
                    <VarBadge pct={varPct(totalAtend, antAtend || null)} size="xs" />
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="font-bold text-foreground">{fmtMoney(totalAtend > 0 ? totalFat / totalAtend : 0)}</div>
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-foreground">{totalExtras}</td>
                  <td className="py-2 px-2 text-right font-bold text-foreground">{totalNovos}</td>
                  {hasComissao && <td className="py-2 px-2 text-right font-bold text-amber-400">{fmtMoney(totalComissao)}</td>}
                  {hasBonus && <td className="py-2 px-2 text-right font-bold text-emerald-400">{fmtMoney(totalBonus)}</td>}
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </div>
  );
}

// ── TemplatesEditor ───────────────────────────────────────────

const VARS_HELP = [
  '{{nome}}', '{{nome_completo}}', '{{semana}}',
  '{{comissao}}', '{{var_comissao}}', '{{bonus}}',
  '{{comissao_servicos}}', '{{comissao_produtos}}', '{{pct_servicos}}', '{{pct_produtos}}',
  '{{faturamento}}', '{{var_faturamento}}', '{{faturamento_servicos}}', '{{faturamento_produtos}}',
  '{{atendimentos}}', '{{var_atendimentos}}', '{{ticket}}', '{{var_ticket}}',
  '{{extras_qtd}}', '{{extras_valor}}', '{{clientes}}', '{{clientes_novos}}',
  '{{dias}}', '{{media_dia}}', '{{analise}}',
];

function TemplatesEditor({ templates, saving, onSave, onDelete }: {
  templates: SemanalTemplate[];
  saving: boolean;
  onSave: (p: { id?: string; nome: string; corpo: string; padrao?: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editId, setEditId] = useState<string | 'new' | null>(null);
  const [nome, setNome] = useState('');
  const [corpo, setCorpo] = useState('');
  const [padrao, setPadrao] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const openNew = () => {
    setEditId('new');
    setNome('Novo Template');
    setCorpo('Olá {{nome}}! 💈\n\n*Resultado da semana {{semana}}:*\n💰 Comissão: {{comissao}}{{var_comissao}}\n✂️ Atendimentos: {{atendimentos}}{{var_atendimentos}}\n🎟️ Ticket Médio: {{ticket}}{{var_ticket}}\n🛍️ Extras: {{extras_qtd}} ({{extras_valor}})\n🆕 Clientes novos: {{clientes_novos}}\n{{analise}}');
    setPadrao(false);
  };

  const openEdit = (t: SemanalTemplate) => { setEditId(t.id); setNome(t.nome); setCorpo(t.corpo); setPadrao(t.padrao); };

  const insertVar = (v: string) => {
    const el = textareaRef.current;
    if (!el) { setCorpo(prev => prev + v); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = corpo.substring(0, start) + v + corpo.substring(end);
    setCorpo(next);
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + v.length; el.focus(); }, 0);
  };

  if (editId !== null) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{editId === 'new' ? 'Novo template' : 'Editar template'}</h4>
          <button onClick={() => setEditId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nome</label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Variáveis disponíveis — clique para inserir no cursor</label>
          <div className="flex flex-wrap gap-1">
            {VARS_HELP.map(v => (
              <button key={v} onClick={() => insertVar(v)}
                className="text-[9px] px-1.5 py-0.5 rounded border border-border/40 bg-muted/10 hover:bg-primary/10 hover:border-primary/30 text-muted-foreground hover:text-primary font-mono"
              >{v}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Corpo da mensagem</label>
          <Textarea ref={textareaRef} value={corpo} onChange={e => setCorpo(e.target.value)} rows={18} className="text-xs font-mono" />
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={padrao} onChange={e => setPadrao(e.target.checked)} className="h-3 w-3" />
          <span className="text-muted-foreground">Definir como template padrão</span>
        </label>
        <Button size="sm" className="text-xs gap-1 w-full" onClick={async () => { await onSave({ id: editId === 'new' ? undefined : editId!, nome, corpo, padrao }); setEditId(null); }} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Salvar template
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{templates.length} template{templates.length !== 1 ? 's' : ''} ativo{templates.length !== 1 ? 's' : ''}</p>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={openNew}><Plus className="h-3 w-3" /> Novo</Button>
      </div>
      {templates.map(t => (
        <div key={t.id} className="rounded-lg border border-border/30 bg-card/40 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {t.padrao && <Star className="h-3 w-3 text-amber-400 shrink-0" />}
              <span className="text-sm font-medium text-foreground truncate">{t.nome}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => openEdit(t)}>Editar</Button>
              {!t.padrao && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-destructive hover:text-destructive" onClick={() => onDelete(t.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/5 rounded p-2 max-h-28 overflow-y-auto">{t.corpo}</pre>
        </div>
      ))}
    </div>
  );
}

// ── HistoricoGlobal ───────────────────────────────────────────

function HistoricoGlobal({ envios, loading, onDelete }: { envios: SemanalEnvio[]; loading: boolean; onDelete: (id: string) => Promise<void> }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (envios.length === 0) return <p className="text-xs text-muted-foreground py-6 text-center">Nenhum envio registrado ainda.</p>;

  const byWeek = new Map<string, SemanalEnvio[]>();
  envios.forEach(e => {
    const key = `${e.semana_inicio}|${e.semana_fim}`;
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push(e);
  });

  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
      {Array.from(byWeek.entries()).map(([key, items]) => {
        const [inicio, fim] = key.split('|');
        return (
          <div key={key} className="space-y-1.5">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Semana {inicio} – {fim} · {items.length} barbeiro{items.length !== 1 ? 's' : ''}
            </h5>
            {items.map(e => (
              <div key={e.id} className="rounded-lg border border-border/30 bg-card/40 p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground">{e.colaborador_nome || e.colaborador_id}</span>
                    {e.telefone && <span className="text-[10px] text-muted-foreground ml-2">{e.telefone}</span>}
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(e.enviado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {e.notas && <p className="text-[10px] text-amber-400/80 italic">{e.notas}</p>}
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-destructive hover:text-destructive shrink-0" disabled={deletingId === e.id}
                    onClick={async () => { setDeletingId(e.id); try { await onDelete(e.id); } catch { toast.error('Erro ao remover'); } finally { setDeletingId(null); } }}
                  >
                    {deletingId === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </div>
                <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/5 rounded p-2 max-h-20 overflow-y-auto">{e.mensagem_final}</pre>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

interface Props {
  semanaAtual: SemanaData | null;
  semanaAnterior: SemanaData | null;
  allSemanas?: SemanaData[];
}

export function SemanalEnvioBarbeiros({ semanaAtual, semanaAnterior, allSemanas }: Props) {
  const [activeTab, setActiveTab] = useState<'barbeiros' | 'comparativo' | 'templates' | 'historico'>('barbeiros');
  const [dialogBarbeiro, setDialogBarbeiro] = useState<ByColaborador | null>(null);
  const [dialogTelefone, setDialogTelefone] = useState('');
  const [showFaturamento, setShowFaturamento] = useState(false);

  // Seleção de semana — começa na última (mais recente)
  const semanas = allSemanas && allSemanas.length > 0 ? allSemanas : semanaAtual ? [semanaAtual] : [];
  const [semanaIdx, setSemanaIdx] = useState<number>(() => semanas.length > 0 ? semanas.length - 1 : 0);

  // Atualiza índice quando allSemanas muda (ex: filtro aplicado)
  useEffect(() => {
    if (semanas.length > 0) setSemanaIdx(semanas.length - 1);
  }, [semanas.length]);

  const selectedSemana = semanas[semanaIdx] ?? semanaAtual;
  const selectedSemanaAnterior = semanaIdx > 0 ? semanas[semanaIdx - 1] : semanaAnterior;

  const inicio = selectedSemana ? format(selectedSemana.data_inicio, 'yyyy-MM-dd') : null;
  const fim = selectedSemana ? format(selectedSemana.data_fim, 'yyyy-MM-dd') : null;
  const inicioAnt = selectedSemanaAnterior ? format(selectedSemanaAnterior.data_inicio, 'yyyy-MM-dd') : null;
  const fimAnt = selectedSemanaAnterior ? format(selectedSemanaAnterior.data_fim, 'yyyy-MM-dd') : null;

  const { barbeiros, barbeirosAnterior, loading: loadingBarbeiros } = useRelatorioSemanalBarbeiros(
    inicio, fim, inicioAnt, fimAnt, !!selectedSemana
  );

  const msg = useRelatorioSemanalMensagens();

  useEffect(() => {
    if (activeTab === 'historico') msg.loadEnvios();
  }, [activeTab]);

  const getBarbeiroAnterior = useCallback((id: string) =>
    barbeirosAnterior.find(b => b.colaborador_id === id) ?? null
  , [barbeirosAnterior]);

  const openDialog = useCallback(async (b: ByColaborador) => {
    const tel = await msg.getUltimoTelefone(b.colaborador_id);
    setDialogTelefone(tel ?? '');
    setDialogBarbeiro(b);
  }, [msg]);

  const handleSent = useCallback(async (mensagem: string, telefone: string, notas: string, templateId: string | null) => {
    if (!selectedSemana || !dialogBarbeiro) return;
    await msg.saveEnvio({
      colaborador_id: dialogBarbeiro.colaborador_id,
      colaborador_nome: dialogBarbeiro.colaborador_nome,
      telefone: telefone.trim() || null,
      semana_inicio: format(selectedSemana.data_inicio, 'yyyy-MM-dd'),
      semana_fim: format(selectedSemana.data_fim, 'yyyy-MM-dd'),
      mensagem_final: mensagem,
      template_id: templateId,
      notas: notas.trim() || undefined,
    });
    toast.success(`Envio registrado para ${dialogBarbeiro.colaborador_nome?.split(' ')[0] || 'barbeiro'}!`);
  }, [selectedSemana, dialogBarbeiro, msg]);

  if (!selectedSemana) return null;

  const semanaLabel = `${format(selectedSemana.data_inicio, "dd 'de' MMM", { locale: ptBR })} – ${format(selectedSemana.data_fim, "dd 'de' MMM", { locale: ptBR })}`;
  const totalEnviadosSemana = msg.envios.filter(e => e.semana_inicio === inicio && e.semana_fim === fim).length;
  const barbeirosOrdenados = [...barbeiros].sort((a, b) => b.faturamento - a.faturamento);
  const totalFaturamentoBarbeiros = barbeirosOrdenados.reduce((s, b) => s + b.faturamento, 0);

  return (
    <>
      <Card className="bg-card/60 border-border/40 overflow-hidden">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 border-b border-border/30">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Barbeiros
            </h3>
            {/* Seletor de semana */}
            {semanas.length > 1 ? (
              <select
                value={semanaIdx}
                onChange={e => setSemanaIdx(Number(e.target.value))}
                className="h-6 rounded-md border border-border/40 bg-card text-[10px] text-foreground px-1.5 pr-5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {semanas.map((s, i) => (
                  <option key={i} value={i}>
                    Sem. {s.semana_numero} · {format(s.data_inicio, 'dd/MM')}–{format(s.data_fim, 'dd/MM')}
                  </option>
                ))}
              </select>
            ) : (
              <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                Sem. {selectedSemana.semana_numero} · {semanaLabel}
              </Badge>
            )}
            {totalEnviadosSemana > 0 && (
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 gap-0.5">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {totalEnviadosSemana}/{barbeiros.length} enviado{totalEnviadosSemana !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => msg.loadEnvios()} disabled={msg.loadingEnvios}>
            <RefreshCw className={`h-3.5 w-3.5 ${msg.loadingEnvios ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* ── Sub-navigation ── */}
        <div className="px-4 pt-3 sm:px-5">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
            <TabsList className="h-8 gap-0.5">
              <TabsTrigger value="barbeiros" className="text-xs gap-1.5 h-7">
                <Send className="h-3 w-3" />
                Envios
                {barbeiros.length > 0 && (
                  <span className="ml-0.5 text-[9px] bg-primary/20 text-primary px-1 rounded-full">{barbeiros.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="comparativo" className="text-xs gap-1.5 h-7">
                <BarChart2 className="h-3 w-3" />
                Comparativo
              </TabsTrigger>
              <TabsTrigger value="templates" className="text-xs gap-1.5 h-7">
                <Settings className="h-3 w-3" />
                Templates
                {msg.templates.length > 0 && (
                  <span className="ml-0.5 text-[9px] bg-muted text-muted-foreground px-1 rounded-full">{msg.templates.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="historico" className="text-xs gap-1.5 h-7">
                <History className="h-3 w-3" />
                Histórico
                {msg.envios.length > 0 && (
                  <span className="ml-0.5 text-[9px] bg-muted text-muted-foreground px-1 rounded-full">{msg.envios.length}</span>
                )}
              </TabsTrigger>
            </TabsList>

            <CardContent className="px-0 pt-4 pb-4">

              {/* ── Envios ── */}
              <TabsContent value="barbeiros" className="mt-0">
                {loadingBarbeiros ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : barbeiros.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Nenhum dado de barbeiro para esta semana.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-6 px-2 text-[10px] gap-1 shrink-0 ${showFaturamento ? 'border-primary/40 text-primary' : ''}`}
                        onClick={() => setShowFaturamento(f => !f)}
                      >
                        {showFaturamento ? 'Ocultar faturamento' : '+ Faturamento'}
                      </Button>
                      <p className="text-[10px] text-muted-foreground">
                        Clique em um barbeiro para gerar a mensagem.
                        {selectedSemanaAnterior && ' Variações vs semana anterior.'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                      {barbeirosOrdenados.map((b, i) => (
                        <BarbeiroPill
                          key={b.colaborador_id}
                          b={b}
                          bAnt={getBarbeiroAnterior(b.colaborador_id)}
                          enviado={msg.isEnviado(b.colaborador_id, inicio!, fim!)}
                          rank={i + 1}
                          totalFaturamento={totalFaturamentoBarbeiros}
                          showFaturamento={showFaturamento}
                          onClick={() => openDialog(b)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Comparativo ── */}
              <TabsContent value="comparativo" className="mt-0">
                {loadingBarbeiros ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : barbeiros.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Nenhum dado de barbeiro para esta semana.</p>
                ) : (
                  <ComparativoTab barbeiros={barbeiros} barbeirosAnterior={barbeirosAnterior} />
                )}
              </TabsContent>

              {/* ── Templates ── */}
              <TabsContent value="templates" className="mt-0">
                <TemplatesEditor
                  templates={msg.templates}
                  saving={msg.saving}
                  onSave={msg.saveTemplate}
                  onDelete={msg.deleteTemplate}
                />
              </TabsContent>

              {/* ── Histórico ── */}
              <TabsContent value="historico" className="mt-0">
                <HistoricoGlobal
                  envios={msg.envios}
                  loading={msg.loadingEnvios}
                  onDelete={msg.deleteEnvio}
                />
              </TabsContent>

            </CardContent>
          </Tabs>
        </div>
      </Card>

      {/* Send Dialog */}
      <SendDialog
        open={!!dialogBarbeiro}
        onClose={() => setDialogBarbeiro(null)}
        barbeiro={dialogBarbeiro}
        barbeiroAnterior={dialogBarbeiro ? getBarbeiroAnterior(dialogBarbeiro.colaborador_id) : null}
        semanaAtual={selectedSemana}
        template={msg.templatePadrao}
        enviados={dialogBarbeiro ? msg.getEnviosDaBarbeiro(dialogBarbeiro.colaborador_id) : []}
        onSent={handleSent}
        saving={msg.saving}
        initialTelefone={dialogTelefone}
      />
    </>
  );
}

export default SemanalEnvioBarbeiros;

// ============================================================
// FILE: src/components/clientes/ClientesDrillFaixa.tsx
// PROPÓSITO: Drill down por faixa — clientes agrupados por barbeiro
// ============================================================

import React, { useState } from 'react';
import { ArrowLeft, Download, Users, Clock, DollarSign, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { fmtInt, fmtMoney, STATUS_CONFIG, toCsv, downloadCsv } from '@/hooks/useClientes';
import { calcDiasSemVir, calcMediaDiasSemVir } from '@/lib/diasSemVir';
import { InfoPopover } from './InfoPopover';

export interface DrillFaixaCliente {
  cliente_id: string;
  cliente_nome: string;
  telefone: string | null;
  ultima_visita: string;
  dias_sem_vir: number;
  dias_distintos: number;
  valor_total: number;
  status_cliente: string;
}

export interface DrillFaixaBarbeiro {
  colaborador_id: string;
  colaborador_nome: string;
  total_clientes: number;
  clientes: DrillFaixaCliente[];
}

export interface DrillFaixaResumo {
  media_dias_sem_vir: number;
  media_frequencia: number;
  valor_total: number;
  ticket_medio: number;
}

export interface DrillFaixaResult {
  total: number;
  por_barbeiro: DrillFaixaBarbeiro[];
  resumo: DrillFaixaResumo;
}

interface Props {
  data: DrillFaixaResult | null;
  label: string;
  tipo: string;
  periodoLabel: string;
  loading: boolean;
  onBack: () => void;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  try {
    const date = new Date(d + 'T00:00:00Z');
    return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
  } catch { return d; }
}

function gerarAnaliseContextual(tipo: string, label: string, data: DrillFaixaResult): string[] {
  const lines: string[] = [];
  const { total, resumo, por_barbeiro } = data;
  if (total === 0 || !por_barbeiro?.length) return ['Nenhum cliente encontrado nesta faixa.'];

  lines.push(`📊 **${fmtInt(total)} clientes** na faixa "${label}", distribuídos entre ${por_barbeiro.length} barbeiro${por_barbeiro.length > 1 ? 's' : ''}.`);

  const allClientes = por_barbeiro.flatMap(b => b.clientes);
  const mediaDiasReal = calcMediaDiasSemVir(allClientes);
  if (mediaDiasReal > 0) {
    const mediaDias = mediaDiasReal;
    if (mediaDias <= 25) {
      lines.push(`✅ Média de ${mediaDias.toFixed(0)} dias sem vir — cadência saudável (ideal para barbearia: 20-30 dias).`);
    } else if (mediaDias <= 45) {
      lines.push(`⚠️ Média de ${mediaDias.toFixed(0)} dias sem vir — razoável, mas pode melhorar. O ideal é manter abaixo de 30 dias.`);
    } else if (mediaDias <= 60) {
      lines.push(`🚨 Média de ${mediaDias.toFixed(0)} dias sem vir — acima do ideal. Considere ações de resgate para estes clientes.`);
    } else {
      lines.push(`🚨 Média de ${mediaDias.toFixed(0)} dias sem vir — base com retenção preocupante. Campanha de resgate urgente recomendada.`);
    }
  }

  if (resumo.media_frequencia > 0) {
    const freq = resumo.media_frequencia;
    if (freq >= 4) {
      lines.push(`🌟 Frequência média de ${freq.toFixed(1)} visitas — muito bom! Clientes recorrentes e fiéis.`);
    } else if (freq >= 2) {
      lines.push(`✅ Frequência média de ${freq.toFixed(1)} visitas no período — bom nível de fidelização.`);
    } else {
      lines.push(`⚠️ Frequência média de ${freq.toFixed(1)} visita no período — maioria veio apenas 1 vez.`);
    }
  }

  lines.push(`💰 Valor total: ${fmtMoney(resumo.valor_total)} | Ticket médio: ${fmtMoney(resumo.ticket_medio)}`);

  // Top barbeiro
  if (por_barbeiro.length > 1) {
    const sorted = [...por_barbeiro].sort((a, b) => b.total_clientes - a.total_clientes);
    lines.push(`👤 Barbeiro com mais clientes nesta faixa: ${sorted[0].colaborador_nome} (${fmtInt(sorted[0].total_clientes)})`);
  }

  return lines;
}

function BarbeiroAccordion({ barbeiro }: { barbeiro: DrillFaixaBarbeiro }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 cursor-pointer transition-colors">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground">{barbeiro.colaborador_nome || 'Sem barbeiro'}</span>
          </div>
          <Badge variant="secondary" className="text-xs">{fmtInt(barbeiro.total_clientes)} cliente{barbeiro.total_clientes > 1 ? 's' : ''}</Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 border border-border/30 rounded-lg overflow-hidden">
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border/30">
            {barbeiro.clientes.map(c => (
              <div key={c.cliente_id} className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate text-foreground">{c.cliente_nome || 'Sem nome'}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                    {STATUS_CONFIG[c.status_cliente]?.label ?? c.status_cliente}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  {c.telefone && <span>📱 {c.telefone}</span>}
                  <span>Última: {formatDate(c.ultima_visita)}</span>
                  <span>{calcDiasSemVir(c.ultima_visita, c.dias_sem_vir)}d sem vir</span>
                  <span>{c.dias_distintos}x visitas</span>
                  <span>{fmtMoney(c.valor_total)}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Telefone</TableHead>
                  <TableHead className="text-xs">Última visita</TableHead>
                  <TableHead className="text-xs text-right">Dias sem vir</TableHead>
                  <TableHead className="text-xs text-right">Visitas</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {barbeiro.clientes.map(c => (
                  <TableRow key={c.cliente_id}>
                    <TableCell className="text-sm">{c.cliente_nome || 'Sem nome'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.telefone || '—'}</TableCell>
                    <TableCell className="text-sm">{formatDate(c.ultima_visita)}</TableCell>
                    <TableCell className="text-sm text-right">{calcDiasSemVir(c.ultima_visita, c.dias_sem_vir)}</TableCell>
                    <TableCell className="text-sm text-right">{c.dias_distintos}</TableCell>
                    <TableCell className="text-sm text-right">{fmtMoney(c.valor_total)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {STATUS_CONFIG[c.status_cliente]?.label ?? c.status_cliente}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ClientesDrillFaixa({ data, label, tipo, periodoLabel, loading, onBack }: Props) {
  const handleExportCsv = () => {
    if (!data) return;
    const rows: Record<string, unknown>[] = [];
    data.por_barbeiro.forEach(b => {
      b.clientes.forEach(c => {
        rows.push({
          barbeiro: b.colaborador_nome,
          cliente: c.cliente_nome,
          telefone: c.telefone ?? '',
          ultima_visita: c.ultima_visita,
          dias_sem_vir: calcDiasSemVir(c.ultima_visita, c.dias_sem_vir),
          visitas: c.dias_distintos,
          valor: c.valor_total,
          status: c.status_cliente,
        });
      });
    });
    const csv = toCsv(rows);
    downloadCsv(csv, `drill_${tipo}_${label.replace(/\s+/g, '_')}.csv`);
  };

  const analise = data ? gerarAnaliseContextual(tipo, label, data) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate text-foreground">{label}</h2>
          <p className="text-xs text-muted-foreground">{periodoLabel}</p>
        </div>
        {data && (
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="shrink-0">
            <Download className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        )}
      </div>

      {loading && !data ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-40" />
        </div>
      ) : data ? (
        <>
          {/* Resumo cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Total</span>
                </div>
                <div className="text-xl font-bold text-foreground">{fmtInt(data.total)}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Média dias sem vir</span>
                </div>
                <div className="text-xl font-bold text-foreground">
                  {calcMediaDiasSemVir(data.por_barbeiro.flatMap(b => b.clientes)).toFixed(0)}d
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Ticket médio</span>
                </div>
                <div className="text-xl font-bold text-foreground">{fmtMoney(data.resumo.ticket_medio)}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Valor total</span>
                </div>
                <div className="text-xl font-bold text-foreground">{fmtMoney(data.resumo.valor_total)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Análise contextual */}
          {analise.length > 0 && (
            <div className="p-3 rounded-md bg-muted/50 border border-border/50 space-y-1.5">
              <div className="flex items-center gap-1 mb-2">
                <p className="text-xs font-medium text-foreground">Análise da faixa</p>
                <InfoPopover
                  title="Análise contextual"
                  description="Interpretação automática baseada na cadência ideal para barbearia (20-30 dias). 1x/mês = bom, 2x/mês = muito bom, 1x/45d = razoável, 1x/60d+ = precisa melhorar."
                />
              </div>
              {analise.map((line, i) => (
                <p key={i} className="text-xs text-muted-foreground leading-relaxed">{line}</p>
              ))}
            </div>
          )}

          {/* Por barbeiro */}
          {data.por_barbeiro && data.por_barbeiro.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Por barbeiro ({data.por_barbeiro.length})
              </p>
              {data.por_barbeiro.map(b => (
                <BarbeiroAccordion key={b.colaborador_id} barbeiro={b} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-sm text-muted-foreground">Nenhum dado disponível.</div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, Info } from 'lucide-react';
import type { CohortMensalItem } from '@/hooks/useClientesNovos';
import { fmtMesAno } from '@/hooks/useClientes';
import { InfoPopover } from '@/components/clientes/InfoPopover';

interface Props {
  data: CohortMensalItem[];
  periodoLabel: string;
}

function heatColor(pct: number): string {
  if (pct >= 50) return 'bg-emerald-500/30 text-emerald-300';
  if (pct >= 35) return 'bg-emerald-500/20 text-emerald-400';
  if (pct >= 20) return 'bg-yellow-500/15 text-yellow-400';
  if (pct >= 10) return 'bg-orange-500/15 text-orange-400';
  return 'bg-red-500/10 text-red-400';
}

function RetBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${heatColor(value)}`}>
      {label} {value?.toFixed(1)}%
    </span>
  );
}

export function ClientesNovosCohort({ data, periodoLabel }: Props) {
  const [howToOpen, setHowToOpen] = useState(false);
  if (!data?.length) return (
    <Card className="bg-card border-border">
      <CardContent className="p-6 text-center text-sm text-muted-foreground">
        Sem dados de cohort para o período selecionado.
      </CardContent>
    </Card>
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-foreground">Cohort Mensal — Retenção de Clientes Novos (dias corridos)</CardTitle>
          <InfoPopover
            title="Cohort — Dias Corridos"
            description="Mesmos clientes novos do período, mas retenção medida por dias corridos: 30d = voltou em até 30 dias da 1ª visita, independente do mês-calendário. Diferente da tabela acima que usa meses-calendário (M+1, M+2)."
            example="Se em Dez/2025 entraram 43 novos e Ret. 30d = 27.9%, significa que 12 dos 43 voltaram em até 30 dias corridos após a primeira visita."
            periodLabel={`Período: ${periodoLabel}`}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">% de novos que retornaram em 30/60/90 dias • {periodoLabel}</p>
      </CardHeader>
      <CardContent className="p-0">
        {/* Banner explicativo */}
        <div className="mx-3 mt-3 mb-2 flex gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Metodologia:</strong> Mesmos clientes novos do período. Retenção medida por <strong className="text-foreground">dias corridos</strong> (30d = voltou em até 30 dias da 1ª visita, independente do mês).</p>
            <p><strong className="text-foreground">O que observar:</strong> Ret. 30d alta = boa primeira impressão. Se 60d ≈ 30d, quem volta cedo fica. Se 90d &gt;&gt; 60d, clientes demoram mas eventualmente voltam.</p>
            <p className="text-muted-foreground/70">≠ Tabela acima mede por <strong>meses-calendário</strong> (M+1, M+2) — útil para comparar cohorts entre si.</p>
          </div>
        </div>

        {/* Mobile: cards */}
        <div className="space-y-2 p-3 sm:hidden">
          {data.map((c) => (
            <div key={c.mes} className="p-3 rounded-md bg-muted/20 border border-border/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground">{fmtMesAno(c.mes)}</span>
                <span className="text-xs font-medium text-muted-foreground">{c.novos} novos</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <RetBadge label="30d" value={c.pct_ret_30d} />
                <RetBadge label="60d" value={c.pct_ret_60d} />
                <RetBadge label="90d" value={c.pct_ret_90d} />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs text-foreground">Mês</TableHead>
                <TableHead className="text-xs text-right text-foreground">Novos</TableHead>
                <TableHead className="text-xs text-center text-foreground">Ret. 30d</TableHead>
                <TableHead className="text-xs text-center text-foreground">Ret. 60d</TableHead>
                <TableHead className="text-xs text-center text-foreground">Ret. 90d</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.mes}>
                  <TableCell className="text-xs font-medium text-foreground">{fmtMesAno(c.mes)}</TableCell>
                  <TableCell className="text-xs text-right text-foreground">{c.novos}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${heatColor(c.pct_ret_30d)}`}>
                      {c.pct_ret_30d?.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${heatColor(c.pct_ret_60d)}`}>
                      {c.pct_ret_60d?.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${heatColor(c.pct_ret_90d)}`}>
                      {c.pct_ret_90d?.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Collapsible "Como ler" */}
        <Collapsible open={howToOpen} onOpenChange={setHowToOpen} className="px-3 pb-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-foreground">
              📖 Como ler esta tabela
              <ChevronDown className={`h-3 w-3 transition-transform ${howToOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground space-y-2">
              <p><strong className="text-foreground">⚠️ Apenas clientes NOVOS do período</strong> — somente quem fez a 1ª visita dentro do filtro selecionado.</p>
              <p><strong>Dias corridos (não meses):</strong> Ret. 30d = voltou em até 30 dias após a 1ª visita. Ret. 60d = até 60 dias. Ret. 90d = até 90 dias.</p>
              <p><strong>Diferença do Cohort Histórico:</strong> O Cohort Histórico (acima) usa TODOS os clientes e mede por meses-calendário (M+1, M+2). Este usa apenas novos e mede por janela de dias corridos.</p>
              <p><strong>Exemplo:</strong> Dez/2025 teve 43 novos. Ret. 30d = 27.9% → 12 dos 43 voltaram em até 30 dias. Se em Jan esse número caiu para 21.7%, algo piorou na conversão do novo cliente.</p>
              <p><strong>Cores:</strong> Verde (≥35%) = boa conversão, Amarelo (≥20%) = regular, Laranja (≥10%) = baixa, Vermelho (&lt;10%) = crítica.</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, Info } from 'lucide-react';
import { InfoPopover } from './InfoPopover';

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function fmtMesAno(v: string) {
  const [y, m] = v.split('-');
  const idx = parseInt(m, 10) - 1;
  return `${MESES_NOMES[idx] ?? m}/${y}`;
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return '—';
  return `${(v * 100).toFixed(0)}%`;
}

function pctBgClass(v: number | null | undefined): string {
  if (v == null) return 'bg-muted/30';
  const pct = v * 100;
  if (pct >= 60) return 'bg-emerald-500/20';
  if (pct >= 40) return 'bg-green-500/15';
  if (pct >= 20) return 'bg-yellow-500/15';
  if (pct >= 10) return 'bg-orange-500/15';
  return 'bg-red-500/15';
}

function pctTextClass(v: number | null | undefined): string {
  if (v == null) return 'text-muted-foreground';
  const pct = v * 100;
  if (pct >= 60) return 'text-emerald-400 font-bold';
  if (pct >= 40) return 'text-green-400 font-semibold';
  if (pct >= 20) return 'text-yellow-400 font-medium';
  if (pct >= 10) return 'text-orange-400 font-medium';
  return 'text-red-400 font-medium';
}

function pctBarColor(v: number | null | undefined): string {
  if (v == null) return 'bg-muted';
  const pct = v * 100;
  if (pct >= 60) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-green-500';
  if (pct >= 20) return 'bg-yellow-500';
  if (pct >= 10) return 'bg-orange-500';
  return 'bg-red-500';
}

interface Props {
  loading: boolean;
  data: Array<{
    cohort_ano_mes: string;
    size: number;
    m1_pct: number | null;
    m2_pct: number | null;
    m3_pct: number | null;
    m6_pct: number | null;
  }> | null;
  title?: string;
  onDrillCohort?: (cohortMonth: string, size: number) => void;
}

function CohortCell({ value }: { value: number | null }) {
  return (
    <div className={`rounded-md px-2 py-1.5 ${pctBgClass(value)} flex flex-col items-center gap-1`}>
      <span className={`text-xs ${pctTextClass(value)}`}>{fmtPct(value)}</span>
      {value != null && (
        <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pctBarColor(value)}`}
            style={{ width: `${Math.min(value * 100, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* Mobile card for a single cohort row */
function CohortMobileCard({ row, onDrill }: { row: Props['data'] extends (infer T)[] | null ? T : never; onDrill?: Props['onDrillCohort'] }) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{fmtMesAno(row.cohort_ano_mes)}</span>
        <span
          className={`text-[10px] text-muted-foreground ${onDrill ? 'cursor-pointer underline decoration-dotted hover:text-foreground' : ''}`}
          onClick={onDrill ? () => onDrill(row.cohort_ano_mes, row.size) : undefined}
        >
          {row.size} clientes
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">M+1</span>
          <CohortCell value={row.m1_pct} />
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">M+2</span>
          <CohortCell value={row.m2_pct} />
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">M+3</span>
          <CohortCell value={row.m3_pct} />
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">M+6</span>
          <CohortCell value={row.m6_pct} />
        </div>
      </div>
    </div>
  );
}

export function ClientesCohortGeral({ loading, data, title, onDrillCohort }: Props) {
  const [howToOpen, setHowToOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{title || 'Retenção por Mês de 1ª Visita (Cohort Histórico)'}</CardTitle>
          <InfoPopover
            title="Cohort — Meses-Calendário"
            description="Clientes novos do período, agrupados pelo mês da 1ª visita. Retenção medida por meses-calendário: M+1 = visitou no mês seguinte, M+2 = dois meses depois, etc. Diferente da tabela de dias corridos (30d/60d/90d) abaixo."
            example="Se 100 novos entraram em Jan e 45 voltaram em Fev, M+1 = 45%. Acima de 40% é bom."
          />
        </div>
      </CardHeader>
      <CardContent>
        {/* Banner explicativo */}
        <div className="mb-3 flex gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Metodologia:</strong> Clientes novos agrupados por mês da 1ª visita. Retenção medida por <strong className="text-foreground">meses-calendário</strong> (M+1 = visitou no mês seguinte, M+2 = dois meses depois, etc.)</p>
            <p><strong className="text-foreground">O que observar:</strong> Tendência entre cohorts — se M+1 cai mês a mês, a primeira impressão está piorando. Se M+6 é muito menor que M+1, clientes experimentam mas não ficam.</p>
            <p className="text-muted-foreground/70">≠ Tabela abaixo mede por <strong>dias corridos</strong> (30d/60d/90d) a partir da 1ª visita — mais precisa para avaliar velocidade de retorno.</p>
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-48" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sem dados de cohort para o período selecionado.</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {data.map((r) => (
                <CohortMobileCard key={r.cohort_ano_mes} row={r} onDrill={onDrillCohort} />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cohort (mês)</TableHead>
                    <TableHead className="text-right">Tamanho</TableHead>
                    <TableHead className="text-center w-24">
                      <div className="flex items-center justify-center gap-1">
                        M+1
                        <InfoPopover
                          title="M+1 — Retorno no mês seguinte"
                          description="Percentual de clientes do cohort que retornaram no mês imediatamente seguinte à primeira visita. É o indicador mais sensível de primeira impressão."
                          example="Cohort Jan: 100 novos → 45 voltaram em Fev → M+1 = 45%. Meta ideal: ≥40%."
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-24">
                      <div className="flex items-center justify-center gap-1">
                        M+2
                        <InfoPopover
                          title="M+2 — Retorno em 2 meses"
                          description="Percentual que retornou até o segundo mês. Mostra se o cliente está criando hábito."
                          example="Dos 100 novos de Jan, 35 voltaram até Março → M+2 = 35%."
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-24">
                      <div className="flex items-center justify-center gap-1">
                        M+3
                        <InfoPopover
                          title="M+3 — Retorno em 3 meses"
                          description="Percentual que retornou até o terceiro mês. Se M+3 está próximo de M+1, significa boa retenção estável."
                          example="Dos 100 novos de Jan, 30 voltaram até Abril → M+3 = 30%. Acima de 25% é sólido."
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-24">
                      <div className="flex items-center justify-center gap-1">
                        M+6
                        <InfoPopover
                          title="M+6 — Retenção de longo prazo"
                          description="Percentual que ainda retorna após 6 meses. Indica fidelização real. Se este número é baixo, há problema de retenção de longo prazo."
                          example="Dos 100 novos de Jan, 20 ainda vêm em Julho → M+6 = 20%. Acima de 15% é bom."
                        />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.cohort_ano_mes}>
                      <TableCell className="font-medium text-xs">{fmtMesAno(r.cohort_ano_mes)}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${onDrillCohort ? 'cursor-pointer underline decoration-dotted hover:text-primary' : ''}`}
                        onClick={onDrillCohort ? () => onDrillCohort(r.cohort_ano_mes, r.size) : undefined}
                      >
                        {r.size}
                      </TableCell>
                      <TableCell className="p-1"><CohortCell value={r.m1_pct} /></TableCell>
                      <TableCell className="p-1"><CohortCell value={r.m2_pct} /></TableCell>
                      <TableCell className="p-1"><CohortCell value={r.m3_pct} /></TableCell>
                      <TableCell className="p-1"><CohortCell value={r.m6_pct} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Legenda */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px]">
              <span className="text-muted-foreground font-medium">Legenda:</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" /> ≥60% Excelente</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500/15 border border-green-500/30" /> ≥40% Bom</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500/15 border border-yellow-500/30" /> ≥20% Atenção</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500/15 border border-orange-500/30" /> ≥10% Alerta</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/15 border border-red-500/30" /> &lt;10% Crítico</span>
            </div>

            {/* Collapsible "Como ler" */}
            <Collapsible open={howToOpen} onOpenChange={setHowToOpen} className="mt-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-foreground">
                  📖 Como ler esta tabela
                  <ChevronDown className={`h-3 w-3 transition-transform ${howToOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">⚠️ Clientes novos do período</strong> — agrupados pelo mês em que fizeram sua primeira visita.</p>
                  <p><strong>Meses-calendário:</strong> M+1 = mês seguinte, M+2 = dois meses depois, etc. Exemplo: cohort de Jan → M+1 = Fev, M+2 = Mar.</p>
                  <p><strong>Bom sinal:</strong> Cores verdes consistentes significam que seus clientes estão criando hábito e voltando.</p>
                  <p><strong>Sinal de alerta:</strong> Se M+1 é alto mas M+3/M+6 caem muito, clientes experimentam mas não ficam.</p>
                  <p><strong>Meta para barbearias:</strong> M+1 ≥ 40%, M+3 ≥ 25%, M+6 ≥ 15%.</p>
                  <p><strong>Clique no número</strong> de clientes para ver a lista detalhada agrupada por barbeiro.</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}

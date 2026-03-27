// ============================================================
// FILE: src/components/clientes/ClientesFaixaDias.tsx
// PROPÓSITO: Barra horizontal segmentada de faixas de dias sem vir + análise
// ============================================================

import React, { useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { FaixasDias } from '@/hooks/useClientes';
import { fmtInt } from '@/hooks/useClientes';
import { InfoPopover } from './InfoPopover';

interface Props {
  faixas: FaixasDias | null;
  periodoLabel: string;
  onDrillFaixa?: (tipo: string, valor: string, label: string) => void;
}

const FAIXAS = [
  { key: 'ate_20d', label: '≤ 20d', color: 'hsl(142, 71%, 45%)', desc: 'Até 20 dias sem vir' },
  { key: '21_30d', label: '21-30d', color: 'hsl(217, 91%, 60%)', desc: '21 a 30 dias sem vir' },
  { key: '31_45d', label: '31-45d', color: 'hsl(45, 93%, 47%)', desc: '31 a 45 dias sem vir' },
  { key: '46_75d', label: '46-75d', color: 'hsl(25, 95%, 53%)', desc: '46 a 75 dias sem vir' },
  { key: 'mais_75d', label: '> 75d', color: 'hsl(0, 84%, 60%)', desc: 'Mais de 75 dias sem vir' },
] as const;

function gerarAnalise(faixas: FaixasDias, total: number): string[] {
  if (total === 0) return ['Sem dados para análise.'];
  const lines: string[] = [];

  const recentes = ((faixas as any).ate_20d ?? 0) + ((faixas as any)['21_30d'] ?? 0);
  const pctRecentes = (recentes / total) * 100;

  if (pctRecentes >= 60) {
    lines.push(`✅ ${pctRecentes.toFixed(0)}% dos clientes vieram nos últimos 30 dias (${fmtInt(recentes)} de ${fmtInt(total)}) — base saudável. Cadência dentro do ideal para barbearia (20-30 dias).`);
  } else if (pctRecentes >= 40) {
    lines.push(`⚠️ ${pctRecentes.toFixed(0)}% dos clientes vieram nos últimos 30 dias (${fmtInt(recentes)} de ${fmtInt(total)}) — atenção moderada. O ideal é que pelo menos 60% estejam nessa faixa.`);
  } else {
    lines.push(`🚨 Apenas ${pctRecentes.toFixed(0)}% dos clientes vieram nos últimos 30 dias (${fmtInt(recentes)} de ${fmtInt(total)}) — base com retenção baixa. A maioria está espaçando demais as visitas.`);
  }

  const perdidos = (faixas as any).mais_75d ?? 0;
  const pctPerdidos = (perdidos / total) * 100;
  if (pctPerdidos > 30) {
    lines.push(`🚨 ${fmtInt(perdidos)} clientes (${pctPerdidos.toFixed(0)}%) estão há mais de 75 dias sem vir — isso equivale a mais de 2 meses sem retorno. Considere campanha de resgate urgente.`);
  } else if (pctPerdidos > 15) {
    lines.push(`⚠️ ${fmtInt(perdidos)} clientes (${pctPerdidos.toFixed(0)}%) estão há mais de 75 dias sem vir — monitore de perto e considere ações de reativação.`);
  }

  const emRisco = (faixas as any)['46_75d'] ?? 0;
  const pctRisco = (emRisco / total) * 100;
  if (emRisco > 0 && pctRisco > 10) {
    lines.push(`💡 ${fmtInt(emRisco)} clientes (${pctRisco.toFixed(0)}%) estão na faixa 46-75 dias (≈1.5 a 2.5 meses sem vir) — foque em resgatar estes antes que virem perdidos.`);
  }

  const leve = (faixas as any)['31_45d'] ?? 0;
  if (leve > emRisco && leve > 0) {
    lines.push(`📊 A faixa 31-45 dias (${fmtInt(leve)}) é maior que a faixa 46-75 dias (${fmtInt(emRisco)}) — sinal positivo, a maioria ainda está em transição.`);
  }

  // Referência de cadência ideal
  const ate20 = (faixas as any).ate_20d ?? 0;
  const pctAte20 = (ate20 / total) * 100;
  if (pctAte20 >= 40) {
    lines.push(`🌟 ${pctAte20.toFixed(0)}% voltam em até 20 dias — excelente cadência! Equivale a clientes que cortam a cada 2-3 semanas.`);
  }

  return lines;
}

export function ClientesFaixaDias({ faixas, periodoLabel, onDrillFaixa }: Props) {
  const [showAnalise, setShowAnalise] = useState(false);

  if (!faixas) return null;

  const values = FAIXAS.map(f => ({ ...f, count: (faixas as any)[f.key] ?? 0 }));
  const total = values.reduce((s, v) => s + v.count, 0);
  if (total === 0) return null;

  const analise = gerarAnalise(faixas, total);

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-1 mb-3">
          <p className="text-xs font-medium text-muted-foreground flex-1">
            Distribuição por dias sem vir • {periodoLabel}
          </p>
          <InfoPopover
            title="Faixas de dias sem vir"
            description="Mostra quantos clientes estão em cada faixa de tempo desde a última visita. Clique em qualquer faixa para ver os clientes detalhados por barbeiro. Verde = vieram recentemente. Vermelho = estão há muito tempo sem vir."
            example="Se 40% dos clientes estão na faixa > 75d, significa que uma parcela significativa da base pode estar perdida. Cadência ideal para barbearia: 20-30 dias."
            periodLabel={`Referência: ${periodoLabel}`}
          />
        </div>

        {/* Segmented bar */}
        <div className="flex h-8 rounded-lg overflow-hidden">
          {values.map(v => {
            const pct = (v.count / total) * 100;
            if (pct < 1) return null;
            return (
              <div
                key={v.key}
                className="relative flex items-center justify-center text-[9px] font-bold text-white transition-all hover:opacity-80 cursor-pointer"
                style={{ width: `${pct}%`, backgroundColor: v.color, minWidth: pct > 3 ? undefined : '2px' }}
                title={`${v.label}: ${fmtInt(v.count)} (${pct.toFixed(1)}%) — clique para ver detalhes`}
                onClick={() => onDrillFaixa?.('FAIXA_DIAS', v.key, `Dias sem vir: ${v.label}`)}
              >
                {pct > 8 && fmtInt(v.count)}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {values.map(v => (
            <div
              key={v.key}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => onDrillFaixa?.('FAIXA_DIAS', v.key, `Dias sem vir: ${v.label}`)}
            >
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: v.color }} />
              {v.label}: {fmtInt(v.count)} ({total > 0 ? ((v.count / total) * 100).toFixed(0) : 0}%)
            </div>
          ))}
        </div>

        {/* Analysis toggle */}
        <Collapsible open={showAnalise} onOpenChange={setShowAnalise}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="mt-3 h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              {showAnalise ? 'Ocultar análise' : 'Ver análise'}
              {showAnalise ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-3 rounded-md bg-muted/50 border border-border/50 space-y-1.5">
              <div className="flex items-center gap-1 mb-2">
                <p className="text-xs font-medium text-foreground">Análise automática</p>
                <InfoPopover
                  title="Análise automática"
                  description="Texto gerado automaticamente com base em regras de cadência para barbearia. Referência: 1x/mês (20-30d) = bom, 1x/quinzena = muito bom, 1x/45d = razoável, 1x/60d+ = precisa melhorar."
                />
              </div>
              {analise.map((line, i) => (
                <p key={i} className="text-xs text-muted-foreground leading-relaxed">{line}</p>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// ============================================================
// FILE: src/components/clientes/ClientesFrequenciaChart.tsx
// PROPÓSITO: Barra horizontal segmentada de frequência de visitas + análise
// ============================================================

import React, { useState, useMemo } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { FaixasFrequencia } from '@/hooks/useClientes';
import { fmtInt } from '@/hooks/useClientes';
import { InfoPopover } from './InfoPopover';

interface Props {
  faixas: FaixasFrequencia | null;
  periodoLabel: string;
  onDrillFaixa?: (tipo: string, valor: string, label: string) => void;
}

const FAIXAS = [
  { key: 'uma_vez_aguardando', label: '1 vez (aguardando)', color: 'hsl(220, 9%, 72%)', desc: 'Vieram 1 vez e a última visita foi há ≤30 dias. Ainda dentro da janela normal de retorno.' },
  { key: 'uma_vez_30d', label: '1 vez (>30d)', color: 'hsl(25, 95%, 53%)', desc: 'Vieram 1 vez e a última visita foi há 31-60 dias. Atenção: risco de perda.' },
  { key: 'uma_vez_60d', label: '1 vez (>60d)', color: 'hsl(0, 84%, 60%)', desc: 'Vieram 1 vez e a última visita foi há mais de 60 dias. Provavelmente perdidos.' },
  { key: 'duas_vezes', label: '2 vezes', color: 'hsl(210, 60%, 65%)', desc: 'Vieram em 2 dias distintos' },
  { key: 'tres_quatro', label: '3-4 vezes', color: 'hsl(217, 91%, 60%)', desc: 'Vieram em 3 a 4 dias distintos' },
  { key: 'cinco_nove', label: '5-9 vezes', color: 'hsl(142, 60%, 50%)', desc: 'Vieram em 5 a 9 dias distintos' },
  { key: 'dez_doze', label: '10-12 vezes', color: 'hsl(142, 71%, 35%)', desc: 'Vieram em 10 a 12 dias distintos' },
  { key: 'treze_quinze', label: '13-15 vezes', color: 'hsl(160, 60%, 40%)', desc: 'Vieram em 13 a 15 dias distintos' },
  { key: 'dezesseis_vinte', label: '16-20 vezes', color: 'hsl(180, 50%, 35%)', desc: 'Vieram em 16 a 20 dias distintos' },
  { key: 'vinte_um_trinta', label: '21-30 vezes', color: 'hsl(200, 60%, 40%)', desc: 'Vieram em 21 a 30 dias distintos' },
  { key: 'trinta_mais', label: '30+ vezes', color: 'hsl(270, 50%, 50%)', desc: 'Vieram em mais de 30 dias distintos — super fiéis' },
] as const;

function gerarAnalise(faixas: FaixasFrequencia, total: number, mesesPeriodo: number): string[] {
  if (total === 0) return ['Sem dados para análise.'];
  const lines: string[] = [];

  const ocasionais = (faixas.uma_vez ?? 0);
  const ocasionais_perdidos = (faixas.uma_vez_60d ?? 0);
  const ocasionais_atencao = (faixas.uma_vez_30d ?? 0);
  const ocasionais_aguardando = (faixas.uma_vez_aguardando ?? 0);
  const pctOcasionais = (ocasionais / total) * 100;

  const recorrentes = (faixas.tres_quatro ?? 0) + (faixas.cinco_nove ?? 0) + (faixas.dez_doze ?? 0) + (faixas.treze_quinze ?? 0) + (faixas.dezesseis_vinte ?? 0) + (faixas.vinte_um_trinta ?? 0) + (faixas.trinta_mais ?? 0);
  const pctRecorrentes = (recorrentes / total) * 100;

  // Contexto de frequência baseado no tamanho do período
  if (mesesPeriodo > 0) {
    const visitasIdealMes = 1; // 1x/mês = bom para barbearia
    const visitasIdealPeriodo = Math.round(mesesPeriodo * visitasIdealMes);

    if (visitasIdealPeriodo > 1) {
      const comFreqIdeal = (faixas.duas_vezes ?? 0) + (faixas.tres_quatro ?? 0) + (faixas.cinco_nove ?? 0) + (faixas.dez_doze ?? 0) + (faixas.treze_quinze ?? 0) + (faixas.dezesseis_vinte ?? 0) + (faixas.vinte_um_trinta ?? 0) + (faixas.trinta_mais ?? 0);
      const pctIdeal = (comFreqIdeal / total) * 100;
      lines.push(`📏 Para um período de ~${mesesPeriodo} meses, o ideal é que cada cliente venha pelo menos ${visitasIdealPeriodo}x (1x/mês = bom). ${pctIdeal.toFixed(0)}% atingem essa marca.`);
    }
  }

  if (pctOcasionais > 60) {
    lines.push(`🚨 ${pctOcasionais.toFixed(0)}% dos clientes vieram apenas 1 vez (${fmtInt(ocasionais)}) — base com baixa fidelização.`);
  } else if (pctOcasionais > 40) {
    lines.push(`⚠️ ${pctOcasionais.toFixed(0)}% dos clientes vieram apenas 1 vez (${fmtInt(ocasionais)}) — fidelização moderada.`);
  } else {
    lines.push(`✅ Apenas ${pctOcasionais.toFixed(0)}% dos clientes vieram 1 vez (${fmtInt(ocasionais)}) — boa taxa de retenção!`);
  }

  // Sub-faixas de 1 vez
  if (ocasionais > 0) {
    if (ocasionais_perdidos > 0) {
      lines.push(`🔴 ${fmtInt(ocasionais_perdidos)} (${((ocasionais_perdidos / total) * 100).toFixed(0)}%) vieram 1 vez há mais de 60 dias — provavelmente perdidos. Campanha de resgate recomendada.`);
    }
    if (ocasionais_atencao > 0) {
      lines.push(`🟠 ${fmtInt(ocasionais_atencao)} (${((ocasionais_atencao / total) * 100).toFixed(0)}%) vieram 1 vez há 31-60 dias — atenção, risco de perda iminente. Follow-up urgente.`);
    }
    if (ocasionais_aguardando > 0) {
      lines.push(`⏳ ${fmtInt(ocasionais_aguardando)} (${((ocasionais_aguardando / total) * 100).toFixed(0)}%) vieram 1 vez há ≤30 dias — aguardando retorno dentro da janela normal.`);
    }
  }

  if (pctRecorrentes >= 30) {
    lines.push(`✅ ${pctRecorrentes.toFixed(0)}% dos clientes vieram 3+ vezes (${fmtInt(recorrentes)}) — base fidelizada sólida. Esses são clientes com cadência mensal ou melhor.`);
  } else if (pctRecorrentes >= 15) {
    lines.push(`📊 ${pctRecorrentes.toFixed(0)}% dos clientes vieram 3+ vezes (${fmtInt(recorrentes)}) — há espaço para melhorar a fidelização. Foque em transformar os de 1-2 visitas em recorrentes.`);
  } else {
    lines.push(`⚠️ Apenas ${pctRecorrentes.toFixed(0)}% vieram 3+ vezes — a maioria dos clientes não retorna com frequência suficiente.`);
  }

  const superFieis = (faixas.dez_doze ?? 0) + (faixas.treze_quinze ?? 0) + (faixas.dezesseis_vinte ?? 0) + (faixas.vinte_um_trinta ?? 0) + (faixas.trinta_mais ?? 0);
  if (superFieis > 0) {
    lines.push(`🌟 ${fmtInt(superFieis)} cliente${superFieis > 1 ? 's' : ''} vieram 10+ vezes no período — seus clientes mais fiéis!`);
  }

  // Interpretação prática de frequência
  const duasVezes = faixas.duas_vezes ?? 0;
  if (duasVezes > 0 && mesesPeriodo >= 2) {
    const cadenciaDias = Math.round(mesesPeriodo * 30 / 2);
    if (cadenciaDias <= 30) {
      lines.push(`👍 ${fmtInt(duasVezes)} clientes com 2 visitas — cadência de ~${cadenciaDias}d, dentro do ideal.`);
    } else if (cadenciaDias <= 45) {
      lines.push(`📊 ${fmtInt(duasVezes)} clientes com 2 visitas — cadência de ~${cadenciaDias}d, razoável mas pode melhorar.`);
    } else {
      lines.push(`⚠️ ${fmtInt(duasVezes)} clientes com 2 visitas — cadência de ~${cadenciaDias}d, abaixo do ideal.`);
    }
  }

  return lines;
}

export function ClientesFrequenciaChart({ faixas, periodoLabel, onDrillFaixa }: Props) {
  const [showAnalise, setShowAnalise] = useState(false);

  // Calculate months in period from periodoLabel
  const mesesPeriodo = useMemo(() => {
    try {
      const parts = periodoLabel.split(' – ');
      if (parts.length < 2) return 1;
      // Parse dd/mmm/yyyy format
      const parsePt = (s: string) => {
        const [d, m, y] = s.trim().split('/');
        const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
        const mi = meses.indexOf(m.toLowerCase());
        return new Date(parseInt(y), mi >= 0 ? mi : 0, parseInt(d));
      };
      const d1 = parsePt(parts[0]);
      const d2 = parsePt(parts[1]);
      const diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return Math.max(1, Math.round(diff));
    } catch { return 1; }
  }, [periodoLabel]);

  if (!faixas) return null;

  const values = FAIXAS.map(f => ({ ...f, count: (faixas as any)[f.key] ?? 0 }));
  const total = values.reduce((s, v) => s + v.count, 0);
  if (total === 0) return null;

  const analise = gerarAnalise(faixas, total, mesesPeriodo);

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-1 mb-3">
          <p className="text-xs font-medium text-muted-foreground flex-1">
            Distribuição por frequência de visitas • {periodoLabel}
          </p>
          <InfoPopover
            title="Frequência de visitas"
            description="Mostra quantos clientes vieram X vezes (dias distintos) no período. Clique em qualquer faixa para ver os clientes por barbeiro. Referência: 1x/mês = bom, 2x/mês = muito bom, 1x/45d = razoável, 1x/60d+ = precisa melhorar."
            example="Em um período de 6 meses, um cliente com 6 visitas tem cadência mensal (bom). Com 12 visitas, quinzenal (muito bom). Com 3 visitas, a cada 60 dias (precisa melhorar)."
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
                onClick={() => onDrillFaixa?.('FAIXA_FREQ', v.key, `Frequência: ${v.label}`)}
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
              onClick={() => onDrillFaixa?.('FAIXA_FREQ', v.key, `Frequência: ${v.label}`)}
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
                  description="Texto gerado com base em regras de cadência para barbearia. 1x/mês = bom, 2x/mês = muito bom, 1x/45d = razoável, 1x/60d+ = precisa melhorar. A frequência ideal depende do tamanho do período analisado."
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

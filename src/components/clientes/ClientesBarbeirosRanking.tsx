// ============================================================
// FILE: src/components/clientes/ClientesBarbeirosRanking.tsx
// PROPÓSITO: Tabela ranking de barbeiros com métricas de clientes
// ============================================================

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { PorBarbeiroItem } from '@/hooks/useClientes';
import { fmtInt, fmtMoney } from '@/hooks/useClientes';
import type { BarbeiroAquisicaoItem } from '@/hooks/useClientesNovos';
import { InfoPopover } from './InfoPopover';

interface Props {
  barbeiros: PorBarbeiroItem[];
  periodoLabel: string;
  onSelectBarbeiro?: (id: string, nome: string) => void;
  novosData?: BarbeiroAquisicaoItem[];
}

export function ClientesBarbeirosRanking({ barbeiros, periodoLabel, onSelectBarbeiro, novosData }: Props) {
  // Build lookup for novos data by colaborador_id
  const novosMap = React.useMemo(() => {
    const map = new Map<string, BarbeiroAquisicaoItem>();
    novosData?.forEach(n => map.set(n.colaborador_id, n));
    return map;
  }, [novosData]);

  const hasNovosData = novosData && novosData.length > 0;

  if (!barbeiros?.length) return null;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-1 mb-3">
          <p className="text-xs font-medium text-muted-foreground flex-1">
            Ranking por barbeiro • {periodoLabel}
          </p>
          <InfoPopover
            title="Ranking de barbeiros"
            description="Cada linha mostra as métricas de clientes de um barbeiro no período selecionado. Clique em uma linha para ver detalhes da carteira do barbeiro (exclusivos vs compartilhados)."
            example="Únicos = clientes distintos atendidos. Novos = clientes cuja 1ª visita foi no período. Exclusivos = clientes que SÓ vieram com esse barbeiro. Ret.30d = % dos novos que voltaram em 30 dias."
            periodLabel={`Período: ${periodoLabel}`}
          />
        </div>

        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 font-medium text-muted-foreground">Barbeiro</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Únicos</th>
                <th className="text-right py-2 font-medium text-muted-foreground hidden sm:table-cell">Novos</th>
                <th className="text-right py-2 font-medium text-muted-foreground hidden md:table-cell">Exclusivos</th>
                {hasNovosData && (
                  <th className="text-right py-2 font-medium text-muted-foreground hidden lg:table-cell">Ret.30d</th>
                )}
                {hasNovosData && (
                  <th className="text-right py-2 font-medium text-muted-foreground hidden lg:table-cell">% Fiéis</th>
                )}
                <th className="text-right py-2 font-medium text-muted-foreground hidden md:table-cell">Valor</th>
              </tr>
            </thead>
            <tbody>
              {barbeiros.map((b, i) => {
                const nd = novosMap.get(b.colaborador_id);
                return (
                  <tr
                    key={b.colaborador_id}
                    className="border-b border-border/20 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => onSelectBarbeiro?.(b.colaborador_id, b.colaborador_nome)}
                  >
                    <td className="py-2.5 font-medium text-foreground">
                      <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                      {b.colaborador_nome}
                    </td>
                    <td className="text-right py-2.5 font-semibold text-foreground">{fmtInt(b.clientes_unicos)}</td>
                    <td className="text-right py-2.5 text-muted-foreground hidden sm:table-cell">{fmtInt(b.clientes_novos)}</td>
                    <td className="text-right py-2.5 text-muted-foreground hidden md:table-cell">{fmtInt(b.clientes_exclusivos)}</td>
                    {hasNovosData && (
                      <td className="text-right py-2.5 text-muted-foreground hidden lg:table-cell">
                        {nd ? `${nd.retencao_30d ?? 0}%` : '—'}
                      </td>
                    )}
                    {hasNovosData && (
                      <td className="text-right py-2.5 text-muted-foreground hidden lg:table-cell">
                        {nd ? `${nd.pct_fieis ?? 0}%` : '—'}
                      </td>
                    )}
                    <td className="text-right py-2.5 text-muted-foreground hidden md:table-cell">{fmtMoney(b.valor_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

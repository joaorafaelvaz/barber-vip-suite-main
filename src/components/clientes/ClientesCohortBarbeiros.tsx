import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClientesCohortGeral } from './ClientesCohortGeral';
import { InfoPopover } from './InfoPopover';

interface Props {
  loading: boolean;
  data: Array<{
    colaborador_id: string;
    colaborador_nome: string;
    cohorts: Array<{
      cohort_ano_mes: string;
      size: number;
      m1_pct: number | null;
      m2_pct: number | null;
      m3_pct: number | null;
      m6_pct: number | null;
    }>;
  }> | null;
}

export function ClientesCohortBarbeiros({ loading, data }: Props) {
  const [barbeiroId, setBarbeiroId] = useState('__NONE__');

  const options = useMemo(() =>
    (data ?? []).map((b) => ({ id: b.colaborador_id, nome: b.colaborador_nome })),
    [data]
  );

  const selected = useMemo(() => {
    if (barbeiroId === '__NONE__') return null;
    return (data ?? []).find((b) => b.colaborador_id === barbeiroId) ?? null;
  }, [data, barbeiroId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Cohort por Barbeiro</CardTitle>
            <InfoPopover
              title="Cohort por Barbeiro (Aquisição)"
              description="Mostra a retenção dos clientes agrupados pelo barbeiro que realizou o primeiro atendimento (barbeiro de aquisição). Permite comparar qual profissional retém melhor os clientes que conquistou."
              example="Se o Barbeiro A tem M+1 = 50% e o B tem M+1 = 25%, o A retém o dobro dos novos clientes no mês seguinte."
            />
          </div>
          <div className="w-52">
            <Select value={barbeiroId} onValueChange={setBarbeiroId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione um barbeiro" />
              </SelectTrigger>
              <SelectContent>
                {options.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-48" />
        ) : !selected ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Selecione um barbeiro para ver o cohort dele.
          </p>
        ) : (
          <ClientesCohortGeral
            loading={false}
            data={selected.cohorts}
            title={`Cohort — ${selected.colaborador_nome}`}
          />
        )}
      </CardContent>
    </Card>
  );
}

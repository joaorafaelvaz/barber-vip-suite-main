/**
 * Histórico de resultados de bônus
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { History, CheckCircle, XCircle } from 'lucide-react';
import { useBonusHistorico } from '@/hooks/useBonus';

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export default function BonusHistoricoTab() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState<number | undefined>(undefined);

  const { data: historico, isLoading } = useBonusHistorico(ano, mes);

  // Agrupar por mês
  const agrupado = (historico || []).reduce((acc, item) => {
    const key = `${item.ano}-${String(item.mes).padStart(2, '0')}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, typeof historico>);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Bônus
          </CardTitle>
          <div className="flex gap-2">
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={mes ? String(mes) : 'todos'}
              onValueChange={(v) => setMes(v === 'todos' ? undefined : Number(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {MESES_NOMES.map((nome, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : !historico || historico.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum histórico de bônus encontrado</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(agrupado)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([key, items]) => {
                const [anoStr, mesStr] = key.split('-');
                const mesNum = parseInt(mesStr, 10);

                return (
                  <div key={key}>
                    <h4 className="font-medium text-foreground mb-3">
                      {MESES_NOMES[mesNum - 1]} {anoStr}
                    </h4>
                    <div className="space-y-2">
                      {items?.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center p-3 rounded bg-muted/20 border border-border/50"
                        >
                          <div>
                            <div className="font-medium text-sm">
                              {(item as any).bonus_regras?.nome_bonus || 'Regra'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.colaborador_nome}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Meta: {formatNumber(item.meta || 0)} | Realizado:{' '}
                              {formatNumber(item.kpi_realizado || 0)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.atingiu ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <div className="text-right">
                              <Badge
                                variant={item.atingiu ? 'default' : 'secondary'}
                                className={item.atingiu ? 'bg-green-500/20 text-green-400' : ''}
                              >
                                {item.atingiu ? 'ATINGIU' : 'NÃO ATINGIU'}
                              </Badge>
                              <div className="text-sm font-medium text-green-500 mt-1">
                                {formatBRL(item.bonus_calculado)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Trophy, AlertTriangle, Users } from 'lucide-react';
import type { ChurnEvolucaoBarbeiroItem } from '@/hooks/raiox-clientes/useRaioXClientesChurnEvolucaoBarbeiro';

interface Props {
  data: ChurnEvolucaoBarbeiroItem[];
  onBarbeiroSelect?: (barbeiroId: string) => void;
  onDrillDown?: (barbeiroId: string, tipo: 'perdidos' | 'resgatados') => void;
}

interface BarbeiroInsight {
  id: string;
  nome: string;
  churn_medio: number;
  base_ativa_media: number;
  resgatados_total: number;
  perdidos_total: number;
  perdidos_fidelizados: number;
  perdidos_oneshot: number;
  em_risco_total: number;
  tendencia: 'melhorando' | 'piorando' | 'estavel';
  performance: 'excelente' | 'boa' | 'atencao' | 'critica';
  ultimo_mes: {
    churn_pct: number;
    base_ativa: number;
    resgatados: number;
  };
}

export function BarbeiroChurnInsights({ data, onBarbeiroSelect, onDrillDown }: Props) {
  const insights = useMemo((): BarbeiroInsight[] => {
    if (!data || data.length === 0) return [];

    const groupedByBarbeiro = data.reduce((acc, item) => {
      const key = item.colaborador_id;
      if (!acc[key]) {
        acc[key] = {
          id: item.colaborador_id,
          nome: item.colaborador_nome,
          items: []
        };
      }
      acc[key].items.push(item);
      return acc;
    }, {} as Record<string, { id: string; nome: string; items: ChurnEvolucaoBarbeiroItem[] }>);

    return Object.values(groupedByBarbeiro).map(({ id, nome, items }) => {
      const sortedItems = items.sort((a, b) => a.ano_mes.localeCompare(b.ano_mes));
      const ultimo = sortedItems[sortedItems.length - 1];
      const penultimo = sortedItems[sortedItems.length - 2];
      
      const churn_medio = items.reduce((sum, item) => sum + item.churn_pct, 0) / items.length;
      const base_ativa_media = items.reduce((sum, item) => sum + item.base_ativa, 0) / items.length;
      const resgatados_total = items.reduce((sum, item) => sum + item.resgatados, 0);
      const perdidos_total = items.reduce((sum, item) => sum + item.perdidos, 0);
      const perdidos_fidelizados = items.reduce((sum, item) => sum + item.perdidos_fidelizados, 0);
      const perdidos_oneshot = items.reduce((sum, item) => sum + item.perdidos_oneshot, 0);
      const em_risco_total = items.reduce((sum, item) => sum + item.em_risco, 0);

      // Calcular tendência
      let tendencia: 'melhorando' | 'piorando' | 'estavel' = 'estavel';
      if (penultimo && ultimo) {
        const diff = ultimo.churn_pct - penultimo.churn_pct;
        if (diff > 2) tendencia = 'piorando';
        else if (diff < -2) tendencia = 'melhorando';
      }

      // Classificar performance
      let performance: 'excelente' | 'boa' | 'atencao' | 'critica' = 'boa';
      if (churn_medio <= 3) performance = 'excelente';
      else if (churn_medio <= 8) performance = 'boa';
      else if (churn_medio <= 15) performance = 'atencao';
      else performance = 'critica';

      return {
        id,
        nome,
        churn_medio,
        base_ativa_media,
        resgatados_total,
        perdidos_total,
        perdidos_fidelizados,
        perdidos_oneshot,
        em_risco_total,
        tendencia,
        performance,
        ultimo_mes: {
          churn_pct: ultimo?.churn_pct || 0,
          base_ativa: ultimo?.base_ativa || 0,
          resgatados: ultimo?.resgatados || 0,
        }
      };
    }).sort((a, b) => a.churn_medio - b.churn_medio); // Melhor churn primeiro
  }, [data]);

  const ranking = useMemo(() => {
    return {
      melhor_churn: insights[0],
      pior_churn: insights[insights.length - 1],
      mais_resgates: insights.sort((a, b) => b.resgatados_total - a.resgatados_total)[0],
      maior_base: insights.sort((a, b) => b.base_ativa_media - a.base_ativa_media)[0],
      mais_perdas_fidelizados: insights.sort((a, b) => b.perdidos_fidelizados - a.perdidos_fidelizados)[0],
    };
  }, [insights]);

  if (!insights || insights.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm p-4">
        Nenhum dado de barbeiro disponível
      </div>
    );
  }

  const getPerformanceBadge = (performance: BarbeiroInsight['performance']) => {
    const variants = {
      excelente: { variant: 'default' as const, color: 'bg-green-500', label: 'Excelente' },
      boa: { variant: 'secondary' as const, color: 'bg-blue-500', label: 'Boa' },
      atencao: { variant: 'outline' as const, color: 'bg-yellow-500', label: 'Atenção' },
      critica: { variant: 'destructive' as const, color: 'bg-red-500', label: 'Crítica' }
    };
    return variants[performance];
  };

  const getTrendIcon = (tendencia: BarbeiroInsight['tendencia']) => {
    switch (tendencia) {
      case 'melhorando': return <TrendingDown className="h-3 w-3 text-green-600" />;
      case 'piorando': return <TrendingUp className="h-3 w-3 text-destructive" />;
      default: return <div className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Ranking Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Melhor Performance */}
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-700 dark:text-green-400">Menor Churn</span>
            </div>
            {ranking.melhor_churn && (
              <div>
                <p className="font-medium text-sm text-green-900 dark:text-green-100">
                  {ranking.melhor_churn.nome}
                </p>
                <p className="text-lg font-bold text-green-600">
                  {ranking.melhor_churn.churn_medio.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Base: {Math.round(ranking.melhor_churn.base_ativa_media)} clientes
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Maior Base */}
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Maior Base</span>
            </div>
            {ranking.maior_base && (
              <div>
                <p className="font-medium text-sm text-blue-900 dark:text-blue-100">
                  {ranking.maior_base.nome}
                </p>
                <p className="text-lg font-bold text-blue-600">
                  {Math.round(ranking.maior_base.base_ativa_media)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Churn: {ranking.maior_base.churn_medio.toFixed(1)}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atenção Especial */}
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-700 dark:text-red-400">Maior Churn</span>
            </div>
            {ranking.pior_churn && (
              <div>
                <p className="font-medium text-sm text-red-900 dark:text-red-100">
                  {ranking.pior_churn.nome}
                </p>
                <p className="text-lg font-bold text-red-600">
                  {ranking.pior_churn.churn_medio.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Base: {Math.round(ranking.pior_churn.base_ativa_media)} clientes
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista Detalhada */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Performance Detalhada por Barbeiro</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="p-3 rounded-lg border border-border/30 bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{insight.nome}</h4>
                    <Badge {...getPerformanceBadge(insight.performance)}>
                      {getPerformanceBadge(insight.performance).label}
                    </Badge>
                    {getTrendIcon(insight.tendencia)}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => onBarbeiroSelect?.(insight.id)}
                  >
                    Ver Detalhes
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Churn Médio</div>
                    <div className="font-medium text-destructive">
                      {insight.churn_medio.toFixed(1)}%
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-muted-foreground">Base Ativa</div>
                    <div className="font-medium">
                      {Math.round(insight.base_ativa_media)}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-muted-foreground">Resgatados</div>
                    <div className="font-medium text-green-600">
                      {insight.resgatados_total}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-muted-foreground">Em Risco</div>
                    <div className="font-medium text-orange-500">
                      {insight.em_risco_total}
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso para Perdas por Tipo */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Perdas: Fidelizados vs One-shot</span>
                    <span>{insight.perdidos_total} total</span>
                  </div>
                  <div className="flex rounded-full overflow-hidden h-2 bg-muted">
                    <div 
                      className="bg-red-500"
                      style={{ 
                        width: insight.perdidos_total > 0 
                          ? `${(insight.perdidos_fidelizados / insight.perdidos_total) * 100}%` 
                          : '0%' 
                      }}
                    />
                    <div 
                      className="bg-orange-400"
                      style={{ 
                        width: insight.perdidos_total > 0 
                          ? `${(insight.perdidos_oneshot / insight.perdidos_total) * 100}%` 
                          : '0%' 
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Fidelizados: {insight.perdidos_fidelizados}</span>
                    <span>One-shot: {insight.perdidos_oneshot}</span>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2 flex-1"
                    onClick={() => onDrillDown?.(insight.id, 'perdidos')}
                  >
                    Ver Perdidos ({insight.perdidos_total})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2 flex-1"
                    onClick={() => onDrillDown?.(insight.id, 'resgatados')}
                  >
                    Ver Resgatados ({insight.resgatados_total})
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
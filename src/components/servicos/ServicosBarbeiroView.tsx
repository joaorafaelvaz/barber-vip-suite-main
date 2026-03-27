import React, { useEffect, useState, useMemo } from 'react';
import { Users, TrendingUp, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import type { ServicosFilters } from '@/hooks/useServicos';

interface BarbeiroCategoriaItem {
  colaborador_id: string;
  colaborador_nome: string;
  categoria: string;
  grupo_de_produto: string | null;
  faturamento: number;
  quantidade: number;
  ticket_medio: number;
}

interface BarbeiroAgregado {
  colaborador_id: string;
  colaborador_nome: string;
  total_faturamento: number;
  total_quantidade: number;
  ticket_medio: number;
  categorias: {
    categoria: string;
    faturamento: number;
    quantidade: number;
    pct: number;
  }[];
}

interface ServicosBarbeiroViewProps {
  baseFilters: ServicosFilters;
  onDrillDown: (barbeiro: BarbeiroAgregado) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat('pt-BR').format(v);

// Category colors using semantic tokens
const CATEGORY_COLORS: Record<string, { bar: string; badge: string }> = {
  'Serviço Base': { bar: 'hsl(var(--primary))', badge: 'bg-primary/10 text-primary border-primary/20' },
  'Serviço Extra': { bar: 'hsl(var(--success))', badge: 'bg-success/10 text-success border-success/20' },
  'Produtos Cabelo': { bar: 'hsl(var(--info))', badge: 'bg-info/10 text-info border-info/20' },
  'Produtos Barba': { bar: 'hsl(var(--info))', badge: 'bg-info/10 text-info border-info/20' },
  'Produtos VIP': { bar: 'hsl(var(--info))', badge: 'bg-info/10 text-info border-info/20' },
  'default': { bar: 'hsl(var(--muted-foreground))', badge: 'bg-muted text-muted-foreground' },
};

const getCategoryColor = (cat: string) => CATEGORY_COLORS[cat] || CATEGORY_COLORS['default'];

export function ServicosBarbeiroView({ baseFilters, onDrillDown }: ServicosBarbeiroViewProps) {
  const [data, setData] = useState<BarbeiroCategoriaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!baseFilters.dataInicio || !baseFilters.dataFim) return;
    
    setLoading(true);
    setError(null);

    supabase.rpc('rpc_servicos_barbeiro_categoria' as any, {
      p_data_inicio: baseFilters.dataInicio,
      p_data_fim: baseFilters.dataFim,
      p_colaborador_id: baseFilters.colaboradorId ?? null,
    }).then(({ data: rpcData, error: rpcErr }) => {
      if (rpcErr) {
        setError(rpcErr.message);
        setData([]);
      } else {
        const typed = rpcData as any;
        setData(typed?.items ?? []);
      }
      setLoading(false);
    });
  }, [baseFilters.dataInicio, baseFilters.dataFim, baseFilters.colaboradorId]);

  // Aggregate by barber
  const barbeiros = useMemo(() => {
    const map = new Map<string, BarbeiroAgregado>();
    
    data.forEach(item => {
      const existing = map.get(item.colaborador_id);
      if (existing) {
        existing.total_faturamento += item.faturamento;
        existing.total_quantidade += item.quantidade;
        existing.categorias.push({
          categoria: item.categoria,
          faturamento: item.faturamento,
          quantidade: item.quantidade,
          pct: 0,
        });
      } else {
        map.set(item.colaborador_id, {
          colaborador_id: item.colaborador_id,
          colaborador_nome: item.colaborador_nome,
          total_faturamento: item.faturamento,
          total_quantidade: item.quantidade,
          ticket_medio: 0,
          categorias: [{
            categoria: item.categoria,
            faturamento: item.faturamento,
            quantidade: item.quantidade,
            pct: 0,
          }],
        });
      }
    });

    // Calculate percentages and ticket
    const result = Array.from(map.values());
    result.forEach(b => {
      b.ticket_medio = b.total_quantidade > 0 ? b.total_faturamento / b.total_quantidade : 0;
      b.categorias.forEach(c => {
        c.pct = b.total_faturamento > 0 ? (c.faturamento / b.total_faturamento) * 100 : 0;
      });
      // Sort categories by faturamento desc
      b.categorias.sort((a, c) => c.faturamento - a.faturamento);
    });

    // Sort by total faturamento
    result.sort((a, b) => b.total_faturamento - a.total_faturamento);
    return result;
  }, [data]);

  const maxFaturamento = barbeiros[0]?.total_faturamento || 1;

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive text-sm">
        Erro ao carregar dados: {error}
      </div>
    );
  }

  if (barbeiros.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Nenhum dado encontrado para o período.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>Clique em um barbeiro para ver detalhes por categoria</span>
      </div>

      <div className="space-y-3">
        {barbeiros.map((b, idx) => (
          <Card 
            key={b.colaborador_id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => onDrillDown(b)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-primary">{idx + 1}°</span>
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      {b.colaborador_nome}
                      {idx === 0 && <Award className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(b.total_quantidade)} atendimentos · Ticket {formatCurrency(b.ticket_medio)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">{formatCurrency(b.total_faturamento)}</div>
                  <div className="text-xs text-muted-foreground">
                    {((b.total_faturamento / barbeiros.reduce((s, x) => s + x.total_faturamento, 0)) * 100).toFixed(1)}% do total
                  </div>
                </div>
              </div>

              {/* Stacked Bar */}
              <div className="h-6 rounded-full overflow-hidden bg-muted/30 mb-2">
                <div 
                  className="h-full flex"
                  style={{ width: `${(b.total_faturamento / maxFaturamento) * 100}%` }}
                >
                  {b.categorias.map((cat, i) => (
                    <div
                      key={cat.categoria}
                      className="h-full transition-all"
                      style={{ 
                        width: `${cat.pct}%`,
                        backgroundColor: getCategoryColor(cat.categoria).bar,
                      }}
                      title={`${cat.categoria}: ${formatCurrency(cat.faturamento)} (${cat.pct.toFixed(1)}%)`}
                    />
                  ))}
                </div>
              </div>

              {/* Category badges */}
              <div className="flex flex-wrap gap-1.5">
                {b.categorias.slice(0, 4).map(cat => (
                  <Badge
                    key={cat.categoria}
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${getCategoryColor(cat.categoria).badge}`}
                  >
                    {cat.categoria.replace('Serviço ', '').replace('Produtos ', 'Prod. ')}: {cat.pct.toFixed(0)}%
                  </Badge>
                ))}
                {b.categorias.length > 4 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
                    +{b.categorias.length - 4}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

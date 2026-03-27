import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, ReferenceLine, Legend
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChurnEvolucaoBarbeiroItem } from '@/hooks/raiox-clientes/useRaioXClientesChurnEvolucaoBarbeiro';

type VisualizationMode = 'percentual' | 'absoluto' | 'ambos';

interface Props {
  data: ChurnEvolucaoBarbeiroItem[];
  title: string;
  description?: string;
  periodoLabel: string;
  onBarbeiroClick?: (barbeiroId: string, periodo: string) => void;
}

interface ChurnTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  data?: ChurnEvolucaoBarbeiroItem[];
}

function ChurnTooltip({ active, payload, label, data }: ChurnTooltipProps) {
  if (!active || !payload?.length || !data) return null;
  
  const item = data.find(d => d.ano_mes_label === label);
  if (!item) return null;

  const tendencia = useMemo(() => {
    const idx = data.findIndex(d => d.ano_mes_label === label);
    if (idx <= 0) return 'estavel';
    const anterior = data[idx - 1];
    const diff = item.churn_pct - anterior.churn_pct;
    if (diff > 1) return 'alta';
    if (diff < -1) return 'baixa';
    return 'estavel';
  }, [data, item, label]);

  const TrendIcon = tendencia === 'alta' ? TrendingUp : tendencia === 'baixa' ? TrendingDown : Minus;
  const trendColor = tendencia === 'alta' ? 'text-destructive' : tendencia === 'baixa' ? 'text-green-600' : 'text-muted-foreground';

  return (
    <div className="rounded-lg border border-border/50 bg-popover p-4 shadow-md text-xs space-y-2 min-w-[280px]">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-foreground">{item.colaborador_nome}</p>
        <div className="flex items-center gap-1">
          <TrendIcon className={`h-3 w-3 ${trendColor}`} />
          <span className={`text-xs ${trendColor}`}>
            {tendencia === 'alta' ? 'Piorando' : tendencia === 'baixa' ? 'Melhorando' : 'Estável'}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Base Ativa</p>
          <p className="font-medium text-foreground">{item.base_ativa.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Atendidos</p>
          <p className="font-medium text-foreground">{item.atendidos_mes.toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Churn Total:</span>
          <span className="font-medium text-destructive">{item.churn_pct.toFixed(1)}%</span>
        </div>
        <div className="pl-2 space-y-1 border-l border-border/30">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fidelizados:</span>
            <span className="text-foreground">{item.perdidos_fidelizados} ({item.churn_fidelizados_pct.toFixed(1)}%)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">One-shot:</span>
            <span className="text-foreground">{item.perdidos_oneshot} ({item.churn_oneshot_pct.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
        <div>
          <p className="text-muted-foreground">Resgatados</p>
          <p className="font-medium text-green-600">{item.resgatados}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Em Risco</p>
          <p className="font-medium text-orange-500">{item.em_risco}</p>
        </div>
      </div>
    </div>
  );
}

export function ChurnEvolucaoBarbeiroChart({ data, title, description, periodoLabel, onBarbeiroClick }: Props) {
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<string>('__todos__');
  const [mode, setMode] = useState<VisualizationMode>('percentual');
  const [visibleSeries, setVisibleSeries] = useState({
    churn_pct: true,
    base_ativa: true,
    resgatados: true,
    perdidos: true
  });

  const barbeiros = useMemo(() => {
    const set = new Set<{ id: string; nome: string }>();
    data.forEach(d => {
      if (d.colaborador_id && d.colaborador_nome) {
        set.add({ id: d.colaborador_id, nome: d.colaborador_nome });
      }
    });
    return Array.from(set).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [data]);

  const chartData = useMemo(() => {
    const filtered = selectedBarbeiro === '__todos__' 
      ? data 
      : data.filter(d => d.colaborador_id === selectedBarbeiro);

    const grouped = filtered.reduce((acc, item) => {
      const key = item.ano_mes_label;
      if (!acc[key]) {
        acc[key] = {
          periodo: key,
          base_ativa: 0,
          perdidos: 0,
          perdidos_fidelizados: 0,
          perdidos_oneshot: 0,
          resgatados: 0,
          em_risco: 0,
          atendidos_mes: 0,
          churn_pct: 0,
          count: 0
        };
      }
      
      acc[key].base_ativa += item.base_ativa;
      acc[key].perdidos += item.perdidos;
      acc[key].perdidos_fidelizados += item.perdidos_fidelizados;
      acc[key].perdidos_oneshot += item.perdidos_oneshot;
      acc[key].resgatados += item.resgatados;
      acc[key].em_risco += item.em_risco;
      acc[key].atendidos_mes += item.atendidos_mes;
      acc[key].count++;
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).map((item: any) => ({
      ...item,
      churn_pct: item.base_ativa > 0 ? (item.perdidos / item.base_ativa) * 100 : 0
    })).sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [data, selectedBarbeiro]);

  const averages = useMemo(() => {
    if (chartData.length === 0) return { churn_pct: 0, base_ativa: 0, resgatados: 0 };
    
    return {
      churn_pct: chartData.reduce((sum, d) => sum + d.churn_pct, 0) / chartData.length,
      base_ativa: chartData.reduce((sum, d) => sum + d.base_ativa, 0) / chartData.length,
      resgatados: chartData.reduce((sum, d) => sum + d.resgatados, 0) / chartData.length
    };
  }, [chartData]);

  const toggleSeries = (key: keyof typeof visibleSeries) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (data.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Nenhum dado de evolução disponível
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {description && (
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{description}</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={mode} onValueChange={(v) => setMode(v as VisualizationMode)}>
              <SelectTrigger className="h-7 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">%</SelectItem>
                <SelectItem value="absoluto">Nº</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedBarbeiro} onValueChange={setSelectedBarbeiro}>
              <SelectTrigger className="h-7 w-[140px] text-xs">
                <SelectValue placeholder="Barbeiro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                {barbeiros.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground">{periodoLabel}</div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Legenda Interativa */}
        <div className="flex flex-wrap gap-1 mb-4">
          <Button
            variant={visibleSeries.churn_pct ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => toggleSeries('churn_pct')}
          >
            <div className="w-2 h-2 rounded-full bg-destructive mr-1" />
            Churn %
          </Button>
          <Button
            variant={visibleSeries.base_ativa ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => toggleSeries('base_ativa')}
          >
            <div className="w-2 h-2 rounded-full bg-primary mr-1" />
            Base Ativa
          </Button>
          <Button
            variant={visibleSeries.resgatados ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => toggleSeries('resgatados')}
          >
            <div className="w-2 h-2 rounded-full bg-green-500 mr-1" />
            Resgatados
          </Button>
          <Button
            variant={visibleSeries.perdidos ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => toggleSeries('perdidos')}
          >
            <div className="w-2 h-2 rounded-full bg-orange-500 mr-1" />
            Perdidos
          </Button>
        </div>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis
                dataKey="periodo"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              
              {(mode === 'percentual' || mode === 'ambos') && (
                <YAxis
                  yAxisId="percentage"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
              )}
              
              {(mode === 'absoluto' || mode === 'ambos') && (
                <YAxis
                  yAxisId="absolute"
                  orientation="right"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
              )}

              <Tooltip content={<ChurnTooltip data={data} />} />

              {/* Linhas de referência para médias */}
              {visibleSeries.churn_pct && (mode === 'percentual' || mode === 'ambos') && (
                <ReferenceLine
                  yAxisId="percentage"
                  y={averages.churn_pct}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{ 
                    value: `Média: ${averages.churn_pct.toFixed(1)}%`, 
                    position: 'insideTopLeft', 
                    fontSize: 9, 
                    fill: 'hsl(var(--muted-foreground))' 
                  }}
                />
              )}

              {/* Barras para perdidos */}
              {visibleSeries.perdidos && (mode === 'absoluto' || mode === 'ambos') && (
                <Bar
                  yAxisId="absolute"
                  dataKey="perdidos"
                  name="Perdidos"
                  fill="hsl(var(--destructive))"
                  opacity={0.6}
                  radius={[2, 2, 0, 0]}
                />
              )}

              {/* Linhas principais */}
              {visibleSeries.churn_pct && (mode === 'percentual' || mode === 'ambos') && (
                <Line
                  yAxisId="percentage"
                  type="monotone"
                  dataKey="churn_pct"
                  name="Churn %"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--destructive))' }}
                />
              )}

              {visibleSeries.base_ativa && (mode === 'absoluto' || mode === 'ambos') && (
                <Line
                  yAxisId="absolute"
                  type="monotone"
                  dataKey="base_ativa"
                  name="Base Ativa"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                />
              )}

              {visibleSeries.resgatados && (mode === 'absoluto' || mode === 'ambos') && (
                <Line
                  yAxisId="absolute"
                  type="monotone"
                  dataKey="resgatados"
                  name="Resgatados"
                  stroke="hsl(142, 71%, 45%)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(142, 71%, 45%)' }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Insights de Performance */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-md bg-muted/40">
            <div className="text-xs text-muted-foreground">Churn Médio</div>
            <div className="text-sm font-medium text-destructive">
              {averages.churn_pct.toFixed(1)}%
            </div>
          </div>
          
          <div className="text-center p-2 rounded-md bg-muted/40">
            <div className="text-xs text-muted-foreground">Base Média</div>
            <div className="text-sm font-medium text-primary">
              {Math.round(averages.base_ativa).toLocaleString()}
            </div>
          </div>
          
          <div className="text-center p-2 rounded-md bg-muted/40">
            <div className="text-xs text-muted-foreground">Resgates/Mês</div>
            <div className="text-sm font-medium text-green-600">
              {Math.round(averages.resgatados)}
            </div>
          </div>
          
          <div className="text-center p-2 rounded-md bg-muted/40">
            <div className="text-xs text-muted-foreground">Profissionais</div>
            <div className="text-sm font-medium text-foreground">
              {selectedBarbeiro === '__todos__' ? barbeiros.length : 1}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
import React, { useEffect, useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, ChevronLeft, ChevronRight, User, Layers, Package, Scissors } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ServicoItem, ServicosFilters } from '@/hooks/useServicos';

// DrillStack entry
interface DrillLevel {
  level: number;
  label: string;
  type: 'barbeiro' | 'categoria' | 'servico';
  params: {
    colaboradorId?: string;
    colaboradorNome?: string;
    categoria?: string;
  };
}

interface ServicosDrillSheetProps {
  open: boolean;
  onClose: () => void;
  item: ServicoItem | null;
  agrupamento: 'servico' | 'barbeiro' | 'mes';
  baseFilters: ServicosFilters;
  // For barbeiro view drill
  barbeiro?: {
    colaborador_id: string;
    colaborador_nome: string;
    total_faturamento: number;
    total_quantidade: number;
    ticket_medio: number;
    categorias: { categoria: string; faturamento: number; quantidade: number; pct: number }[];
  };
}

// VIP Palette
const VIBRANT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--info))',
  'hsl(43, 72%, 44%)',
  'hsl(156, 78%, 35%)',
  'hsl(205, 78%, 44%)',
];

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--popover-foreground))',
};

const AXIS_STYLE = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 };

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat('pt-BR').format(v);

const getCategoryColor = (cat: string) => {
  if (cat.includes('Base')) return 'bg-primary/10 text-primary border-primary/20';
  if (cat.includes('Extra')) return 'bg-success/10 text-success border-success/20';
  if (cat.includes('Produto')) return 'bg-info/10 text-info border-info/20';
  return 'bg-muted text-muted-foreground';
};

const getCategoryBarColor = (cat: string) => {
  if (cat.includes('Base')) return 'hsl(var(--primary))';
  if (cat.includes('Extra')) return 'hsl(var(--success))';
  if (cat.includes('Produto')) return 'hsl(var(--info))';
  return 'hsl(var(--muted-foreground))';
};

export function ServicosDrillSheet({
  open, onClose, item, agrupamento, baseFilters, barbeiro,
}: ServicosDrillSheetProps) {
  const [drillStack, setDrillStack] = useState<DrillLevel[]>([]);
  const [drillData, setDrillData] = useState<ServicoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize drill stack when opening
  useEffect(() => {
    if (!open) {
      setDrillStack([]);
      setDrillData([]);
      return;
    }

    if (barbeiro) {
      // Starting from barbeiro view - show categories level
      setDrillStack([{
        level: 1,
        label: barbeiro.colaborador_nome,
        type: 'barbeiro',
        params: {
          colaboradorId: barbeiro.colaborador_id,
          colaboradorNome: barbeiro.colaborador_nome,
        },
      }]);
    } else if (item && agrupamento === 'servico') {
      // Drilling into a service → show barbers who did it
      fetchServiceDrill(item);
    } else if (item && agrupamento === 'barbeiro') {
      // Drilling into a barber from existing view
      setDrillStack([{
        level: 1,
        label: item.colaborador_nome || item.nome,
        type: 'barbeiro',
        params: {
          colaboradorId: item.colaborador_id || '',
          colaboradorNome: item.colaborador_nome || item.nome,
        },
      }]);
    }
  }, [open, barbeiro, item, agrupamento]);

  // Fetch data based on current drill level
  useEffect(() => {
    if (!open || drillStack.length === 0) return;
    
    const currentLevel = drillStack[drillStack.length - 1];
    
    if (currentLevel.type === 'barbeiro') {
      // Show categories for this barber - we already have this from the barbeiro prop or need to fetch
      if (barbeiro && drillStack.length === 1) {
        // Use the passed barbeiro data directly
        setDrillData([]);
        setLoading(false);
      } else {
        // Fetch categories for this barber
        fetchBarbeiroCategories(currentLevel.params.colaboradorId!);
      }
    } else if (currentLevel.type === 'categoria') {
      // Show services for this barber + category
      fetchCategoryServices(
        currentLevel.params.colaboradorId!,
        currentLevel.params.categoria!
      );
    }
  }, [drillStack, open]);

  const fetchServiceDrill = useCallback(async (serviceItem: ServicoItem) => {
    setLoading(true);
    setError(null);
    
    const { data, error: rpcErr } = await supabase.rpc('rpc_servicos_analise' as any, {
      p_data_inicio: baseFilters.dataInicio,
      p_data_fim: baseFilters.dataFim,
      p_colaborador_id: null,
      p_tipo_servico: null,
      p_agrupamento: 'barbeiro',
    });

    if (rpcErr) {
      setError(rpcErr.message);
      setDrillData([]);
    } else {
      const typed = data as any;
      setDrillData(typed?.items ?? []);
    }
    setLoading(false);
  }, [baseFilters]);

  const fetchBarbeiroCategories = useCallback(async (colaboradorId: string) => {
    setLoading(true);
    setError(null);
    
    const { data, error: rpcErr } = await supabase.rpc('rpc_servicos_barbeiro_categoria' as any, {
      p_data_inicio: baseFilters.dataInicio,
      p_data_fim: baseFilters.dataFim,
      p_colaborador_id: colaboradorId,
    });

    if (rpcErr) {
      setError(rpcErr.message);
      setDrillData([]);
    } else {
      const typed = data as any;
      // Group by categoria
      const items = typed?.items ?? [];
      const grouped = items.reduce((acc: any[], item: any) => {
        const existing = acc.find(x => x.categoria === item.categoria);
        if (existing) {
          existing.faturamento += item.faturamento;
          existing.quantidade += item.quantidade;
        } else {
          acc.push({ ...item, nome: item.categoria });
        }
        return acc;
      }, []);
      grouped.forEach((g: any) => {
        g.ticket_medio = g.quantidade > 0 ? g.faturamento / g.quantidade : 0;
      });
      setDrillData(grouped);
    }
    setLoading(false);
  }, [baseFilters]);

  const fetchCategoryServices = useCallback(async (colaboradorId: string, categoria: string) => {
    setLoading(true);
    setError(null);
    
    // Map categoria to tipoServico filter
    let tipoServico: string | null = null;
    if (categoria.includes('Base')) tipoServico = 'Base';
    else if (categoria.includes('Extra')) tipoServico = 'Extra';
    else if (categoria.includes('Produto')) tipoServico = 'Produtos';

    const { data, error: rpcErr } = await supabase.rpc('rpc_servicos_analise' as any, {
      p_data_inicio: baseFilters.dataInicio,
      p_data_fim: baseFilters.dataFim,
      p_colaborador_id: colaboradorId,
      p_tipo_servico: tipoServico,
      p_agrupamento: 'servico',
    });

    if (rpcErr) {
      setError(rpcErr.message);
      setDrillData([]);
    } else {
      const typed = data as any;
      // Filter to only this categoria
      const items = (typed?.items ?? []).filter((i: any) => i.categoria === categoria);
      setDrillData(items);
    }
    setLoading(false);
  }, [baseFilters]);

  const handleDrillIntoCategory = useCallback((categoria: string) => {
    const currentLevel = drillStack[drillStack.length - 1];
    setDrillStack(prev => [...prev, {
      level: prev.length + 1,
      label: categoria,
      type: 'categoria',
      params: {
        ...currentLevel.params,
        categoria,
      },
    }]);
  }, [drillStack]);

  const handleBack = useCallback(() => {
    if (drillStack.length > 1) {
      setDrillStack(prev => prev.slice(0, -1));
    } else {
      onClose();
    }
  }, [drillStack, onClose]);

  const currentLevel = drillStack[drillStack.length - 1];

  // Build chart data
  const chartData = drillData.slice(0, 8).map((d, i) => ({
    name: d.nome || d.categoria,
    faturamento: d.faturamento,
    quantidade: d.quantidade,
    fill: currentLevel?.type === 'barbeiro' 
      ? getCategoryBarColor(d.categoria || d.nome)
      : VIBRANT_COLORS[i % VIBRANT_COLORS.length],
  }));

  // Render categories view for barbeiro level
  const renderBarbeiroCategorias = () => {
    if (!barbeiro || drillStack.length !== 1) return null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{formatCurrency(barbeiro.total_faturamento)}</div>
            <div className="text-xs text-muted-foreground">Faturamento Total</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{formatNumber(barbeiro.total_quantidade)}</div>
            <div className="text-xs text-muted-foreground">Atendimentos</div>
          </div>
        </div>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Categorias
        </p>

        <div className="space-y-2">
          {barbeiro.categorias.map((cat, idx) => (
            <Card
              key={cat.categoria}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleDrillIntoCategory(cat.categoria)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-primary">{idx + 1}°</span>
                  <div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getCategoryColor(cat.categoria)}`}
                    >
                      {cat.categoria.includes('Produto') ? <Package className="h-3 w-3 mr-1" /> : <Scissors className="h-3 w-3 mr-1" />}
                      {cat.categoria}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatNumber(cat.quantidade)} itens
                    </div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <div className="text-sm font-bold text-primary">{formatCurrency(cat.faturamento)}</div>
                    <div className="text-xs text-muted-foreground">{cat.pct.toFixed(1)}%</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  // Render services list for categoria level
  const renderServicos = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      );
    }

    if (drillData.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhum dado encontrado.
        </div>
      );
    }

    const totalFat = drillData.reduce((s, d) => s + d.faturamento, 0);

    return (
      <>
        {/* Bar chart */}
        {chartData.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Top {Math.min(8, chartData.length)}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={AXIS_STYLE}
                  axisLine={false}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis
                  tick={AXIS_STYLE}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatCurrency}
                  width={68}
                />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Faturamento']}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                />
                <Bar dataKey="faturamento" radius={[4, 4, 0, 0]}>
                  {chartData.map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Table */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Detalhamento
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">
                    {currentLevel?.type === 'categoria' ? 'Serviço' : 'Categoria'}
                  </TableHead>
                  <TableHead className="text-xs text-right">Faturamento</TableHead>
                  <TableHead className="text-xs text-right">Qtd</TableHead>
                  <TableHead className="text-xs text-right">Ticket</TableHead>
                  <TableHead className="text-xs text-right">Part.%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillData.map((d, i) => {
                  const pct = totalFat > 0 ? (d.faturamento / totalFat) * 100 : 0;
                  return (
                    <TableRow 
                      key={i} 
                      className={`hover:bg-muted/30 ${currentLevel?.type === 'barbeiro' ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (currentLevel?.type === 'barbeiro') {
                          handleDrillIntoCategory(d.categoria || d.nome);
                        }
                      }}
                    >
                      <TableCell className="text-xs text-muted-foreground">{i + 1}°</TableCell>
                      <TableCell className="text-xs font-medium">
                        <div className="flex items-center gap-1">
                          <span
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: chartData[i]?.fill || VIBRANT_COLORS[i % VIBRANT_COLORS.length] }}
                          />
                          <span className="truncate max-w-[140px]" title={d.nome || d.categoria}>
                            {d.nome || d.categoria}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium text-primary">
                        {formatCurrency(d.faturamento)}
                      </TableCell>
                      <TableCell className="text-xs text-right">{formatNumber(d.quantidade)}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(d.ticket_medio)}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {pct.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader className="pb-4 border-b border-border">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            {drillStack.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-1 text-muted-foreground">
              {drillStack.map((level, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="h-3 w-3" />}
                  <span className={idx === drillStack.length - 1 ? 'text-foreground font-medium' : ''}>
                    {level.label}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            {currentLevel?.type === 'barbeiro' && <User className="h-4 w-4 text-primary" />}
            {currentLevel?.type === 'categoria' && <Layers className="h-4 w-4 text-success" />}
            <SheetTitle className="text-base text-foreground">
              {currentLevel?.type === 'barbeiro' ? 'Categorias do Barbeiro' : 
               currentLevel?.type === 'categoria' ? 'Serviços da Categoria' : 
               item?.nome || 'Detalhes'}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {barbeiro && drillStack.length === 1 ? renderBarbeiroCategorias() : renderServicos()}
        </div>
      </SheetContent>
    </Sheet>
  );
}

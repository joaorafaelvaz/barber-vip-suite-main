import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import type { ServicoItem } from '@/hooks/useServicos';

interface ServicosTableProps {
  items: ServicoItem[];
  agrupamento: 'servico' | 'barbeiro' | 'mes';
  onDrillDown?: (item: ServicoItem) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat('pt-BR').format(v);
const formatPct = (v: number) => `${v.toFixed(1)}%`;

// VIP Palette
const VIBRANT_COLORS = [
  'hsl(43, 72%, 54%)',   // Gold (primary)
  'hsl(156, 78%, 40%)',  // Emerald (success)
  'hsl(205, 78%, 54%)',  // Blue (info)
  'hsl(42, 92%, 52%)',   // Warning gold
  'hsl(43, 72%, 44%)',   // Gold darker
  'hsl(156, 78%, 35%)',  // Emerald darker
  'hsl(205, 78%, 44%)',  // Blue darker
  'hsl(43, 72%, 64%)',   // Gold lighter
];

const getCategoryBadge = (cat: string) => {
  if (cat.includes('Base')) return 'bg-primary/10 text-primary border-primary/20';
  if (cat.includes('Extra')) return 'bg-success/10 text-success border-success/20';
  if (cat.includes('Produto')) return 'bg-info/10 text-info border-info/20';
  return 'bg-muted text-muted-foreground border-border';
};

export function ServicosTable({ items, agrupamento, onDrillDown }: ServicosTableProps) {
  const getDisplayName = (item: ServicoItem) => {
    if (agrupamento === 'barbeiro') return item.colaborador_nome || item.nome;
    if (agrupamento === 'mes') return item.mes_ano || item.nome;
    return item.nome;
  };

  const getColumnHeader = () => {
    if (agrupamento === 'barbeiro') return 'Barbeiro';
    if (agrupamento === 'mes') return 'Mês';
    return 'Serviço';
  };

  const clickable = !!onDrillDown && agrupamento !== 'mes';

  // Calculate max faturamento for bar widths
  const maxFat = Math.max(...items.map((i) => i.faturamento), 1);

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-foreground">
            Ranking por {getColumnHeader()}
          </CardTitle>
          {clickable && (
            <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Clique para detalhar</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Mobile card view */}
        <div className="sm:hidden divide-y divide-border">
          {items.map((item, index) => (
            <div
              key={index}
              className={`p-3 ${clickable ? 'cursor-pointer active:bg-muted/40' : ''}`}
              onClick={() => clickable && onDrillDown?.(item)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs font-bold text-muted-foreground w-5 flex-shrink-0">
                    {index + 1}°
                  </span>
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: VIBRANT_COLORS[index % VIBRANT_COLORS.length] }}
                  />
                  <span className="text-sm font-medium text-foreground truncate" title={getDisplayName(item)}>
                    {getDisplayName(item)}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-sm font-bold text-primary">{formatCurrency(item.faturamento)}</span>
                  {clickable && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              {/* Progress bar */}
              <div className="ml-7 h-1 rounded-full bg-muted overflow-hidden mb-2" style={{ maxWidth: '100%' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.faturamento / maxFat) * 100}%`,
                    backgroundColor: VIBRANT_COLORS[index % VIBRANT_COLORS.length],
                    opacity: 0.7,
                  }}
                />
              </div>
              {/* Meta row */}
              <div className="ml-7 flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
                <span>{formatNumber(item.quantidade)} atend.</span>
                <span>·</span>
                <span>Ticket {formatCurrency(item.ticket_medio)}</span>
                <span>·</span>
                <span>{formatPct(item.participacao_pct)}</span>
                {agrupamento === 'servico' && (
                  <>
                    <span>·</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 h-4 ${getCategoryBadge(item.categoria)}`}
                    >
                      {item.categoria.replace('Serviço ', '').replace('Produtos ', 'Prod. ')}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center text-muted-foreground py-10 text-sm">
              Nenhum resultado encontrado
            </div>
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden sm:block overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20 border-border">
                <TableHead className="w-[40px] text-xs">#</TableHead>
                <TableHead className="min-w-[160px] text-xs">{getColumnHeader()}</TableHead>
                {agrupamento === 'servico' && (
                  <TableHead className="text-center text-xs w-[90px] hidden md:table-cell">Categoria</TableHead>
                )}
                <TableHead className="text-right text-xs">Faturamento</TableHead>
                <TableHead className="text-right text-xs hidden md:table-cell">Qtd</TableHead>
                <TableHead className="text-right text-xs hidden lg:table-cell">Ticket</TableHead>
                <TableHead className="text-right text-xs">Part.%</TableHead>
                {clickable && <TableHead className="w-[32px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow
                  key={index}
                  className={`border-border transition-colors ${clickable ? 'cursor-pointer hover:bg-muted/40' : 'hover:bg-muted/20'}`}
                  onClick={() => clickable && onDrillDown?.(item)}
                >
                  <TableCell className="text-center font-medium text-muted-foreground text-xs">
                    {index + 1}°
                  </TableCell>

                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: VIBRANT_COLORS[index % VIBRANT_COLORS.length] }}
                        />
                        <span
                          className="text-sm truncate max-w-[140px] lg:max-w-[180px] text-foreground"
                          title={getDisplayName(item)}
                        >
                          {getDisplayName(item)}
                        </span>
                      </div>
                      {/* Mini bar */}
                      <div className="ml-4 h-1 rounded-full bg-muted overflow-hidden w-[100px] lg:w-[140px]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(item.faturamento / maxFat) * 100}%`,
                            backgroundColor: VIBRANT_COLORS[index % VIBRANT_COLORS.length],
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    </div>
                  </TableCell>

                  {agrupamento === 'servico' && (
                    <TableCell className="text-center hidden md:table-cell">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0.5 border ${getCategoryBadge(item.categoria)}`}
                      >
                        {item.categoria.replace('Serviço ', '').replace('Produtos ', 'Prod. ')}
                      </Badge>
                    </TableCell>
                  )}

                  <TableCell className="text-right text-sm font-semibold text-primary">
                    {formatCurrency(item.faturamento)}
                  </TableCell>

                  <TableCell className="text-right text-sm text-foreground hidden md:table-cell">
                    {formatNumber(item.quantidade)}
                  </TableCell>

                  <TableCell className="text-right text-sm text-primary/80 hidden lg:table-cell">
                    {formatCurrency(item.ticket_medio)}
                  </TableCell>

                  <TableCell className="text-right">
                    <span className="text-xs text-muted-foreground">
                      {formatPct(item.participacao_pct)}
                    </span>
                  </TableCell>

                  {clickable && (
                    <TableCell className="text-center">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  )}
                </TableRow>
              ))}

              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={agrupamento === 'servico' ? (clickable ? 8 : 7) : (clickable ? 7 : 6)}
                    className="text-center text-muted-foreground py-10 text-sm"
                  >
                    Nenhum resultado encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

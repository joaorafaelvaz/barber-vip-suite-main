// ============================================================
// FILE: src/components/faturamento/DrillTable.tsx
// PROPÓSITO: Tabela responsiva com hierarquia visual + detalhes contextuais
// ============================================================

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { List, ChevronDown, ChevronUp } from 'lucide-react';

function sanitize(val: any): string {
  if (val == null || (typeof val === 'string' && val.trim() === '')) return '(Não informado)';
  return String(val);
}

function formatValue(key: string, val: any): string {
  if (val == null) return '—';
  if (typeof val === 'number') {
    if (key.includes('share') || key.includes('percent') || key.includes('pct')) {
      return `${(val * 100).toFixed(1)}%`;
    }
    if (key.includes('valor') || key === 'total' || key.includes('ticket') || key.includes('medio') || key.includes('faturamento')) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(val);
    }
    return new Intl.NumberFormat('pt-BR').format(val);
  }
  if (Array.isArray(val)) return val.join(', ');
  return sanitize(val);
}

const LABEL_MAP: Record<string, string> = {
  rank: '#', bucket: 'Nome', colaborador_nome: 'Colaborador', item: 'Item',
  grupo_de_produto: 'Grupo', produto: 'Produto', forma_pagamento: 'Pagamento',
  dia_semana: 'Dia', faixa_horaria: 'Horário', valor: 'Valor',
  share: 'Part.(%)', total: 'Total', atendimentos: 'Atend.',
  ticket_medio: 'Ticket', qtd: 'Qtd', qtd_registros: 'Qtd Reg.',
  itens_exemplo: 'Exemplos', dow: 'Dia Nº', colaborador_id: 'ID Colab.',
};

const HIDDEN_COLS_MOBILE = new Set(['rank', 'colaborador_id', 'dow']);
const DETAIL_COLS = new Set(['grupo_de_produto', 'itens_exemplo', 'colaborador_id']);

function colLabel(key: string): string {
  return LABEL_MAP[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

function getRankBadge(idx: number) {
  if (idx === 0) return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px] px-1.5">🥇 #1</Badge>;
  if (idx === 1) return <Badge className="bg-muted text-muted-foreground border-border text-[10px] px-1.5">🥈 #2</Badge>;
  if (idx === 2) return <Badge className="bg-amber-800/20 text-amber-700 border-amber-700/30 text-[10px] px-1.5">🥉 #3</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5">#{idx + 1}</Badge>;
}

interface DrillTableProps { table: any; }

export function DrillTable({ table }: DrillTableProps) {
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    if (!table) return [];
    if (Array.isArray(table)) return table;
    return [];
  }, [table]);

  if (rows.length === 0) {
    if (table && typeof table === 'object' && !Array.isArray(table)) {
      return (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-x-auto">{JSON.stringify(table, null, 2)}</pre>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  const columns = Object.keys(rows[0]);
  const bucketCol = columns.find(c => c === 'bucket' || c === 'item' || c.includes('nome') || c.includes('produto')) || columns[0];
  const valorCol = columns.find(c => c === 'valor' || c.includes('total'));
  const shareCol = columns.find(c => c.includes('share'));
  const detailCols = columns.filter(c => DETAIL_COLS.has(c) && c !== bucketCol);

  const MOBILE_LIMIT = 10;
  const displayRows = showAll ? rows : rows.slice(0, MOBILE_LIMIT);
  const hasMore = rows.length > MOBILE_LIMIT;
  const maxValor = valorCol ? Math.max(...rows.map((r: any) => Number(r[valorCol]) || 0), 1) : 1;

  const isValueCol = (k: string) => k.includes('valor') || k === 'total' || k.includes('ticket') || k.includes('medio');
  const isShareCol = (k: string) => k.includes('share') || k.includes('percent') || k.includes('pct');

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <List className="h-4 w-4 text-primary" />
          Ranking ({rows.length} itens)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mobile: Cards */}
        <div className="md:hidden space-y-2 overflow-hidden max-w-full">
          {displayRows.map((row: any, idx: number) => {
            const valor = valorCol ? Number(row[valorCol]) || 0 : 0;
            const share = shareCol ? Number(row[shareCol]) || 0 : 0;
            const progressValue = (valor / maxValor) * 100;
            const mainLabel = sanitize(row[bucketCol]);

            return (
              <div key={idx} className="p-3 rounded-lg border border-border/30 bg-muted/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {getRankBadge(idx)}
                    <span className="text-sm font-medium text-foreground truncate">{mainLabel}</span>
                  </div>
                  {shareCol && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{(share * 100).toFixed(1)}%</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-foreground">
                    {valorCol ? formatValue(valorCol, valor) : '—'}
                  </span>
                  {row.qtd_registros != null && (
                    <span className="text-xs text-muted-foreground">• {row.qtd_registros} itens</span>
                  )}
                </div>
                {/* Detail info */}
                {detailCols.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-border/20">
                    {detailCols.map(col => {
                      const v = row[col];
                      if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return null;
                      return (
                        <span key={col} className="text-[10px] text-muted-foreground">
                          <span className="font-medium">{colLabel(col)}:</span>{' '}
                          {Array.isArray(v) ? v.join(', ') : sanitize(v)}
                        </span>
                      );
                    })}
                  </div>
                )}
                <Progress value={progressValue} className="h-1.5" />
              </div>
            );
          })}
          {hasMore && !showAll && (
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setShowAll(true)}>
              <ChevronDown className="h-3 w-3 mr-1" /> Ver todos ({rows.length})
            </Button>
          )}
          {showAll && hasMore && (
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setShowAll(false)}>
              <ChevronUp className="h-3 w-3 mr-1" /> Mostrar menos
            </Button>
          )}
        </div>

        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                {columns.map((col) => (
                  <TableHead key={col} className={`text-xs ${isValueCol(col) || isShareCol(col) ? 'text-right' : ''}`}>
                    {colLabel(col)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="w-10">{getRankBadge(idx)}</TableCell>
                  {columns.map((col) => (
                    <TableCell key={col} className={`text-sm ${isValueCol(col) || isShareCol(col) ? 'text-right font-medium' : ''}`}>
                      {formatValue(col, row[col])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

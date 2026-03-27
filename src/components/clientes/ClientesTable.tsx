// ============================================================
// FILE: src/components/clientes/ClientesTable.tsx
// PROPÓSITO: Tabela reutilizável com mobile cards + desktop table
// ============================================================

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { List, ChevronDown, ChevronUp } from 'lucide-react';

export type ColumnDef<T> = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
  hideOnMobile?: boolean;
};

interface ClientesTableProps<T> {
  title: string;
  columns: ColumnDef<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  mobileLimit?: number;
}

export function ClientesTable<T extends Record<string, any>>({
  title,
  columns,
  rows,
  onRowClick,
  mobileLimit = 10,
}: ClientesTableProps<T>) {
  const [showAll, setShowAll] = useState(false);
  const displayRows = showAll ? rows : rows.slice(0, mobileLimit);
  const hasMore = rows.length > mobileLimit;

  const mobileCols = columns.filter(c => !c.hideOnMobile);
  const primaryCol = mobileCols[0];
  const valueCols = mobileCols.slice(1);

  if (rows.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <List className="h-4 w-4 text-primary" />
          {title} ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mobile: Cards */}
        <div className="md:hidden space-y-2">
          {displayRows.map((row, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border border-border/30 bg-muted/10 space-y-1.5 ${onRowClick ? 'cursor-pointer active:bg-muted/20' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              <div className="text-sm font-medium text-foreground truncate">
                {primaryCol?.render ? primaryCol.render(row) : String(row[primaryCol?.key] ?? '')}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {valueCols.map(col => (
                  <span key={col.key} className="text-[11px] text-muted-foreground">
                    <span className="font-medium">{col.label}:</span>{' '}
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </span>
                ))}
              </div>
            </div>
          ))}
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
                {columns.map(col => (
                  <TableHead
                    key={col.key}
                    className={`text-xs ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow
                  key={idx}
                  className={onRowClick ? 'cursor-pointer' : ''}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map(col => (
                    <TableCell
                      key={col.key}
                      className={`text-sm ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                    >
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
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

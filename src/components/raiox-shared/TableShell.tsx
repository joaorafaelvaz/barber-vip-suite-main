import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface TableShellProps {
  title: string;
  description?: string;
  columns: string[];
  children?: React.ReactNode;
  onExport?: () => void;
  filters?: React.ReactNode;
  isEmpty?: boolean;
}

export function TableShell({ title, description, columns, children, onExport, filters, isEmpty = true }: TableShellProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={onExport} className="text-xs">
            <Download className="h-3 w-3 mr-1" /> Export
          </Button>
        </div>
        {filters && <div className="flex flex-wrap gap-2 mt-2">{filters}</div>}
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {isEmpty ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {columns.map((col) => (
                    <th key={col} className="text-left p-2 text-muted-foreground font-medium whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{children}</tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

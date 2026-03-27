// ============================================================
// FILE: src/components/clientes/InfoPopover.tsx
// PROPÓSITO: Popover informativo reutilizável com ícone ⓘ
// ============================================================

import React from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface InfoPopoverProps {
  title: string;
  description: string;
  example?: string;
  periodLabel?: string;
  className?: string;
}

export function InfoPopover({ title, description, example, periodLabel, className }: InfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors h-5 w-5 shrink-0 ${className ?? ''}`}
          aria-label={`Informações: ${title}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-72 text-xs space-y-2">
        <p className="font-semibold text-foreground text-sm">{title}</p>
        {periodLabel && (
          <p className="text-muted-foreground italic">{periodLabel}</p>
        )}
        <p className="text-muted-foreground leading-relaxed">{description}</p>
        {example && (
          <div className="rounded-md bg-muted/50 border border-border/50 p-2 text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Exemplo: </span>
            {example}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

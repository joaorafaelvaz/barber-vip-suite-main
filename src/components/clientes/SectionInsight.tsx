import React, { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface Props {
  text: string;
  label?: string;
  /** When true, only render the trigger button (no wrapper div). Use inside flex headers. */
  inline?: boolean;
}

/**
 * Inline trigger + collapsible insight text.
 * When `inline` is true, the CollapsibleContent renders in a portal-like
 * manner via absolute positioning so the trigger can sit in a flex row.
 */
export function SectionInsight({ text, label, inline }: Props) {
  const [open, setOpen] = useState(false);

  if (!text) return null;

  const buttonLabel = label ? `📊 ${label}` : (open ? 'Ocultar resumo' : 'Ver resumo');

  if (inline) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/50 shrink-0 whitespace-nowrap">
            <span>{buttonLabel}</span>
            <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent forceMount={open ? undefined : undefined}>
          {open && (
            <div className="absolute left-0 right-0 z-10 mt-1 mx-4">
              <div className="bg-muted/80 backdrop-blur-sm border border-border/50 rounded-md p-3">
                <p className="text-[11px] text-foreground/80 leading-relaxed">{text}</p>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5">
          <span>{buttonLabel}</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-muted/50 border border-border/50 rounded-md p-3 mt-1">
          <p className="text-[11px] text-foreground/80 leading-relaxed">{text}</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

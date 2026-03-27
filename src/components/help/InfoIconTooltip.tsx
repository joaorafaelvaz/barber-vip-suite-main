import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface InfoIconTooltipProps {
  title: string;
  short: string;
  details: React.ReactNode;
  size?: 'sm' | 'md';
}

export function InfoIconTooltip({ title, short, details, size = 'sm' }: InfoIconTooltipProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';

  return (
    <TooltipProvider delayDuration={200}>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 ${btnSize}`}
                aria-label={`Informações: ${title}`}
              >
                <Info className={iconSize} />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          {!popoverOpen && (
            <TooltipContent side="top" className="max-w-xs text-xs">
              {short}
            </TooltipContent>
          )}
        </Tooltip>
        <PopoverContent side="top" align="center" className="w-80 text-xs space-y-2 max-h-[60vh] overflow-y-auto">
          <p className="font-semibold text-foreground text-sm">{title}</p>
          <div className="text-muted-foreground leading-relaxed space-y-2">{details}</div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

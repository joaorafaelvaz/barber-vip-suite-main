import React from 'react';
import { Camera, CalendarDays } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

type MetricType = 'snapshot' | 'mensal';

interface MetricTypeBadgeProps {
  type: MetricType;
  className?: string;
}

const CONFIG: Record<MetricType, { icon: React.ReactNode; label: string; tip: string; style: string }> = {
  snapshot: {
    icon: <Camera className="h-2.5 w-2.5" />,
    label: 'Foto',
    tip: 'Snapshot — foto do estado no fim do mês (acumulado histórico)',
    style: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground',
  },
  mensal: {
    icon: <CalendarDays className="h-2.5 w-2.5" />,
    label: 'Mês',
    tip: 'Do mês — atividade ou variação ocorrida naquele mês específico',
    style: 'border-blue-400/40 bg-blue-500/10 text-blue-500 dark:text-blue-400',
  },
};

export function MetricTypeBadge({ type, className }: MetricTypeBadgeProps) {
  const c = CONFIG[type];
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-0.5 rounded border px-1 py-0 text-[9px] font-medium leading-tight select-none ${c.style} ${className ?? ''}`}>
            {c.icon}
            {c.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px]">
          {c.tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

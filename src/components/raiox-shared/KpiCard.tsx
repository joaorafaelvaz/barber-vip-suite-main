import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface KpiMedias {
  m12: number | null;
  m6: number | null;
  ano: number | null;
}

interface KpiCardProps {
  label: React.ReactNode;
  value: string | number;
  subtitle?: string;
  delta?: number | null;
  deltaLabel?: string;
  status?: 'positive' | 'negative' | 'neutral' | 'warning';
  className?: string;
  loading?: boolean;
  suffix?: React.ReactNode;
  medias?: KpiMedias | null;
}

const statusColors = {
  positive: 'text-green-600',
  negative: 'text-destructive',
  neutral: 'text-muted-foreground',
  warning: 'text-yellow-600',
};

const statusBorderColors = {
  positive: 'border-l-emerald-500/60',
  negative: 'border-l-rose-500/60',
  neutral: 'border-l-border',
  warning: 'border-l-amber-500/60',
};

export function KpiCard({ label, value, subtitle, delta, deltaLabel, status = 'neutral', className, loading, suffix, medias }: KpiCardProps) {
  const DeltaIcon = delta && delta > 0 ? TrendingUp : delta && delta < 0 ? TrendingDown : Minus;

  return (
    <Card className={cn('border-border/50 border-l-2 overflow-hidden', statusBorderColors[status], className)}>
      <CardContent className="p-2 sm:p-3 md:p-4">
        <div className="flex items-start justify-between gap-1 mb-0.5 sm:mb-1 min-w-0">
          <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground leading-tight flex-1 min-w-0">{label}</p>
          {suffix && <div className="flex items-center shrink-0 text-muted-foreground">{suffix}</div>}
        </div>
        {loading ? (
          <div className="h-5 sm:h-6 md:h-7 w-12 sm:w-14 md:w-16 bg-muted animate-pulse rounded" />
        ) : (
          <>
            <p className="text-sm sm:text-base md:text-xl font-bold text-foreground truncate">{value}</p>
            {subtitle && (
              <p className="text-[8px] sm:text-[9px] md:text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            )}
          </>
        )}
        {delta != null && !loading && (
          <div className={cn('flex items-center gap-1 mt-1 text-[9px] sm:text-[10px] md:text-xs', statusColors[status])}>
            <DeltaIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            <span>{delta > 0 ? '+' : ''}{delta}%</span>
            {deltaLabel && <span className="text-muted-foreground ml-1">{deltaLabel}</span>}
          </div>
        )}
        {medias && !loading && (
          <div className="flex items-center gap-1 sm:gap-1.5 mt-1 sm:mt-1.5 pt-1 sm:pt-1.5 border-t border-border/20 text-[8px] sm:text-[9px] text-muted-foreground tabular-nums flex-wrap">
            {medias.m12 != null && <span>12m: <span className="text-foreground/80 font-medium">{medias.m12.toLocaleString('pt-BR')}</span></span>}
            {medias.m6 != null && <span>6m: <span className="text-foreground/80 font-medium">{medias.m6.toLocaleString('pt-BR')}</span></span>}
            {medias.ano != null && <span>Ano: <span className="text-foreground/80 font-medium">{medias.ano.toLocaleString('pt-BR')}</span></span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

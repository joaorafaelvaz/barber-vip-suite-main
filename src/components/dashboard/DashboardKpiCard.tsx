// ============================================================
// FILE: src/components/dashboard/DashboardKpiCard.tsx
// PROPÓSITO: Card individual de KPI com comparações slim
// FORMATAÇÃO: pt-BR para moeda e números
// ============================================================

import React, { useState, useMemo } from 'react';
import { LucideIcon, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { KpiDetails, KpiComparisons } from './types';

// ============================================================
// HELPERS DE FORMATAÇÃO
// ============================================================

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(value));
}

function formatDecimal(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
}

// ============================================================
// TIPOS
// ============================================================

interface DashboardKpiCardProps {
  title: string;
  value: number;
  format: 'currency' | 'number' | 'decimal';
  icon: LucideIcon;
  subtitle?: string;
  iconColor?: string;
  gradientColor?: string;
  details?: KpiDetails;
  comparisons?: KpiComparisons;
}

// ============================================================
// COMPONENTE: CHIP DE COMPARAÇÃO (INLINE/SLIM)
// ============================================================

interface ComparisonChipProps {
  label: string;
  tooltip: string;
  currentValue: number;
  compareValue?: number | null;
}

function ComparisonChip({ label, tooltip, currentValue, compareValue }: ComparisonChipProps) {
  if (compareValue === undefined || compareValue === null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60 font-mono">
              {label}<span className="text-muted-foreground/40">#*</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>{tooltip}</p>
            <p className="text-muted-foreground">Dado não disponível</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const variation = compareValue !== 0 
    ? ((currentValue - compareValue) / compareValue) * 100 
    : 0;
  
  const isPositive = variation > 0;
  const isNeutral = Math.abs(variation) < 0.1;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[10px] font-medium',
            isNeutral ? 'text-muted-foreground' : isPositive ? 'text-emerald-500' : 'text-red-500'
          )}>
            {label}
            {isNeutral ? (
              <Minus className="h-2.5 w-2.5" />
            ) : isPositive ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
            <span className="font-mono">{formatPercent(variation)}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function DashboardKpiCard({ 
  title, 
  value, 
  format: formatType, 
  icon: Icon,
  subtitle,
  iconColor = 'text-muted-foreground',
  gradientColor,
  details,
  comparisons
}: DashboardKpiCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Formata o valor conforme o tipo
  const formattedValue = useMemo(() => {
    switch (formatType) {
      case 'currency':
        return formatBRL(value);
      case 'decimal':
        return formatDecimal(value, 2);
      case 'number':
      default:
        return formatNumber(value);
    }
  }, [value, formatType]);

  // Extrai a cor base do iconColor para o gradiente
  const bgGradient = useMemo(() => {
    if (gradientColor) return gradientColor;
    const colorMap: Record<string, string> = {
      'text-green-500': 'hsl(142 76% 36%)',
      'text-blue-500': 'hsl(217 91% 60%)',
      'text-purple-500': 'hsl(262 83% 58%)',
      'text-orange-500': 'hsl(25 95% 53%)',
      'text-cyan-500': 'hsl(188 78% 41%)',
      'text-pink-500': 'hsl(330 81% 60%)',
      'text-amber-500': 'hsl(45 93% 47%)',
      'text-indigo-500': 'hsl(239 84% 67%)',
      'text-emerald-500': 'hsl(160 84% 39%)',
    };
    return colorMap[iconColor] || 'hsl(var(--primary))';
  }, [iconColor, gradientColor]);

  return (
    <Card className="overflow-hidden relative group border-border/50">
      {/* Gradiente de fundo sutil */}
      <div 
        className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity"
        style={{ 
          background: `linear-gradient(135deg, ${bgGradient} 0%, transparent 60%)` 
        }}
      />
      
      <CardContent className="relative p-3">
        {/* Header: Título + Info + Ícone */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
              {title}
            </span>
            {details && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger className="p-0.5 rounded hover:bg-muted/50 transition-colors">
                  <Info className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground" />
                </CollapsibleTrigger>
              </Collapsible>
            )}
          </div>
          <Icon className={cn('h-4 w-4 shrink-0 opacity-60', iconColor)} />
        </div>

        {/* Valor Principal - Responsivo */}
        <div className="kpi-value font-bold text-foreground truncate mb-2">
          {formattedValue}
        </div>

        {/* Comparações Inline Slim */}
        {comparisons && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 border-t border-border/30">
            <ComparisonChip 
              label="SPLY" 
              tooltip="Same Period Last Year"
              currentValue={value}
              compareValue={comparisons.sply}
            />
            <ComparisonChip 
              label="MOM" 
              tooltip="Month over Month"
              currentValue={value}
              compareValue={comparisons.mom}
            />
            <ComparisonChip 
              label="M12" 
              tooltip="Média 12 meses"
              currentValue={value}
              compareValue={comparisons.avg_12m}
            />
            <ComparisonChip 
              label="M6" 
              tooltip="Média 6 meses"
              currentValue={value}
              compareValue={comparisons.avg_6m}
            />
          </div>
        )}

        {/* Detalhes Expandíveis */}
        {details && isExpanded && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <div className="text-[10px] space-y-1.5 p-2 rounded bg-muted/30">
              <p className="text-foreground leading-relaxed">{details.description}</p>
              <div className="flex flex-col gap-0.5 text-muted-foreground">
                <span>
                  <span className="opacity-60">Cálculo:</span>{' '}
                  <code className="text-[9px] bg-muted px-1 py-0.5 rounded font-mono">
                    {details.formula}
                  </code>
                </span>
                <span>
                  <span className="opacity-60">Fonte:</span> {details.source}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Subtítulo (só aparece se não há comparações nem detalhes expandidos) */}
        {subtitle && !comparisons && !isExpanded && (
          <p className="text-[10px] text-muted-foreground truncate">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default DashboardKpiCard;

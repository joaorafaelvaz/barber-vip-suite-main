import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Filter } from 'lucide-react';
import type { BaseType } from './BaseBadge';

interface BaseSelectorProps {
  value: BaseType;
  onChange: (v: BaseType) => void;
  meses?: number;
  dias?: number;
  /** Label exibido antes dos badges */
  label?: string;
}

const OPTIONS: { type: BaseType; icon: (m: number, d: number) => React.ReactNode; label: (m: number, d: number) => string }[] = [
  { type: 'P', icon: () => <Filter className="h-2.5 w-2.5" />, label: () => 'Principal' },
  { type: 'S', icon: (m) => <span>{m}</span>, label: (m) => `Status ${m}m` },
  { type: 'T', icon: () => <span>T</span>, label: () => 'Total' },
  { type: 'J', icon: () => <span>J</span>, label: (_m, d) => `Janela ${d}d` },
];

const SELECTED_STYLES: Record<BaseType, string> = {
  P: 'border-blue-500 bg-blue-500/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400/50',
  S: 'border-amber-500 bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/50',
  T: 'border-emerald-500 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400/50',
  J: 'border-violet-500 bg-violet-500/20 text-violet-700 dark:text-violet-300 ring-1 ring-violet-400/50',
};

const UNSELECTED = 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/60';

export function BaseSelector({ value, onChange, meses = 12, dias = 60, label }: BaseSelectorProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {label && <span className="text-xs text-muted-foreground shrink-0">{label}</span>}
      <div className="flex items-center gap-1">
        {OPTIONS.map((opt) => {
          const selected = value === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => onChange(opt.type)}
              className="inline-flex"
            >
              <Badge
                variant="outline"
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold leading-tight rounded cursor-pointer select-none transition-all ${
                  selected ? SELECTED_STYLES[opt.type] : UNSELECTED
                }`}
              >
                {opt.icon(meses, dias)}
                <span className="font-normal ml-0.5">{opt.label(meses, dias)}</span>
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

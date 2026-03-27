import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Filter } from 'lucide-react';

export type BaseType = 'P' | 'S' | 'T' | 'J';

interface BaseBadgeProps {
  type: BaseType;
  /** Para type='S', quantos meses (ex: 12). Default: 12 */
  meses?: number;
  /** Para type='J', quantos dias da janela (ex: 60). Default: 60 */
  dias?: number;
  /** Mostra label textual ao lado do ícone */
  withLabel?: boolean;
}

const POPOVER_TEXT = {
  P: {
    title: 'Base Principal',
    desc: 'Clientes filtrados pelo modo configurado na aba Config (Janela, Período filtrado, Total ou Total com corte). Representa o universo de análise das métricas de período.',
  },
  S: (m: number) => ({
    title: `Base Status ${m}m`,
    desc: `Clientes com pelo menos 1 atividade nos últimos ${m} meses até a data REF. Usada para classificações de saúde (Perfil, Cadência, Status 12m).`,
  }),
  T: {
    title: 'Base Total',
    desc: 'Todos os clientes do histórico completo, sem recorte de período ou janela. Útil para análises de longo prazo e comparações absolutas.',
  },
  J: (d: number) => ({
    title: `Base Janela ${d}d`,
    desc: `Clientes com atividade nos últimos ${d} dias a partir da data REF. A janela é configurável (30, 60, 90, 120 dias) na aba Config.`,
  }),
};

const TYPE_STYLES: Record<BaseType, string> = {
  P: 'border-blue-400/60 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  S: 'border-amber-400/60 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  T: 'border-emerald-400/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  J: 'border-violet-400/60 bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

const TYPE_ICON: Record<BaseType, (meses: number, dias: number) => React.ReactNode> = {
  P: () => <Filter className="h-2.5 w-2.5" />,
  S: (m) => <span>{m}</span>,
  T: () => <span>T</span>,
  J: () => <span>J</span>,
};

const TYPE_LABEL: Record<BaseType, (meses: number, dias: number) => string> = {
  P: () => 'Principal',
  S: (m) => `Status ${m}m`,
  T: () => 'Total',
  J: (_m, d) => `Janela ${d}d`,
};

export function BaseBadge({ type, meses = 12, dias = 60, withLabel }: BaseBadgeProps) {
  const info = type === 'S'
    ? POPOVER_TEXT.S(meses)
    : type === 'J'
    ? POPOVER_TEXT.J(dias)
    : POPOVER_TEXT[type];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex">
          <Badge
            variant="outline"
            className={`inline-flex items-center gap-0.5 px-1 py-0 text-[10px] font-bold leading-tight rounded cursor-pointer select-none hover:opacity-80 transition-opacity ${TYPE_STYLES[type]}`}
          >
            {TYPE_ICON[type](meses, dias)}
            {withLabel && (
              <span className="font-normal ml-0.5">
                {TYPE_LABEL[type](meses, dias)}
              </span>
            )}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 p-3 text-xs space-y-1" align="start">
        <p className="font-semibold text-foreground">{info.title}</p>
        <p className="text-muted-foreground leading-relaxed">{info.desc}</p>
      </PopoverContent>
    </Popover>
  );
}

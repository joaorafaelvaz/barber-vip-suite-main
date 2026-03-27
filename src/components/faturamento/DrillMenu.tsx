// ============================================================
// FILE: src/components/faturamento/DrillMenu.tsx
// PROPÓSITO: Menu de aberturas (7 views) + controles contextuais
// ============================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Calendar,
  Users,
  Package,
  ShoppingBag,
  CalendarDays,
  CreditCard,
  Clock,
} from 'lucide-react';
import { VIEW_CONFIG, type ViewId, type Granularidade } from '@/hooks/useFaturamentoDrill';

const VIEW_ICONS: Record<ViewId, React.ReactNode> = {
  periodo: <Calendar className="h-3.5 w-3.5" />,
  colaborador: <Users className="h-3.5 w-3.5" />,
  grupo: <Package className="h-3.5 w-3.5" />,
  item: <ShoppingBag className="h-3.5 w-3.5" />,
  dia_semana: <CalendarDays className="h-3.5 w-3.5" />,
  pagamento: <CreditCard className="h-3.5 w-3.5" />,
  faixa_horaria: <Clock className="h-3.5 w-3.5" />,
};

interface DrillMenuProps {
  selectedView: ViewId;
  onSelectView: (v: ViewId) => void;
  granularidade: Granularidade;
  onGranularidade: (g: Granularidade) => void;
  topLimit: number;
  onTopLimit: (n: number) => void;
}

export function DrillMenu({
  selectedView,
  onSelectView,
  granularidade,
  onGranularidade,
  topLimit,
  onTopLimit,
}: DrillMenuProps) {
  const cfg = VIEW_CONFIG[selectedView];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Aberturas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* View buttons - grid on mobile, flex on desktop */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 max-w-full min-w-0">
          {(Object.keys(VIEW_CONFIG) as ViewId[]).map((id) => (
            <Button
              key={id}
              size="sm"
              variant={selectedView === id ? 'default' : 'outline'}
              onClick={() => onSelectView(id)}
              className="text-xs gap-1.5 w-full sm:w-auto"
            >
              {VIEW_ICONS[id]}
              {VIEW_CONFIG[id].title}
            </Button>
          ))}
        </div>

        {/* Contextual controls */}
        <div className="flex flex-wrap items-center gap-2">
          {cfg.needs?.granularidade && (
            <>
              <span className="text-xs text-muted-foreground">Granularidade:</span>
              {(['day', 'week', 'month'] as Granularidade[]).map((g) => (
                <Button
                  key={g}
                  size="sm"
                  variant={granularidade === g ? 'default' : 'outline'}
                  onClick={() => onGranularidade(g)}
                  className="text-xs h-7 px-2"
                >
                  {g === 'day' ? 'Dia' : g === 'week' ? 'Semana' : 'Mês'}
                </Button>
              ))}
            </>
          )}

          {cfg.needs?.topLimit && (
            <>
              <span className="text-xs text-muted-foreground">Top:</span>
              {[10, 20, 50, 0].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={topLimit === n ? 'default' : 'outline'}
                  onClick={() => onTopLimit(n)}
                  className="text-xs h-7 px-2"
                >
                  {n === 0 ? 'Todos' : n}
                </Button>
              ))}
            </>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          {VIEW_ICONS[selectedView]}
          {cfg.description}
        </p>
      </CardContent>
    </Card>
  );
}

import React from 'react';
import type { RaioXScreen } from './raioxTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

interface Props {
  screen: RaioXScreen;
  screenContext?: Record<string, unknown>;
  onBack: () => void;
}

const SCREEN_TITLES: Record<Exclude<RaioXScreen, 'PAINEL'>, string> = {
  BARBEIRO: 'Visão do Barbeiro',
  DRILLDOWN: 'Lista de Clientes',
  DRILL_FAIXA: 'Clientes por Faixa',
  LISTA_NOVOS: 'Novos Clientes',
  DRILL_RETENCAO_NOVOS: 'Retenção de Novos',
};

export function RaioXClientesScreens({ screen, screenContext, onBack }: Props) {
  if (screen === 'PAINEL') return null;

  const title = SCREEN_TITLES[screen] || screen;

  console.log('[RaioXClientesScreens] screen:', screen, 'context:', screenContext);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>

      <Card className="border-border/50">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            Conteúdo — {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Settings } from 'lucide-react';
import type { ColaboradorComDados } from '@/types/colaborador';
import { getIniciais } from '@/types/colaborador';

interface ColaboradorCardProps {
  colaborador: ColaboradorComDados;
  onVerDetalhes: (colaborador: ColaboradorComDados) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ColaboradorCard({ colaborador, onVerDetalhes }: ColaboradorCardProps) {
  const temFaturamento = colaborador.faturamento > 0;
  const iniciais = getIniciais(colaborador.colaborador_nome);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header com avatar e nome */}
        <div className="flex items-start gap-3 mb-4">
          <div 
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold ${
              temFaturamento 
                ? 'bg-primary/20 text-primary' 
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {iniciais}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {colaborador.colaborador_nome || 'Sem nome'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${temFaturamento ? 'bg-green-500' : 'bg-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">
                {temFaturamento ? 'Ativo' : 'Sem faturamento'}
              </span>
            </div>
          </div>
        </div>

        {/* Métricas */}
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Faturamento</div>
            <div className="text-lg font-semibold">{formatCurrency(colaborador.faturamento)}</div>
          </div>

          {temFaturamento && (
            <>
              <div>
                <div className="text-xs text-muted-foreground">Comissão + Bônus</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-primary">
                    {formatCurrency(colaborador.totalReceber)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({colaborador.percentualTotal.toFixed(1)}%)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {colaborador.faixa && (
                  <Badge 
                    variant="outline" 
                    className={`bg-${colaborador.faixa.cor}/20 border-${colaborador.faixa.cor}`}
                    style={{ 
                      backgroundColor: `hsl(var(--${colaborador.faixa.cor}) / 0.2)`,
                      borderColor: `hsl(var(--${colaborador.faixa.cor}))`
                    }}
                  >
                    {colaborador.faixa.nome}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {colaborador.diasTrabalhados} dias
                </span>
              </div>
            </>
          )}
        </div>

        {/* Ações */}
        <div className="mt-4 pt-4 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => onVerDetalhes(colaborador)}
          >
            {temFaturamento ? (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Ver Detalhes
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Configurar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

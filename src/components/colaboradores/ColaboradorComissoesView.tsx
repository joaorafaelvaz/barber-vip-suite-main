// ============================================================
// FILE: src/components/colaboradores/ColaboradorComissoesView.tsx
// PROPÓSITO: Visualização das regras de comissão do colaborador
// ============================================================

import React from 'react';
import { DollarSign, TrendingUp, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRegrasComissaoPeriodo } from '@/hooks/useRegrasComissao';

interface ColaboradorComissoesViewProps {
  colaboradorId: string;
  colaboradorNome: string;
  ano: number;
  mes: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ColaboradorComissoesView({ 
  colaboradorId, 
  colaboradorNome,
  ano,
  mes 
}: ColaboradorComissoesViewProps) {
  const { data: regrasCompletas = [], isLoading } = useRegrasComissaoPeriodo(ano, mes, colaboradorId);
  
  // Encontrar regra ativa (individual ou global)
  const regraIndividual = regrasCompletas.find(r => r.regra.colaborador_id === colaboradorId);
  const regraGlobal = regrasCompletas.find(r => !r.regra.colaborador_id);
  const regraAtiva = regraIndividual || regraGlobal;
  
  // Faixas da regra ativa
  const faixasRegra = regraAtiva?.faixas || [];

  return (
    <div className="space-y-4">
      {/* Card de regra ativa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Regra de Comissão Ativa
          </CardTitle>
          <CardDescription>
            Regra aplicada em {new Date(ano, mes - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!regraAtiva ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="h-4 w-4" />
              <span className="text-sm">Nenhuma regra de comissão configurada para este período.</span>
            </div>
          ) : (
            <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Badge variant={regraIndividual ? 'default' : 'secondary'}>
                  {regraIndividual ? 'Regra Individual' : 'Regra Global'}
                </Badge>
                {regraAtiva.regra.usa_escalonamento ? (
                  <Badge variant="outline">Escalonamento por Faixa</Badge>
                ) : (
                  <Badge variant="outline">Percentual Fixo: {regraAtiva.regra.percentual_fixo}%</Badge>
                )}
              </div>
              
              {/* Faixas de escalonamento */}
              {regraAtiva.regra.usa_escalonamento && faixasRegra.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Faixas de Comissão
                  </h4>
                  <div className="grid gap-2">
                    {faixasRegra.map((faixa, idx) => (
                      <div 
                        key={faixa.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ 
                              backgroundColor: `hsl(var(--${faixa.cor || 'primary'}))` 
                            }}
                          />
                          <div>
                            <span className="font-medium">{faixa.nome}</span>
                            <span className="text-muted-foreground ml-2 text-sm">
                              {formatCurrency(faixa.valor_minimo)}
                              {faixa.valor_maximo 
                                ? ` - ${formatCurrency(faixa.valor_maximo)}`
                                : '+'
                              }
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-lg font-bold">
                          {faixa.percentual}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Nota sobre edição */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Para editar as regras de comissão, acesse a tela de{' '}
            <a href="/app/comissoes" className="text-primary hover:underline">
              Comissões → Regras
            </a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

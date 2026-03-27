// ============================================================
// FILE: src/components/colaboradores/ColaboradorBonusView.tsx
// PROPÓSITO: Visualização das regras de bônus do colaborador
// ============================================================

import React from 'react';
import { Award, Target, CheckCircle2, XCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBonusRegrasPeriodo, useBonusHistorico } from '@/hooks/useBonus';

interface ColaboradorBonusViewProps {
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

export function ColaboradorBonusView({ 
  colaboradorId, 
  colaboradorNome,
  ano,
  mes 
}: ColaboradorBonusViewProps) {
  const { data: regrasCompletas = [], isLoading } = useBonusRegrasPeriodo(ano, mes);
  const { data: historicoData = [] } = useBonusHistorico(ano, mes, colaboradorId);
  
  // Regras que aplicam a este colaborador (individuais ou globais)
  const regrasAplicaveis = regrasCompletas.filter(r => 
    r.regra.ativo && 
    (!r.regra.colaborador_id || r.regra.colaborador_id === colaboradorId)
  );
  
  // Histórico de bônus deste colaborador
  const historicoColaborador = historicoData.filter(h => 
    h.colaborador_id === colaboradorId &&
    h.ano === ano &&
    h.mes === mes
  );

  return (
    <div className="space-y-4">
      {/* Regras de bônus ativas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" />
            Regras de Bônus Aplicáveis
          </CardTitle>
          <CardDescription>
            Regras ativas em {new Date(ano, mes - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {regrasAplicaveis.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="h-4 w-4" />
              <span className="text-sm">Nenhuma regra de bônus ativa para este período.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {regrasAplicaveis.map(regraCompleta => {
                const regra = regraCompleta.regra;
                const resultado = historicoColaborador.find(h => h.regra_id === regra.id);
                const atingiu = resultado?.atingiu;
                
                return (
                  <div 
                    key={regra.id}
                    className="p-4 rounded-lg bg-muted/30 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{regra.nome_bonus}</h4>
                        <Badge variant={regra.colaborador_id ? 'default' : 'secondary'}>
                          {regra.colaborador_id ? 'Individual' : 'Geral'}
                        </Badge>
                      </div>
                      {resultado && (
                        <div className="flex items-center gap-1">
                          {atingiu ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                              <span className="text-primary font-medium">
                                {formatCurrency(resultado.bonus_calculado)}
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground text-sm">Não atingido</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {regra.descricao_regra && (
                      <p className="text-sm text-muted-foreground">{regra.descricao_regra}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge variant="outline">
                        Tipo: {regra.tipo_bonus}
                      </Badge>
                      {regra.depende_meta && regra.meta_valor && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Meta: {regra.meta_operador} {regra.meta_valor}
                        </Badge>
                      )}
                      {regra.bonus_valor && (
                        <Badge variant="outline">
                          Valor: {formatCurrency(regra.bonus_valor)}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Resumo do período */}
      {historicoColaborador.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total de Bônus no Período</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(
                  historicoColaborador
                    .filter(h => h.atingiu)
                    .reduce((sum, h) => sum + h.bonus_calculado, 0)
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Nota sobre edição */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Para editar as regras de bônus, acesse a tela de{' '}
            <a href="/app/comissoes" className="text-primary hover:underline">
              Comissões → Bônus
            </a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

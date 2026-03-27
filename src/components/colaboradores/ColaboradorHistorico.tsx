// ============================================================
// FILE: src/components/colaboradores/ColaboradorHistorico.tsx
// PROPÓSITO: Histórico de períodos anteriores do colaborador
// ============================================================

import React, { useState } from 'react';
import { History, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ColaboradorHistoricoProps {
  colaboradorId: string;
  colaboradorNome: string;
}

interface PeriodoHistorico {
  ano: number;
  mes: number;
  faturamento: number;
  comissao: number;
  bonus: number;
  dias_trabalhados: number;
  faixa_nome: string | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const MESES_NOME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function ColaboradorHistorico({ 
  colaboradorId, 
  colaboradorNome 
}: ColaboradorHistoricoProps) {
  const [limit, setLimit] = useState(6);
  
  // Buscar histórico dos últimos meses
  const { data: historico, isLoading } = useQuery({
    queryKey: ['colaborador-historico', colaboradorId, limit],
    queryFn: async () => {
      const hoje = new Date();
      const periodos: PeriodoHistorico[] = [];
      
      // Buscar últimos N meses
      for (let i = 0; i < limit; i++) {
        const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const ano = data.getFullYear();
        const mes = data.getMonth() + 1;
        
        const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const fimDate = new Date(ano, mes, 0);
        const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(fimDate.getDate()).padStart(2, '0')}`;
        
        const { data: rpcData, error } = await supabase.rpc('rpc_dashboard_period', {
          p_inicio: inicio,
          p_fim: fim,
          p_colaborador_id: colaboradorId,
          p_tipo_colaborador: null
        });
        
        if (!error && rpcData) {
          const kpis = (rpcData as any).kpis || {};
          periodos.push({
            ano,
            mes,
            faturamento: kpis.faturamento || 0,
            comissao: 0, // TODO: integrar com cálculo real de comissão
            bonus: 0,
            dias_trabalhados: kpis.dias_trabalhados || 0,
            faixa_nome: null
          });
        }
      }
      
      return periodos;
    },
    staleTime: 5 * 60 * 1000
  });
  
  // Calcular variações
  const getVariacao = (atual: number, anterior: number) => {
    if (anterior === 0) return null;
    return ((atual - anterior) / anterior) * 100;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Histórico de Períodos
        </CardTitle>
        <CardDescription>
          Performance de {colaboradorNome.split(' ')[0]} nos últimos meses
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !historico || historico.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum histórico disponível.
          </p>
        ) : (
          <div className="space-y-2">
            {historico.map((periodo, idx) => {
              const anterior = historico[idx + 1];
              const variacaoFat = anterior ? getVariacao(periodo.faturamento, anterior.faturamento) : null;
              
              return (
                <div 
                  key={`${periodo.ano}-${periodo.mes}`}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">
                        {MESES_NOME[periodo.mes - 1]} {periodo.ano}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {periodo.dias_trabalhados} dias trabalhados
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {formatCurrency(periodo.faturamento)}
                      </div>
                      <div className="text-sm text-muted-foreground">Faturamento</div>
                    </div>
                    
                    {variacaoFat !== null && (
                      <div className={`flex items-center gap-1 ${
                        variacaoFat > 0 ? 'text-emerald-500' : 
                        variacaoFat < 0 ? 'text-red-500' : 
                        'text-muted-foreground'
                      }`}>
                        {variacaoFat > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : variacaoFat < 0 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <Minus className="h-4 w-4" />
                        )}
                        <span className="text-sm font-medium">
                          {Math.abs(variacaoFat).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    
                    {periodo.faixa_nome && (
                      <Badge variant="outline">{periodo.faixa_nome}</Badge>
                    )}
                  </div>
                </div>
              );
            })}
            
            {limit < 12 && (
              <Button 
                variant="ghost" 
                className="w-full mt-2"
                onClick={() => setLimit(12)}
              >
                Carregar mais
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

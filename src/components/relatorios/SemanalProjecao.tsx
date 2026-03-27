// ============================================================
// FILE: src/components/relatorios/SemanalProjecao.tsx
// PROPÓSITO: Card de projeção do mês (baseado no mês de referência)
// ============================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { TrendingUp, Calendar, Target } from 'lucide-react';
import type { ProjecaoMes } from '@/types/relatorio-semanal';

interface SemanalProjecaoProps {
  projecao: ProjecaoMes;
  mostrarFaturamento: boolean;
  onToggleFaturamento: (show: boolean) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function SemanalProjecao({ 
  projecao, 
  mostrarFaturamento, 
  onToggleFaturamento 
}: SemanalProjecaoProps) {
  // Extrair nome do mês sem o ano para usar na frase
  const mesApenas = projecao.mes_nome.split('/')[0];
  
  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Projeção para {projecao.mes_nome}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {projecao.dias_trabalhados_mes} dias trabalhados
            </span>
          </div>
          <div className="text-muted-foreground">|</div>
          <span className="text-muted-foreground">
            {projecao.dias_restantes_mes} dias restantes
          </span>
          <div className="text-muted-foreground">|</div>
          <span className="text-muted-foreground">
            Média: <span className="text-foreground font-medium">
              {formatCurrency(projecao.media_dia_atual)}/dia
            </span>
          </span>
        </div>
        
        {/* Projeção */}
        <div className="bg-background/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              Se mantiver esse ritmo até o fim de {mesApenas}:
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Faturamento */}
            <div>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(projecao.faturamento_projetado_mes)}
              </div>
              <div className="text-xs text-muted-foreground">
                Faturamento projetado
              </div>
            </div>
            
            {/* Comissão */}
            <div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(projecao.comissao_projetada_mes)}
              </div>
              <div className="text-xs text-muted-foreground">
                Comissão projetada ({projecao.percentual_comissao.toFixed(0)}%)
              </div>
            </div>
            
            {/* Atendimentos */}
            <div>
              <div className="text-2xl font-bold text-foreground">
                {projecao.atendimentos_projetados_mes}
              </div>
              <div className="text-xs text-muted-foreground">
                Atendimentos projetados
              </div>
            </div>
          </div>
        </div>
        
        {/* Toggle para exibir faturamento */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-sm text-muted-foreground">
            Exibir faturamento nos cards
          </span>
          <Switch
            checked={mostrarFaturamento}
            onCheckedChange={onToggleFaturamento}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default SemanalProjecao;

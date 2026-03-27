// ============================================================
// FILE: src/components/relatorios/SemanaCard.tsx
// PROPÓSITO: Card expandível de uma semana individual
// ============================================================

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  Star,
  Save
} from 'lucide-react';
import type { SemanaData, Orientacao } from '@/types/relatorio-semanal';

interface SemanaCardProps {
  semana: SemanaData;
  medias: {
    faturamento: number;
    atendimentos: number;
    ticket_medio: number;
    extras_qtd: number;
  };
  comentarioInicial?: string;
  onSaveComentario?: (comentario: string) => void;
  savingComentario?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatVariacao(value: number | null): string {
  if (value === null) return '';
  return `${value > 0 ? '+' : ''}${value}%`;
}

function gerarOrientacoes(semana: SemanaData, medias: SemanaCardProps['medias']): Orientacao[] {
  const orientacoes: Orientacao[] = [];
  
  // Extras abaixo da média
  if (semana.extras_qtd < medias.extras_qtd * 0.8) {
    orientacoes.push({
      tipo: 'atencao',
      texto: `Extras abaixo da média (${semana.extras_qtd} vs ${Math.round(medias.extras_qtd)} média)`,
      dica: 'Oferecer mais serviços complementares como hidratação e sobrancelha'
    });
  }
  
  // Ticket médio acima da média
  if (semana.ticket_medio > medias.ticket_medio * 1.05) {
    const pct = Math.round((semana.ticket_medio / medias.ticket_medio - 1) * 100);
    orientacoes.push({
      tipo: 'destaque',
      texto: `Ticket médio ${pct}% acima da média!`,
      dica: 'Continue oferecendo combos e serviços premium'
    });
  }
  
  // Tendência de queda
  if (semana.tendencia === 'down' && (semana.var_faturamento_pct ?? 0) < -10) {
    orientacoes.push({
      tipo: 'alerta',
      texto: 'Faturamento em queda significativa',
      dica: 'Revisar agenda e disponibilidade'
    });
  }
  
  // Faturamento acima da média
  if (semana.faturamento > medias.faturamento * 1.1) {
    orientacoes.push({
      tipo: 'destaque',
      texto: 'Semana excelente! Faturamento acima da média'
    });
  }
  
  return orientacoes;
}

export function SemanaCard({ 
  semana, 
  medias, 
  comentarioInicial = '',
  onSaveComentario,
  savingComentario
}: SemanaCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [comentario, setComentario] = useState(comentarioInicial);
  const [comentarioEditado, setComentarioEditado] = useState(false);
  
  const orientacoes = gerarOrientacoes(semana, medias);
  
  const TendenciaIcon = semana.tendencia === 'up' 
    ? TrendingUp 
    : semana.tendencia === 'down' 
      ? TrendingDown 
      : Minus;
  
  const tendenciaColor = semana.tendencia === 'up'
    ? 'text-emerald-400'
    : semana.tendencia === 'down'
      ? 'text-red-400'
      : 'text-muted-foreground';

  const handleComentarioChange = (value: string) => {
    setComentario(value);
    setComentarioEditado(value !== comentarioInicial);
  };

  const handleSave = () => {
    onSaveComentario?.(comentario);
    setComentarioEditado(false);
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  Semana {semana.semana_numero}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({semana.label})
                </span>
                {semana.parcial && (
                  <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                    Semana parcial
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground">
                {formatCurrency(semana.faturamento)}
              </span>
              {semana.var_faturamento_pct !== null && (
                <div className={`flex items-center gap-1 ${tendenciaColor}`}>
                  <TendenciaIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {formatVariacao(semana.var_faturamento_pct)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            {/* KPIs detalhados - Grid expandido */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <div className="text-xs text-muted-foreground">Faturamento</div>
                <div className="text-sm font-medium">{formatCurrency(semana.faturamento)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Atendimentos</div>
                <div className="text-sm font-medium">{semana.atendimentos}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Ticket Médio</div>
                <div className="text-sm font-medium">{formatCurrency(semana.ticket_medio)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Extras</div>
                <div className="text-sm font-medium">{semana.extras_qtd} ({formatCurrency(semana.extras_valor)})</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Média/Dia</div>
                <div className="text-sm font-medium">{formatCurrency(semana.media_dia)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Clientes Novos</div>
                <div className="text-sm font-medium">{semana.clientes_novos}</div>
              </div>
              {semana.comissao > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground">Comissão</div>
                  <div className="text-sm font-medium text-amber-400">{formatCurrency(semana.comissao)}</div>
                </div>
              )}
              {semana.bonus > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground">Bônus</div>
                  <div className="text-sm font-medium text-emerald-400">{formatCurrency(semana.bonus)}</div>
                </div>
              )}
            </div>
            
            {/* Orientações */}
            {orientacoes.length > 0 && (
              <div className="space-y-2">
                {orientacoes.map((o, i) => (
                  <div 
                    key={i}
                    className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                      o.tipo === 'destaque' 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : o.tipo === 'atencao'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {o.tipo === 'destaque' ? (
                      <Star className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <div className="font-medium">{o.texto}</div>
                      {o.dica && (
                        <div className="text-xs opacity-80 mt-1">{o.dica}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Comentário */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Comentário / Observação</label>
              <div className="flex gap-2">
                <Textarea 
                  value={comentario}
                  onChange={(e) => handleComentarioChange(e.target.value)}
                  placeholder="Adicione observações sobre esta semana..."
                  className="min-h-[80px] resize-none"
                />
                {onSaveComentario && (
                  <Button 
                    size="sm" 
                    onClick={handleSave}
                    disabled={!comentarioEditado || savingComentario}
                    className="shrink-0"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default SemanaCard;

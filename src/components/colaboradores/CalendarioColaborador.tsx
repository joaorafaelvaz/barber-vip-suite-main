// ============================================================
// FILE: src/components/colaboradores/CalendarioColaborador.tsx
// PROPÓSITO: Calendário visual individual mostrando faturamento e folgas
// ============================================================

import React from 'react';
import { format, getDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { DIAS_SEMANA } from '@/types/colaborador';
import type { CalendarioColaboradorMensal, DiaCalendarioColaborador } from '@/types/colaborador';

interface CalendarioColaboradorProps {
  calendario: CalendarioColaboradorMensal;
  percentualComissao?: number;
  onMesAnterior: () => void;
  onProximoMes: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrencyShort(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace('.0', '')}k`;
  }
  return String(Math.round(value));
}

function getDiaStyle(dia: DiaCalendarioColaborador): string {
  // Se teve faturamento, prioriza o estilo de faturamento
  if ((dia.ehPassado || dia.ehHoje) && dia.faturamento && dia.faturamento > 0) {
    return 'bg-emerald-500/10 border-emerald-500/30';
  }
  
  if (dia.barbeariaFechada) {
    return 'bg-muted/50 text-muted-foreground border-muted';
  }
  if (dia.temFolgaFixa || dia.temFolgaAvulsa) {
    return 'bg-amber-500/10 border-amber-500/30 text-amber-200';
  }
  if (dia.ehPassado || dia.ehHoje) {
    return 'bg-destructive/10 border-destructive/30';
  }
  if (dia.ehFuturo && dia.trabalha) {
    return 'bg-primary/5 border-primary/20';
  }
  return 'bg-muted/30 border-border';
}

function getTooltipContent(dia: DiaCalendarioColaborador): string {
  const dataFormatada = format(dia.data, "EEEE, dd 'de' MMMM", { locale: ptBR });
  
  const partes: string[] = [dataFormatada];
  
  // Adiciona info de faturamento se houver
  if ((dia.ehPassado || dia.ehHoje) && dia.faturamento !== undefined && dia.faturamento > 0) {
    partes.push(`💰 Faturou: ${formatCurrency(dia.faturamento)}`);
    partes.push(`📋 ${dia.atendimentos || 0} atendimentos`);
  }
  
  // Adiciona indicadores de status especial
  if (dia.ehFeriado && dia.nomeFeriado) {
    partes.push(`🟡 Feriado: ${dia.nomeFeriado}`);
  } else if (dia.barbeariaFechada) {
    partes.push('🔴 Barbearia fechada');
  }
  
  if (dia.temFolgaFixa) {
    partes.push('📅 Folga fixa semanal');
  } else if (dia.temFolgaAvulsa) {
    partes.push(`✈️ ${dia.motivoFolga || 'Ausência'}`);
  }
  
  // Sem faturamento em dia que deveria trabalhar
  if ((dia.ehPassado || dia.ehHoje) && (!dia.faturamento || dia.faturamento === 0)) {
    if (!dia.barbeariaFechada && !dia.temFolgaFixa && !dia.temFolgaAvulsa) {
      partes.push('⚠️ Sem faturamento registrado');
    }
  }
  
  // Dia futuro programado
  if (dia.ehFuturo && dia.trabalha) {
    partes.push('✅ Programado para trabalhar');
  }
  
  return partes.join('\n');
}

// Helper para mostrar indicador de status especial
function getStatusIndicator(dia: DiaCalendarioColaborador): string | null {
  if (dia.ehFeriado) return '🟡';
  if (dia.temFolgaFixa) return '📅';
  if (dia.temFolgaAvulsa) return '✈️';
  if (dia.barbeariaFechada) return '🔴';
  return null;
}

export function CalendarioColaborador({ 
  calendario, 
  percentualComissao = 0,
  onMesAnterior, 
  onProximoMes 
}: CalendarioColaboradorProps) {
  // Calcular offset para o primeiro dia do mês
  const primeiroDia = startOfMonth(new Date(calendario.ano, calendario.mes - 1));
  const offsetDias = getDay(primeiroDia); // 0 = domingo
  
  // Calcular projeção
  const diasTotaisTrabalho = calendario.resumo.diasTrabalhados + calendario.resumo.diasProgramadosRestantes;
  const projecaoFaturamento = calendario.resumo.mediaFaturamentoDia * diasTotaisTrabalho;
  const projecaoComissao = projecaoFaturamento * (percentualComissao / 100);
  
  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(calendario.ano, calendario.mes - 1), 'MMMM yyyy', { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={onMesAnterior}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onProximoMes}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Resumo com Tooltips */}
          <div className="flex flex-wrap gap-2 text-sm pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs cursor-help">
                  {calendario.resumo.diasTrabalhados} dias
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Dias trabalhados no período (com faturamento registrado)
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30 cursor-help">
                  {formatCurrency(calendario.resumo.faturamentoTotal)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Faturamento total acumulado no período
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs cursor-help">
                  Média: {formatCurrency(calendario.resumo.mediaFaturamentoDia)}/dia
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Média de faturamento por dia trabalhado
              </TooltipContent>
            </Tooltip>
            
            {calendario.resumo.diasProgramadosRestantes > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs text-primary border-primary/30 cursor-help">
                    {calendario.resumo.diasProgramadosRestantes} restantes
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Dias úteis restantes para trabalhar no mês
                </TooltipContent>
              </Tooltip>
            )}
            
            {/* Projeção de faturamento */}
            {calendario.resumo.diasTrabalhados > 0 && calendario.resumo.diasProgramadosRestantes > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30 cursor-help">
                    Projeção: {formatCurrency(projecaoFaturamento)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p>Projeção de faturamento considerando média e dias restantes</p>
                    <p className="text-muted-foreground text-xs">
                      ({calendario.resumo.diasTrabalhados} trabalhados + {calendario.resumo.diasProgramadosRestantes} restantes) × {formatCurrency(calendario.resumo.mediaFaturamentoDia)}/dia
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            
            {/* Projeção de comissão */}
            {percentualComissao > 0 && calendario.resumo.diasTrabalhados > 0 && calendario.resumo.diasProgramadosRestantes > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs text-primary border-primary/50 cursor-help">
                    Comissão: {formatCurrency(projecaoComissao)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p>Projeção de comissão baseada na faixa atual ({percentualComissao}%)</p>
                    <p className="text-muted-foreground text-xs">
                      {formatCurrency(projecaoFaturamento)} × {percentualComissao}%
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Grid do calendário */}
          <div className="grid grid-cols-7 gap-1">
            {/* Header dias da semana */}
            {DIAS_SEMANA.map(d => (
              <div key={d.value} className="text-center text-xs font-medium py-2 text-muted-foreground">
                {d.short}
              </div>
            ))}
            
            {/* Células vazias para offset */}
            {Array.from({ length: offsetDias }).map((_, i) => (
              <div key={`offset-${i}`} className="aspect-square" />
            ))}
            
            {/* Dias do mês */}
            {calendario.dias.map(dia => (
              <Tooltip key={dia.dataStr}>
                <TooltipTrigger asChild>
                  <div 
                    className={`
                      aspect-square p-0.5 rounded-md border flex flex-col items-center justify-center cursor-default
                      transition-colors
                      ${getDiaStyle(dia)}
                      ${dia.ehHoje ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
                    `}
                  >
                    <div className="text-[11px] font-medium leading-none">
                      {format(dia.data, 'd')}
                    </div>
                    
                    {/* Conteúdo baseado no status - prioriza faturamento */}
                    <div className="text-[9px] leading-none mt-0.5 flex items-center gap-0.5">
                      {(dia.ehPassado || dia.ehHoje) && dia.faturamento !== undefined && dia.faturamento > 0 ? (
                        <>
                          <span className="font-medium text-emerald-400">
                            {formatCurrencyShort(dia.faturamento)}
                          </span>
                          {getStatusIndicator(dia) && (
                            <span className="text-[7px]">{getStatusIndicator(dia)}</span>
                          )}
                        </>
                      ) : dia.barbeariaFechada ? (
                        <span>{dia.ehFeriado ? '🟡' : '🔴'}</span>
                      ) : dia.temFolgaFixa || dia.temFolgaAvulsa ? (
                        <span>{dia.temFolgaFixa ? '📅' : '✈️'}</span>
                      ) : (dia.ehPassado || dia.ehHoje) ? (
                        <span className="font-medium text-destructive">--</span>
                      ) : dia.ehFuturo && dia.trabalha ? (
                        <span className="text-[8px] text-primary font-medium">útil</span>
                      ) : null}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="whitespace-pre-line text-xs">
                  {getTooltipContent(dia)}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          
          {/* Legenda */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <span>🟡</span> Feriado
            </div>
            <div className="flex items-center gap-1">
              <span>📅</span> Folga Fixa
            </div>
            <div className="flex items-center gap-1">
              <span>✈️</span> Ausência
            </div>
            <div className="flex items-center gap-1">
              <span className="text-emerald-400 font-medium">R$</span> Faturamento
            </div>
            <div className="flex items-center gap-1">
              <span className="text-primary font-medium">útil</span> Dia Útil
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CalendarioMensal } from '@/types/colaborador';

interface CalendarioOperacionalProps {
  calendario: CalendarioMensal;
  onMesAnterior: () => void;
  onProximoMes: () => void;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarioOperacional({ 
  calendario, 
  onMesAnterior, 
  onProximoMes 
}: CalendarioOperacionalProps) {
  const { ano, mes, dias, resumo } = calendario;
  const primeiroDia = dias[0]?.data;
  const offsetInicio = primeiroDia ? primeiroDia.getDay() : 0;

  // Cria células vazias para alinhamento
  const celulasVazias = Array.from({ length: offsetInicio }, (_, i) => (
    <div key={`empty-${i}`} className="aspect-square" />
  ));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR })}
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

        {/* Resumo */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
          <span>{resumo.totalDias} dias no mês</span>
          <span>{resumo.diasUteis} dias úteis</span>
          {resumo.feriados > 0 && <span>{resumo.feriados} feriado(s)</span>}
          {resumo.domingosFechados > 0 && <span>{resumo.domingosFechados} domingos fechados</span>}
        </div>
      </CardHeader>

      <CardContent>
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DIAS_SEMANA.map(dia => (
            <div 
              key={dia} 
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {dia}
            </div>
          ))}
        </div>

        {/* Grid do calendário */}
        <TooltipProvider delayDuration={200}>
          <div className="grid grid-cols-7 gap-1">
            {celulasVazias}
            {dias.map(dia => {
              const hoje = isToday(dia.data);
              const passado = isBefore(startOfDay(dia.data), startOfDay(new Date()));
              const quemTrabalha = dia.colaboradoresTrabalham.filter(c => c.trabalha);
              
              return (
                <Tooltip key={dia.data.toISOString()}>
                  <TooltipTrigger asChild>
                    <div
                      className={`
                        aspect-square p-1 rounded-md border text-center flex flex-col
                        ${dia.barbeariaFecha ? 'bg-destructive/10 border-destructive/30' : 'bg-card border-border'}
                        ${hoje ? 'ring-2 ring-primary' : ''}
                        ${passado && !hoje ? 'opacity-60' : ''}
                      `}
                    >
                      <div className={`text-sm font-medium ${dia.barbeariaFecha ? 'text-destructive' : ''}`}>
                        {format(dia.data, 'd')}
                      </div>
                      
                      {dia.barbeariaFecha ? (
                        <div className="text-[10px] text-destructive mt-auto">
                          {dia.ehFeriado ? '🟡' : '🔴'}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-0.5 justify-center mt-auto">
                          {quemTrabalha.slice(0, 4).map(colab => (
                            <span 
                              key={colab.id} 
                              className="text-[10px] font-medium text-primary"
                            >
                              {colab.iniciais}
                            </span>
                          ))}
                          {quemTrabalha.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{quemTrabalha.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <div className="text-sm">
                      <div className="font-medium">
                        {format(dia.data, 'EEEE, d', { locale: ptBR })}
                      </div>
                      {dia.ehFeriado && (
                        <div className="text-accent">{dia.nomeFeriado}</div>
                      )}
                      {dia.barbeariaFecha ? (
                        <div className="text-destructive text-xs">Barbearia fechada</div>
                      ) : (
                        <div className="text-xs mt-1">
                          {quemTrabalha.length === 0 ? (
                            'Ninguém escalado'
                          ) : (
                            <>
                              <span className="text-muted-foreground">Trabalham: </span>
                              {quemTrabalha.map(c => c.nome.split(' ')[0]).join(', ')}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Legenda */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-destructive/20 border border-destructive/30" />
            <span>Fechado</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🟡</span>
            <span>Feriado</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-primary font-medium">AB</span>
            <span>= Iniciais</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

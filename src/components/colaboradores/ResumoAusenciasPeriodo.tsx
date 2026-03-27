// ============================================================
// FILE: src/components/colaboradores/ResumoAusenciasPeriodo.tsx
// PROPÓSITO: Resumo expansível das ausências/dias do período
// ============================================================

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronDown, 
  ChevronRight, 
  Briefcase, 
  CalendarCheck, 
  CalendarX, 
  PartyPopper, 
  Plane, 
  AlertTriangle,
  Store
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { CalendarioColaboradorMensal, DiaCalendarioColaborador } from '@/types/colaborador';

interface ResumoAusenciasPeriodoProps {
  calendario: CalendarioColaboradorMensal;
  ano: number;
  mes: number;
}

interface GrupoResumo {
  id: string;
  titulo: string;
  icone: React.ReactNode;
  iconeBg: string;
  quantidade: number;
  dias: DiaCalendarioColaborador[];
}

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

export function ResumoAusenciasPeriodo({ calendario, ano, mes }: ResumoAusenciasPeriodoProps) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  
  const grupos = useMemo((): GrupoResumo[] => {
    const diasTrabalhados = calendario.dias.filter(d => d.trabalhou);
    const folgasFixas = calendario.dias.filter(d => d.temFolgaFixa && !d.ehFeriado && !d.temFolgaAvulsa);
    const feriados = calendario.dias.filter(d => d.ehFeriado);
    const folgasAvulsas = calendario.dias.filter(d => d.temFolgaAvulsa);
    const diasATrabalhar = calendario.dias.filter(d => d.ehFuturo && d.trabalha);
    const barbeariaFechada = calendario.dias.filter(d => d.barbeariaFechada && !d.ehFeriado && !d.temFolgaFixa && !d.temFolgaAvulsa);
    
    // Classificar folgas avulsas por tipo
    const folgasFerias = folgasAvulsas.filter(d => {
      const motivo = d.motivoFolga?.toLowerCase() || '';
      return ['ferias', 'férias', 'folga', 'compensacao', 'licença', 'licenca'].some(t => motivo.includes(t));
    });
    
    const faltas = folgasAvulsas.filter(d => {
      const motivo = d.motivoFolga?.toLowerCase() || '';
      return ['falta', 'atestado', 'doente', 'doença', 'medico', 'médico'].some(t => motivo.includes(t));
    });
    
    // Folgas avulsas não classificadas vão para Férias/Folgas
    const outrasAusencias = folgasAvulsas.filter(d => 
      !folgasFerias.includes(d) && !faltas.includes(d)
    );
    
    // Dias passados sem faturamento e sem nenhuma classificação = faltas não justificadas
    const diasFaltados = calendario.dias.filter(d => 
      (d.ehPassado || d.ehHoje) && 
      !d.trabalhou && 
      !d.barbeariaFechada && 
      !d.ehFeriado && 
      !d.temFolgaFixa && 
      !d.temFolgaAvulsa
    );
    
    return [
      {
        id: 'trabalhados',
        titulo: 'Dias Trabalhados',
        icone: <CalendarCheck className="h-4 w-4 text-emerald-400" />,
        iconeBg: 'bg-emerald-500/20',
        quantidade: diasTrabalhados.length,
        dias: diasTrabalhados,
      },
      {
        id: 'aTrabalhar',
        titulo: 'Dias a Trabalhar',
        icone: <Briefcase className="h-4 w-4 text-primary" />,
        iconeBg: 'bg-primary/20',
        quantidade: diasATrabalhar.length,
        dias: diasATrabalhar,
      },
      {
        id: 'folgasFixas',
        titulo: 'Folgas Fixas',
        icone: <CalendarX className="h-4 w-4 text-secondary-foreground" />,
        iconeBg: 'bg-secondary/30',
        quantidade: folgasFixas.length,
        dias: folgasFixas,
      },
      {
        id: 'feriados',
        titulo: 'Feriados',
        icone: <PartyPopper className="h-4 w-4 text-warning" />,
        iconeBg: 'bg-warning/20',
        quantidade: feriados.length,
        dias: feriados,
      },
      {
        id: 'barbeariaFechada',
        titulo: 'Barbearia Fechada',
        icone: <Store className="h-4 w-4 text-muted-foreground" />,
        iconeBg: 'bg-muted/40',
        quantidade: barbeariaFechada.length,
        dias: barbeariaFechada,
      },
      {
        id: 'folgasExtras',
        titulo: 'Férias/Folgas',
        icone: <Plane className="h-4 w-4 text-info" />,
        iconeBg: 'bg-info/20',
        quantidade: folgasFerias.length + outrasAusencias.length,
        dias: [...folgasFerias, ...outrasAusencias],
      },
      {
        id: 'faltas',
        titulo: 'Faltas/Atestados',
        icone: <AlertTriangle className="h-4 w-4 text-destructive" />,
        iconeBg: 'bg-destructive/20',
        quantidade: faltas.length + diasFaltados.length,
        dias: [...faltas, ...diasFaltados],
      },
    ].filter(g => g.quantidade > 0);
  }, [calendario]);
  
  const handleToggle = (id: string) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const formatDia = (dia: DiaCalendarioColaborador): string => {
    const dataFormatada = format(dia.data, "EEE dd/MM", { locale: ptBR });
    return dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          📊 Resumo do Período
          <Badge variant="outline" className="font-normal">
            {MESES.find(m => m.value === mes)?.label} {ano}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {grupos.map(grupo => {
          const isExpanded = expandidos.has(grupo.id);
          
          return (
            <Collapsible
              key={grupo.id}
              open={isExpanded}
              onOpenChange={() => handleToggle(grupo.id)}
            >
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-3 w-full p-3 hover:bg-muted/50 transition-colors text-left">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className={`p-1.5 rounded ${grupo.iconeBg} shrink-0`}>
                      {grupo.icone}
                    </div>
                    <span className="text-sm font-medium flex-1">{grupo.titulo}</span>
                    <Badge variant="secondary" className="text-xs">
                      {grupo.quantidade} {grupo.quantidade === 1 ? 'dia' : 'dias'}
                    </Badge>
                  </button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="border-t bg-muted/20 p-3">
                    <div className="flex flex-wrap gap-2">
                      {grupo.dias.map((dia, idx) => (
                        <div 
                          key={idx}
                          className="text-xs bg-background px-2 py-1 rounded border"
                        >
                          <span className="font-medium">{formatDia(dia)}</span>
                          {dia.nomeFeriado && (
                            <span className="text-muted-foreground ml-1">- {dia.nomeFeriado}</span>
                          )}
                          {dia.motivoFolga && !dia.temFolgaFixa && (
                            <span className="text-muted-foreground ml-1">- {dia.motivoFolga}</span>
                          )}
                          {dia.faturamento !== undefined && dia.faturamento > 0 && (
                            <span className="text-emerald-400 ml-1">
                              (R$ {dia.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 0 })})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
        
        {grupos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum dado disponível para o período
          </p>
        )}
      </CardContent>
    </Card>
  );
}

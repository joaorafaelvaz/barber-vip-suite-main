// ============================================================
// FILE: src/components/colaboradores/HistoricoFolgasMes.tsx
// PROPÓSITO: Lista resumo das ausências do mês
// ============================================================

import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { HistoricoFolgaMes } from '@/types/colaborador';

interface HistoricoFolgasMesProps {
  historico: HistoricoFolgaMes[];
  ano: number;
  mes: number;
}

function getBadgeVariant(tipo: HistoricoFolgaMes['tipo']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (tipo) {
    case 'fixa':
      return 'secondary';
    case 'avulsa':
      return 'default';
    case 'feriado':
      return 'outline';
    case 'fechado':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getTipoLabel(tipo: HistoricoFolgaMes['tipo']): string {
  switch (tipo) {
    case 'fixa':
      return 'Folga Fixa';
    case 'avulsa':
      return 'Ausência';
    case 'feriado':
      return 'Feriado';
    case 'fechado':
      return 'Fechado';
    default:
      return tipo;
  }
}

function getTipoIcon(tipo: HistoricoFolgaMes['tipo']): string {
  switch (tipo) {
    case 'fixa':
      return '📅';
    case 'avulsa':
      return '✈️';
    case 'feriado':
      return '🟡';
    case 'fechado':
      return '🔴';
    default:
      return '📋';
  }
}

export function HistoricoFolgasMes({ historico, ano, mes }: HistoricoFolgasMesProps) {
  // Agrupar por tipo para exibição mais limpa
  const porTipo = historico.reduce((acc, h) => {
    if (!acc[h.tipo]) acc[h.tipo] = [];
    acc[h.tipo].push(h);
    return acc;
  }, {} as Record<string, HistoricoFolgaMes[]>);
  
  const tipos = Object.keys(porTipo) as HistoricoFolgaMes['tipo'][];
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Ausências - {format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma ausência registrada no período
          </p>
        ) : (
          <div className="space-y-3">
            {tipos.map(tipo => (
              <div key={tipo} className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>{getTipoIcon(tipo)}</span>
                  <Badge variant={getBadgeVariant(tipo)} className="text-xs">
                    {getTipoLabel(tipo)}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    ({porTipo[tipo].length} {porTipo[tipo].length === 1 ? 'dia' : 'dias'})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pl-6">
                  {porTipo[tipo].map((h, idx) => (
                    <div 
                      key={idx}
                      className="text-xs bg-muted/30 px-2 py-1 rounded"
                    >
                      <span className="text-muted-foreground">{h.diaSemanaLabel.slice(0, 3)}</span>
                      {' '}
                      <span className="font-medium">
                        {format(new Date(h.data + 'T00:00:00'), 'dd/MM')}
                      </span>
                      {h.descricao && h.tipo !== 'fixa' && (
                        <span className="text-muted-foreground ml-1">- {h.descricao}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

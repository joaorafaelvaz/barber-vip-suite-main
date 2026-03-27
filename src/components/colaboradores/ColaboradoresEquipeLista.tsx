// ============================================================
// FILE: src/components/colaboradores/ColaboradoresEquipeLista.tsx
// PROPÓSITO: Lista clicável de colaboradores da equipe no período
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ColaboradorComDados } from '@/types/colaborador';

interface ColaboradoresEquipeListaProps {
  colaboradores: ColaboradorComDados[];
  ano: number;
  mes: number;
  isLoading?: boolean;
  onPeriodoChange?: (ano: number, mes: number) => void;
}

function getIniciais(nome: string): string {
  const partes = nome.split(' ').filter(Boolean);
  if (partes.length === 0) return '??';
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
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

const ANOS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

export function ColaboradoresEquipeLista({ 
  colaboradores, 
  ano: anoInicial, 
  mes: mesInicial, 
  isLoading,
  onPeriodoChange
}: ColaboradoresEquipeListaProps) {
  const navigate = useNavigate();
  const [mes, setMes] = useState(mesInicial);
  const [ano, setAno] = useState(anoInicial);
  
  useEffect(() => {
    setMes(mesInicial);
    setAno(anoInicial);
  }, [mesInicial, anoInicial]);
  
  const handleMesChange = (value: string) => {
    const novoMes = parseInt(value, 10);
    setMes(novoMes);
    onPeriodoChange?.(ano, novoMes);
  };
  
  const handleAnoChange = (value: string) => {
    const novoAno = parseInt(value, 10);
    setAno(novoAno);
    onPeriodoChange?.(novoAno, mes);
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Carregando equipe...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div 
                key={i}
                className="h-16 rounded-lg border bg-muted/20 animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Equipe
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Período:</span>
            <Select value={String(mes)} onValueChange={handleMesChange}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map(m => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(ano)} onValueChange={handleAnoChange}>
              <SelectTrigger className="w-[90px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANOS.map(a => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {colaboradores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum colaborador encontrado no período
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {colaboradores.map(c => (
              <div 
                key={c.colaborador_id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/app/colaboradores/${c.colaborador_id}`)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm bg-primary/10 text-primary">
                    {getIniciais(c.colaborador_nome || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.colaborador_nome}</div>
                  <div className="flex items-center gap-2">
                    {c.faturamento > 0 ? (
                      <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Sem faturamento
                      </Badge>
                    )}
                    {c.faixa && (
                      <Badge variant="secondary" className="text-xs">
                        {c.faixa.nome}
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

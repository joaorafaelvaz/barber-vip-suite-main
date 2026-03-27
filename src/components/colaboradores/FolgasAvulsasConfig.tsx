// ============================================================
// FILE: src/components/colaboradores/FolgasAvulsasConfig.tsx
// PROPÓSITO: Gestão de folgas avulsas (férias, faltas, etc.)
// ============================================================

import React, { useState } from 'react';
import { format, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, X, Calendar as CalendarIcon, Palmtree, AlertTriangle, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFolgas } from '@/hooks/useFolgas';
import type { DateRange } from 'react-day-picker';

interface FolgasAvulsasConfigProps {
  colaboradorId: string;
  colaboradorNome: string;
  ano: number;
  mes: number;
}

const TIPOS_FOLGA = [
  { value: 'folga', label: 'Folga', icon: CalendarIcon, color: 'bg-blue-500/20 text-blue-400' },
  { value: 'ferias', label: 'Férias', icon: Palmtree, color: 'bg-emerald-500/20 text-emerald-400' },
  { value: 'falta', label: 'Falta', icon: AlertTriangle, color: 'bg-amber-500/20 text-amber-400' },
  { value: 'atestado', label: 'Atestado', icon: Stethoscope, color: 'bg-red-500/20 text-red-400' },
];

export function FolgasAvulsasConfig({ 
  colaboradorId, 
  colaboradorNome,
  ano,
  mes 
}: FolgasAvulsasConfigProps) {
  const { 
    folgasAvulsas, 
    isLoading,
    createFolgaAvulsa,
    deleteFolgaAvulsa,
  } = useFolgas({ colaboradorId, ano, mes });
  
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [novaFolgaRange, setNovaFolgaRange] = useState<DateRange | undefined>();
  const [novaFolgaMotivo, setNovaFolgaMotivo] = useState('');
  const [novaFolgaTipo, setNovaFolgaTipo] = useState('folga');
  
  // Folgas avulsas deste colaborador no mês (excluir folgas fixas)
  const folgasDoMes = folgasAvulsas.filter(f => 
    f.colaborador_id === colaboradorId && f.tipo !== 'folga_fixa'
  );
  
  const handleAddFolga = async () => {
    if (!novaFolgaRange?.from) return;
    
    const motivo = novaFolgaMotivo || TIPOS_FOLGA.find(t => t.value === novaFolgaTipo)?.label || 'Folga';
    
    // Se tem range, criar uma folga para cada dia
    const datasParaCriar: Date[] = [];
    
    if (novaFolgaRange.to) {
      const todasDatas = eachDayOfInterval({ 
        start: novaFolgaRange.from, 
        end: novaFolgaRange.to 
      });
      datasParaCriar.push(...todasDatas);
    } else {
      datasParaCriar.push(novaFolgaRange.from);
    }
    
    // Criar folgas em sequência com try/catch individual
    let sucessos = 0;
    let erros = 0;
    
    for (const data of datasParaCriar) {
      const dataStr = format(data, 'yyyy-MM-dd');
      try {
        await createFolgaAvulsa.mutateAsync({
          colaborador_id: colaboradorId,
          data: dataStr,
          motivo,
          tipo: 'avulsa',
        });
        sucessos++;
      } catch {
        erros++;
      }
    }
    
    if (sucessos > 0) {
      toast.success(`${sucessos} dia(s) adicionado(s)${erros > 0 ? ` (${erros} já existiam)` : ''}`);
    } else if (erros > 0) {
      toast.error('Todos os dias selecionados já possuem registro');
    }
    
    setNovaFolgaRange(undefined);
    setNovaFolgaMotivo('');
    setNovaFolgaTipo('folga');
    setPopoverOpen(false);
  };
  
  const getTipoFromMotivo = (motivo: string | null) => {
    if (!motivo) return TIPOS_FOLGA[0];
    const lower = motivo.toLowerCase();
    return TIPOS_FOLGA.find(t => lower.includes(t.value) || lower.includes(t.label.toLowerCase())) || TIPOS_FOLGA[0];
  };
  
  // Calcular quantidade de dias selecionados
  const diasSelecionados = novaFolgaRange?.from && novaFolgaRange?.to
    ? eachDayOfInterval({ start: novaFolgaRange.from, end: novaFolgaRange.to }).length
    : novaFolgaRange?.from ? 1 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Folgas, Férias e Faltas
            </CardTitle>
            <CardDescription>
              {format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR })} - 
              Cadastre ausências pontuais
            </CardDescription>
          </div>
          
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Tipo</Label>
                  <Select value={novaFolgaTipo} onValueChange={setNovaFolgaTipo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_FOLGA.map(tipo => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          <div className="flex items-center gap-2">
                            <tipo.icon className="h-4 w-4" />
                            {tipo.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Data ou Período</Label>
                  <Calendar
                    mode="range"
                    selected={novaFolgaRange}
                    onSelect={setNovaFolgaRange}
                    locale={ptBR}
                    defaultMonth={new Date(ano, mes - 1)}
                    disabled={(date) => {
                      const dataStr = format(date, 'yyyy-MM-dd');
                      return folgasAvulsas.some(f => f.data === dataStr && f.colaborador_id === colaboradorId);
                    }}
                    className="rounded-md border pointer-events-auto"
                  />
                  {diasSelecionados > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {diasSelecionados === 1 
                        ? `Selecionado: ${format(novaFolgaRange!.from!, 'dd/MM/yyyy', { locale: ptBR })}`
                        : `Período: ${format(novaFolgaRange!.from!, 'dd/MM', { locale: ptBR })} a ${format(novaFolgaRange!.to!, 'dd/MM', { locale: ptBR })} (${diasSelecionados} dias)`
                      }
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Observação (opcional)</Label>
                  <Input
                    placeholder="Ex: Consulta médica, viagem..."
                    value={novaFolgaMotivo}
                    onChange={(e) => setNovaFolgaMotivo(e.target.value)}
                  />
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={handleAddFolga}
                  disabled={!novaFolgaRange?.from || createFolgaAvulsa.isPending}
                >
                  {createFolgaAvulsa.isPending 
                    ? 'Salvando...' 
                    : diasSelecionados > 1 
                      ? `Adicionar ${diasSelecionados} dias`
                      : 'Confirmar'
                  }
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        {folgasDoMes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma folga cadastrada para este mês</p>
          </div>
        ) : (
          <div className="space-y-2">
            {folgasDoMes
              .sort((a, b) => a.data.localeCompare(b.data))
              .map(folga => {
                const tipo = getTipoFromMotivo(folga.motivo);
                const Icon = tipo.icon;
                
                return (
                  <div 
                    key={folga.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${tipo.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {format(new Date(folga.data + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                        </div>
                        {folga.motivo && (
                          <div className="text-sm text-muted-foreground">{folga.motivo}</div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteFolgaAvulsa.mutate(folga.id)}
                      disabled={deleteFolgaAvulsa.isPending}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

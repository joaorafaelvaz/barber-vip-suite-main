import React, { useState } from 'react';
import { Plus, X, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFolgas } from '@/hooks/useFolgas';
import { DIAS_SEMANA } from '@/types/colaborador';

interface FolgasEditorProps {
  colaboradorId: string;
  colaboradorNome: string;
  ano: number;
  mes: number;
}

export function FolgasEditor({ colaboradorId, colaboradorNome, ano, mes }: FolgasEditorProps) {
  const { 
    folgasAvulsas, 
    folgasFixas, 
    isLoading,
    createFolgaAvulsa,
    deleteFolgaAvulsa,
    toggleFolgaFixa,
  } = useFolgas({ colaboradorId, ano, mes });

  const [novaFolgaData, setNovaFolgaData] = useState<Date | undefined>();
  const [novaFolgaMotivo, setNovaFolgaMotivo] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Dias com folga fixa deste colaborador
  const diasFolgaFixa = folgasFixas
    .filter(f => f.colaborador_id === colaboradorId && f.ativo)
    .map(f => f.dia_semana);

  // Folgas avulsas deste colaborador no mês
  const folgasDoMes = folgasAvulsas.filter(f => f.colaborador_id === colaboradorId);

  const handleToggleFolgaFixa = (diaSemana: number) => {
    const ativo = !diasFolgaFixa.includes(diaSemana);
    toggleFolgaFixa.mutate({ colaboradorId, diaSemana, ativo });
  };

  const handleAddFolgaAvulsa = () => {
    if (!novaFolgaData) return;

    createFolgaAvulsa.mutate({
      colaborador_id: colaboradorId,
      data: format(novaFolgaData, 'yyyy-MM-dd'),
      motivo: novaFolgaMotivo || null,
      tipo: 'avulsa',
    });

    setNovaFolgaData(undefined);
    setNovaFolgaMotivo('');
    setPopoverOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Folgas Fixas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Folgas Fixas (toda semana)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {DIAS_SEMANA.map(dia => (
              <div key={dia.value} className="flex items-center gap-2">
                <Checkbox
                  id={`folga-${colaboradorId}-${dia.value}`}
                  checked={diasFolgaFixa.includes(dia.value)}
                  onCheckedChange={() => handleToggleFolgaFixa(dia.value)}
                  disabled={toggleFolgaFixa.isPending}
                />
                <Label 
                  htmlFor={`folga-${colaboradorId}-${dia.value}`}
                  className="text-sm cursor-pointer"
                >
                  {dia.label}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Folgas Avulsas */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Folgas Avulsas ({format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR })})
          </CardTitle>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Data</Label>
                  <Calendar
                    mode="single"
                    selected={novaFolgaData}
                    onSelect={setNovaFolgaData}
                    locale={ptBR}
                    defaultMonth={new Date(ano, mes - 1)}
                    disabled={(date) => {
                      const dataStr = format(date, 'yyyy-MM-dd');
                      return folgasDoMes.some(f => f.data === dataStr);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Motivo (opcional)</Label>
                  <Input
                    placeholder="Ex: Consulta médica"
                    value={novaFolgaMotivo}
                    onChange={(e) => setNovaFolgaMotivo(e.target.value)}
                  />
                </div>
                <Button 
                  className="w-full" 
                  size="sm"
                  onClick={handleAddFolgaAvulsa}
                  disabled={!novaFolgaData || createFolgaAvulsa.isPending}
                >
                  Confirmar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent>
          {folgasDoMes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma folga avulsa cadastrada para este mês
            </p>
          ) : (
            <div className="space-y-2">
              {folgasDoMes.map(folga => (
                <div 
                  key={folga.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">
                        {format(new Date(folga.data + 'T00:00:00'), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}
                      </div>
                      {folga.motivo && (
                        <div className="text-xs text-muted-foreground">{folga.motivo}</div>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

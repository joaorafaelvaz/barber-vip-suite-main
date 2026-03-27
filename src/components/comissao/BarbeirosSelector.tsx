/**
 * Componente para seleção de barbeiros (colaboradores)
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Users, ChevronDown, Loader2 } from 'lucide-react';

interface BarbeirosSelectorProps {
  modo: 'global' | 'especificos';
  onModoChange: (modo: 'global' | 'especificos') => void;
  colaboradoresSelecionados: string[];
  onColaboradoresChange: (colaboradores: string[]) => void;
}

interface Colaborador {
  colaborador_id: string;
  colaborador_nome: string;
}

function useColaboradoresAtivos() {
  return useQuery({
    queryKey: ['colaboradores-ativos-comissao'],
    queryFn: async (): Promise<Colaborador[]> => {
      const { data, error } = await supabase
        .from('dimensao_colaboradores')
        .select('colaborador_id, colaborador_nome')
        .eq('ativo', true)
        .order('colaborador_nome');

      if (error) throw error;
      return data || [];
    },
  });
}

export default function BarbeirosSelector({
  modo,
  onModoChange,
  colaboradoresSelecionados,
  onColaboradoresChange,
}: BarbeirosSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: colaboradores, isLoading } = useColaboradoresAtivos();

  const handleSelectAll = () => {
    if (colaboradores) {
      onColaboradoresChange(colaboradores.map((c) => c.colaborador_id));
    }
  };

  const handleDeselectAll = () => {
    onColaboradoresChange([]);
  };

  const handleToggleColaborador = (id: string) => {
    if (colaboradoresSelecionados.includes(id)) {
      onColaboradoresChange(colaboradoresSelecionados.filter((c) => c !== id));
    } else {
      onColaboradoresChange([...colaboradoresSelecionados, id]);
    }
  };

  const selecionadosNomes = colaboradores
    ?.filter((c) => colaboradoresSelecionados.includes(c.colaborador_id))
    .map((c) => c.colaborador_nome) || [];

  return (
    <div className="space-y-3">
      <RadioGroup
        value={modo}
        onValueChange={(v) => onModoChange(v as 'global' | 'especificos')}
        className="flex flex-col space-y-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="global" id="regra-global" />
          <Label htmlFor="regra-global" className="cursor-pointer">
            Regra Global (todos os barbeiros)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="especificos" id="regra-especifica" />
          <Label htmlFor="regra-especifica" className="cursor-pointer">
            Barbeiros específicos
          </Label>
        </div>
      </RadioGroup>

      {modo === 'especificos' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              <Users className="h-4 w-4 mr-1" />
              Aplicar a Todos
            </Button>

            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  Selecionar Barbeiros
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                {isLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="p-2 border-b flex justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAll}
                        className="text-xs h-7"
                      >
                        Todos
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDeselectAll}
                        className="text-xs h-7"
                      >
                        Nenhum
                      </Button>
                    </div>
                    <ScrollArea className="h-[200px]">
                      <div className="p-2 space-y-1">
                        {colaboradores?.map((colaborador) => (
                          <div
                            key={colaborador.colaborador_id}
                            className="flex items-center space-x-2 p-1 rounded hover:bg-muted"
                          >
                            <Checkbox
                              id={colaborador.colaborador_id}
                              checked={colaboradoresSelecionados.includes(
                                colaborador.colaborador_id
                              )}
                              onCheckedChange={() =>
                                handleToggleColaborador(colaborador.colaborador_id)
                              }
                            />
                            <Label
                              htmlFor={colaborador.colaborador_id}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {colaborador.colaborador_nome}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {selecionadosNomes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selecionadosNomes.slice(0, 3).map((nome) => (
                <Badge key={nome} variant="secondary" className="text-xs">
                  {nome}
                </Badge>
              ))}
              {selecionadosNomes.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{selecionadosNomes.length - 3} mais
                </Badge>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

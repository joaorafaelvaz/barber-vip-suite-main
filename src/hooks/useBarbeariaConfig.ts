import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { DiasFechadosConfig } from '@/types/colaborador';
import type { Json } from '@/integrations/supabase/types';

const DEFAULT_DIAS_FECHADOS: DiasFechadosConfig = {
  domingo: true,
  segunda: false,
  terca: false,
  quarta: false,
  quinta: false,
  sexta: false,
  sabado: false,
};

export function useBarbeariaConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['barbearia_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('barbearia_config')
        .select('*');
      if (error) throw error;
      
      // Transforma array em objeto por chave
      const configMap: Record<string, unknown> = {};
      data.forEach(item => {
        configMap[item.chave] = item.valor;
      });
      return configMap;
    },
  });

  const diasFechados: DiasFechadosConfig = (config?.dias_fechados as DiasFechadosConfig) || DEFAULT_DIAS_FECHADOS;

  const updateDiasFechados = useMutation({
    mutationFn: async (dias: DiasFechadosConfig) => {
      // First check if config exists
      const { data: existing } = await supabase
        .from('barbearia_config')
        .select('id')
        .eq('chave', 'dias_fechados')
        .maybeSingle();

      const valorJson = dias as unknown as Json;

      if (existing) {
        const { error } = await supabase
          .from('barbearia_config')
          .update({
            valor: valorJson,
            updated_at: new Date().toISOString(),
          })
          .eq('chave', 'dias_fechados');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('barbearia_config')
          .insert([{
            chave: 'dias_fechados',
            valor: valorJson,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barbearia_config'] });
      toast.success('Configuração atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar configuração');
    },
  });

  // Helper: verifica se um dia da semana a barbearia fecha
  const barbeariaFecha = (diaSemana: number): boolean => {
    const dias: (keyof DiasFechadosConfig)[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    return diasFechados[dias[diaSemana]] ?? false;
  };

  return {
    config,
    diasFechados,
    isLoading,
    updateDiasFechados,
    barbeariaFecha,
  };
}

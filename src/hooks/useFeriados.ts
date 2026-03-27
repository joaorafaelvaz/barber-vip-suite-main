import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Feriado } from '@/types/colaborador';

export function useFeriados(ano?: number) {
  const queryClient = useQueryClient();

  const { data: feriados = [], isLoading, error } = useQuery({
    queryKey: ['feriados', ano],
    queryFn: async () => {
      let query = supabase
        .from('feriados')
        .select('*')
        .order('data', { ascending: true });

      if (ano) {
        query = query
          .gte('data', `${ano}-01-01`)
          .lte('data', `${ano}-12-31`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Feriado[];
    },
  });

  const createFeriado = useMutation({
    mutationFn: async (feriado: Omit<Feriado, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('feriados')
        .insert(feriado)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feriados'] });
      toast.success('Feriado adicionado com sucesso');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('Já existe um feriado nesta data');
      } else {
        toast.error('Erro ao adicionar feriado');
      }
    },
  });

  const updateFeriado = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Feriado> & { id: string }) => {
      const { data, error } = await supabase
        .from('feriados')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feriados'] });
      toast.success('Feriado atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar feriado');
    },
  });

  const deleteFeriado = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('feriados')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feriados'] });
      toast.success('Feriado removido');
    },
    onError: () => {
      toast.error('Erro ao remover feriado');
    },
  });

  // Busca feriados de um mês específico
  const getFeriadosMes = useCallback((mes: number, anoParam?: number) => {
    const anoFiltro = anoParam ?? ano ?? new Date().getFullYear();
    return feriados.filter(f => {
      const data = new Date(f.data + 'T00:00:00');
      return data.getMonth() + 1 === mes && data.getFullYear() === anoFiltro;
    });
  }, [feriados, ano]);

  return {
    feriados,
    isLoading,
    error,
    createFeriado,
    updateFeriado,
    deleteFeriado,
    getFeriadosMes,
  };
}

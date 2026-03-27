// ============================================================
// FILE: src/hooks/useRelatorioComentarios.ts
// PROPÓSITO: Hook para gerenciar comentários de relatórios
// FONTE DE DADOS: relatorio_comentarios (Supabase)
// ============================================================

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { RelatorioComentario } from '@/types/relatorio-semanal';

interface ComentarioInput {
  tipo?: string;
  colaborador_id: string | null;
  ano: number;
  semana_inicio: string;
  semana_fim: string;
  comentario: string;
}

export function useRelatorioComentarios() {
  const [comentarios, setComentarios] = useState<RelatorioComentario[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  /**
   * Busca comentários para um período e colaborador
   */
  const fetchComentarios = useCallback(async (
    ano: number,
    mes: number,
    colaborador_id: string | null
  ) => {
    setLoading(true);
    
    try {
      let query = supabase
        .from('relatorio_comentarios')
        .select('*')
        .eq('ano', ano)
        .order('semana_inicio', { ascending: false });
      
      if (colaborador_id) {
        query = query.eq('colaborador_id', colaborador_id);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('[useRelatorioComentarios] Fetch error:', error);
        return;
      }
      
      setComentarios(data || []);
    } catch (err) {
      console.error('[useRelatorioComentarios] Exception:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Salva ou atualiza um comentário
   */
  const saveComentario = useCallback(async (input: ComentarioInput) => {
    setSaving(true);
    
    try {
      // Verifica se já existe comentário para este período/colaborador
      const { data: existing } = await supabase
        .from('relatorio_comentarios')
        .select('id')
        .eq('ano', input.ano)
        .eq('semana_inicio', input.semana_inicio)
        .eq('colaborador_id', input.colaborador_id || '')
        .maybeSingle();
      
      if (existing) {
        // Update
        const { error } = await supabase
          .from('relatorio_comentarios')
          .update({ 
            comentario: input.comentario,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        
        if (error) throw error;
        
        toast({
          title: 'Comentário atualizado',
          description: 'Seu comentário foi salvo com sucesso.'
        });
      } else {
        // Insert
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('Usuário não autenticado');
        
        const { error } = await supabase
          .from('relatorio_comentarios')
          .insert({
            tipo: input.tipo || 'semanal',
            colaborador_id: input.colaborador_id,
            ano: input.ano,
            semana_inicio: input.semana_inicio,
            semana_fim: input.semana_fim,
            comentario: input.comentario,
            created_by: userData.user.id
          });
        
        if (error) throw error;
        
        toast({
          title: 'Comentário salvo',
          description: 'Seu comentário foi salvo com sucesso.'
        });
      }
      
      // Atualiza lista local
      await fetchComentarios(input.ano, 0, input.colaborador_id);
      
      return true;
    } catch (err) {
      console.error('[useRelatorioComentarios] Save error:', err);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o comentário.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchComentarios, toast]);

  /**
   * Busca comentário específico de uma semana
   */
  const getComentarioSemana = useCallback((
    semana_inicio: string,
    colaborador_id: string | null
  ): RelatorioComentario | undefined => {
    return comentarios.find(c => 
      c.semana_inicio === semana_inicio && 
      c.colaborador_id === colaborador_id
    );
  }, [comentarios]);

  return {
    comentarios,
    loading,
    saving,
    fetchComentarios,
    saveComentario,
    getComentarioSemana
  };
}

export default useRelatorioComentarios;

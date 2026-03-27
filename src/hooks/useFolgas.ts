import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  getDay, 
  format 
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ColaboradorFolga, ColaboradorFolgaFixa } from '@/types/colaborador';

interface UseFolgasParams {
  colaboradorId?: string;
  ano?: number;
  mes?: number;
}

export function useFolgas({ colaboradorId, ano, mes }: UseFolgasParams = {}) {
  const queryClient = useQueryClient();

  // Folgas (avulsas e fixas geradas)
  const { data: folgasAvulsas = [], isLoading: loadingAvulsas } = useQuery({
    queryKey: ['colaborador_folgas', colaboradorId, ano, mes],
    queryFn: async () => {
      let query = supabase.from('colaborador_folgas').select('*');

      if (colaboradorId) {
        query = query.eq('colaborador_id', colaboradorId);
      }

      if (ano && mes) {
        const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const ultimoDia = endOfMonth(new Date(ano, mes - 1));
        const fim = format(ultimoDia, 'yyyy-MM-dd');
        query = query.gte('data', inicio).lte('data', fim);
      }

      const { data, error } = await query.order('data', { ascending: true });
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        tipo: item.tipo || 'avulsa',
      })) as ColaboradorFolga[];
    },
  });

  // Folgas fixas vigentes (tabela legada - ainda usada pelo calendário)
  const { data: folgasFixas = [], isLoading: loadingFixas } = useQuery({
    queryKey: ['colaborador_folgas_fixas', colaboradorId],
    queryFn: async () => {
      let query = supabase
        .from('colaborador_folgas_fixas')
        .select('*')
        .eq('ativo', true)
        .is('vigencia_fim', null);

      if (colaboradorId) {
        query = query.eq('colaborador_id', colaboradorId);
      }

      const { data, error } = await query.order('dia_semana', { ascending: true });
      if (error) throw error;
      return data as ColaboradorFolgaFixa[];
    },
  });

  // Histórico completo de folgas fixas (tabela legada)
  const { data: folgasFixasHistorico = [], isLoading: loadingHistorico } = useQuery({
    queryKey: ['colaborador_folgas_fixas_historico', colaboradorId],
    queryFn: async () => {
      if (!colaboradorId) return [];
      
      const { data, error } = await supabase
        .from('colaborador_folgas_fixas')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .order('vigencia_inicio', { ascending: false });
        
      if (error) throw error;
      return data as ColaboradorFolgaFixa[];
    },
    enabled: !!colaboradorId,
  });

  // Criar folga avulsa
  const createFolgaAvulsa = useMutation({
    mutationFn: async (folga: Omit<ColaboradorFolga, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('colaborador_folgas')
        .upsert({
          colaborador_id: folga.colaborador_id,
          data: folga.data,
          motivo: folga.motivo,
          tipo: folga.tipo || 'avulsa',
        }, { onConflict: 'colaborador_id,data' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador_folgas'] });
      queryClient.invalidateQueries({ queryKey: ['calendario-colaborador-dashboard'] });
    },
    onError: () => {
      toast.error('Erro ao adicionar folga');
    },
  });

  // Remover folga avulsa
  const deleteFolgaAvulsa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('colaborador_folgas')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador_folgas'] });
      queryClient.invalidateQueries({ queryKey: ['calendario-colaborador-dashboard'] });
      toast.success('Folga removida');
    },
    onError: () => {
      toast.error('Erro ao remover folga');
    },
  });

  // Toggle folga fixa (legado - para compatibilidade)
  const toggleFolgaFixa = useMutation({
    mutationFn: async ({ colaboradorId, diaSemana, ativo }: { colaboradorId: string; diaSemana: number; ativo: boolean }) => {
      if (ativo) {
        const { error } = await supabase
          .from('colaborador_folgas_fixas')
          .upsert({
            colaborador_id: colaboradorId,
            dia_semana: diaSemana,
            ativo: true,
            vigencia_inicio: new Date().toISOString().split('T')[0],
            vigencia_fim: null,
          }, {
            onConflict: 'colaborador_id,dia_semana',
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('colaborador_folgas_fixas')
          .update({ 
            ativo: false,
            vigencia_fim: new Date().toISOString().split('T')[0]
          })
          .eq('colaborador_id', colaboradorId)
          .eq('dia_semana', diaSemana)
          .is('vigencia_fim', null);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador_folgas_fixas'] });
      toast.success('Folga fixa atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar folga fixa');
    },
  });

  // Atualizar folgas fixas com nova vigência (legado)
  const updateFolgasFixasVigencia = useMutation({
    mutationFn: async ({ 
      colaboradorId, 
      diasSemana, 
      vigenciaInicio 
    }: { 
      colaboradorId: string; 
      diasSemana: number[]; 
      vigenciaInicio: string;
    }) => {
      const { data: folgasVigentes } = await supabase
        .from('colaborador_folgas_fixas')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .eq('ativo', true)
        .is('vigencia_fim', null);
      
      const diasAtuais = (folgasVigentes || []).map(f => f.dia_semana);
      const diasParaEncerrar = diasAtuais.filter(d => !diasSemana.includes(d));
      const diasParaAdicionar = diasSemana.filter(d => !diasAtuais.includes(d));
      
      const vigenciaDate = new Date(vigenciaInicio + 'T00:00:00');
      vigenciaDate.setDate(vigenciaDate.getDate() - 1);
      const dataEncerramento = vigenciaDate.toISOString().split('T')[0];
      
      for (const dia of diasParaEncerrar) {
        await supabase
          .from('colaborador_folgas_fixas')
          .update({ 
            vigencia_fim: dataEncerramento,
            ativo: false
          })
          .eq('colaborador_id', colaboradorId)
          .eq('dia_semana', dia)
          .eq('ativo', true)
          .is('vigencia_fim', null);
      }
      
      if (diasParaAdicionar.length > 0) {
        const novasEntradas = diasParaAdicionar.map(dia => ({
          colaborador_id: colaboradorId,
          dia_semana: dia,
          ativo: true,
          vigencia_inicio: vigenciaInicio,
          vigencia_fim: null,
        }));
        
        const { error } = await supabase
          .from('colaborador_folgas_fixas')
          .insert(novasEntradas);
          
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador_folgas_fixas'] });
      queryClient.invalidateQueries({ queryKey: ['colaborador_folgas_fixas_historico'] });
      toast.success('Folgas fixas atualizadas');
    },
    onError: (error) => {
      console.error('Erro ao atualizar folgas:', error);
      toast.error('Erro ao atualizar folgas fixas');
    },
  });

  // NOVA MUTATION: Gerar folgas fixas por período
  const gerarFolgasFixasPeriodo = useMutation({
    mutationFn: async ({ 
      colaboradorId, 
      diasSemana,
      mesInicio,
      anoInicio,
      mesFim,
      anoFim,
    }: { 
      colaboradorId: string; 
      diasSemana: number[];
      mesInicio: number;
      anoInicio: number;
      mesFim: number;
      anoFim: number;
    }) => {
      // 1. Calcular todas as datas dos dias selecionados no período
      const inicio = startOfMonth(new Date(anoInicio, mesInicio - 1));
      const fim = endOfMonth(new Date(anoFim, mesFim - 1));
      const todasDatas = eachDayOfInterval({ start: inicio, end: fim });
      const datasGeradas = todasDatas.filter(data => diasSemana.includes(getDay(data)));
      
      if (datasGeradas.length === 0) {
        throw new Error('Nenhuma data a ser gerada');
      }
      
      const periodoInicio = format(inicio, 'yyyy-MM-dd');
      const periodoFim = format(fim, 'yyyy-MM-dd');
      
      // 2. Remover folgas_fixas existentes do colaborador no período
      const { error: deleteError } = await supabase
        .from('colaborador_folgas')
        .delete()
        .eq('colaborador_id', colaboradorId)
        .eq('tipo', 'folga_fixa')
        .gte('data', periodoInicio)
        .lte('data', periodoFim);
      
      if (deleteError) throw deleteError;
      
      // 3. Inserir novas datas em lotes de 500
      const registros = datasGeradas.map(data => ({
        colaborador_id: colaboradorId,
        data: format(data, 'yyyy-MM-dd'),
        motivo: null,
        tipo: 'folga_fixa',
      }));
      
      const batchSize = 500;
      for (let i = 0; i < registros.length; i += batchSize) {
        const batch = registros.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('colaborador_folgas')
          .insert(batch);
        
        if (insertError) throw insertError;
      }
      
      return { totalGerado: registros.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['colaborador_folgas'] });
      queryClient.invalidateQueries({ queryKey: ['calendario-colaborador-dashboard'] });
      toast.success(`${data.totalGerado} folgas fixas geradas`);
    },
    onError: (error) => {
      console.error('Erro ao gerar folgas:', error);
      toast.error('Erro ao gerar folgas fixas');
    },
  });

  // Excluir folgas fixas de um período específico
  const deleteFolgasFixasPeriodo = useMutation({
    mutationFn: async ({ 
      colaboradorId, 
      mes, 
      ano 
    }: { 
      colaboradorId: string; 
      mes: number; 
      ano: number;
    }) => {
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const fim = `${ano}-${String(mes).padStart(2, '0')}-31`;
      
      const { error } = await supabase
        .from('colaborador_folgas')
        .delete()
        .eq('colaborador_id', colaboradorId)
        .eq('tipo', 'folga_fixa')
        .gte('data', inicio)
        .lte('data', fim);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador_folgas'] });
      queryClient.invalidateQueries({ queryKey: ['calendario-colaborador-dashboard'] });
      toast.success('Folgas do período excluídas');
    },
    onError: () => {
      toast.error('Erro ao excluir folgas do período');
    },
  });

  // Trocar data de uma folga fixa (excluir antiga e criar nova)
  const trocarFolgaFixa = useMutation({
    mutationFn: async ({ 
      folgaId, 
      colaboradorId: colabId,
      dataAntiga,
      dataNova, 
      motivo 
    }: { 
      folgaId: string; 
      colaboradorId: string;
      dataAntiga: string;
      dataNova: string; 
      motivo?: string;
    }) => {
      // 1. Deletar a folga antiga
      const { error: deleteError } = await supabase
        .from('colaborador_folgas')
        .delete()
        .eq('id', folgaId);
      
      if (deleteError) throw deleteError;
      
      // 2. Inserir a nova folga com motivo da troca
      const motivoCompleto = motivo 
        ? `Trocado de ${dataAntiga}: ${motivo}`
        : `Trocado de ${dataAntiga}`;
      
      const { error: insertError } = await supabase
        .from('colaborador_folgas')
        .insert({
          colaborador_id: colabId,
          data: dataNova,
          motivo: motivoCompleto,
          tipo: 'folga_fixa',
        });
      
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador_folgas'] });
      queryClient.invalidateQueries({ queryKey: ['calendario-colaborador-dashboard'] });
      toast.success('Folga trocada com sucesso');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('Já existe uma folga na data selecionada');
      } else {
        toast.error('Erro ao trocar folga');
      }
    },
  });

  // Helper: verifica se um dia é folga para um colaborador
  const ehFolga = useCallback((data: Date, colabId: string): boolean => {
    const diaSemana = data.getDay();
    const dataStr = format(data, 'yyyy-MM-dd');

    // Verifica folga fixa na tabela legada
    const temFolgaFixa = folgasFixas.some(
      f => f.colaborador_id === colabId && f.dia_semana === diaSemana && f.ativo
    );

    // Verifica folga na tabela principal (avulsa ou folga_fixa)
    const temFolgaRegistrada = folgasAvulsas.some(
      f => f.colaborador_id === colabId && f.data === dataStr
    );

    return temFolgaFixa || temFolgaRegistrada;
  }, [folgasFixas, folgasAvulsas]);

  // Helper: dias de folga fixa de um colaborador (tabela legada)
  const getDiasFolgaFixa = useCallback((colabId: string): number[] => {
    return folgasFixas
      .filter(f => f.colaborador_id === colabId && f.ativo)
      .map(f => f.dia_semana);
  }, [folgasFixas]);

  return {
    folgasAvulsas,
    folgasFixas,
    folgasFixasHistorico,
    isLoading: loadingAvulsas || loadingFixas || loadingHistorico,
    createFolgaAvulsa,
    deleteFolgaAvulsa,
    toggleFolgaFixa,
    updateFolgasFixasVigencia,
    gerarFolgasFixasPeriodo,
    deleteFolgasFixasPeriodo,
    trocarFolgaFixa,
    ehFolga,
    getDiasFolgaFixa,
  };
}
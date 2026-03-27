// ============================================================
// FILE: src/hooks/useDashboard.ts
// PROPÓSITO: Hook para gerenciar chamadas RPC do Dashboard
// FONTE DE DADOS: public.rpc_dashboard_period (Supabase)
// COMPORTAMENTO: 
//   - NÃO dispara automaticamente
//   - Requer chamada explícita de fetchDashboard()
//   - Busca última data com faturamento para default
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardData, DashboardFilters, DashboardColaborador } from '@/components/dashboard/types';
import { format, parseISO, startOfMonth } from 'date-fns';

/**
 * Formata Date para string YYYY-MM-DD (formato aceito pela RPC)
 */
function formatDateForRPC(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Hook principal do Dashboard
 * 
 * @returns {Object}
 *   - data: Dados do dashboard (null se não carregado)
 *   - loading: Estado de carregamento
 *   - error: Mensagem de erro (null se sem erro)
 *   - fetchDashboard: Função para carregar dados
 *   - colaboradores: Lista de colaboradores para filtro
 *   - fetchColaboradores: Função para carregar colaboradores
 *   - lastFaturamentoDate: Última data com faturamento no mês atual
 */
export function useDashboard() {
  // Estado dos dados do dashboard
  const [data, setData] = useState<DashboardData | null>(null);
  
  // Estado de carregamento
  const [loading, setLoading] = useState(false);
  
  // Estado de erro
  const [error, setError] = useState<string | null>(null);
  
  // Lista de colaboradores para o filtro
  const [colaboradores, setColaboradores] = useState<DashboardColaborador[]>([]);
  
  // Loading específico para colaboradores
  const [colaboradoresLoading, setColaboradoresLoading] = useState(false);
  
  // Última data com faturamento (para default do filtro)
  const [lastFaturamentoDate, setLastFaturamentoDate] = useState<Date | null>(null);
  
  // Loading para busca de última data
  const [lastDateLoading, setLastDateLoading] = useState(false);

  /**
   * Busca última data com faturamento no mês atual
   * Usado para definir data fim padrão dos filtros
   */
  const fetchLastFaturamentoDate = useCallback(async () => {
    setLastDateLoading(true);
    
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_get_last_faturamento_date');

      if (rpcError) {
        console.error('[useDashboard] Last date Error:', rpcError);
        setLastFaturamentoDate(startOfMonth(new Date()));
      } else if (rpcData) {
        const parsedDate = parseISO(rpcData);
        setLastFaturamentoDate(parsedDate);
      } else {
        setLastFaturamentoDate(startOfMonth(new Date()));
      }
    } catch (err) {
      console.error('[useDashboard] Last date Exception:', err);
      setLastFaturamentoDate(startOfMonth(new Date()));
    } finally {
      setLastDateLoading(false);
    }
  }, []);

  // Busca última data ao montar
  useEffect(() => {
    fetchLastFaturamentoDate();
  }, [fetchLastFaturamentoDate]);

  /**
   * Busca dados do dashboard via RPC
   * 
   * @param filters - Filtros selecionados pelo usuário
   * 
   * CHAMADA RPC:
   *   supabase.rpc('rpc_dashboard_period', {
   *     p_inicio: date,
   *     p_fim: date,
   *     p_colaborador_id: text | null,
   *     p_tipo_colaborador: text | null
   *   })
   */
  const fetchDashboard = useCallback(async (filters: DashboardFilters) => {
    setLoading(true);
    setError(null);

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_dashboard_period', {
        p_inicio: formatDateForRPC(filters.dateFrom),
        p_fim: formatDateForRPC(filters.dateTo),
        p_colaborador_id: filters.colaboradorId,
        p_tipo_colaborador: filters.tipoColaborador
      });

      if (rpcError) {
        console.error('[useDashboard] RPC Error:', rpcError);
        setError(rpcError.message);
        setData(null);
      } else {
        const typedData = rpcData as unknown as DashboardData;
        setData(typedData);
        
        // Atualiza lista de colaboradores do retorno da RPC
        // NOTA: Agora retorna apenas colaboradores COM faturamento no período
        if (typedData?.colaboradores_periodo) {
          setColaboradores(typedData.colaboradores_periodo);
        }
      }
    } catch (err) {
      console.error('[useDashboard] Exception:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Busca lista de colaboradores ativos
   * Usado para popular o select de colaboradores inicial
   * 
   * FONTE: public.dimensao_colaboradores
   * FILTROS: ativo = true, tipo_colaborador (se informado)
   */
  const fetchColaboradores = useCallback(async (tipoColaborador: string | null = null) => {
    setColaboradoresLoading(true);

    try {
      let query = supabase
        .from('dimensao_colaboradores')
        .select('colaborador_id, colaborador_nome')
        .eq('ativo', true)
        .order('colaborador_nome', { ascending: true });

      // Filtra por tipo se informado
      if (tipoColaborador) {
        query = query.eq('tipo_colaborador', tipoColaborador);
      }

      const { data: colabs, error: colabError } = await query;

      if (colabError) {
        console.error('[useDashboard] Colaboradores Error:', colabError);
      } else {
        setColaboradores(colabs || []);
      }
    } catch (err) {
      console.error('[useDashboard] Colaboradores Exception:', err);
    } finally {
      setColaboradoresLoading(false);
    }
  }, []);

  return {
    // Dados e estados
    data,
    loading,
    error,
    colaboradores,
    colaboradoresLoading,
    lastFaturamentoDate,
    lastDateLoading,
    
    // Ações
    fetchDashboard,
    fetchColaboradores,
    fetchLastFaturamentoDate,
    
    // Reset
    clearError: () => setError(null),
    clearData: () => setData(null)
  };
}

export default useDashboard;

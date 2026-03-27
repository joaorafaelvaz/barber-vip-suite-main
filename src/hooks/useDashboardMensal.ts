import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardColaborador, DashboardComparacoes, DashboardKpis, ByColaborador } from '@/components/dashboard/types';

export interface DashboardMonthly {
  ano_mes: string;
  faturamento: number;
  atendimentos: number;
  ticket_medio: number;
  clientes: number;
  clientes_novos: number;
  extras_qtd: number;
  extras_valor: number;
  servicos_totais: number;
  dias_trabalhados: number;
}

export interface DashboardMensalFilters {
  anoInicio: number;
  mesInicio: number;
  anoFim: number;
  mesFim: number;
  colaboradorId: string | null;
  tipoColaborador: 'barbeiro' | 'recepcao' | null;
}

export interface DashboardMensalData {
  periodo: { inicio: string; fim: string };
  filtros: { colaborador_id: string | null; tipo_colaborador: string | null };
  kpis: DashboardKpis;
  monthly: DashboardMonthly[];
  colaboradores_periodo: DashboardColaborador[];
  by_colaborador: ByColaborador[];
  comparacoes: DashboardComparacoes;
}

export function useDashboardMensal() {
  const [data, setData] = useState<DashboardMensalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colaboradores, setColaboradores] = useState<DashboardColaborador[]>([]);

  const fetchColaboradores = useCallback(async (tipoColaborador: string | null = null) => {
    try {
      let query = supabase
        .from('dimensao_colaboradores')
        .select('colaborador_id, colaborador_nome')
        .eq('ativo', true)
        .order('colaborador_nome', { ascending: true });

      if (tipoColaborador) {
        query = query.eq('tipo_colaborador', tipoColaborador);
      }

      const { data: colabs, error: colabError } = await query;
      if (!colabError) {
        setColaboradores(colabs || []);
      }
    } catch (err) {
      console.error('[useDashboardMensal] Colaboradores Exception:', err);
    }
  }, []);

  useEffect(() => {
    fetchColaboradores();
  }, [fetchColaboradores]);

  const fetchDashboard = useCallback(async (filters: DashboardMensalFilters) => {
    setLoading(true);
    setError(null);

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_dashboard_monthly' as any, {
        p_ano_inicio: filters.anoInicio,
        p_mes_inicio: filters.mesInicio,
        p_ano_fim: filters.anoFim,
        p_mes_fim: filters.mesFim,
        p_colaborador_id: filters.colaboradorId,
        p_tipo_colaborador: filters.tipoColaborador,
      });

      if (rpcError) {
        console.error('[useDashboardMensal] RPC Error:', rpcError);
        setError(rpcError.message);
        setData(null);
      } else {
        const typedData = rpcData as unknown as DashboardMensalData;
        setData(typedData);
        if (typedData?.colaboradores_periodo) {
          setColaboradores(typedData.colaboradores_periodo);
        }
      }
    } catch (err) {
      console.error('[useDashboardMensal] Exception:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    data,
    loading,
    error,
    colaboradores,
    fetchDashboard,
    fetchColaboradores,
    clearError: () => setError(null),
  };
}

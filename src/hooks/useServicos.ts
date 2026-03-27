import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardColaborador } from '@/components/dashboard/types';

export interface ServicosFilters {
  dataInicio: string;
  dataFim: string;
  colaboradorId: string | null;
  tipoServico: 'Base' | 'Extra' | 'Produtos' | null;
  agrupamento: 'servico' | 'barbeiro' | 'mes';
}

export interface ServicoItem {
  nome: string;
  categoria: string;
  grupo_de_produto?: string;
  faturamento: number;
  quantidade: number;
  ticket_medio: number;
  participacao_pct: number;
  colaborador_id?: string;
  colaborador_nome?: string;
  mes_ano?: string;
}

export interface ServicosKpis {
  faturamento_total: number;
  quantidade_total: number;
  ticket_medio: number;
  top_servicos: Array<{
    nome: string;
    faturamento: number;
  }>;
}

export interface ServicosData {
  periodo: { inicio: string; fim: string };
  filtros: {
    colaborador_id: string | null;
    tipo_servico: string | null;
    agrupamento: string;
  };
  kpis: ServicosKpis;
  items: ServicoItem[];
  colaboradores_periodo: DashboardColaborador[];
}

export function useServicos() {
  const [data, setData] = useState<ServicosData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colaboradores, setColaboradores] = useState<DashboardColaborador[]>([]);

  const fetchColaboradores = useCallback(async () => {
    try {
      const { data: colabs, error: colabError } = await supabase
        .from('dimensao_colaboradores')
        .select('colaborador_id, colaborador_nome')
        .eq('ativo', true)
        .eq('tipo_colaborador', 'barbeiro')
        .order('colaborador_nome', { ascending: true });

      if (!colabError) {
        setColaboradores(colabs || []);
      }
    } catch (err) {
      console.error('[useServicos] Colaboradores Exception:', err);
    }
  }, []);

  useEffect(() => {
    fetchColaboradores();
  }, [fetchColaboradores]);

  const fetchServicos = useCallback(async (filters: ServicosFilters) => {
    setLoading(true);
    setError(null);

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_servicos_analise' as any, {
        p_data_inicio: filters.dataInicio,
        p_data_fim: filters.dataFim,
        p_colaborador_id: filters.colaboradorId,
        p_tipo_servico: filters.tipoServico,
        p_agrupamento: filters.agrupamento,
      });

      if (rpcError) {
        console.error('[useServicos] RPC Error:', rpcError);
        setError(rpcError.message);
        setData(null);
      } else {
        const typedData = rpcData as unknown as ServicosData;
        setData(typedData);
        if (typedData?.colaboradores_periodo) {
          setColaboradores(typedData.colaboradores_periodo);
        }
      }
    } catch (err) {
      console.error('[useServicos] Exception:', err);
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
    fetchServicos,
    fetchColaboradores,
    clearError: () => setError(null),
  };
}
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DrillMensalTipo = 'novos' | 'em_risco' | 'perdidos' | 'resgatados' | 'ativos';

export interface DrillMensalCliente {
  cliente_id: string;
  nome: string;
  telefone: string;
  ultima_visita: string;
  primeira_visita: string;
  dias_sem_vir: number;
  visitas_total: number;
  colaborador_nome: string;
  colaborador_id: string;
  dias_ausente?: number;
}

export interface DrillMensalMeta {
  ano_mes: string;
  tipo: DrillMensalTipo;
  mes_inicio: string;
  mes_fim: string;
  total: number;
  limit: number;
  offset: number;
}

export interface DrillMensalResult {
  meta: DrillMensalMeta;
  clientes: DrillMensalCliente[];
}

interface Params {
  riscoMinDias?: number;
  riscoMaxDias?: number;
  resgateMinDias?: number;
  excluirSemCadastro?: boolean;
}

export function useRaioxVisaoGeralDrillMensal(params: Params = {}) {
  const {
    riscoMinDias = 45,
    riscoMaxDias = 90,
    resgateMinDias = 90,
    excluirSemCadastro = true,
  } = params;

  const [data, setData] = useState<DrillMensalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (
    anoMes: string,
    tipo: DrillMensalTipo,
    colaboradorId?: string,
    limit = 200,
    offset = 0,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        'rpc_raiox_visaogeral_drill_mensal_v1' as any,
        {
          p_ano_mes: anoMes,
          p_tipo: tipo,
          p_colaborador_id: colaboradorId ?? null,
          p_risco_min_dias: riscoMinDias,
          p_risco_max_dias: riscoMaxDias,
          p_resgate_dias_minimos: resgateMinDias,
          p_excluir_sem_cadastro: excluirSemCadastro,
          p_limit: limit,
          p_offset: offset,
        }
      );
      if (rpcError) throw new Error(rpcError.message);
      setData(result as DrillMensalResult);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar clientes do mês');
    } finally {
      setLoading(false);
    }
  }, [riscoMinDias, riscoMaxDias, resgateMinDias, excluirSemCadastro]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, fetch, reset };
}

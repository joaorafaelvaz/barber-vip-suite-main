import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { RaioXComputedFilters } from '@/pages/app/raiox-clientes/raioxTypes';
import { defaultRaioxClientesConfig } from '@/pages/app/raiox-clientes/config/defaultConfig';

export interface OverviewKpis {
  clientes_unicos_periodo: number;
  novos_clientes_periodo: number;
  clientes_ativos_janela: number;
  clientes_em_risco_macro: number;
  clientes_perdidos_macro: number;
  clientes_resgatados_periodo: number;
  one_shot_em_risco: number;
  one_shot_perdido: number;
}

export interface OverviewDistItem {
  perfil?: string;
  status?: string;
  macro?: string;
  qtd: number;
}

export interface OverviewTrendItem {
  ano: number;
  mes: number;
  qtd: number;
}

export interface OverviewAlerts {
  registros_sem_cliente_id: number;
  pct_registros_sem_cliente_id: number;
}

export interface OverviewData {
  meta: Record<string, unknown> & { base_total?: number; base_distribuicao_total?: number; status12m_meses?: number };
  kpis: OverviewKpis;
  distribuicoes: {
    por_perfil_tipo: OverviewDistItem[];
    por_cadencia_momento: OverviewDistItem[];
    por_macro: OverviewDistItem[];
  };
  tendencias: {
    clientes_unicos_mensal: OverviewTrendItem[];
    novos_clientes_mensal: OverviewTrendItem[];
  };
  alerts: OverviewAlerts;
  /** True when the hook auto-limited the period sent to the RPC */
  _periodoLimitado?: boolean;
}

export interface RaioxConfigParams {
  ref_mode?: string;
  base_mode?: string;
  base_corte_meses?: number;
  status12m_meses?: number;
  status12m_enabled?: boolean;
}

// No period cap — the RPC has a 300s statement_timeout configured in the database.

function isTimeoutError(msg: string): boolean {
  return msg.includes('57014') || msg.toLowerCase().includes('statement timeout') || msg.toLowerCase().includes('canceling statement');
}

export function useRaioXClientesOverview(filters: RaioXComputedFilters, configOverrides?: RaioxConfigParams) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(0);

  // Merge config defaults with any overrides
  const cfg = {
    ref_mode: configOverrides?.ref_mode ?? defaultRaioxClientesConfig.ref_mode,
    base_mode: configOverrides?.base_mode ?? defaultRaioxClientesConfig.base_mode,
    base_corte_meses: configOverrides?.base_corte_meses ?? defaultRaioxClientesConfig.base_corte_meses,
    status12m_meses: configOverrides?.status12m_meses ?? defaultRaioxClientesConfig.status12m_meses,
    status12m_enabled: configOverrides?.status12m_enabled ?? defaultRaioxClientesConfig.status12m_enabled,
  };

  const fetchData = useCallback(async () => {
    const id = ++abortRef.current;
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        'rpc_raiox_clientes_overview_v1' as any,
        {
          p_inicio: filters.dataInicioISO,
          p_fim: filters.dataFimISO,
          p_janela_dias: filters.janelaDias,
          p_colaborador_id: filters.filtroColaborador.id || null,
          p_excluir_sem_cadastro: filters.excluirSemCadastro,
          p_base_mode: cfg.base_mode,
          p_base_corte_meses: cfg.base_corte_meses,
          p_status12m_meses: cfg.status12m_meses,
          p_ref_mode: cfg.ref_mode,
        }
      );

      if (id !== abortRef.current) return;

      if (rpcError) {
        if (isTimeoutError(rpcError.message)) {
          setError('Consulta excedeu o tempo limite. Tente reduzir o período selecionado.');
          toast.error('Timeout: a consulta da Visão Geral excedeu o limite. Reduza o período.');
        } else {
          setError(rpcError.message);
        }
        setData(null);
      } else {
        const parsed = result as unknown as OverviewData;
        // Inject config metadata if not present from RPC
        if (parsed?.meta && parsed.meta.status12m_meses == null) {
          parsed.meta.status12m_meses = cfg.status12m_meses;
        }
        parsed._periodoLimitado = false;
        setData(parsed);
      }
    } catch (err: any) {
      if (id === abortRef.current) {
        const msg = err.message || 'Erro desconhecido';
        if (isTimeoutError(msg)) {
          setError('Consulta excedeu o tempo limite. Tente reduzir o período selecionado.');
          toast.error('Timeout: a consulta da Visão Geral excedeu o limite. Reduza o período.');
        } else {
          setError(msg);
        }
        setData(null);
      }
    } finally {
      if (id === abortRef.current) setLoading(false);
    }
  }, [filters.dataInicioISO, filters.dataFimISO, filters.janelaDias, filters.filtroColaborador.id, filters.excluirSemCadastro, cfg.status12m_meses, cfg.base_mode, cfg.base_corte_meses, cfg.ref_mode, cfg.status12m_enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

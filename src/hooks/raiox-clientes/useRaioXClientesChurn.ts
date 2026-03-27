import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RaioXComputedFilters } from '@/pages/app/raiox-clientes/raioxTypes';
import { defaultRaioxClientesConfig } from '@/pages/app/raiox-clientes/config/defaultConfig';
import type { RaioxConfigParams } from './useRaioXClientesOverview';

export interface ChurnKpis {
  churn_geral_pct: number;
  perdidos: number;
  base_ativa: number;
  churn_fidelizados_pct: number;
  perdidos_fidelizados: number;
  base_fidelizados: number;
  churn_oneshot_pct: number;
  perdidos_oneshot: number;
  base_oneshot: number;
  resgatados: number;
  em_risco: number;
}

export interface ChurnBarbeiroItem {
  colaborador_id: string;
  colaborador_nome: string;
  base_ativa: number;
  perdidos: number;
  churn_pct: number;
  exclusivos_pct: number | null;
  compartilhados_pct: number | null;
}

export interface ChurnListaItem {
  cliente_id: string;
  cliente_nome: string | null;
  telefone: string | null;
  colaborador_nome: string | null;
  ultima_visita: string | null;
  dias_sem_vir: number;
  visitas_total: number;
  valor_total: number;
  status_churn: string;
}

export interface ChurnData {
  meta: {
    ref: string;
    inicio: string;
    fim: string;
    base_mode: string;
    base_corte_meses: number;
    base_ativa: number;
    base_fidelizados: number;
    base_oneshot: number;
    total_universo: number;
  };
  kpis: ChurnKpis;
  por_barbeiro: ChurnBarbeiroItem[];
  lista_perdidos: ChurnListaItem[];
}

export interface ChurnConfigOverrides extends RaioxConfigParams {
  churn_dias_sem_voltar?: number;
  risco_min_dias?: number;
  risco_max_dias?: number;
  cadencia_min_visitas?: number;
  resgate_dias_minimos?: number;
  atribuicao_modo?: string;
  atribuicao_janela_meses?: number;
}

export function useRaioXClientesChurn(filters: RaioXComputedFilters, configOverrides?: ChurnConfigOverrides) {
  const [data, setData] = useState<ChurnData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(0);

  const cfg = {
    ref_mode: configOverrides?.ref_mode ?? defaultRaioxClientesConfig.ref_mode,
    base_mode: configOverrides?.base_mode ?? defaultRaioxClientesConfig.base_mode,
    base_corte_meses: configOverrides?.base_corte_meses ?? defaultRaioxClientesConfig.base_corte_meses,
    churn_dias_sem_voltar: configOverrides?.churn_dias_sem_voltar ?? defaultRaioxClientesConfig.churn_dias_sem_voltar,
    risco_min_dias: configOverrides?.risco_min_dias ?? defaultRaioxClientesConfig.risco_min_dias,
    risco_max_dias: configOverrides?.risco_max_dias ?? defaultRaioxClientesConfig.risco_max_dias,
    cadencia_min_visitas: configOverrides?.cadencia_min_visitas ?? defaultRaioxClientesConfig.cadencia_min_visitas,
    resgate_dias_minimos: configOverrides?.resgate_dias_minimos ?? defaultRaioxClientesConfig.resgate_dias_minimos,
    atribuicao_modo: configOverrides?.atribuicao_modo ?? defaultRaioxClientesConfig.atribuicao_modo,
    atribuicao_janela_meses: configOverrides?.atribuicao_janela_meses ?? defaultRaioxClientesConfig.atribuicao_janela_meses,
  };

  const fetchData = useCallback(async () => {
    const id = ++abortRef.current;
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        'rpc_raiox_clientes_churn_v1' as any,
        {
          p_inicio: filters.dataInicioISO,
          p_fim: filters.dataFimISO,
          p_janela_dias: filters.janelaDias,
          p_colaborador_id: filters.filtroColaborador.id || null,
          p_excluir_sem_cadastro: filters.excluirSemCadastro,
          p_churn_dias_sem_voltar: cfg.churn_dias_sem_voltar,
          p_risco_min_dias: cfg.risco_min_dias,
          p_risco_max_dias: cfg.risco_max_dias,
          p_cadencia_min_visitas: cfg.cadencia_min_visitas,
          p_resgate_dias_minimos: cfg.resgate_dias_minimos,
          p_atribuicao_modo: cfg.atribuicao_modo,
          p_atribuicao_janela_meses: cfg.atribuicao_janela_meses,
          p_base_mode: cfg.base_mode,
          p_base_corte_meses: cfg.base_corte_meses,
          p_ref_mode: cfg.ref_mode,
        }
      );

      if (id !== abortRef.current) return;

      if (rpcError) {
        setError(rpcError.message);
        setData(null);
      } else {
        setData(result as unknown as ChurnData);
      }
    } catch (err: any) {
      if (id === abortRef.current) {
        setError(err.message || 'Erro desconhecido');
        setData(null);
      }
    } finally {
      if (id === abortRef.current) setLoading(false);
    }
  }, [
    filters.dataInicioISO, filters.dataFimISO, filters.janelaDias,
    filters.filtroColaborador.id, filters.excluirSemCadastro,
    cfg.churn_dias_sem_voltar, cfg.risco_min_dias, cfg.risco_max_dias,
    cfg.cadencia_min_visitas, cfg.resgate_dias_minimos,
    cfg.atribuicao_modo, cfg.atribuicao_janela_meses,
    cfg.base_mode, cfg.base_corte_meses, cfg.ref_mode,
  ]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

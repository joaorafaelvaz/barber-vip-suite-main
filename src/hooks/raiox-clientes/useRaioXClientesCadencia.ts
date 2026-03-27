import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RaioXComputedFilters } from '@/pages/app/raiox-clientes/raioxTypes';
import { defaultRaioxClientesConfig } from '@/pages/app/raiox-clientes/config/defaultConfig';

export interface CadenciaKpis {
  total: number;
  assiduo: number;
  regular: number;
  espacando: number;
  primeira_vez: number;
  em_risco: number;
  perdido: number;
}

export interface CadenciaBarbeiroItem {
  colaborador_nome: string;
  colaborador_id: string;
  total: number;
  assiduo: number;
  regular: number;
  espacando: number;
  primeira_vez: number;
  em_risco: number;
  perdido: number;
}

export interface CadenciaSeriesItem {
  ano_mes: string;
  ano_mes_label: string;
  total: number;
  assiduo: number;
  regular: number;
  espacando: number;
  primeira_vez: number;
  em_risco: number;
  perdido: number;
  pct_em_risco: number;
  pct_perdido: number;
  delta_mom_risco: number | null;
  delta_mom_perdido: number | null;
}

export interface CadenciaData {
  meta: Record<string, unknown>;
  kpis: CadenciaKpis;
  por_barbeiro: CadenciaBarbeiroItem[];
  series: CadenciaSeriesItem[];
}

export interface CadenciaConfigParams {
  ref_mode?: string;
  base_mode?: string;
  base_corte_meses?: number;
  cadencia_meses_analise?: number;
  cadencia_min_visitas?: number;
  ratio_muito_frequente_max?: number;
  ratio_regular_max?: number;
  ratio_espacando_max?: number;
  ratio_risco_max?: number;
  one_shot_aguardando_max_dias?: number;
  one_shot_risco_max_dias?: number;
  atribuicao_modo?: string;
  atribuicao_janela_meses?: number;
  cadencia_evolution_grain?: string;
  cadencia_evolution_range_months?: number;
}

export function useRaioXClientesCadencia(filters: RaioXComputedFilters, configOverrides?: CadenciaConfigParams, enabled = true) {
  const [data, setData] = useState<CadenciaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(0);

  const d = defaultRaioxClientesConfig;
  const cfg = {
    ref_mode: configOverrides?.ref_mode ?? d.ref_mode,
    base_mode: configOverrides?.base_mode ?? d.base_mode,
    base_corte_meses: configOverrides?.base_corte_meses ?? d.base_corte_meses,
    cadencia_meses_analise: configOverrides?.cadencia_meses_analise ?? d.cadencia_meses_analise,
    cadencia_min_visitas: configOverrides?.cadencia_min_visitas ?? d.cadencia_min_visitas,
    ratio_muito_frequente_max: configOverrides?.ratio_muito_frequente_max ?? d.ratio_muito_frequente_max,
    ratio_regular_max: configOverrides?.ratio_regular_max ?? d.ratio_regular_max,
    ratio_espacando_max: configOverrides?.ratio_espacando_max ?? d.ratio_espacando_max,
    ratio_risco_max: configOverrides?.ratio_risco_max ?? d.ratio_risco_max,
    one_shot_aguardando_max_dias: configOverrides?.one_shot_aguardando_max_dias ?? d.one_shot_aguardando_max_dias,
    one_shot_risco_max_dias: configOverrides?.one_shot_risco_max_dias ?? d.one_shot_risco_max_dias,
    atribuicao_modo: configOverrides?.atribuicao_modo ?? d.atribuicao_modo,
    atribuicao_janela_meses: configOverrides?.atribuicao_janela_meses ?? d.atribuicao_janela_meses,
    cadencia_evolution_grain: configOverrides?.cadencia_evolution_grain ?? d.cadencia_evolution_grain,
    cadencia_evolution_range_months: configOverrides?.cadencia_evolution_range_months ?? d.cadencia_evolution_range_months,
  };

  const fetchData = useCallback(async () => {
    const id = ++abortRef.current;
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        'rpc_raiox_clientes_cadencia_v2' as any,
        {
          p_inicio: filters.dataInicioISO,
          p_fim: filters.dataFimISO,
          p_janela_dias: filters.janelaDias,
          p_colaborador_id: filters.filtroColaborador.id || null,
          p_excluir_sem_cadastro: filters.excluirSemCadastro,
          p_base_mode: cfg.base_mode,
          p_base_corte_meses: cfg.base_corte_meses,
          p_ref_mode: cfg.ref_mode,
          p_cadencia_meses_analise: cfg.cadencia_meses_analise,
          p_cadencia_min_visitas: cfg.cadencia_min_visitas,
          p_ratio_muito_frequente_max: cfg.ratio_muito_frequente_max,
          p_ratio_regular_max: cfg.ratio_regular_max,
          p_ratio_espacando_max: cfg.ratio_espacando_max,
          p_ratio_risco_max: cfg.ratio_risco_max,
          p_one_shot_aguardando_max_dias: cfg.one_shot_aguardando_max_dias,
          p_one_shot_risco_max_dias: cfg.one_shot_risco_max_dias,
          p_atribuicao_modo: cfg.atribuicao_modo,
          p_atribuicao_janela_meses: cfg.atribuicao_janela_meses,
          p_grain: cfg.cadencia_evolution_grain,
          p_range_months: cfg.cadencia_evolution_range_months,
        }
      );

      if (id !== abortRef.current) return;

      if (rpcError) {
        setError(rpcError.message);
        setData(null);
      } else {
        setData(result as unknown as CadenciaData);
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
    cfg.ref_mode, cfg.base_mode, cfg.base_corte_meses,
    cfg.cadencia_meses_analise, cfg.cadencia_min_visitas,
    cfg.ratio_muito_frequente_max, cfg.ratio_regular_max,
    cfg.ratio_espacando_max, cfg.ratio_risco_max,
    cfg.one_shot_aguardando_max_dias, cfg.one_shot_risco_max_dias,
    cfg.atribuicao_modo, cfg.atribuicao_janela_meses,
    cfg.cadencia_evolution_grain, cfg.cadencia_evolution_range_months,
  ]);

  useEffect(() => {
    if (!enabled) return;
    fetchData();
  }, [fetchData, enabled]);

  return { data, loading, error, refetch: fetchData };
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CohortRow {
  cohort_ano_mes: string;
  size: number;
  m1_pct: number | null;
  m2_pct: number | null;
  m3_pct: number | null;
  m6_pct: number | null;
}

export interface CohortBarbeiro {
  colaborador_id: string;
  colaborador_nome: string;
  cohorts: CohortRow[];
}

export function useClientesCohortGeral(opts: {
  dataInicio: string;
  dataFim: string;
  excluirSemCadastro: boolean;
  enabled: boolean;
}) {
  const { dataInicio, dataFim, excluirSemCadastro, enabled } = opts;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cohortGeral, setCohortGeral] = useState<CohortRow[] | null>(null);
  const [cohortPorBarbeiro, setCohortPorBarbeiro] = useState<CohortBarbeiro[] | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [r1, r2] = await Promise.all([
        supabase.rpc('rpc_clientes_cohort_geral' as any, {
          p_inicio: dataInicio,
          p_fim: dataFim,
          p_excluir_sem_cadastro: excluirSemCadastro,
        }),
        supabase.rpc('rpc_clientes_cohort_barbeiros' as any, {
          p_inicio: dataInicio,
          p_fim: dataFim,
          p_excluir_sem_cadastro: excluirSemCadastro,
        }),
      ]);

      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;

      setCohortGeral((r1.data ?? null) as any);
      setCohortPorBarbeiro((r2.data ?? null) as any);
    } catch (e: any) {
      console.error('[useClientesCohortGeral]', e);
      setError(e?.message || 'Erro ao carregar cohort');
    } finally {
      setLoading(false);
    }
  }, [enabled, dataInicio, dataFim, excluirSemCadastro]);

  useEffect(() => { load(); }, [load]);

  return { loading, error, cohortGeral, cohortPorBarbeiro, reload: load };
}

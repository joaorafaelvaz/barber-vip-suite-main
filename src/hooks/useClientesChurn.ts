import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type JanelaDias = number;

export interface ChurnResumo {
  base_ativa: number;
  perdidos: number;
  churn_pct: number;
  resgatados: number;
  tempo_medio_resgate: number | null;
  valor_perdido_estimado: number | null;
}

export interface ChurnSerieItem {
  ano_mes: string;
  base_ativa: number;
  perdidos: number;
  churn_pct: number;
  resgatados: number;
}

export interface ChurnBarbeiroItem {
  colaborador_id: string;
  colaborador_nome: string;
  base_ativa: number;
  perdidos: number;
  churn_pct: number;
  exclusivos_pct?: number | null;
  compartilhados_pct?: number | null;
}

export interface SaldoBaseData {
  base_inicio: number;
  novos_entraram: number;
  novos_ficaram: number;
  sairam: number;
  base_atual: number;
  saldo: number;
}

export function useClientesChurn(opts: {
  refDate: string;
  dataInicio: string;
  dataFim: string;
  janelaDias: JanelaDias;
  excluirSemCadastro: boolean;
  enabled: boolean;
}) {
  const { refDate, dataInicio, dataFim, janelaDias, excluirSemCadastro, enabled } = opts;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ChurnResumo | null>(null);
  const [serie, setSerie] = useState<ChurnSerieItem[] | null>(null);
  const [porBarbeiro, setPorBarbeiro] = useState<ChurnBarbeiroItem[] | null>(null);
  const [saldoBase, setSaldoBase] = useState<SaldoBaseData | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);

    try {
      const [r1, r2, r3, r4] = await Promise.all([
        supabase.rpc('rpc_clientes_churn_resumo' as any, {
          p_ref: refDate,
          p_janela_dias: janelaDias,
          p_excluir_sem_cadastro: excluirSemCadastro,
        }),
        supabase.rpc('rpc_clientes_churn_series' as any, {
          p_inicio: dataInicio,
          p_fim: dataFim,
          p_janela_dias: janelaDias,
          p_excluir_sem_cadastro: excluirSemCadastro,
        }),
        supabase.rpc('rpc_clientes_churn_barbeiros' as any, {
          p_ref: refDate,
          p_janela_dias: janelaDias,
          p_excluir_sem_cadastro: excluirSemCadastro,
        }),
        supabase.rpc('rpc_clientes_saldo_base' as any, {
          p_ref: refDate,
          p_janela_dias: janelaDias,
          p_excluir_sem_cadastro: excluirSemCadastro,
        }),
      ]);

      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      if (r3.error) throw r3.error;
      if (r4.error) throw r4.error;

      setResumo((r1.data ?? null) as any);
      setSerie((r2.data ?? null) as any);
      setPorBarbeiro((r3.data ?? null) as any);
      setSaldoBase((r4.data ?? null) as any);
    } catch (e: any) {
      console.error('[useClientesChurn]', e);
      setError(e?.message || 'Erro ao carregar churn');
    } finally {
      setLoading(false);
    }
  }, [enabled, refDate, dataInicio, dataFim, janelaDias, excluirSemCadastro]);

  useEffect(() => { load(); }, [load]);

  return { loading, error, resumo, serie, porBarbeiro, saldoBase, reload: load };
}

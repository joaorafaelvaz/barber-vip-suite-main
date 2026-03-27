/**
 * FILE: src/hooks/useSyncDatabase.ts
 *
 * 2 modos:
 * - auditVendas(): chama Edge Function import_api_to_raw em modo "audit" (NÃO escreve no banco)
 * - syncVendas():  chama Edge Function import_api_to_raw em modo "execute" (ESCREVE no banco)
 *
 * IMPORTANTE (Brasil / -03):
 * - NÃO usar toISOString().split('T')[0] para "dia puro"
 *   porque isso converte para UTC e pode voltar 1 dia dependendo do horário.
 * - Aqui usamos formatDateLocal() para sempre gerar YYYY-MM-DD no horário local.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Retorno esperado da sincronização (EXECUTE).
 */
export interface SyncVendasResult {
  ok: boolean;
  mode?: 'execute' | string;
  message?: string;
  error?: string;
  details?: string;

  fetched_count?: number; // api_rows_received
  inserted_count?: number; // tmp_inserted

  periodo_inicio?: string;
  periodo_fim?: string;

  before_raw_rows_in_period?: number;
  after_raw_rows_in_period?: number;

  deleted_rows_in_period?: number;
  inserted_rows_in_period?: number;
  net_change_in_period?: number;

  warnings?: string[];
  source_run_id?: string;
  total_ms?: string;
}

/**
 * Retorno esperado da auditoria (AUDIT).
 * (Não grava no banco, apenas calcula impacto esperado)
 */
export interface AuditVendasResult {
  ok: boolean;
  mode?: 'audit' | string;
  error?: string;
  details?: string;

  periodo_inicio?: string;
  periodo_fim?: string;

  before?: {
    raw_rows_in_period?: number;
  };

  incoming?: {
    api_rows_received?: number;
    rows_mapped?: number;
    invalid_date_rows?: number;
    missing_venda_id_rows?: number;
  };

  expected?: {
    will_delete_raw_rows_in_period?: number;
    will_insert_rows_from_api?: number;
    expected_raw_rows_in_period_after?: number;
    expected_net_change?: number;
  };

  warnings?: string[];
  source_run_id?: string;
  total_ms?: string;
}

/**
 * Retorno esperado da atualização de dimensões (se existir).
 */
export interface UpdateDimensoesResult {
  ok: boolean;
  message?: string;
  error?: string;
  details?: string;
  periodo_inicio?: string;
  periodo_fim?: string;
  stats?: {
    clientes: { before: number; after: number; added: number };
    colaboradores: { before: number; after: number; added: number };
    produtos: { before: number; after: number; added: number };
  };
}

/**
 * Stats simples do banco (contagens de registros).
 */
export interface DatabaseStats {
  vendas_raw: number;
  clientes: number;
  colaboradores: number;
  produtos: number;
  caixas: number;
}

/**
 * Helpers de diagnóstico
 */
function parseJsonSafe(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toPrettyDetails(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * Date local -> YYYY-MM-DD (sem UTC)
 * Evita bug de "voltar um dia" no Brasil.
 */
function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * URL da Edge Function (fallback fetch)
 */
const SUPABASE_URL = 'https://ftjjkqanssuwumpzqjiu.supabase.co';
const EDGE_IMPORT_URL = `${SUPABASE_URL}/functions/v1/import_api_to_raw`;

export function useSyncDatabase() {
  const { session } = useAuth();
  const { toast } = useToast();

  const [syncLoading, setSyncLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [dimensoesLoading, setDimensoesLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  const [stats, setStats] = useState<DatabaseStats | null>(null);

  const [lastAuditResult, setLastAuditResult] = useState<AuditVendasResult | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncVendasResult | null>(null);
  const [lastDimensoesResult, setLastDimensoesResult] = useState<UpdateDimensoesResult | null>(null);

  /**
   * fetchStats:
   * Contagem de registros (não puxa dados, só count)
   */
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [vendasRes, clientesRes, colaboradoresRes, produtosRes, caixasRes] = await Promise.all([
        supabase.from('vendas_api_raw').select('*', { count: 'exact', head: true }),
        supabase.from('dimensao_clientes').select('*', { count: 'exact', head: true }),
        supabase.from('dimensao_colaboradores').select('*', { count: 'exact', head: true }),
        supabase.from('dimensao_produtos').select('*', { count: 'exact', head: true }),
        supabase.from('caixas').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        vendas_raw: vendasRes.count || 0,
        clientes: clientesRes.count || 0,
        colaboradores: colaboradoresRes.count || 0,
        produtos: produtosRes.count || 0,
        caixas: caixasRes.count || 0,
      });
    } catch (error) {
      console.error('🔥 [STATS_ERROR] erro ao buscar contagens:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  /**
   * Normaliza shapes diferentes do back para um shape “amigável” pro front.
   * (porque às vezes o back devolve import/diff, às vezes devolve flat).
   */
  function normalizeSyncResult(data: any, fallback_from: string, fallback_to: string): SyncVendasResult {
    const requested_inicio = data?.requested_period?.inicio ?? data?.periodo_inicio ?? data?.date_from ?? fallback_from;
    const requested_fim = data?.requested_period?.fim ?? data?.periodo_fim ?? data?.date_to ?? fallback_to;

    const fetched =
      data?.import?.api_rows_received ??
      data?.api_rows_received ??
      data?.fetched_count ??
      data?.fetched ??
      0;

    const inserted_tmp =
      data?.import?.tmp_inserted ??
      data?.tmp_inserted ??
      data?.inserted_count ??
      data?.inserted ??
      0;

    const before_raw =
      data?.before?.raw_rows_in_period ??
      data?.before_raw_rows_in_period ??
      data?.raw_before ??
      0;

    const after_raw =
      data?.after?.raw_rows_in_period ??
      data?.after_raw_rows_in_period ??
      data?.raw_after ??
      0;

    const deleted =
      data?.diff?.deleted_rows_in_period ??
      data?.deleted_rows_in_period ??
      data?.deleted ??
      0;

    const inserted_period =
      data?.diff?.inserted_rows_in_period ??
      data?.inserted_rows_in_period ??
      data?.inserted_period ??
      inserted_tmp ??
      0;

    const net =
      data?.diff?.net_change_in_period ??
      data?.net_change_in_period ??
      (Number(inserted_period || 0) - Number(deleted || 0));

    return {
      ok: Boolean(data?.ok ?? false),
      mode: data?.mode ?? 'execute',
      message: data?.message,
      error: data?.error,
      details: data?.details ? String(data.details) : undefined,

      fetched_count: Number(fetched || 0),
      inserted_count: Number(inserted_tmp || 0),

      periodo_inicio: String(requested_inicio),
      periodo_fim: String(requested_fim),

      before_raw_rows_in_period: Number(before_raw || 0),
      after_raw_rows_in_period: Number(after_raw || 0),

      deleted_rows_in_period: Number(deleted || 0),
      inserted_rows_in_period: Number(inserted_period || 0),
      net_change_in_period: Number(net || 0),

      warnings: data?.warnings ?? [],
      source_run_id: data?.source_run_id,
      total_ms: data?.total_ms,
    };
  }

  function normalizeAuditResult(data: any, fallback_from: string, fallback_to: string): AuditVendasResult {
    const requested_inicio = data?.requested_period?.inicio ?? data?.periodo_inicio ?? data?.date_from ?? fallback_from;
    const requested_fim = data?.requested_period?.fim ?? data?.periodo_fim ?? data?.date_to ?? fallback_to;

    return {
      ok: Boolean(data?.ok ?? false),
      mode: data?.mode ?? 'audit',
      error: data?.error,
      details: data?.details ? String(data.details) : undefined,

      periodo_inicio: String(requested_inicio),
      periodo_fim: String(requested_fim),

      before: data?.before,
      incoming: data?.incoming,
      expected: data?.expected,

      warnings: data?.warnings ?? [],
      source_run_id: data?.source_run_id,
      total_ms: data?.total_ms,
    };
  }

  /**
   * Helper central: chama a edge function com mode
   * - tenta invoke
   * - se falhar, tenta fetch direto
   */
  const callImportEdge = useCallback(
    async (mode: 'audit' | 'execute', date_from: string, date_to: string) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (!session?.access_token) {
        return {
          ok: false,
          error: 'Not authenticated (sem access_token no front)',
          details: toPrettyDetails({
            hint: 'Você precisa estar logado via Supabase Auth para ter JWT válido.',
            auth_user: authData?.user ? { id: authData.user.id, email: authData.user.email } : null,
            auth_error: authError?.message ?? null,
          }),
          requested_period: { inicio: date_from, fim: date_to },
          mode,
        };
      }

      const body = {
        op: 'import_api_to_raw',
        mode,
        date_from,
        date_to,
      };

      // 1) invoke (Supabase SDK)
      const { data, error } = await supabase.functions.invoke('import_api_to_raw', {
        body,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!error) return data;

      const ctx = (error as any)?.context;
      const status = ctx?.status;
      const ctxBody = ctx?.body;

      console.error('🔥 [EDGE_ERROR] invoke error (SDK):', {
        message: error.message,
        status,
        ctxBody,
        raw: error,
      });

      // 2) fallback fetch direto
      let fallback: any = null;
      try {
        const res = await fetch(EDGE_IMPORT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        });

        const text = await res.text();
        fallback = { status: res.status, ok: res.ok, body: parseJsonSafe(text) };

        console.error('🔥 [EDGE_ERROR] fallback fetch result:', fallback);

        if (fallback?.body) {
          return {
            ok: false,
            error:
              (typeof fallback.body === 'object' && (fallback.body.error || fallback.body.message)) ||
              error.message ||
              'Edge Function error',
            details: toPrettyDetails({
              sdk_error_message: error.message,
              sdk_context_status: status,
              sdk_context_body: ctxBody,
              fallback_fetch: fallback,
              sent_body: body,
            }),
            ...((typeof fallback.body === 'object' && fallback.body) || {}),
          };
        }
      } catch (fetchErr) {
        console.error('🔥 [EDGE_ERROR] fallback fetch FAILED:', fetchErr);
        fallback = { error: 'Falhou o fetch direto (rede/CORS)', details: String(fetchErr) };
      }

      return {
        ok: false,
        error:
          (typeof ctxBody === 'object' && ctxBody && (ctxBody as any).error) ||
          error.message ||
          'Edge Function error',
        details: toPrettyDetails({
          sdk_error_message: error.message,
          sdk_context_status: status,
          sdk_context_body: ctxBody,
          fallback_fetch: fallback,
          sent_body: body,
        }),
      };
    },
    [session?.access_token]
  );

  /**
   * AUDIT: não grava no banco.
   */
  const auditVendas = useCallback(
    async (inicio: Date, fim: Date): Promise<AuditVendasResult> => {
      setAuditLoading(true);
      setLastAuditResult(null);

      const date_from = formatDateLocal(inicio);
      const date_to = formatDateLocal(fim);

      try {
        const data = await callImportEdge('audit', date_from, date_to);
        const result = normalizeAuditResult(data, date_from, date_to);

        setLastAuditResult(result);

        if (result.ok) {
          toast({
            title: 'Auditoria pronta (sem gravar)',
            description: `Antes: ${result.before?.raw_rows_in_period ?? 0} | API: ${result.incoming?.api_rows_received ?? 0} | Δ esperado: ${result.expected?.expected_net_change ?? 0}`,
          });
        } else {
          toast({
            title: 'Erro na auditoria',
            description: result.error || 'Falha ao auditar',
            variant: 'destructive',
          });
        }

        return result;
      } catch (err) {
        console.error('🔥 [AUDIT_ERROR] catch:', err);

        const result: AuditVendasResult = {
          ok: false,
          error: 'Network/runtime error',
          details: toPrettyDetails({ err: String(err) }),
          periodo_inicio: date_from,
          periodo_fim: date_to,
        };

        setLastAuditResult(result);

        toast({
          title: 'Erro de conexão (auditoria)',
          description: 'Falha ao chamar a Edge Function. Veja o Console (F12).',
          variant: 'destructive',
        });

        return result;
      } finally {
        setAuditLoading(false);
      }
    },
    [callImportEdge, toast]
  );

  /**
   * EXECUTE: grava no banco.
   */
  const syncVendas = useCallback(
    async (inicio: Date, fim: Date): Promise<SyncVendasResult> => {
      setSyncLoading(true);
      setLastSyncResult(null);

      const date_from = formatDateLocal(inicio);
      const date_to = formatDateLocal(fim);

      try {
        const data = await callImportEdge('execute', date_from, date_to);
        const result = normalizeSyncResult(data, date_from, date_to);

        setLastSyncResult(result);

        if (result.ok) {
          toast({
            title: 'Sincronização concluída (gravou)',
            description: `API: ${result.fetched_count ?? 0} | TMP: ${result.inserted_count ?? 0} | Δ real: ${result.net_change_in_period ?? 0}`,
          });
          fetchStats();
        } else {
          toast({
            title: 'Erro na sincronização',
            description: result.error || 'Falha ao sincronizar',
            variant: 'destructive',
          });
        }

        return result;
      } catch (err) {
        console.error('🔥 [SYNC_ERROR] catch:', err);

        const result: SyncVendasResult = {
          ok: false,
          error: 'Network/runtime error',
          details: toPrettyDetails({ err: String(err) }),
          periodo_inicio: date_from,
          periodo_fim: date_to,
        };

        setLastSyncResult(result);

        toast({
          title: 'Erro de conexão',
          description: 'Falha fora do invoke. Veja o Console (F12).',
          variant: 'destructive',
        });

        return result;
      } finally {
        setSyncLoading(false);
      }
    },
    [callImportEdge, toast, fetchStats]
  );

  /**
   * updateDimensoes:
   * só funciona se existir a Edge Function update-dimensoes
   */
  const updateDimensoes = useCallback(
    async (inicio: Date, fim: Date): Promise<UpdateDimensoesResult> => {
      if (!session?.access_token) {
        const result: UpdateDimensoesResult = {
          ok: false,
          error: 'Not authenticated',
          details: 'Sem access_token no front. Faça login no app.',
        };
        setLastDimensoesResult(result);
        return result;
      }

      setDimensoesLoading(true);
      setLastDimensoesResult(null);

      const inicioStr = formatDateLocal(inicio);
      const fimStr = formatDateLocal(fim);

      try {
        const { data, error } = await supabase.functions.invoke('update-dimensoes', {
          body: { inicio: inicioStr, fim: fimStr },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (error) {
          const ctx = (error as any)?.context;
          const status = ctx?.status;
          const ctxBody = ctx?.body;

          console.error('🔥 [DIM_ERROR] invoke error:', { status, ctxBody, raw: error });

          const result: UpdateDimensoesResult = {
            ok: false,
            error:
              (typeof ctxBody === 'object' && ctxBody ? (ctxBody as any).error : null) ||
              error.message ||
              'Failed to update dimensions',
            details: toPrettyDetails({
              sdk_error_message: error.message,
              sdk_context_status: status,
              sdk_context_body: ctxBody,
            }),
            periodo_inicio: inicioStr,
            periodo_fim: fimStr,
          };

          setLastDimensoesResult(result);

          toast({
            title: `Erro na atualização${status ? ` (${status})` : ''}`,
            description: result.error || 'Falha ao chamar a Edge Function',
            variant: 'destructive',
          });

          return result;
        }

        const result = (data as UpdateDimensoesResult) ?? { ok: false };
        result.periodo_inicio = result.periodo_inicio ?? inicioStr;
        result.periodo_fim = result.periodo_fim ?? fimStr;

        setLastDimensoesResult(result);

        if (result.ok) {
          toast({ title: 'Dimensões atualizadas', description: 'OK' });
          fetchStats();
        } else {
          toast({
            title: 'Erro na atualização',
            description: result.error || 'Erro desconhecido',
            variant: 'destructive',
          });
        }

        return result;
      } catch (err) {
        console.error('🔥 [DIM_ERROR] catch:', err);

        const result: UpdateDimensoesResult = {
          ok: false,
          error: 'Network/runtime error',
          details: toPrettyDetails({ err: String(err) }),
          periodo_inicio: inicioStr,
          periodo_fim: fimStr,
        };

        setLastDimensoesResult(result);

        toast({
          title: 'Erro de conexão',
          description: 'Não foi possível conectar ao servidor',
          variant: 'destructive',
        });

        return result;
      } finally {
        setDimensoesLoading(false);
      }
    },
    [session?.access_token, toast, fetchStats]
  );

  return {
    // AUDIT
    auditVendas,
    auditLoading,
    lastAuditResult,

    // EXECUTE / DIM / STATS
    syncVendas,
    updateDimensoes,
    fetchStats,

    syncLoading,
    dimensoesLoading,
    statsLoading,
    stats,

    lastSyncResult,
    lastDimensoesResult,
  };
}

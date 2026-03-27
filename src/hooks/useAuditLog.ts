import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from './usePermissions';
import { Json } from '@/integrations/supabase/types';

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  actor_user_id: string | null;
  actor_name?: string;
  org_id: string | null;
  unit_id: string | null;
  diff: Json | null;
  meta: Json | null;
  created_at: string;
}

interface UseAuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  entity?: string;
  action?: string;
  userId?: string;
}

interface UseAuditLogReturn {
  logs: AuditLogEntry[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setFilters: (filters: UseAuditLogFilters) => void;
  refetch: () => Promise<void>;
}

const PAGE_SIZE = 20;

export function useAuditLog(): UseAuditLogReturn {
  const { profile } = useAuth();
  const { isMaster, isFranquiaAdmin, canViewAudit } = usePermissions();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<UseAuditLogFilters>({});

  const fetchLogs = useCallback(async () => {
    if (!canViewAudit) {
      setLoading(false);
      setError('Sem permissão para visualizar logs de auditoria');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('app_audit_log')
        .select('*', { count: 'exact' });

      // Filter by org for non-master users
      if (!isMaster && profile?.org_id) {
        query = query.eq('org_id', profile.org_id);
      }

      // Apply filters
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }
      if (filters.entity) {
        query = query.eq('entity', filters.entity);
      }
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.userId) {
        query = query.eq('actor_user_id', filters.userId);
      }

      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error: queryError, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (queryError) throw queryError;

      // Enrich with actor names
      const logsWithActors = await Promise.all(
        (data || []).map(async (log) => {
          if (!log.actor_user_id) return { ...log, actor_name: 'Sistema' };

          const { data: profileData } = await supabase
            .from('app_user_profiles')
            .select('display_name')
            .eq('user_id', log.actor_user_id)
            .single();

          return {
            ...log,
            actor_name: profileData?.display_name || 'Usuário desconhecido',
          };
        })
      );

      setLogs(logsWithActors);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Erro ao carregar logs de auditoria');
    } finally {
      setLoading(false);
    }
  }, [canViewAudit, isMaster, profile?.org_id, page, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    totalCount,
    page,
    pageSize: PAGE_SIZE,
    setPage,
    setFilters,
    refetch: fetchLogs,
  };
}

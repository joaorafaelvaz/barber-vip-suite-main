import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from './usePermissions';
import { useToast } from '@/hooks/use-toast';

export interface Organization {
  id: string;
  nome: string;
  status: string;
  created_at: string;
  unit_count?: number;
  user_count?: number;
}

interface UseOrgsReturn {
  organizations: Organization[];
  currentOrg: Organization | null;
  loading: boolean;
  error: string | null;
  createOrg: (nome: string) => Promise<boolean>;
  updateOrg: (id: string, nome: string) => Promise<boolean>;
  toggleOrgStatus: (id: string, currentStatus: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useOrgs(): UseOrgsReturn {
  const { profile } = useAuth();
  const { isMaster } = usePermissions();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrgs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('app_orgs')
        .select('*')
        .order('nome');

      // Master sees all, others see only their org
      if (!isMaster && profile?.org_id) {
        query = query.eq('id', profile.org_id);
      }

      const { data: orgsData, error: orgsError } = await query;

      if (orgsError) throw orgsError;

      // Get counts for each org
      const orgsWithCounts = await Promise.all(
        (orgsData || []).map(async (org) => {
          const [unitResult, userResult] = await Promise.all([
            supabase
              .from('app_units')
              .select('*', { count: 'exact', head: true })
              .eq('org_id', org.id),
            supabase
              .from('app_user_profiles')
              .select('*', { count: 'exact', head: true })
              .eq('org_id', org.id),
          ]);

          return {
            ...org,
            unit_count: unitResult.count || 0,
            user_count: userResult.count || 0,
          };
        })
      );

      setOrganizations(orgsWithCounts);

      // Set current org
      if (profile?.org_id) {
        const current = orgsWithCounts.find((o) => o.id === profile.org_id);
        setCurrentOrg(current || null);
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError('Erro ao carregar organizações');
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id, isMaster]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const createOrg = async (nome: string): Promise<boolean> => {
    if (!isMaster) {
      toast({
        title: 'Sem permissão',
        description: 'Apenas usuários Master podem criar organizações',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { error } = await supabase.from('app_orgs').insert({
        nome,
        status: 'ativo',
      });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Organização criada com sucesso',
      });

      await fetchOrgs();
      return true;
    } catch (err) {
      console.error('Error creating organization:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao criar organização',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateOrg = async (id: string, nome: string): Promise<boolean> => {
    if (!isMaster) {
      toast({
        title: 'Sem permissão',
        description: 'Apenas usuários Master podem editar organizações',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('app_orgs')
        .update({ nome })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Organização atualizada com sucesso',
      });

      await fetchOrgs();
      return true;
    } catch (err) {
      console.error('Error updating organization:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar organização',
        variant: 'destructive',
      });
      return false;
    }
  };

  const toggleOrgStatus = async (id: string, currentStatus: string): Promise<boolean> => {
    if (!isMaster) {
      toast({
        title: 'Sem permissão',
        description: 'Apenas usuários Master podem alterar status de organizações',
        variant: 'destructive',
      });
      return false;
    }

    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';

    try {
      const { error } = await supabase
        .from('app_orgs')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `Organização ${newStatus === 'ativo' ? 'ativada' : 'desativada'} com sucesso`,
      });

      await fetchOrgs();
      return true;
    } catch (err) {
      console.error('Error toggling organization status:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao alterar status da organização',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    organizations,
    currentOrg,
    loading,
    error,
    createOrg,
    updateOrg,
    toggleOrgStatus,
    refetch: fetchOrgs,
  };
}

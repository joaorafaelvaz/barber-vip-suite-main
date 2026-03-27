import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from './usePermissions';
import { useToast } from '@/hooks/use-toast';

export interface Unit {
  id: string;
  nome: string;
  org_id: string;
  org_nome?: string;
  status: string;
  created_at: string;
  user_count?: number;
}

interface UseUnitsOptions {
  filterByOrgId?: string | null;
}

interface UseUnitsReturn {
  units: Unit[];
  loading: boolean;
  error: string | null;
  createUnit: (nome: string, orgId: string) => Promise<boolean>;
  updateUnit: (id: string, nome: string) => Promise<boolean>;
  toggleUnitStatus: (id: string, currentStatus: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useUnits(options?: UseUnitsOptions): UseUnitsReturn {
  const { profile } = useAuth();
  const { isMaster, isFranquiaAdmin } = usePermissions();
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterByOrgId = options?.filterByOrgId;

  const fetchUnits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch units - Master sees all, others see only their org
      let query = supabase
        .from('app_units')
        .select('*')
        .order('nome');

      // Apply org filter if provided
      if (filterByOrgId) {
        query = query.eq('org_id', filterByOrgId);
      } else if (!isMaster && profile?.org_id) {
        query = query.eq('org_id', profile.org_id);
      }

      const { data: unitsData, error: unitsError } = await query;

      if (unitsError) throw unitsError;

      // Get org names and user counts per unit
      const unitsWithDetails = await Promise.all(
        (unitsData || []).map(async (unit) => {
          const [orgResult, userCountResult] = await Promise.all([
            supabase
              .from('app_orgs')
              .select('nome')
              .eq('id', unit.org_id)
              .single(),
            supabase
              .from('app_user_profiles')
              .select('*', { count: 'exact', head: true })
              .eq('unit_id', unit.id),
          ]);

          return {
            ...unit,
            org_nome: orgResult.data?.nome || 'Organização',
            user_count: userCountResult.count || 0,
          };
        })
      );

      setUnits(unitsWithDetails);
    } catch (err) {
      console.error('Error fetching units:', err);
      setError('Erro ao carregar unidades');
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id, isMaster, filterByOrgId]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const createUnit = async (nome: string, orgId: string): Promise<boolean> => {
    if (!isMaster && !isFranquiaAdmin) {
      toast({
        title: 'Sem permissão',
        description: 'Você não tem permissão para criar unidades',
        variant: 'destructive',
      });
      return false;
    }

    // Non-master users can only create units for their own org
    const targetOrgId = isMaster ? orgId : profile?.org_id;
    if (!targetOrgId) {
      toast({
        title: 'Erro',
        description: 'Organização não encontrada',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { error } = await supabase.from('app_units').insert({
        nome,
        org_id: targetOrgId,
        status: 'ativo',
      });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Unidade criada com sucesso',
      });

      await fetchUnits();
      return true;
    } catch (err) {
      console.error('Error creating unit:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao criar unidade',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateUnit = async (id: string, nome: string): Promise<boolean> => {
    if (!isMaster && !isFranquiaAdmin) {
      toast({
        title: 'Sem permissão',
        description: 'Você não tem permissão para editar unidades',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('app_units')
        .update({ nome })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Unidade atualizada com sucesso',
      });

      await fetchUnits();
      return true;
    } catch (err) {
      console.error('Error updating unit:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar unidade',
        variant: 'destructive',
      });
      return false;
    }
  };

  const toggleUnitStatus = async (id: string, currentStatus: string): Promise<boolean> => {
    if (!isMaster && !isFranquiaAdmin) {
      toast({
        title: 'Sem permissão',
        description: 'Você não tem permissão para alterar status de unidades',
        variant: 'destructive',
      });
      return false;
    }

    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';

    try {
      const { error } = await supabase
        .from('app_units')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `Unidade ${newStatus === 'ativo' ? 'ativada' : 'desativada'} com sucesso`,
      });

      await fetchUnits();
      return true;
    } catch (err) {
      console.error('Error toggling unit status:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao alterar status da unidade',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    units,
    loading,
    error,
    createUnit,
    updateUnit,
    toggleUnitStatus,
    refetch: fetchUnits,
  };
}

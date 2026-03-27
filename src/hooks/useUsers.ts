import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n';

export interface UserProfile {
  user_id: string;
  email: string | null;
  display_name: string;
  role_base: 'master' | 'franquia_admin' | 'unidade_gerente' | 'colaborador';
  org_id: string | null;
  unit_id: string | null;
  org_name: string | null;
  unit_name: string | null;
  colaborador_id: string | null;
  login_alias: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  display_name: string;
  role_base: 'master' | 'franquia_admin' | 'unidade_gerente' | 'colaborador';
  org_id?: string;
  unit_id?: string;
  colaborador_id?: string;
  login_alias?: string;
}

export interface UpdateUserData {
  user_id: string;
  display_name?: string;
  role_base?: 'master' | 'franquia_admin' | 'unidade_gerente' | 'colaborador';
  org_id?: string | null;
  unit_id?: string | null;
  colaborador_id?: string | null;
  login_alias?: string | null;
  is_active?: boolean;
  new_password?: string;
}

export interface UsersListResponse {
  users: UserProfile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
}

export function useUsers() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const listUsers = useCallback(async (params: ListUsersParams = {}): Promise<UsersListResponse | null> => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set('page', String(params.page));
      if (params.limit) queryParams.set('limit', String(params.limit));
      if (params.search) queryParams.set('search', params.search);
      if (params.role) queryParams.set('role', params.role);
      if (params.status) queryParams.set('status', params.status);

      const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `https://${supabaseProjectId}.supabase.co/functions/v1/list-users?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao listar usuários');
      }

      return result as UsersListResponse;
    } catch (error: any) {
      console.error('List users error:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Erro ao listar usuários'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  const createUser = useCallback(async (data: CreateUserData): Promise<boolean> => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const { data: result, error } = await supabase.functions.invoke('create-user', {
        body: data,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: t('common.success'),
        description: t('users.createSuccess')
      });

      return true;
    } catch (error: any) {
      console.error('Create user error:', error);
      
      // Check for duplicate email error
      const errorMessage = error.message || '';
      const isDuplicateEmail = errorMessage.includes('already been registered') || 
                               errorMessage.includes('já está cadastrado') ||
                               errorMessage.includes('User already registered');
      
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: isDuplicateEmail 
          ? t('users.emailAlreadyExists') 
          : (errorMessage || 'Erro ao criar usuário')
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  const updateUser = useCallback(async (data: UpdateUserData): Promise<boolean> => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const { data: result, error } = await supabase.functions.invoke('update-user', {
        body: data,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: t('common.success'),
        description: t('users.updateSuccess')
      });

      return true;
    } catch (error: any) {
      console.error('Update user error:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Erro ao atualizar usuário'
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  const toggleUserStatus = useCallback(async (userId: string, isActive: boolean): Promise<boolean> => {
    return updateUser({ user_id: userId, is_active: isActive });
  }, [updateUser]);

  return {
    loading,
    listUsers,
    createUser,
    updateUser,
    toggleUserStatus
  };
}

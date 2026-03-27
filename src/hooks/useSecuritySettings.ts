import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from './usePermissions';
import { useToast } from '@/hooks/use-toast';

export interface SecuritySettings {
  id: string;
  org_id: string | null;
  unit_id: string | null;
  require_mfa_for_master: boolean;
  allow_mfa_for_others: boolean;
  session_policy: string | null;
  created_at: string;
  updated_at: string;
}

interface UseSecuritySettingsReturn {
  settings: SecuritySettings | null;
  loading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<SecuritySettings>) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useSecuritySettings(): UseSecuritySettingsReturn {
  const { profile } = useAuth();
  const { isMaster } = usePermissions();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!profile?.org_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('app_security_settings')
        .select('*')
        .eq('org_id', profile.org_id)
        .maybeSingle();

      if (queryError) throw queryError;

      // If no settings exist, create default ones
      if (!data) {
        const { data: newSettings, error: insertError } = await supabase
          .from('app_security_settings')
          .insert({
            org_id: profile.org_id,
            require_mfa_for_master: false,
            allow_mfa_for_others: true,
            session_policy: 'multiple',
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newSettings);
      } else {
        setSettings(data);
      }
    } catch (err) {
      console.error('Error fetching security settings:', err);
      setError('Erro ao carregar configurações de segurança');
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<SecuritySettings>): Promise<boolean> => {
    if (!isMaster) {
      toast({
        title: 'Sem permissão',
        description: 'Apenas usuários Master podem alterar configurações de segurança',
        variant: 'destructive',
      });
      return false;
    }

    if (!settings?.id) return false;

    try {
      const { error } = await supabase
        .from('app_security_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Configurações de segurança atualizadas',
      });

      await fetchSettings();
      return true;
    } catch (err) {
      console.error('Error updating security settings:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar configurações',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    settings,
    loading,
    error,
    updateSettings,
    refetch: fetchSettings,
  };
}

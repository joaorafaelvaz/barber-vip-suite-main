import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  defaultRaioxClientesConfig,
  type RaioxClientesConfigJson,
} from '@/pages/app/raiox-clientes/config/defaultConfig';

interface ConfigState {
  config: RaioxClientesConfigJson;
  loading: boolean;
  saving: boolean;
  loaded: boolean;
  updatedAt: string | null;
  version: string | null;
  dbId: string | null;
}

export function useRaioxClientesConfig() {
  const { user } = useAuth();
  const [state, setState] = useState<ConfigState>({
    config: { ...defaultRaioxClientesConfig },
    loading: false,
    saving: false,
    loaded: false,
    updatedAt: null,
    version: null,
    dbId: null,
  });

  const loadedRef = useRef(false);

  const loadConfig = useCallback(async () => {
    if (!user?.id) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const { data, error } = await supabase
        .from('raiox_clientes_config' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const row = data as any;
        const merged = { ...defaultRaioxClientesConfig, ...(row.config_json as any) };
        setState((s) => ({
          ...s,
          config: merged,
          loading: false,
          loaded: true,
          updatedAt: row.updated_at,
          version: row.version,
          dbId: row.id,
        }));
      } else {
        // Create default
        const { data: inserted, error: insErr } = await supabase
          .from('raiox_clientes_config' as any)
          .insert({
            user_id: user.id,
            config_json: defaultRaioxClientesConfig as any,
            version: 'v4.1',
          } as any)
          .select()
          .single();

        if (insErr) throw insErr;
        const row = inserted as any;
        setState((s) => ({
          ...s,
          config: { ...defaultRaioxClientesConfig },
          loading: false,
          loaded: true,
          updatedAt: row.updated_at,
          version: row.version,
          dbId: row.id,
        }));
      }
    } catch (err: any) {
      console.error('[useRaioxClientesConfig] loadConfig error:', err);
      setState((s) => ({ ...s, loading: false, loaded: true }));
    }
  }, [user?.id]);

  // Auto-load on mount
  useEffect(() => {
    if (!loadedRef.current && user?.id) {
      loadedRef.current = true;
      loadConfig();
    }
  }, [user?.id, loadConfig]);

  const saveConfig = useCallback(async () => {
    if (!state.dbId || !user?.id) return;
    setState((s) => ({ ...s, saving: true }));
    try {
      const { error } = await supabase
        .from('raiox_clientes_config' as any)
        .update({
          config_json: state.config as any,
          version: 'v4.1',
        } as any)
        .eq('id', state.dbId);

      if (error) throw error;

      setState((s) => ({ ...s, saving: false, updatedAt: new Date().toISOString() }));
      toast({ title: 'Configuração salva', description: 'As regras do RaioX foram atualizadas.' });
    } catch (err: any) {
      console.error('[useRaioxClientesConfig] saveConfig error:', err);
      setState((s) => ({ ...s, saving: false }));
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
  }, [state.dbId, state.config, user?.id]);

  const restoreDefaults = useCallback(async () => {
    setState((s) => ({ ...s, config: { ...defaultRaioxClientesConfig } }));
    // Auto-save defaults
    if (!state.dbId || !user?.id) return;
    try {
      await supabase
        .from('raiox_clientes_config' as any)
        .update({
          config_json: defaultRaioxClientesConfig as any,
          version: 'v4.1',
        } as any)
        .eq('id', state.dbId);

      setState((s) => ({ ...s, updatedAt: new Date().toISOString() }));
      toast({ title: 'Defaults restaurados', description: 'Configurações padrão aplicadas e salvas.' });
    } catch (err: any) {
      console.error('[useRaioxClientesConfig] restoreDefaults error:', err);
      toast({ title: 'Erro ao restaurar', description: err.message, variant: 'destructive' });
    }
  }, [state.dbId, user?.id]);

  const updateField = useCallback(<K extends keyof RaioxClientesConfigJson>(
    key: K,
    value: RaioxClientesConfigJson[K],
  ) => {
    setState((s) => ({ ...s, config: { ...s.config, [key]: value } }));
  }, []);

  return {
    config: state.config,
    loading: state.loading,
    saving: state.saving,
    loaded: state.loaded,
    updatedAt: state.updatedAt,
    version: state.version,
    updateField,
    saveConfig,
    restoreDefaults,
    loadConfig,
  };
}

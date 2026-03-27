
-- Fix 1: Add PERMISSIVE policies to app_security_settings so authenticated users
-- can read settings and only master can write (the existing RESTRICTIVE policies
-- already require app_is_master() but we need at least one PERMISSIVE policy)

-- Allow all authenticated users to read security settings for their org
CREATE POLICY "authenticated_select_security_settings"
  ON public.app_security_settings FOR SELECT
  TO authenticated USING (true);

-- Allow master to insert security settings
CREATE POLICY "master_insert_security_settings"
  ON public.app_security_settings FOR INSERT
  TO authenticated WITH CHECK (public.app_is_master());

-- Allow master to update security settings
CREATE POLICY "master_update_security_settings"
  ON public.app_security_settings FOR UPDATE
  TO authenticated USING (public.app_is_master())
  WITH CHECK (public.app_is_master());

-- Allow master to delete security settings
CREATE POLICY "master_delete_security_settings"
  ON public.app_security_settings FOR DELETE
  TO authenticated USING (public.app_is_master());

-- Fix 2: Enable RLS on tables that are missing it

-- cliente_status_snapshot - internal snapshot data, master only
ALTER TABLE public.cliente_status_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_select_cliente_status_snapshot"
  ON public.cliente_status_snapshot FOR SELECT
  TO authenticated USING (public.app_is_master());

CREATE POLICY "master_insert_cliente_status_snapshot"
  ON public.cliente_status_snapshot FOR INSERT
  TO authenticated WITH CHECK (public.app_is_master());

CREATE POLICY "master_update_cliente_status_snapshot"
  ON public.cliente_status_snapshot FOR UPDATE
  TO authenticated USING (public.app_is_master())
  WITH CHECK (public.app_is_master());

CREATE POLICY "master_delete_cliente_status_snapshot"
  ON public.cliente_status_snapshot FOR DELETE
  TO authenticated USING (public.app_is_master());

-- financeiro_contaazul_raw - raw financial ingestion data, master only
ALTER TABLE public.financeiro_contaazul_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_select_financeiro_contaazul_raw"
  ON public.financeiro_contaazul_raw FOR SELECT
  TO authenticated USING (public.app_is_master());

CREATE POLICY "master_insert_financeiro_contaazul_raw"
  ON public.financeiro_contaazul_raw FOR INSERT
  TO authenticated WITH CHECK (public.app_is_master());

CREATE POLICY "master_delete_financeiro_contaazul_raw"
  ON public.financeiro_contaazul_raw FOR DELETE
  TO authenticated USING (public.app_is_master());

-- integrations_contaazul_tokens - sensitive token storage, master only
ALTER TABLE public.integrations_contaazul_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_select_integrations_contaazul_tokens"
  ON public.integrations_contaazul_tokens FOR SELECT
  TO authenticated USING (public.app_is_master());

CREATE POLICY "master_insert_integrations_contaazul_tokens"
  ON public.integrations_contaazul_tokens FOR INSERT
  TO authenticated WITH CHECK (public.app_is_master());

CREATE POLICY "master_update_integrations_contaazul_tokens"
  ON public.integrations_contaazul_tokens FOR UPDATE
  TO authenticated USING (public.app_is_master())
  WITH CHECK (public.app_is_master());

CREATE POLICY "master_delete_integrations_contaazul_tokens"
  ON public.integrations_contaazul_tokens FOR DELETE
  TO authenticated USING (public.app_is_master());

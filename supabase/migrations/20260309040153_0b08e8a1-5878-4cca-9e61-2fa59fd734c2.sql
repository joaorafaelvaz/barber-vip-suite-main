-- Fix PUBLIC_DATA_EXPOSURE: mensagem_envios RLS vulnerability
-- Add criado_por column to track who created each record
ALTER TABLE public.mensagem_envios 
ADD COLUMN IF NOT EXISTS criado_por uuid DEFAULT auth.uid();

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "authenticated_select_mensagem_envios" ON public.mensagem_envios;
DROP POLICY IF EXISTS "authenticated_insert_mensagem_envios" ON public.mensagem_envios;
DROP POLICY IF EXISTS "authenticated_update_mensagem_envios" ON public.mensagem_envios;
DROP POLICY IF EXISTS "authenticated_delete_mensagem_envios" ON public.mensagem_envios;

-- Create scoped SELECT policy: see own records OR be admin/master
CREATE POLICY "mensagem_envios_select_scoped"
  ON public.mensagem_envios FOR SELECT TO authenticated
  USING (
    criado_por = auth.uid()
    OR public.app_is_master()
    OR (SELECT role_base FROM public.app_user_profiles WHERE user_id = auth.uid() AND is_active = true) 
       IN ('franquia_admin', 'unidade_gerente')
  );

-- Create INSERT policy: only can insert for yourself
CREATE POLICY "mensagem_envios_insert_own"
  ON public.mensagem_envios FOR INSERT TO authenticated
  WITH CHECK (
    criado_por IS NULL OR criado_por = auth.uid()
  );

-- Create UPDATE policy: only modify own records or be master
CREATE POLICY "mensagem_envios_update_scoped"
  ON public.mensagem_envios FOR UPDATE TO authenticated
  USING (
    criado_por = auth.uid()
    OR public.app_is_master()
  )
  WITH CHECK (
    criado_por = auth.uid()
    OR public.app_is_master()
  );

-- Create DELETE policy: only delete own records or be master
CREATE POLICY "mensagem_envios_delete_scoped"
  ON public.mensagem_envios FOR DELETE TO authenticated
  USING (
    criado_por = auth.uid()
    OR public.app_is_master()
  );
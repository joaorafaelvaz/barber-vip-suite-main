-- =============================================================
-- MIGRAÇÃO: Corrigir recursão infinita em app_user_profiles RLS
-- PROBLEMA: Políticas com EXISTS inline causam recursão
-- SOLUÇÃO: Usar funções SECURITY DEFINER para verificar roles
-- =============================================================

-- 1. Remover políticas problemáticas que causam recursão
DROP POLICY IF EXISTS "app_user_profiles_select" ON public.app_user_profiles;
DROP POLICY IF EXISTS "app_user_profiles_update_master_only" ON public.app_user_profiles;

-- 2. Criar função SECURITY DEFINER para verificar se é o próprio usuário
-- Esta função bypassa RLS, evitando recursão
CREATE OR REPLACE FUNCTION public.app_is_own_profile(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT check_user_id = auth.uid();
$$;

-- 3. Nova política SELECT: usuário pode ler seu próprio perfil OU se for master
-- Usa APENAS funções SECURITY DEFINER, sem subqueries inline
CREATE POLICY "users_can_read_own_profile"
ON public.app_user_profiles
FOR SELECT
TO authenticated
USING (
  app_is_own_profile(user_id) OR app_is_master()
);
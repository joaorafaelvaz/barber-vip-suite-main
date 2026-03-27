-- =====================================================
-- Fix RLS Policies for Bonus and Commission Tables
-- Replace permissive 'true' policies with master-only access
-- Allow employees to view their own bonus history
-- =====================================================

-- =====================================================
-- 1. FIX bonus_regras TABLE
-- =====================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view bonus rules" ON public.bonus_regras;
DROP POLICY IF EXISTS "Authenticated users can manage bonus rules" ON public.bonus_regras;

-- Create master-only policies
CREATE POLICY "master_select_bonus_regras"
  ON public.bonus_regras FOR SELECT
  USING (app_is_master());

CREATE POLICY "master_insert_bonus_regras"
  ON public.bonus_regras FOR INSERT
  WITH CHECK (app_is_master());

CREATE POLICY "master_update_bonus_regras"
  ON public.bonus_regras FOR UPDATE
  USING (app_is_master())
  WITH CHECK (app_is_master());

CREATE POLICY "master_delete_bonus_regras"
  ON public.bonus_regras FOR DELETE
  USING (app_is_master());

-- =====================================================
-- 2. FIX bonus_faixas TABLE
-- =====================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view bonus tiers" ON public.bonus_faixas;
DROP POLICY IF EXISTS "Authenticated users can manage bonus tiers" ON public.bonus_faixas;

-- Create master-only policies
CREATE POLICY "master_select_bonus_faixas"
  ON public.bonus_faixas FOR SELECT
  USING (app_is_master());

CREATE POLICY "master_insert_bonus_faixas"
  ON public.bonus_faixas FOR INSERT
  WITH CHECK (app_is_master());

CREATE POLICY "master_update_bonus_faixas"
  ON public.bonus_faixas FOR UPDATE
  USING (app_is_master())
  WITH CHECK (app_is_master());

CREATE POLICY "master_delete_bonus_faixas"
  ON public.bonus_faixas FOR DELETE
  USING (app_is_master());

-- =====================================================
-- 3. FIX bonus_regras_periodos TABLE
-- =====================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view bonus periods" ON public.bonus_regras_periodos;
DROP POLICY IF EXISTS "Authenticated users can manage bonus periods" ON public.bonus_regras_periodos;

-- Create master-only policies
CREATE POLICY "master_select_bonus_regras_periodos"
  ON public.bonus_regras_periodos FOR SELECT
  USING (app_is_master());

CREATE POLICY "master_insert_bonus_regras_periodos"
  ON public.bonus_regras_periodos FOR INSERT
  WITH CHECK (app_is_master());

CREATE POLICY "master_update_bonus_regras_periodos"
  ON public.bonus_regras_periodos FOR UPDATE
  USING (app_is_master())
  WITH CHECK (app_is_master());

CREATE POLICY "master_delete_bonus_regras_periodos"
  ON public.bonus_regras_periodos FOR DELETE
  USING (app_is_master());

-- =====================================================
-- 4. FIX bonus_historico_resultado TABLE
-- Employees can view their own bonus history
-- =====================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view bonus history" ON public.bonus_historico_resultado;
DROP POLICY IF EXISTS "Authenticated users can manage bonus history" ON public.bonus_historico_resultado;

-- Create a helper function to get user's colaborador_id
CREATE OR REPLACE FUNCTION public.app_get_user_colaborador_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT colaborador_id 
  FROM public.app_user_profiles 
  WHERE user_id = auth.uid() 
    AND is_active = true
  LIMIT 1;
$$;

-- Employees can view their own bonus history, master sees all
CREATE POLICY "select_bonus_historico_resultado"
  ON public.bonus_historico_resultado FOR SELECT
  USING (
    app_is_master() OR
    colaborador_id = app_get_user_colaborador_id()
  );

-- Only master can manage bonus history
CREATE POLICY "master_insert_bonus_historico_resultado"
  ON public.bonus_historico_resultado FOR INSERT
  WITH CHECK (app_is_master());

CREATE POLICY "master_update_bonus_historico_resultado"
  ON public.bonus_historico_resultado FOR UPDATE
  USING (app_is_master())
  WITH CHECK (app_is_master());

CREATE POLICY "master_delete_bonus_historico_resultado"
  ON public.bonus_historico_resultado FOR DELETE
  USING (app_is_master());

-- =====================================================
-- 5. FIX regras_comissao_periodo TABLE
-- =====================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view commission rules" ON public.regras_comissao_periodo;
DROP POLICY IF EXISTS "Authenticated users can manage commission rules" ON public.regras_comissao_periodo;

-- Create master-only policies
CREATE POLICY "master_select_regras_comissao_periodo"
  ON public.regras_comissao_periodo FOR SELECT
  USING (app_is_master());

CREATE POLICY "master_insert_regras_comissao_periodo"
  ON public.regras_comissao_periodo FOR INSERT
  WITH CHECK (app_is_master());

CREATE POLICY "master_update_regras_comissao_periodo"
  ON public.regras_comissao_periodo FOR UPDATE
  USING (app_is_master())
  WITH CHECK (app_is_master());

CREATE POLICY "master_delete_regras_comissao_periodo"
  ON public.regras_comissao_periodo FOR DELETE
  USING (app_is_master());

-- =====================================================
-- 6. FIX faixas_comissao_periodo TABLE
-- =====================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view commission tiers" ON public.faixas_comissao_periodo;
DROP POLICY IF EXISTS "Authenticated users can manage commission tiers" ON public.faixas_comissao_periodo;

-- Create master-only policies
CREATE POLICY "master_select_faixas_comissao_periodo"
  ON public.faixas_comissao_periodo FOR SELECT
  USING (app_is_master());

CREATE POLICY "master_insert_faixas_comissao_periodo"
  ON public.faixas_comissao_periodo FOR INSERT
  WITH CHECK (app_is_master());

CREATE POLICY "master_update_faixas_comissao_periodo"
  ON public.faixas_comissao_periodo FOR UPDATE
  USING (app_is_master())
  WITH CHECK (app_is_master());

CREATE POLICY "master_delete_faixas_comissao_periodo"
  ON public.faixas_comissao_periodo FOR DELETE
  USING (app_is_master());
-- Migration 1: Add new enum values and tipo_colaborador field
-- NOTE: Data migration will be done in a separate migration

-- 1. Add new values to app_role_base enum
ALTER TYPE public.app_role_base ADD VALUE IF NOT EXISTS 'org_admin';
ALTER TYPE public.app_role_base ADD VALUE IF NOT EXISTS 'unit_manager';
ALTER TYPE public.app_role_base ADD VALUE IF NOT EXISTS 'team_lead';

-- 2. Add tipo_colaborador field to dimensao_colaboradores
ALTER TABLE public.dimensao_colaboradores 
ADD COLUMN IF NOT EXISTS tipo_colaborador TEXT DEFAULT 'nenhum';

-- 3. Add check constraint for tipo_colaborador
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dimensao_colaboradores_tipo_colaborador_check'
  ) THEN
    ALTER TABLE public.dimensao_colaboradores 
    ADD CONSTRAINT dimensao_colaboradores_tipo_colaborador_check 
    CHECK (tipo_colaborador IN ('barbeiro', 'recepcao', 'nenhum'));
  END IF;
END $$;
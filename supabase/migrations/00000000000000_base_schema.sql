-- =============================================================
-- BASE SCHEMA MIGRATION
-- Creates all foundational tables, enums, and extensions
-- that the incremental migrations depend on.
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "unaccent" SCHEMA public;

-- =============================================================
-- ENUMS
-- =============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role_base AS ENUM (
    'master', 'franquia_admin', 'unidade_gerente', 'colaborador'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.app_permission_action AS ENUM (
    'view', 'export', 'create', 'edit', 'delete',
    'manage_users', 'grant_access', 'manage_rules', 'view_audit'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.app_grant_type AS ENUM (
    'allow_org', 'allow_unit', 'allow_colaborador', 'allow_screen', 'allow_filter'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================
-- AUTH / RBAC TABLES
-- =============================================================

-- Organizations
CREATE TABLE IF NOT EXISTS public.app_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  status text DEFAULT 'active',
  tenant_key text,
  created_at timestamptz DEFAULT now()
);

-- Units (branches)
CREATE TABLE IF NOT EXISTS public.app_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  org_id uuid NOT NULL REFERENCES public.app_orgs(id),
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- User profiles
CREATE TABLE IF NOT EXISTS public.app_user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role_base public.app_role_base DEFAULT 'colaborador',
  org_id uuid REFERENCES public.app_orgs(id),
  unit_id uuid REFERENCES public.app_units(id),
  colaborador_id text,
  login_alias text,
  is_active boolean DEFAULT true,
  preferred_language text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Roles
CREATE TABLE IF NOT EXISTS public.app_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  base_role public.app_role_base DEFAULT 'colaborador',
  is_system boolean,
  org_id uuid REFERENCES public.app_orgs(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User-role assignment
CREATE TABLE IF NOT EXISTS public.app_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.app_roles(id),
  scope_org_id uuid REFERENCES public.app_orgs(id),
  scope_unit_id uuid REFERENCES public.app_units(id),
  granted_by uuid,
  granted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Permissions
CREATE TABLE IF NOT EXISTS public.app_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  screen_key text NOT NULL,
  action public.app_permission_action NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Role-permission mapping
CREATE TABLE IF NOT EXISTS public.app_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.app_roles(id),
  permission_id uuid NOT NULL REFERENCES public.app_permissions(id),
  created_at timestamptz DEFAULT now()
);

-- User grants
CREATE TABLE IF NOT EXISTS public.app_user_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  grant_type public.app_grant_type NOT NULL,
  ref_id text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- Security settings
CREATE TABLE IF NOT EXISTS public.app_security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid UNIQUE REFERENCES public.app_orgs(id),
  unit_id uuid UNIQUE REFERENCES public.app_units(id),
  require_mfa_for_master boolean DEFAULT false,
  allow_mfa_for_others boolean DEFAULT false,
  session_policy text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Audit log
CREATE TABLE IF NOT EXISTS public.app_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor_user_id uuid,
  diff jsonb,
  meta jsonb,
  org_id uuid REFERENCES public.app_orgs(id),
  unit_id uuid REFERENCES public.app_units(id),
  created_at timestamptz DEFAULT now()
);

-- =============================================================
-- DIMENSION / DATA TABLES
-- =============================================================

-- Colaboradores dimension
CREATE TABLE IF NOT EXISTS public.dimensao_colaboradores (
  colaborador_id text PRIMARY KEY,
  colaborador_nome text,
  ativo boolean DEFAULT true,
  first_seen timestamptz,
  last_seen timestamptz,
  dim_created_at timestamptz DEFAULT now(),
  dim_updated_at timestamptz DEFAULT now()
);

-- Clientes dimension
CREATE TABLE IF NOT EXISTS public.dimensao_clientes (
  cliente_id text PRIMARY KEY,
  cliente_nome text,
  telefone text,
  telefone_digits text,
  nascimento date,
  rua text,
  numero text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  origem text,
  ativo boolean DEFAULT true,
  consumo numeric,
  pontuacao numeric,
  score_updated_at timestamptz,
  ultimo_colaborador text,
  ultimo_colaborador_id text,
  ultimo_colaborador_nome text,
  first_seen timestamptz,
  last_seen timestamptz,
  dim_created_at timestamptz DEFAULT now(),
  dim_updated_at timestamptz DEFAULT now()
);

-- Produtos dimension
CREATE TABLE IF NOT EXISTS public.dimensao_produtos (
  produto text PRIMARY KEY,
  grupo_de_produto text,
  servicos_ou_produtos text,
  classificacao_status text DEFAULT 'pendente',
  classificacao_updated_at timestamptz,
  first_seen timestamptz,
  last_seen timestamptz,
  dim_created_at timestamptz DEFAULT now(),
  dim_updated_at timestamptz DEFAULT now()
);

-- Caixas dimension
CREATE TABLE IF NOT EXISTS public.caixas (
  caixa_id text PRIMARY KEY,
  caixa_nome text,
  first_seen timestamptz,
  last_seen timestamptz,
  dim_created_at timestamptz DEFAULT now(),
  dim_updated_at timestamptz DEFAULT now()
);

-- Classificacao de produtos
CREATE TABLE IF NOT EXISTS public.classificacao_produtos (
  produto text PRIMARY KEY,
  grupo_de_produto text,
  servicos_ou_produtos text,
  imported_at timestamptz DEFAULT now()
);

-- Cliente status snapshot
CREATE TABLE IF NOT EXISTS public.cliente_status_snapshot (
  cliente_id text NOT NULL,
  snapshot_date date NOT NULL,
  cliente_nome text,
  telefone text,
  status_cliente text,
  ultima_visita_ts timestamptz,
  ultima_visita_dia date,
  dias_sem_vir integer,
  cadencia_dias numeric,
  cadencia_bruta_dias numeric,
  cadencia_metodo text,
  atendimentos_periodo integer,
  qtd_visitas_periodo integer,
  valor_periodo numeric,
  colaborador_id_ultimo text,
  colaborador_nome_ultimo text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (cliente_id, snapshot_date)
);

-- =============================================================
-- RAW SALES TABLES
-- =============================================================

CREATE TABLE IF NOT EXISTS public.vendas_api_raw (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  venda_id text NOT NULL,
  venda_data_ts timestamptz,
  venda_data_text text,
  cliente_id text,
  cliente_nome text,
  colaborador text,
  colaborador_id text,
  colaborador_nome text,
  produto text,
  valor_bruto numeric,
  valor_liquido numeric,
  forma_pagamento text,
  convenio text,
  caixa_id text,
  caixa_nome text,
  telefone text,
  source text DEFAULT 'trinks',
  source_run_id text DEFAULT gen_random_uuid()::text,
  payload jsonb NOT NULL,
  ingested_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendas_api_raw_tmp (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  venda_id text NOT NULL,
  venda_data_ts timestamptz,
  venda_data_text text,
  cliente_id text,
  cliente_nome text,
  colaborador text,
  colaborador_id text,
  colaborador_nome text,
  produto text,
  valor_bruto numeric,
  valor_liquido numeric,
  forma_pagamento text,
  convenio text,
  caixa_id text,
  caixa_nome text,
  telefone text,
  source text DEFAULT 'trinks',
  source_run_id text DEFAULT gen_random_uuid()::text,
  payload jsonb NOT NULL,
  ingested_at timestamptz DEFAULT now()
);

-- =============================================================
-- FINANCE TABLES
-- =============================================================

CREATE TABLE IF NOT EXISTS public.finance_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL,
  banco text,
  saldo_inicial numeric,
  saldo_atualizado_em timestamptz,
  ca_conta_id text,
  ativo boolean,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.finance_plano_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL,
  grupo text,
  subgrupo text,
  classificacao text,
  estrutura_grupo text,
  dre_linha text,
  pacote text,
  ordem integer,
  sinal integer,
  ca_categoria_id text,
  ativo boolean,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.finance_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  tipo text NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  data_vencimento date NOT NULL,
  data_pagamento date,
  status text DEFAULT 'pendente',
  conta_id uuid REFERENCES public.finance_contas(id),
  plano_conta_id uuid REFERENCES public.finance_plano_contas(id),
  origem text,
  ca_id text,
  ca_categoria text,
  ca_contato text,
  ca_grupo text,
  ca_ref_date text,
  ca_run_id text,
  ca_source_run_id text,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.finance_extrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  conta_id uuid REFERENCES public.finance_contas(id),
  data date NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  conciliado boolean,
  origem text,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.finance_conciliacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id uuid REFERENCES public.finance_lancamentos(id),
  extrato_id uuid REFERENCES public.finance_extrato(id),
  score_match numeric,
  status text,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.finance_pacotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  nome text NOT NULL,
  tipo text,
  ordem integer,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.finance_recorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  descricao text NOT NULL,
  tipo text NOT NULL,
  valor numeric NOT NULL,
  frequencia text DEFAULT 'mensal',
  dia_execucao integer DEFAULT 1,
  conta_id uuid REFERENCES public.finance_contas(id),
  plano_conta_id uuid REFERENCES public.finance_plano_contas(id),
  ativo boolean,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.finance_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  conta_origem_id uuid REFERENCES public.finance_contas(id),
  conta_destino_id uuid REFERENCES public.finance_contas(id),
  valor numeric DEFAULT 0,
  data_transferencia date NOT NULL,
  descricao text,
  status text,
  origem text,
  ca_id text,
  ca_run_id text,
  created_at timestamptz,
  updated_at timestamptz
);

-- =============================================================
-- INTEGRATION TABLES
-- =============================================================

CREATE TABLE IF NOT EXISTS public.financeiro_contaazul_raw (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  endpoint text NOT NULL,
  payload jsonb NOT NULL,
  external_id text,
  ref_date date,
  page_number integer,
  page_size integer,
  query_params jsonb,
  source text DEFAULT 'conta_azul',
  source_run_id text DEFAULT gen_random_uuid()::text,
  tenant_key text,
  ingested_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integrations_contaazul_tokens (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_key text DEFAULT 'barbearia_vip',
  access_token text,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamptz,
  raw jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================================
-- MESSAGING TABLES
-- =============================================================

CREATE TABLE IF NOT EXISTS public.mensagem_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  codigo text NOT NULL,
  titulo text NOT NULL,
  corpo text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mensagem_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id text NOT NULL,
  cliente_nome text,
  telefone text,
  status_cliente text NOT NULL,
  categoria text NOT NULL,
  ref_date date NOT NULL,
  colaborador_id text,
  colaborador_nome text,
  template_id uuid REFERENCES public.mensagem_templates(id),
  mensagem_sugerida text,
  mensagem_final text,
  canal text DEFAULT 'whatsapp',
  enviado boolean DEFAULT false,
  enviado_em timestamptz,
  enviado_por text,
  criado_por text,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================================
-- REPORT TABLES
-- =============================================================

CREATE TABLE IF NOT EXISTS public.relatorio_semanal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  corpo text NOT NULL,
  padrao boolean DEFAULT false,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.relatorio_semanal_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id text NOT NULL,
  colaborador_nome text,
  telefone text,
  semana_inicio date NOT NULL,
  semana_fim date NOT NULL,
  template_id uuid REFERENCES public.relatorio_semanal_templates(id),
  mensagem_final text NOT NULL,
  notas text,
  enviado_em timestamptz DEFAULT now(),
  enviado_por text,
  created_at timestamptz DEFAULT now()
);

-- =============================================================
-- HELPER FUNCTIONS (used by edge functions and RLS)
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_user_role_base()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role_base::text FROM public.app_user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT org_id FROM public.app_user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_unit_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT unit_id FROM public.app_user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_colaborador_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT colaborador_id FROM public.app_user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT o.tenant_key FROM public.app_user_profiles p
  JOIN public.app_orgs o ON o.id = p.org_id
  WHERE p.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_user_profiles
    WHERE user_id = auth.uid() AND role_base = 'master'
  );
$$;

CREATE OR REPLACE FUNCTION public.app_is_master()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT public.is_master();
$$;

CREATE OR REPLACE FUNCTION public.is_unidade_gerente()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_user_profiles
    WHERE user_id = auth.uid() AND role_base IN ('master', 'franquia_admin', 'unidade_gerente')
  );
$$;

CREATE OR REPLACE FUNCTION public.app_is_own_profile(check_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT check_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.app_get_user_colaborador_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT public.get_user_colaborador_id();
$$;

CREATE OR REPLACE FUNCTION public.can_manage_users()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_user_profiles
    WHERE user_id = auth.uid()
      AND role_base IN ('master', 'franquia_admin', 'unidade_gerente')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_grant(p_grant_type text, p_ref_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_user_grants
    WHERE user_id = auth.uid()
      AND grant_type = p_grant_type::public.app_grant_type
      AND ref_id = p_ref_id
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_current_user_context()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'user_id', p.user_id,
    'role_base', p.role_base,
    'org_id', p.org_id,
    'unit_id', p.unit_id,
    'colaborador_id', p.colaborador_id,
    'is_active', p.is_active,
    'tenant_key', o.tenant_key
  )
  FROM public.app_user_profiles p
  LEFT JOIN public.app_orgs o ON o.id = p.org_id
  WHERE p.user_id = auth.uid();
$$;

-- Normalize phone to BR format
CREATE OR REPLACE FUNCTION public.fn_norm_fone_br(raw text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  digits text;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  digits := regexp_replace(raw, '[^0-9]', '', 'g');
  IF length(digits) = 11 THEN
    RETURN '+55' || digits;
  ELSIF length(digits) = 13 AND starts_with(digits, '55') THEN
    RETURN '+' || digits;
  ELSE
    RETURN digits;
  END IF;
END;
$$;

-- Normalize name
CREATE OR REPLACE FUNCTION public.fn_norm_nome(raw text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT trim(regexp_replace(upper(unaccent(coalesce(raw, ''))), '\s+', ' ', 'g'));
$$;

-- =============================================================
-- ROW LEVEL SECURITY (basic policies for core tables)
-- =============================================================

ALTER TABLE public.app_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.app_user_profiles FOR SELECT
  USING (user_id = auth.uid() OR public.is_master());

CREATE POLICY "Masters can manage all profiles"
  ON public.app_user_profiles FOR ALL
  USING (public.is_master());

ALTER TABLE public.app_orgs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view orgs"
  ON public.app_orgs FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.app_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view units"
  ON public.app_units FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================
-- SEED: Default org and unit
-- =============================================================

INSERT INTO public.app_orgs (id, nome, status, tenant_key)
VALUES ('50bbbbea-cd17-4764-ba36-ac1bb5f26d75', 'Barbearia VIP', 'active', 'barbearia_vip')
ON CONFLICT DO NOTHING;

INSERT INTO public.app_units (nome, org_id, status)
VALUES ('Joinville', '50bbbbea-cd17-4764-ba36-ac1bb5f26d75', 'active')
ON CONFLICT DO NOTHING;

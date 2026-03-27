
-- Tabela de configuração do RaioX Clientes
CREATE TABLE public.raiox_clientes_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  org_id uuid,
  unit_id uuid,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  version text NOT NULL DEFAULT 'v4.1',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT raiox_clientes_config_unique UNIQUE (user_id, org_id, unit_id)
);

-- Enable RLS
ALTER TABLE public.raiox_clientes_config ENABLE ROW LEVEL SECURITY;

-- Users can read their own config
CREATE POLICY "users_select_own_config"
  ON public.raiox_clientes_config
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own config
CREATE POLICY "users_insert_own_config"
  ON public.raiox_clientes_config
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own config
CREATE POLICY "users_update_own_config"
  ON public.raiox_clientes_config
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own config
CREATE POLICY "users_delete_own_config"
  ON public.raiox_clientes_config
  FOR DELETE
  USING (auth.uid() = user_id);

-- Master can do everything
CREATE POLICY "master_all_raiox_clientes_config"
  ON public.raiox_clientes_config
  FOR ALL
  USING (app_is_master());

-- Trigger for updated_at
CREATE TRIGGER update_raiox_clientes_config_updated_at
  BEFORE UPDATE ON public.raiox_clientes_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

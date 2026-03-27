
-- Enable RLS on mensagem_envios
ALTER TABLE public.mensagem_envios ENABLE ROW LEVEL SECURITY;

-- Authenticated users can SELECT mensagem_envios
CREATE POLICY "authenticated_select_mensagem_envios"
  ON public.mensagem_envios FOR SELECT TO authenticated
  USING (true);

-- Authenticated users can INSERT mensagem_envios
CREATE POLICY "authenticated_insert_mensagem_envios"
  ON public.mensagem_envios FOR INSERT TO authenticated
  WITH CHECK (true);

-- Authenticated users can UPDATE mensagem_envios
CREATE POLICY "authenticated_update_mensagem_envios"
  ON public.mensagem_envios FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Enable RLS on mensagem_templates
ALTER TABLE public.mensagem_templates ENABLE ROW LEVEL SECURITY;

-- Authenticated users can SELECT templates
CREATE POLICY "authenticated_select_mensagem_templates"
  ON public.mensagem_templates FOR SELECT TO authenticated
  USING (true);

-- Only master can manage templates
CREATE POLICY "master_insert_mensagem_templates"
  ON public.mensagem_templates FOR INSERT TO authenticated
  WITH CHECK (app_is_master());

CREATE POLICY "master_update_mensagem_templates"
  ON public.mensagem_templates FOR UPDATE TO authenticated
  USING (app_is_master()) WITH CHECK (app_is_master());

CREATE POLICY "master_delete_mensagem_templates"
  ON public.mensagem_templates FOR DELETE TO authenticated
  USING (app_is_master());

-- Tabela para comentários de relatórios semanais
CREATE TABLE public.relatorio_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'semanal',
  colaborador_id text NULL,
  ano integer NOT NULL,
  semana_inicio date NOT NULL,
  semana_fim date NOT NULL,
  comentario text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index para busca rápida por período
CREATE INDEX idx_relatorio_comentarios_periodo 
  ON relatorio_comentarios(ano, semana_inicio, colaborador_id);

-- Enable RLS
ALTER TABLE relatorio_comentarios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Masters podem tudo
CREATE POLICY "master_all_relatorio_comentarios"
  ON relatorio_comentarios
  FOR ALL
  USING (public.app_is_master());

-- Gerentes podem ver e criar comentários
CREATE POLICY "gerente_select_relatorio_comentarios"
  ON relatorio_comentarios
  FOR SELECT
  USING (public.is_unidade_gerente(auth.uid()));

CREATE POLICY "gerente_insert_relatorio_comentarios"
  ON relatorio_comentarios
  FOR INSERT
  WITH CHECK (public.is_unidade_gerente(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "gerente_update_own_relatorio_comentarios"
  ON relatorio_comentarios
  FOR UPDATE
  USING (public.is_unidade_gerente(auth.uid()) AND created_by = auth.uid());

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_relatorio_comentarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_update_relatorio_comentarios_updated_at
  BEFORE UPDATE ON relatorio_comentarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_relatorio_comentarios_updated_at();
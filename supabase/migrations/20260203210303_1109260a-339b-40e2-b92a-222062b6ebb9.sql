-- Criar função de atualização de updated_at se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Tabela de regras de comissão por período
CREATE TABLE public.regras_comissao_periodo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ano INTEGER NOT NULL CHECK (ano >= 2020 AND ano <= 2100),
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  tipo TEXT NOT NULL CHECK (tipo IN ('SERVICO', 'PRODUTO')),
  colaborador_id TEXT DEFAULT NULL,
  usa_escalonamento BOOLEAN NOT NULL DEFAULT true,
  percentual_fixo NUMERIC(5,2) DEFAULT NULL CHECK (percentual_fixo IS NULL OR (percentual_fixo >= 0 AND percentual_fixo <= 100)),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Constraint único para evitar regras duplicadas
CREATE UNIQUE INDEX idx_regras_comissao_periodo_unique 
ON public.regras_comissao_periodo (ano, mes, tipo, COALESCE(colaborador_id, ''));

-- Tabela de faixas de comissão por regra
CREATE TABLE public.faixas_comissao_periodo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  regra_id UUID NOT NULL REFERENCES public.regras_comissao_periodo(id) ON DELETE CASCADE,
  faixa_ordem INTEGER NOT NULL CHECK (faixa_ordem >= 1),
  nome TEXT NOT NULL,
  valor_minimo NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_minimo >= 0),
  valor_maximo NUMERIC(12,2) DEFAULT NULL CHECK (valor_maximo IS NULL OR valor_maximo >= valor_minimo),
  percentual NUMERIC(5,2) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
  cor TEXT NOT NULL DEFAULT 'tier-1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca por regra
CREATE INDEX idx_faixas_comissao_regra ON public.faixas_comissao_periodo(regra_id);

-- Índice para busca por período
CREATE INDEX idx_regras_comissao_periodo ON public.regras_comissao_periodo(ano, mes);

-- Trigger para updated_at
CREATE TRIGGER update_regras_comissao_periodo_updated_at
  BEFORE UPDATE ON public.regras_comissao_periodo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.regras_comissao_periodo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faixas_comissao_periodo ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso - usuários autenticados podem ver e gerenciar
CREATE POLICY "Authenticated users can view commission rules"
  ON public.regras_comissao_periodo
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage commission rules"
  ON public.regras_comissao_periodo
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view commission tiers"
  ON public.faixas_comissao_periodo
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage commission tiers"
  ON public.faixas_comissao_periodo
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comentários nas tabelas
COMMENT ON TABLE public.regras_comissao_periodo IS 'Regras de comissão por período (ano/mês) - globais ou por colaborador';
COMMENT ON TABLE public.faixas_comissao_periodo IS 'Faixas de comissão escalonadas por regra';
COMMENT ON COLUMN public.regras_comissao_periodo.colaborador_id IS 'NULL = regra global para todos colaboradores';
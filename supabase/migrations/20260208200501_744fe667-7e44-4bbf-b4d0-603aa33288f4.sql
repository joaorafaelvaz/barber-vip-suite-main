-- =====================================================
-- BONUS SYSTEM TABLES
-- =====================================================

-- 1. bonus_regras - Cadastro de regras de bônus
CREATE TABLE public.bonus_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_bonus TEXT NOT NULL,
  descricao_regra TEXT,
  colaborador_id TEXT,           -- NULL = GLOBAL
  ativo BOOLEAN NOT NULL DEFAULT true,
  
  -- Tipo de bonus
  tipo_bonus TEXT NOT NULL CHECK (tipo_bonus IN (
    'percentual_extra',           -- +X% sobre comissão
    'percentual_faturamento',     -- X% sobre faturamento total/extras/base
    'valor_fixo',                 -- R$ X fixo
    'valor_por_unidade'           -- R$ X por unidade de KPI acima da meta
  )),
  
  -- Base para cálculo (quando tipo_bonus = 'percentual_faturamento')
  base_calculo TEXT CHECK (base_calculo IN (
    'faturamento_total',
    'faturamento_extras',
    'faturamento_base',
    'comissao_total'
  )),
  
  -- Valor do bônus (dependendo do tipo)
  bonus_valor NUMERIC,            -- Percentual ou valor R$
  
  -- Meta condicional
  depende_meta BOOLEAN NOT NULL DEFAULT false,
  kpi_key TEXT,                   -- KPI da RPC/View
  item_alvo TEXT,                 -- Para KPIs de item específico (ex.: "Hidratação")
  meta_operador TEXT DEFAULT '>=' CHECK (meta_operador IN ('>=', '>', '=', 'faixa')),
  meta_valor NUMERIC,
  
  -- Escalonamento opcional
  usa_escalonamento BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bonus_regras ENABLE ROW LEVEL SECURITY;

-- RLS policies for bonus_regras
CREATE POLICY "Authenticated users can view bonus rules" 
  ON public.bonus_regras FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can manage bonus rules" 
  ON public.bonus_regras FOR ALL 
  USING (true) 
  WITH CHECK (true);


-- 2. bonus_faixas - Faixas de escalonamento
CREATE TABLE public.bonus_faixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID NOT NULL REFERENCES public.bonus_regras(id) ON DELETE CASCADE,
  faixa_ordem INTEGER NOT NULL,
  valor_minimo NUMERIC NOT NULL DEFAULT 0,
  valor_maximo NUMERIC,
  bonus_valor NUMERIC NOT NULL,   -- Valor ou percentual da faixa
  nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bonus_faixas ENABLE ROW LEVEL SECURITY;

-- RLS policies for bonus_faixas
CREATE POLICY "Authenticated users can view bonus tiers" 
  ON public.bonus_faixas FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can manage bonus tiers" 
  ON public.bonus_faixas FOR ALL 
  USING (true) 
  WITH CHECK (true);


-- 3. bonus_regras_periodos - Vínculo regra x período
CREATE TABLE public.bonus_regras_periodos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID NOT NULL REFERENCES public.bonus_regras(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (regra_id, ano, mes)
);

-- Enable RLS
ALTER TABLE public.bonus_regras_periodos ENABLE ROW LEVEL SECURITY;

-- RLS policies for bonus_regras_periodos
CREATE POLICY "Authenticated users can view bonus periods" 
  ON public.bonus_regras_periodos FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can manage bonus periods" 
  ON public.bonus_regras_periodos FOR ALL 
  USING (true) 
  WITH CHECK (true);


-- 4. bonus_historico_resultado - Resultado congelado
CREATE TABLE public.bonus_historico_resultado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID NOT NULL REFERENCES public.bonus_regras(id),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  
  -- Resultado
  kpi_realizado NUMERIC,
  meta NUMERIC,
  atingiu BOOLEAN NOT NULL DEFAULT false,
  bonus_calculado NUMERIC NOT NULL DEFAULT 0,
  
  -- Detalhes para auditoria
  detalhes JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (regra_id, colaborador_id, ano, mes)
);

-- Enable RLS
ALTER TABLE public.bonus_historico_resultado ENABLE ROW LEVEL SECURITY;

-- RLS policies for bonus_historico_resultado
CREATE POLICY "Authenticated users can view bonus history" 
  ON public.bonus_historico_resultado FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can manage bonus history" 
  ON public.bonus_historico_resultado FOR ALL 
  USING (true) 
  WITH CHECK (true);


-- Index for performance
CREATE INDEX idx_bonus_regras_colaborador ON public.bonus_regras(colaborador_id);
CREATE INDEX idx_bonus_regras_periodos_periodo ON public.bonus_regras_periodos(ano, mes);
CREATE INDEX idx_bonus_historico_periodo ON public.bonus_historico_resultado(ano, mes);
CREATE INDEX idx_bonus_historico_colaborador ON public.bonus_historico_resultado(colaborador_id);
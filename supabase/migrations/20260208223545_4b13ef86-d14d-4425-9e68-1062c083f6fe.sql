-- Remover CONSTRAINT unica que impede historico de folgas fixas
ALTER TABLE public.colaborador_folgas_fixas 
DROP CONSTRAINT IF EXISTS uq_colaborador_folgas_fixas;

-- Criar indice para performance (nao unico) para consultas por colaborador e dia
CREATE INDEX IF NOT EXISTS idx_colaborador_folgas_fixas_lookup 
ON public.colaborador_folgas_fixas(colaborador_id, dia_semana, vigencia_fim);
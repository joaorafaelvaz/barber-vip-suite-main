-- ============================================================
-- Adicionar vigência às folgas fixas para histórico
-- ============================================================

-- Adicionar campos de vigência à tabela colaborador_folgas_fixas
ALTER TABLE public.colaborador_folgas_fixas
ADD COLUMN IF NOT EXISTS vigencia_inicio date NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS vigencia_fim date NULL;

-- Índice para consultas por período
CREATE INDEX IF NOT EXISTS idx_folgas_fixas_vigencia 
ON colaborador_folgas_fixas(colaborador_id, vigencia_inicio, vigencia_fim);

-- Comentários explicativos
COMMENT ON COLUMN colaborador_folgas_fixas.vigencia_inicio IS 'Data de início da vigência desta configuração de folga';
COMMENT ON COLUMN colaborador_folgas_fixas.vigencia_fim IS 'Data de fim da vigência (NULL = vigente até nova alteração)';
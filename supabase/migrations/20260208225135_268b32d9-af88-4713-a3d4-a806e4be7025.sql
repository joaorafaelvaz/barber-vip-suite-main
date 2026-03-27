-- Adicionar coluna tipo para diferenciar folgas avulsas de folgas fixas geradas
ALTER TABLE colaborador_folgas 
ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'avulsa';

-- Criar indice para performance nas consultas
CREATE INDEX IF NOT EXISTS idx_colaborador_folgas_tipo 
ON colaborador_folgas(colaborador_id, tipo, data);

COMMENT ON COLUMN colaborador_folgas.tipo IS 'avulsa = ausencia manual, folga_fixa = gerada automaticamente';
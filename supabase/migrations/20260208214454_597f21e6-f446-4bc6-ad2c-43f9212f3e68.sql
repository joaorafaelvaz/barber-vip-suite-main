-- =====================================================
-- COLABORADORES: Folgas, Feriados e Configurações
-- =====================================================

-- Tabela 1: Folgas avulsas (datas específicas)
CREATE TABLE public.colaborador_folgas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id text NOT NULL,
  data date NOT NULL,
  motivo text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT fk_colaborador_folgas_colab 
    FOREIGN KEY (colaborador_id) REFERENCES dimensao_colaboradores(colaborador_id) ON DELETE CASCADE,
  CONSTRAINT uq_colaborador_folgas_data UNIQUE(colaborador_id, data)
);

CREATE INDEX idx_colaborador_folgas_data ON colaborador_folgas(data);
CREATE INDEX idx_colaborador_folgas_colab ON colaborador_folgas(colaborador_id);

-- Tabela 2: Folgas fixas semanais (dias da semana)
CREATE TABLE public.colaborador_folgas_fixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id text NOT NULL,
  dia_semana integer NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6), -- 0=Dom, 1=Seg...
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT fk_colaborador_folgas_fixas_colab 
    FOREIGN KEY (colaborador_id) REFERENCES dimensao_colaboradores(colaborador_id) ON DELETE CASCADE,
  CONSTRAINT uq_colaborador_folgas_fixas UNIQUE(colaborador_id, dia_semana)
);

CREATE INDEX idx_colaborador_folgas_fixas_colab ON colaborador_folgas_fixas(colaborador_id);

-- Tabela 3: Feriados (barbearia fechada)
CREATE TABLE public.feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'nacional' CHECK (tipo IN ('nacional', 'local', 'especial')),
  barbearia_fecha boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_feriados_data ON feriados(data);
CREATE INDEX idx_feriados_ano ON feriados(EXTRACT(YEAR FROM data));

-- Tabela 4: Configurações gerais da barbearia
CREATE TABLE public.barbearia_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Inserir configuração padrão: domingo fechado
INSERT INTO barbearia_config (chave, valor) 
VALUES ('dias_fechados', '{"domingo": true, "segunda": false, "terca": false, "quarta": false, "quinta": false, "sexta": false, "sabado": false}'::jsonb);

-- =====================================================
-- RLS Policies
-- =====================================================

-- Colaborador Folgas
ALTER TABLE colaborador_folgas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colaborador_folgas_select_authenticated" ON colaborador_folgas 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "colaborador_folgas_insert_master" ON colaborador_folgas 
  FOR INSERT TO authenticated WITH CHECK (app_is_master());

CREATE POLICY "colaborador_folgas_update_master" ON colaborador_folgas 
  FOR UPDATE TO authenticated USING (app_is_master()) WITH CHECK (app_is_master());

CREATE POLICY "colaborador_folgas_delete_master" ON colaborador_folgas 
  FOR DELETE TO authenticated USING (app_is_master());

-- Colaborador Folgas Fixas
ALTER TABLE colaborador_folgas_fixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colaborador_folgas_fixas_select_authenticated" ON colaborador_folgas_fixas 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "colaborador_folgas_fixas_insert_master" ON colaborador_folgas_fixas 
  FOR INSERT TO authenticated WITH CHECK (app_is_master());

CREATE POLICY "colaborador_folgas_fixas_update_master" ON colaborador_folgas_fixas 
  FOR UPDATE TO authenticated USING (app_is_master()) WITH CHECK (app_is_master());

CREATE POLICY "colaborador_folgas_fixas_delete_master" ON colaborador_folgas_fixas 
  FOR DELETE TO authenticated USING (app_is_master());

-- Feriados
ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feriados_select_authenticated" ON feriados 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "feriados_insert_master" ON feriados 
  FOR INSERT TO authenticated WITH CHECK (app_is_master());

CREATE POLICY "feriados_update_master" ON feriados 
  FOR UPDATE TO authenticated USING (app_is_master()) WITH CHECK (app_is_master());

CREATE POLICY "feriados_delete_master" ON feriados 
  FOR DELETE TO authenticated USING (app_is_master());

-- Barbearia Config
ALTER TABLE barbearia_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "barbearia_config_select_authenticated" ON barbearia_config 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "barbearia_config_insert_master" ON barbearia_config 
  FOR INSERT TO authenticated WITH CHECK (app_is_master());

CREATE POLICY "barbearia_config_update_master" ON barbearia_config 
  FOR UPDATE TO authenticated USING (app_is_master()) WITH CHECK (app_is_master());

CREATE POLICY "barbearia_config_delete_master" ON barbearia_config 
  FOR DELETE TO authenticated USING (app_is_master());
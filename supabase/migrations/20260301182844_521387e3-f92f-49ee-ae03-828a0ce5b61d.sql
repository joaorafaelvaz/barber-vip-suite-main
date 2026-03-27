
-- Fix: Add WHERE true to UPDATE statements blocked by pg_safeupdate

CREATE OR REPLACE FUNCTION public.rpc_raiox_clientes_churn_v1(
  p_inicio text DEFAULT '2024-01-01',
  p_fim text DEFAULT '2024-12-31',
  p_janela_dias int DEFAULT 60,
  p_colaborador_id text DEFAULT NULL,
  p_excluir_sem_cadastro boolean DEFAULT true,
  p_churn_dias_sem_voltar int DEFAULT 90,
  p_risco_min_dias int DEFAULT 45,
  p_risco_max_dias int DEFAULT 90,
  p_cadencia_min_visitas int DEFAULT 3,
  p_resgate_dias_minimos int DEFAULT 90,
  p_atribuicao_modo text DEFAULT 'MULTI',
  p_atribuicao_janela_meses int DEFAULT 12,
  p_base_mode text DEFAULT 'TOTAL_COM_CORTE',
  p_base_corte_meses int DEFAULT 24,
  p_ref_mode text DEFAULT 'FIM_FILTRO'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ref date;
  v_inicio date;
  v_fim date;
  v_result jsonb;
  v_meta jsonb;
  v_kpis jsonb;
  v_por_barbeiro jsonb;
  v_lista jsonb;
  v_base_ativa int;
  v_base_fidelizados int;
  v_base_oneshot int;
  v_perdidos int;
  v_perdidos_fidelizados int;
  v_perdidos_oneshot int;
  v_resgatados int;
  v_em_risco int;
BEGIN
  v_inicio := p_inicio::date;
  v_fim := p_fim::date;

  IF p_ref_mode = 'HOJE' THEN
    v_ref := current_date;
  ELSE
    v_ref := v_fim;
  END IF;

  CREATE TEMP TABLE _churn_base ON COMMIT DROP AS
  SELECT
    dc.cliente_id,
    dc.cliente_nome,
    dc.telefone,
    dc.last_seen,
    (v_ref - dc.last_seen) AS dias_sem_vir,
    COALESCE(cr.visitas_total, 0)::int AS visitas_total,
    COALESCE(cr.valor_total, 0)::numeric AS valor_total
  FROM dimensao_clientes dc
  LEFT JOIN LATERAL (
    SELECT
      COUNT(DISTINCT v.venda_id)::int AS visitas_total,
      SUM(v.valor_liquido) AS valor_total
    FROM vendas_api_raw v
    WHERE v.cliente_id = dc.cliente_id
  ) cr ON true
  WHERE dc.cliente_id IS NOT NULL
    AND dc.cliente_id <> ''
    AND (NOT p_excluir_sem_cadastro OR (dc.cliente_nome IS NOT NULL AND dc.cliente_nome <> ''))
    AND CASE
      WHEN p_base_mode = 'JANELA' THEN dc.last_seen >= (v_ref - p_janela_dias * interval '1 day')::date
      WHEN p_base_mode = 'PERIODO_FILTRADO' THEN dc.last_seen >= v_inicio AND dc.last_seen <= v_fim
      WHEN p_base_mode = 'TOTAL' THEN true
      WHEN p_base_mode = 'TOTAL_COM_CORTE' THEN dc.last_seen >= (v_ref - (p_base_corte_meses * interval '1 month'))::date
      ELSE dc.last_seen >= (v_ref - (p_base_corte_meses * interval '1 month'))::date
    END;

  ALTER TABLE _churn_base ADD COLUMN status_churn text;
  ALTER TABLE _churn_base ADD COLUMN is_fidelizado boolean DEFAULT false;
  ALTER TABLE _churn_base ADD COLUMN is_oneshot boolean DEFAULT false;

  UPDATE _churn_base SET
    status_churn = CASE
      WHEN dias_sem_vir > p_churn_dias_sem_voltar THEN 'PERDIDO'
      WHEN dias_sem_vir >= p_risco_min_dias AND dias_sem_vir <= p_risco_max_dias THEN 'RISCO'
      WHEN dias_sem_vir <= p_janela_dias THEN 'ATIVO'
      ELSE 'INATIVO'
    END,
    is_fidelizado = (visitas_total >= p_cadencia_min_visitas),
    is_oneshot = (visitas_total = 1)
  WHERE true;

  CREATE TEMP TABLE _resgatados ON COMMIT DROP AS
  SELECT DISTINCT cb.cliente_id
  FROM _churn_base cb
  WHERE EXISTS (
    SELECT 1 FROM vendas_api_raw v
    WHERE v.cliente_id = cb.cliente_id
      AND v.venda_data_ts::date BETWEEN v_inicio AND v_fim
  )
  AND (
    SELECT (v.venda_data_ts::date - LAG(v.venda_data_ts::date) OVER (ORDER BY v.venda_data_ts))
    FROM vendas_api_raw v
    WHERE v.cliente_id = cb.cliente_id
      AND v.venda_data_ts::date <= v_fim
    ORDER BY v.venda_data_ts DESC
    LIMIT 1
  ) >= p_resgate_dias_minimos;

  DROP TABLE _resgatados;
  CREATE TEMP TABLE _resgatados ON COMMIT DROP AS
  SELECT cb.cliente_id
  FROM _churn_base cb
  WHERE EXISTS (
    SELECT 1 FROM vendas_api_raw v1
    WHERE v1.cliente_id = cb.cliente_id
      AND v1.venda_data_ts::date BETWEEN v_inicio AND v_fim
  )
  AND (
    SELECT MAX(gap) >= p_resgate_dias_minimos
    FROM (
      SELECT vd.venda_data_ts::date - LAG(vd.venda_data_ts::date) OVER (ORDER BY vd.venda_data_ts) AS gap
      FROM (
        SELECT DISTINCT ON (vd2.venda_data_ts::date) vd2.venda_data_ts
        FROM vendas_api_raw vd2
        WHERE vd2.cliente_id = cb.cliente_id
        ORDER BY vd2.venda_data_ts::date, vd2.venda_data_ts
      ) vd
    ) gaps
  );

  SELECT COUNT(*) INTO v_base_ativa FROM _churn_base WHERE status_churn = 'ATIVO';
  SELECT COUNT(*) INTO v_perdidos FROM _churn_base WHERE status_churn = 'PERDIDO';
  SELECT COUNT(*) INTO v_em_risco FROM _churn_base WHERE status_churn = 'RISCO';
  SELECT COUNT(*) INTO v_resgatados FROM _resgatados;

  SELECT COUNT(*) INTO v_base_fidelizados FROM _churn_base WHERE status_churn = 'ATIVO' AND is_fidelizado;
  SELECT COUNT(*) INTO v_perdidos_fidelizados FROM _churn_base WHERE status_churn = 'PERDIDO' AND is_fidelizado;

  SELECT COUNT(*) INTO v_base_oneshot FROM _churn_base WHERE status_churn = 'ATIVO' AND is_oneshot;
  SELECT COUNT(*) INTO v_perdidos_oneshot FROM _churn_base WHERE status_churn = 'PERDIDO' AND is_oneshot;

  v_meta := jsonb_build_object(
    'ref', v_ref::text,
    'base_ativa', v_base_ativa,
    'base_fidelizados', v_base_fidelizados,
    'base_oneshot', v_base_oneshot,
    'total_universo', (SELECT COUNT(*) FROM _churn_base)
  );

  v_kpis := jsonb_build_object(
    'churn_geral_pct', CASE WHEN v_base_ativa + v_perdidos > 0 THEN ROUND(v_perdidos * 100.0 / (v_base_ativa + v_perdidos), 1) ELSE 0 END,
    'perdidos', v_perdidos,
    'base_ativa', v_base_ativa,
    'churn_fidelizados_pct', CASE WHEN v_base_fidelizados + v_perdidos_fidelizados > 0 THEN ROUND(v_perdidos_fidelizados * 100.0 / (v_base_fidelizados + v_perdidos_fidelizados), 1) ELSE 0 END,
    'perdidos_fidelizados', v_perdidos_fidelizados,
    'base_fidelizados', v_base_fidelizados,
    'churn_oneshot_pct', CASE WHEN v_base_oneshot + v_perdidos_oneshot > 0 THEN ROUND(v_perdidos_oneshot * 100.0 / (v_base_oneshot + v_perdidos_oneshot), 1) ELSE 0 END,
    'perdidos_oneshot', v_perdidos_oneshot,
    'base_oneshot', v_base_oneshot,
    'resgatados', v_resgatados,
    'em_risco', v_em_risco
  );

  v_por_barbeiro := COALESCE((
    SELECT jsonb_agg(row_to_json(bb)::jsonb ORDER BY bb.churn_pct DESC)
    FROM (
      SELECT
        va.colaborador_id,
        va.colaborador_nome,
        COUNT(DISTINCT cb.cliente_id) FILTER (WHERE cb.status_churn = 'ATIVO') AS base_ativa,
        COUNT(DISTINCT cb.cliente_id) FILTER (WHERE cb.status_churn = 'PERDIDO') AS perdidos,
        CASE
          WHEN COUNT(DISTINCT cb.cliente_id) FILTER (WHERE cb.status_churn IN ('ATIVO','PERDIDO')) > 0
          THEN ROUND(
            COUNT(DISTINCT cb.cliente_id) FILTER (WHERE cb.status_churn = 'PERDIDO') * 100.0
            / COUNT(DISTINCT cb.cliente_id) FILTER (WHERE cb.status_churn IN ('ATIVO','PERDIDO')),
            1
          )
          ELSE 0
        END AS churn_pct,
        ROUND(
          COUNT(DISTINCT cb.cliente_id) FILTER (WHERE cb.status_churn IN ('ATIVO','PERDIDO') AND n_barb.n_barbeiros = 1) * 100.0
          / NULLIF(COUNT(DISTINCT cb.cliente_id) FILTER (WHERE cb.status_churn IN ('ATIVO','PERDIDO')), 0),
          1
        ) AS exclusivos_pct,
        ROUND(
          COUNT(DISTINCT cb.cliente_id) FILTER (WHERE cb.status_churn IN ('ATIVO','PERDIDO') AND n_barb.n_barbeiros > 1) * 100.0
          / NULLIF(COUNT(DISTINCT cb.cliente_id) FILTER (WHERE cb.status_churn IN ('ATIVO','PERDIDO')), 0),
          1
        ) AS compartilhados_pct
      FROM _churn_base cb
      JOIN vendas_api_raw va ON va.cliente_id = cb.cliente_id
        AND va.colaborador_id IS NOT NULL
        AND va.venda_data_ts::date >= (v_ref - (p_atribuicao_janela_meses * interval '1 month'))::date
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT va2.colaborador_id) AS n_barbeiros
        FROM vendas_api_raw va2
        WHERE va2.cliente_id = cb.cliente_id
          AND va2.colaborador_id IS NOT NULL
          AND va2.venda_data_ts::date >= (v_ref - (p_atribuicao_janela_meses * interval '1 month'))::date
      ) n_barb ON true
      WHERE (p_colaborador_id IS NULL OR va.colaborador_id = p_colaborador_id)
      GROUP BY va.colaborador_id, va.colaborador_nome
      HAVING COUNT(DISTINCT cb.cliente_id) FILTER (WHERE cb.status_churn IN ('ATIVO','PERDIDO')) > 0
    ) bb
  ), '[]'::jsonb);

  v_lista := COALESCE((
    SELECT jsonb_agg(row_to_json(ll)::jsonb)
    FROM (
      SELECT
        cb.cliente_id,
        cb.cliente_nome,
        cb.telefone,
        dc_colab.colaborador_nome AS colaborador_nome,
        cb.last_seen::text AS ultima_visita,
        cb.dias_sem_vir,
        cb.visitas_total,
        cb.valor_total,
        CASE
          WHEN r.cliente_id IS NOT NULL THEN 'RESGATADO'
          ELSE cb.status_churn
        END AS status_churn
      FROM _churn_base cb
      LEFT JOIN _resgatados r ON r.cliente_id = cb.cliente_id
      LEFT JOIN LATERAL (
        SELECT va3.colaborador_nome
        FROM vendas_api_raw va3
        WHERE va3.cliente_id = cb.cliente_id AND va3.colaborador_nome IS NOT NULL
        ORDER BY va3.venda_data_ts DESC
        LIMIT 1
      ) dc_colab ON true
      WHERE cb.status_churn IN ('PERDIDO', 'RISCO') OR r.cliente_id IS NOT NULL
      ORDER BY cb.dias_sem_vir DESC
      LIMIT 50
    ) ll
  ), '[]'::jsonb);

  v_result := jsonb_build_object(
    'meta', v_meta,
    'kpis', v_kpis,
    'por_barbeiro', v_por_barbeiro,
    'lista_perdidos', v_lista
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- rpc_raiox_clientes_churn_drill_v1 (fix WHERE true)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_raiox_clientes_churn_drill_v1(
  p_inicio text DEFAULT '2024-01-01',
  p_fim text DEFAULT '2024-12-31',
  p_janela_dias int DEFAULT 60,
  p_colaborador_id text DEFAULT NULL,
  p_excluir_sem_cadastro boolean DEFAULT true,
  p_churn_dias_sem_voltar int DEFAULT 90,
  p_risco_min_dias int DEFAULT 45,
  p_risco_max_dias int DEFAULT 90,
  p_cadencia_min_visitas int DEFAULT 3,
  p_resgate_dias_minimos int DEFAULT 90,
  p_atribuicao_modo text DEFAULT 'MULTI',
  p_atribuicao_janela_meses int DEFAULT 12,
  p_base_mode text DEFAULT 'TOTAL_COM_CORTE',
  p_base_corte_meses int DEFAULT 24,
  p_ref_mode text DEFAULT 'FIM_FILTRO',
  p_tipo text DEFAULT 'PERDIDOS',
  p_valor text DEFAULT NULL,
  p_limit int DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ref date;
  v_inicio date;
  v_fim date;
  v_total int;
  v_rows jsonb;
BEGIN
  v_inicio := p_inicio::date;
  v_fim := p_fim::date;

  IF p_ref_mode = 'HOJE' THEN
    v_ref := current_date;
  ELSE
    v_ref := v_fim;
  END IF;

  CREATE TEMP TABLE _drill_base ON COMMIT DROP AS
  SELECT
    dc.cliente_id,
    dc.cliente_nome,
    dc.telefone,
    dc.last_seen,
    (v_ref - dc.last_seen) AS dias_sem_vir,
    COALESCE(cr.visitas_total, 0)::int AS visitas_total,
    COALESCE(cr.valor_total, 0)::numeric AS valor_total
  FROM dimensao_clientes dc
  LEFT JOIN LATERAL (
    SELECT
      COUNT(DISTINCT v.venda_id)::int AS visitas_total,
      SUM(v.valor_liquido) AS valor_total
    FROM vendas_api_raw v
    WHERE v.cliente_id = dc.cliente_id
  ) cr ON true
  WHERE dc.cliente_id IS NOT NULL
    AND dc.cliente_id <> ''
    AND (NOT p_excluir_sem_cadastro OR (dc.cliente_nome IS NOT NULL AND dc.cliente_nome <> ''))
    AND CASE
      WHEN p_base_mode = 'JANELA' THEN dc.last_seen >= (v_ref - p_janela_dias * interval '1 day')::date
      WHEN p_base_mode = 'PERIODO_FILTRADO' THEN dc.last_seen >= v_inicio AND dc.last_seen <= v_fim
      WHEN p_base_mode = 'TOTAL' THEN true
      WHEN p_base_mode = 'TOTAL_COM_CORTE' THEN dc.last_seen >= (v_ref - (p_base_corte_meses * interval '1 month'))::date
      ELSE dc.last_seen >= (v_ref - (p_base_corte_meses * interval '1 month'))::date
    END;

  ALTER TABLE _drill_base ADD COLUMN status_churn text;
  ALTER TABLE _drill_base ADD COLUMN is_fidelizado boolean DEFAULT false;
  ALTER TABLE _drill_base ADD COLUMN is_oneshot boolean DEFAULT false;

  UPDATE _drill_base SET
    status_churn = CASE
      WHEN dias_sem_vir > p_churn_dias_sem_voltar THEN 'PERDIDO'
      WHEN dias_sem_vir >= p_risco_min_dias AND dias_sem_vir <= p_risco_max_dias THEN 'RISCO'
      WHEN dias_sem_vir <= p_janela_dias THEN 'ATIVO'
      ELSE 'INATIVO'
    END,
    is_fidelizado = (visitas_total >= p_cadencia_min_visitas),
    is_oneshot = (visitas_total = 1)
  WHERE true;

  CREATE TEMP TABLE _drill_resgatados ON COMMIT DROP AS
  SELECT cb.cliente_id
  FROM _drill_base cb
  WHERE EXISTS (
    SELECT 1 FROM vendas_api_raw v1
    WHERE v1.cliente_id = cb.cliente_id
      AND v1.venda_data_ts::date BETWEEN v_inicio AND v_fim
  )
  AND (
    SELECT MAX(gap) >= p_resgate_dias_minimos
    FROM (
      SELECT vd.venda_data_ts::date - LAG(vd.venda_data_ts::date) OVER (ORDER BY vd.venda_data_ts) AS gap
      FROM (
        SELECT DISTINCT ON (vd2.venda_data_ts::date) vd2.venda_data_ts
        FROM vendas_api_raw vd2
        WHERE vd2.cliente_id = cb.cliente_id
        ORDER BY vd2.venda_data_ts::date, vd2.venda_data_ts
      ) vd
    ) gaps
  );

  CREATE TEMP TABLE _drill_filtered ON COMMIT DROP AS
  SELECT db.*, dc_colab.colaborador_nome
  FROM _drill_base db
  LEFT JOIN LATERAL (
    SELECT va.colaborador_nome
    FROM vendas_api_raw va
    WHERE va.cliente_id = db.cliente_id AND va.colaborador_nome IS NOT NULL
    ORDER BY va.venda_data_ts DESC
    LIMIT 1
  ) dc_colab ON true
  WHERE
    CASE p_tipo
      WHEN 'PERDIDOS' THEN db.status_churn = 'PERDIDO'
      WHEN 'RISCO' THEN db.status_churn = 'RISCO'
      WHEN 'RESGATADOS' THEN EXISTS (SELECT 1 FROM _drill_resgatados r WHERE r.cliente_id = db.cliente_id)
      WHEN 'PERDIDOS_FIDELIZADOS' THEN db.status_churn = 'PERDIDO' AND db.is_fidelizado
      WHEN 'PERDIDOS_ONESHOT' THEN db.status_churn = 'PERDIDO' AND db.is_oneshot
      WHEN 'BARBEIRO' THEN EXISTS (
        SELECT 1 FROM vendas_api_raw va2
        WHERE va2.cliente_id = db.cliente_id
          AND va2.colaborador_id = p_valor
          AND va2.venda_data_ts::date >= (v_ref - (p_atribuicao_janela_meses * interval '1 month'))::date
      ) AND db.status_churn IN ('ATIVO','PERDIDO','RISCO')
      ELSE false
    END;

  SELECT COUNT(*) INTO v_total FROM _drill_filtered;

  v_rows := COALESCE((
    SELECT jsonb_agg(row_to_json(rr)::jsonb)
    FROM (
      SELECT
        f.cliente_id,
        f.cliente_nome,
        f.telefone,
        f.colaborador_nome,
        f.last_seen::text AS ultima_visita,
        f.dias_sem_vir,
        f.visitas_total,
        f.valor_total
      FROM _drill_filtered f
      ORDER BY f.dias_sem_vir DESC
      LIMIT p_limit
    ) rr
  ), '[]'::jsonb);

  RETURN jsonb_build_object(
    'total', v_total,
    'tipo', p_tipo,
    'valor', p_valor,
    'rows', v_rows
  );
END;
$$;

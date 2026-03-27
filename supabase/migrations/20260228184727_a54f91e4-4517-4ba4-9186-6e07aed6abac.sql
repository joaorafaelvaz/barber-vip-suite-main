
-- ============================================================
-- Unify cadence logic: rpc_clientes_barbeiro_detalhe
-- Replace period-only cadence with 3-year historical LAG/median
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_clientes_barbeiro_detalhe(
  p_data_inicio text,
  p_data_fim text,
  p_ref_date text DEFAULT NULL,
  p_colaborador_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio date := p_data_inicio::date;
  v_fim    date := p_data_fim::date;
  v_ref    date := COALESCE(p_ref_date::date, CURRENT_DATE);
  v_result jsonb;
BEGIN
  IF p_colaborador_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  WITH
  -- Period vendas (for metrics: atendimentos, valor, etc.)
  vendas AS (
    SELECT v.cliente_id, v.cliente_nome, v.colaborador_id, v.colaborador_nome,
           v.venda_dia, v.valor_faturamento, v.telefone
    FROM vw_vendas_kpi_base v
    WHERE v.venda_dia BETWEEN v_inicio AND v_fim
      AND v.is_credito = false
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.cliente_nome IS NOT NULL
      AND v.cliente_nome NOT ILIKE '%sem cadastro%'
      AND v.produto IS NOT NULL
      AND v.produto <> ''
  ),

  vendas_barb AS (
    SELECT * FROM vendas WHERE colaborador_id = p_colaborador_id
  ),

  clientes_barb AS (
    SELECT
      cliente_id,
      MIN(cliente_nome) AS cliente_nome,
      MIN(telefone) AS telefone,
      COUNT(DISTINCT venda_dia) AS atendimentos,
      SUM(valor_faturamento) AS valor_total,
      MAX(venda_dia) AS ultima_visita
    FROM vendas_barb
    GROUP BY cliente_id
  ),

  -- Historical cadence: up to 3 years, for THIS barber only
  historico_visitas_barb AS (
    SELECT v.cliente_id, v.venda_dia
    FROM vw_vendas_kpi_base v
    WHERE v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.is_credito = false
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND v.cliente_nome NOT ILIKE '%sem cadastro%'
      AND v.colaborador_id = p_colaborador_id
      AND v.venda_dia <= v_ref
      AND v.venda_dia >= (v_inicio - interval '3 years')::date
    GROUP BY v.cliente_id, v.venda_dia
  ),

  dias_cliente_barb AS (
    SELECT cliente_id, venda_dia,
      LAG(venda_dia) OVER (PARTITION BY cliente_id ORDER BY venda_dia) AS dia_anterior
    FROM historico_visitas_barb
  ),

  cadencia AS (
    SELECT cliente_id,
      CASE
        WHEN COUNT(dia_anterior) >= 3
          THEN PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (venda_dia - dia_anterior)::numeric)
        WHEN COUNT(dia_anterior) >= 1
          THEN AVG((venda_dia - dia_anterior)::numeric)
        ELSE NULL
      END AS cadencia_dias
    FROM dias_cliente_barb
    WHERE dia_anterior IS NOT NULL
    GROUP BY cliente_id
  ),

  status_calc AS (
    SELECT
      cb.cliente_id,
      cb.cliente_nome,
      cb.telefone,
      cb.atendimentos,
      cb.valor_total,
      cb.ultima_visita,
      (v_ref - cb.ultima_visita) AS dias_sem_vir,
      c.cadencia_dias,
      CASE
        -- 1 visit in period: use fixed thresholds
        WHEN cb.atendimentos = 1 AND c.cadencia_dias IS NULL THEN
          CASE
            WHEN (v_ref - cb.ultima_visita) <= 30 THEN 'AGUARDANDO_RETORNO'
            WHEN (v_ref - cb.ultima_visita) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        -- Has historical cadence (even if 1 visit in period)
        WHEN c.cadencia_dias IS NOT NULL AND c.cadencia_dias > 0 THEN
          CASE
            WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 0.8) THEN 'ATIVO_VIP'
            WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 1.2) THEN 'ATIVO_FORTE'
            WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 1.8) THEN 'ATIVO_LEVE'
            WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 2.5) THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        -- 2+ visits but no cadence (shouldn't happen, but fallback with fixed thresholds)
        ELSE
          CASE
            WHEN (v_ref - cb.ultima_visita) <= 20 THEN 'ATIVO_VIP'
            WHEN (v_ref - cb.ultima_visita) <= 30 THEN 'ATIVO_FORTE'
            WHEN (v_ref - cb.ultima_visita) <= 45 THEN 'ATIVO_LEVE'
            WHEN (v_ref - cb.ultima_visita) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
      END AS status_cliente
    FROM clientes_barb cb
    LEFT JOIN cadencia c ON c.cliente_id = cb.cliente_id
  ),

  exclusivos AS (
    SELECT cb.cliente_id
    FROM clientes_barb cb
    WHERE NOT EXISTS (
      SELECT 1 FROM vendas v2
      WHERE v2.cliente_id = cb.cliente_id
        AND v2.colaborador_id <> p_colaborador_id
    )
  ),

  perdidos AS (
    SELECT
      COUNT(*) FILTER (WHERE sc.status_cliente = 'PERDIDO')::int AS total,
      COUNT(*) FILTER (
        WHERE sc.status_cliente = 'PERDIDO'
        AND NOT EXISTS (
          SELECT 1 FROM vendas v2
          WHERE v2.cliente_id = sc.cliente_id
            AND v2.colaborador_id <> p_colaborador_id
            AND v2.venda_dia > sc.ultima_visita
        )
      )::int AS perdidos_barbearia,
      COUNT(*) FILTER (
        WHERE sc.status_cliente = 'PERDIDO'
        AND EXISTS (
          SELECT 1 FROM vendas v2
          WHERE v2.cliente_id = sc.cliente_id
            AND v2.colaborador_id <> p_colaborador_id
            AND v2.venda_dia > sc.ultima_visita
        )
      )::int AS perdidos_para_outro
    FROM status_calc sc
  ),

  fieis AS (
    SELECT COUNT(*)::int AS total
    FROM clientes_barb cb
    WHERE cb.atendimentos >= 3
      AND cb.cliente_id IN (SELECT e.cliente_id FROM exclusivos e)
  ),

  novos_periodo AS (
    SELECT COUNT(DISTINCT cb.cliente_id)::int AS total
    FROM clientes_barb cb
    JOIN dimensao_clientes dc ON dc.cliente_id = cb.cliente_id
    WHERE dc.first_seen BETWEEN v_inicio AND v_fim
  ),

  novos_ret AS (
    SELECT
      cb.cliente_id,
      dc.first_seen,
      CASE WHEN EXISTS (
        SELECT 1 FROM vendas_barb v2
        WHERE v2.cliente_id = cb.cliente_id
          AND v2.venda_dia > dc.first_seen
          AND v2.venda_dia <= dc.first_seen + 30
      ) THEN 1 ELSE 0 END AS retornou_30d
    FROM clientes_barb cb
    JOIN dimensao_clientes dc ON dc.cliente_id = cb.cliente_id
    WHERE dc.first_seen BETWEEN v_inicio AND v_fim
  ),

  ret_30d_agg AS (
    SELECT
      CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(retornou_30d)::numeric / COUNT(*) * 100, 1) ELSE 0 END AS retencao_30d
    FROM novos_ret
  ),

  evolucao AS (
    SELECT
      to_char(venda_dia, 'YYYY-MM') AS ano_mes,
      COUNT(DISTINCT cliente_id)::int AS clientes_unicos,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM dimensao_clientes dc2
          WHERE dc2.cliente_id = vendas_barb.cliente_id
            AND dc2.first_seen >= date_trunc('month', vendas_barb.venda_dia)::date
            AND dc2.first_seen < (date_trunc('month', vendas_barb.venda_dia) + interval '1 month')::date
        ) THEN vendas_barb.cliente_id END
      )::int AS novos,
      COUNT(*)::int AS atendimentos,
      ROUND(COALESCE(SUM(valor_faturamento), 0)::numeric, 2) AS valor
    FROM vendas_barb
    GROUP BY to_char(venda_dia, 'YYYY-MM')
    ORDER BY ano_mes
  ),

  freq_dist AS (
    SELECT
      CASE
        WHEN atendimentos = 1 THEN '1 vez'
        WHEN atendimentos = 2 THEN '2x'
        WHEN atendimentos BETWEEN 3 AND 4 THEN '3-4x'
        WHEN atendimentos BETWEEN 5 AND 9 THEN '5-9x'
        WHEN atendimentos BETWEEN 10 AND 12 THEN '10-12x'
        WHEN atendimentos BETWEEN 13 AND 15 THEN '13-15x'
        WHEN atendimentos BETWEEN 16 AND 20 THEN '16-20x'
        WHEN atendimentos BETWEEN 21 AND 30 THEN '21-30x'
        ELSE '30+'
      END AS faixa,
      CASE
        WHEN atendimentos = 1 THEN 1
        WHEN atendimentos = 2 THEN 2
        WHEN atendimentos BETWEEN 3 AND 4 THEN 3
        WHEN atendimentos BETWEEN 5 AND 9 THEN 4
        WHEN atendimentos BETWEEN 10 AND 12 THEN 5
        WHEN atendimentos BETWEEN 13 AND 15 THEN 6
        WHEN atendimentos BETWEEN 16 AND 20 THEN 7
        WHEN atendimentos BETWEEN 21 AND 30 THEN 8
        ELSE 9
      END AS ordem,
      COUNT(*)::int AS count
    FROM clientes_barb
    GROUP BY 1, 2
    ORDER BY ordem
  ),

  top_clientes AS (
    SELECT
      sc.cliente_id,
      sc.cliente_nome,
      sc.telefone,
      sc.atendimentos AS visitas,
      ROUND(sc.valor_total::numeric, 2) AS valor,
      sc.ultima_visita::text AS ultima_visita,
      sc.dias_sem_vir,
      sc.status_cliente AS status
    FROM status_calc sc
    ORDER BY sc.valor_total DESC
    LIMIT 10
  ),

  kpis AS (
    SELECT
      COUNT(*)::int AS total_clientes,
      ROUND(COALESCE(AVG(valor_total), 0)::numeric, 2) AS valor_medio_cliente,
      COUNT(DISTINCT CASE WHEN cb.cliente_id IN (SELECT e.cliente_id FROM exclusivos e) THEN cb.cliente_id END)::int AS exclusivos_total,
      COUNT(DISTINCT CASE WHEN cb.cliente_id NOT IN (SELECT e.cliente_id FROM exclusivos e) THEN cb.cliente_id END)::int AS compartilhados_total
    FROM clientes_barb cb
  )

  SELECT jsonb_build_object(
    'total_clientes', k.total_clientes,
    'valor_medio_cliente', k.valor_medio_cliente,
    'exclusivos_total', k.exclusivos_total,
    'compartilhados_total', k.compartilhados_total,
    'fieis', f.total,
    'novos_no_periodo', np.total,
    'retencao_30d', r.retencao_30d,
    'perdidos_total', p.total,
    'perdidos_barbearia', p.perdidos_barbearia,
    'perdidos_para_outro', p.perdidos_para_outro,
    'status_distribuicao', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', sd.status, 'count', sd.count)) FROM (SELECT status_cliente AS status, COUNT(*)::int AS count FROM status_calc GROUP BY status_cliente) sd), '[]'::jsonb),
    'evolucao_mensal', COALESCE((SELECT jsonb_agg(jsonb_build_object('ano_mes', e.ano_mes, 'clientes_unicos', e.clientes_unicos, 'novos', e.novos, 'atendimentos', e.atendimentos, 'valor', e.valor) ORDER BY e.ano_mes) FROM evolucao e), '[]'::jsonb),
    'frequencia_dist', COALESCE((SELECT jsonb_agg(jsonb_build_object('faixa', fd.faixa, 'count', fd.count) ORDER BY fd.ordem) FROM freq_dist fd), '[]'::jsonb),
    'top_clientes_valor', COALESCE((SELECT jsonb_agg(jsonb_build_object('cliente_id', tc.cliente_id, 'cliente_nome', tc.cliente_nome, 'telefone', tc.telefone, 'visitas', tc.visitas, 'valor', tc.valor, 'ultima_visita', tc.ultima_visita, 'dias_sem_vir', tc.dias_sem_vir, 'status', tc.status)) FROM top_clientes tc), '[]'::jsonb)
  )
  INTO v_result
  FROM kpis k, fieis f, novos_periodo np, ret_30d_agg r, perdidos p;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ============================================================
-- Unify cadence logic: rpc_clientes_barbearia_detalhe
-- Replace period-only cadence with 3-year historical LAG/median
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_clientes_barbearia_detalhe(
  p_data_inicio text,
  p_data_fim text,
  p_ref_date text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio date := p_data_inicio::date;
  v_fim    date := p_data_fim::date;
  v_ref    date := COALESCE(p_ref_date::date, CURRENT_DATE);
  v_result jsonb;
BEGIN
  WITH
  -- Period vendas (for metrics)
  vendas AS (
    SELECT v.cliente_id, v.cliente_nome, v.colaborador_id, v.colaborador_nome,
           v.venda_dia, v.valor_faturamento, v.telefone
    FROM vw_vendas_kpi_base v
    WHERE v.venda_dia BETWEEN v_inicio AND v_fim
      AND v.is_credito = false
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.cliente_nome IS NOT NULL
      AND v.cliente_nome NOT ILIKE '%sem cadastro%'
      AND v.produto IS NOT NULL
      AND v.produto <> ''
  ),

  clientes_barb AS (
    SELECT
      cliente_id,
      MIN(cliente_nome) AS cliente_nome,
      MIN(telefone) AS telefone,
      COUNT(DISTINCT venda_dia) AS atendimentos,
      SUM(valor_faturamento) AS valor_total,
      MAX(venda_dia) AS ultima_visita
    FROM vendas
    GROUP BY cliente_id
  ),

  -- Historical cadence: up to 3 years, ALL barbers (barbearia-wide)
  historico_visitas AS (
    SELECT v.cliente_id, v.venda_dia
    FROM vw_vendas_kpi_base v
    WHERE v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.is_credito = false
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND v.cliente_nome NOT ILIKE '%sem cadastro%'
      AND v.venda_dia <= v_ref
      AND v.venda_dia >= (v_inicio - interval '3 years')::date
    GROUP BY v.cliente_id, v.venda_dia
  ),

  dias_cliente AS (
    SELECT cliente_id, venda_dia,
      LAG(venda_dia) OVER (PARTITION BY cliente_id ORDER BY venda_dia) AS dia_anterior
    FROM historico_visitas
  ),

  cadencia AS (
    SELECT cliente_id,
      CASE
        WHEN COUNT(dia_anterior) >= 3
          THEN PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (venda_dia - dia_anterior)::numeric)
        WHEN COUNT(dia_anterior) >= 1
          THEN AVG((venda_dia - dia_anterior)::numeric)
        ELSE NULL
      END AS cadencia_dias
    FROM dias_cliente
    WHERE dia_anterior IS NOT NULL
    GROUP BY cliente_id
  ),

  status_calc AS (
    SELECT
      cb.cliente_id,
      cb.cliente_nome,
      cb.telefone,
      cb.atendimentos,
      cb.valor_total,
      cb.ultima_visita,
      (v_ref - cb.ultima_visita) AS dias_sem_vir,
      c.cadencia_dias,
      CASE
        -- 1 visit in period and no historical cadence: fixed thresholds
        WHEN cb.atendimentos = 1 AND c.cadencia_dias IS NULL THEN
          CASE
            WHEN (v_ref - cb.ultima_visita) <= 30 THEN 'AGUARDANDO_RETORNO'
            WHEN (v_ref - cb.ultima_visita) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        -- Has historical cadence
        WHEN c.cadencia_dias IS NOT NULL AND c.cadencia_dias > 0 THEN
          CASE
            WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 0.8) THEN 'ATIVO_VIP'
            WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 1.2) THEN 'ATIVO_FORTE'
            WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 1.8) THEN 'ATIVO_LEVE'
            WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 2.5) THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        -- Fallback: fixed thresholds
        ELSE
          CASE
            WHEN (v_ref - cb.ultima_visita) <= 20 THEN 'ATIVO_VIP'
            WHEN (v_ref - cb.ultima_visita) <= 30 THEN 'ATIVO_FORTE'
            WHEN (v_ref - cb.ultima_visita) <= 45 THEN 'ATIVO_LEVE'
            WHEN (v_ref - cb.ultima_visita) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
      END AS status_cliente
    FROM clientes_barb cb
    LEFT JOIN cadencia c ON c.cliente_id = cb.cliente_id
  ),

  status_dist AS (
    SELECT status_cliente AS status, COUNT(*)::int AS count
    FROM status_calc
    GROUP BY status_cliente
  ),

  perdidos_agg AS (
    SELECT
      COUNT(*) FILTER (WHERE status_cliente = 'PERDIDO')::int AS perdidos_barbearia,
      0::int AS perdidos_para_outro
    FROM status_calc
  ),

  fieis AS (
    SELECT COUNT(*)::int AS total
    FROM clientes_barb cb
    WHERE cb.atendimentos >= 3
      AND (SELECT COUNT(DISTINCT v2.colaborador_id) FROM vendas v2 WHERE v2.cliente_id = cb.cliente_id) = 1
  ),

  novos_periodo AS (
    SELECT COUNT(DISTINCT cb.cliente_id)::int AS total
    FROM clientes_barb cb
    JOIN dimensao_clientes dc ON dc.cliente_id = cb.cliente_id
    WHERE dc.first_seen BETWEEN v_inicio AND v_fim
  ),

  novos_ret AS (
    SELECT
      cb.cliente_id,
      dc.first_seen,
      CASE WHEN EXISTS (
        SELECT 1 FROM vendas v2
        WHERE v2.cliente_id = cb.cliente_id
          AND v2.venda_dia > dc.first_seen
          AND v2.venda_dia <= dc.first_seen + 30
      ) THEN 1 ELSE 0 END AS retornou_30d
    FROM clientes_barb cb
    JOIN dimensao_clientes dc ON dc.cliente_id = cb.cliente_id
    WHERE dc.first_seen BETWEEN v_inicio AND v_fim
  ),

  ret_30d_agg AS (
    SELECT
      CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(retornou_30d)::numeric / COUNT(*) * 100, 1) ELSE 0 END AS retencao_30d
    FROM novos_ret
  ),

  evolucao AS (
    SELECT
      to_char(venda_dia, 'YYYY-MM') AS ano_mes,
      COUNT(DISTINCT cliente_id)::int AS clientes_unicos,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM dimensao_clientes dc2
          WHERE dc2.cliente_id = vendas.cliente_id
            AND dc2.first_seen >= date_trunc('month', vendas.venda_dia)::date
            AND dc2.first_seen < (date_trunc('month', vendas.venda_dia) + interval '1 month')::date
        ) THEN vendas.cliente_id END
      )::int AS novos,
      COUNT(*)::int AS atendimentos,
      ROUND(COALESCE(SUM(valor_faturamento), 0), 2)::numeric AS valor
    FROM vendas
    GROUP BY to_char(venda_dia, 'YYYY-MM')
    ORDER BY ano_mes
  ),

  freq_dist AS (
    SELECT
      CASE
        WHEN atendimentos = 1 THEN '1 vez'
        WHEN atendimentos = 2 THEN '2x'
        WHEN atendimentos BETWEEN 3 AND 4 THEN '3-4x'
        WHEN atendimentos BETWEEN 5 AND 9 THEN '5-9x'
        ELSE '10+'
      END AS faixa,
      CASE
        WHEN atendimentos = 1 THEN 1
        WHEN atendimentos = 2 THEN 2
        WHEN atendimentos BETWEEN 3 AND 4 THEN 3
        WHEN atendimentos BETWEEN 5 AND 9 THEN 4
        ELSE 5
      END AS ordem,
      COUNT(*)::int AS count
    FROM clientes_barb
    GROUP BY 1, 2
    ORDER BY ordem
  ),

  top_clientes AS (
    SELECT
      sc.cliente_id,
      sc.cliente_nome,
      sc.telefone,
      sc.atendimentos AS visitas,
      ROUND(sc.valor_total, 2)::numeric AS valor,
      sc.ultima_visita::text AS ultima_visita,
      sc.dias_sem_vir,
      sc.status_cliente AS status
    FROM status_calc sc
    ORDER BY sc.valor_total DESC
    LIMIT 10
  ),

  kpis AS (
    SELECT
      COUNT(*)::int AS total_clientes,
      ROUND(COALESCE(AVG(valor_total), 0), 2)::numeric AS valor_medio_cliente
    FROM clientes_barb
  )

  SELECT jsonb_build_object(
    'total_clientes', k.total_clientes,
    'valor_medio_cliente', k.valor_medio_cliente,
    'fieis', f.total,
    'novos_no_periodo', np.total,
    'retencao_30d', r.retencao_30d,
    'status_distribuicao', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', sd.status, 'count', sd.count)) FROM status_dist sd), '[]'::jsonb),
    'perdidos_barbearia', pa.perdidos_barbearia,
    'perdidos_para_outro', pa.perdidos_para_outro,
    'evolucao_mensal', COALESCE((SELECT jsonb_agg(jsonb_build_object('ano_mes', e.ano_mes, 'clientes_unicos', e.clientes_unicos, 'novos', e.novos, 'atendimentos', e.atendimentos, 'valor', e.valor) ORDER BY e.ano_mes) FROM evolucao e), '[]'::jsonb),
    'frequencia_dist', COALESCE((SELECT jsonb_agg(jsonb_build_object('faixa', fd.faixa, 'count', fd.count) ORDER BY fd.ordem) FROM freq_dist fd), '[]'::jsonb),
    'top_clientes_valor', COALESCE((SELECT jsonb_agg(jsonb_build_object('cliente_id', tc.cliente_id, 'cliente_nome', tc.cliente_nome, 'telefone', tc.telefone, 'visitas', tc.visitas, 'valor', tc.valor, 'ultima_visita', tc.ultima_visita, 'dias_sem_vir', tc.dias_sem_vir, 'status', tc.status)) FROM top_clientes tc), '[]'::jsonb)
  )
  INTO v_result
  FROM kpis k, fieis f, novos_periodo np, ret_30d_agg r, perdidos_agg pa;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;


-- ============================================================
-- 1) rpc_clientes_churn_resumo
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_clientes_churn_resumo(
  p_ref text,
  p_janela_dias int DEFAULT 60,
  p_excluir_sem_cadastro bool DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_ref date := p_ref::date;
  v_cutoff date := v_ref - p_janela_dias;
  v_cutoff2 date := v_ref - (2 * p_janela_dias);
  v_base_ativa bigint;
  v_perdidos bigint;
  v_resgatados bigint;
  v_tempo_medio numeric;
  v_valor_perdido numeric;
BEGIN
  -- Build client last-visit snapshot
  WITH base AS (
    SELECT
      v.cliente_id,
      v.cliente_nome,
      MAX(v.venda_dia) AS ultima_visita,
      SUM(v.valor_bruto) AS valor_total,
      COUNT(DISTINCT v.venda_dia) AS visitas
    FROM vw_vendas_kpi_base v
    WHERE v.is_credito = false
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.venda_dia <= v_ref
      AND v.venda_dia >= v_cutoff2
      AND (NOT p_excluir_sem_cadastro OR v.cliente_nome NOT ILIKE '%sem cadastro%')
    GROUP BY v.cliente_id, v.cliente_nome
  ),
  ativos AS (
    SELECT * FROM base WHERE ultima_visita >= v_cutoff
  ),
  perdidos AS (
    SELECT * FROM base WHERE ultima_visita < v_cutoff AND ultima_visita >= v_cutoff2
  ),
  -- Resgatados: had last visit before cutoff in previous window, but came back in current window
  resgatados AS (
    SELECT
      r.cliente_id,
      r.ultima_visita AS visita_retorno,
      prev.prev_ultima
    FROM ativos r
    JOIN LATERAL (
      SELECT MAX(v2.venda_dia) AS prev_ultima
      FROM vw_vendas_kpi_base v2
      WHERE v2.cliente_id = r.cliente_id
        AND v2.is_credito = false
        AND v2.produto IS NOT NULL AND v2.produto <> ''
        AND v2.venda_dia < v_cutoff
        AND v2.venda_dia >= v_cutoff2 - p_janela_dias
    ) prev ON prev.prev_ultima IS NOT NULL
    WHERE prev.prev_ultima < v_cutoff - p_janela_dias
  )
  SELECT
    (SELECT count(*) FROM ativos),
    (SELECT count(*) FROM perdidos),
    (SELECT count(*) FROM resgatados),
    (SELECT avg(r.visita_retorno - r.prev_ultima) FROM resgatados r),
    (SELECT
      CASE WHEN count(*) > 0
        THEN (sum(p.valor_total) / count(*)) * count(*)
        ELSE 0
      END
     FROM perdidos p)
  INTO v_base_ativa, v_perdidos, v_resgatados, v_tempo_medio, v_valor_perdido;

  RETURN jsonb_build_object(
    'base_ativa', v_base_ativa,
    'perdidos', v_perdidos,
    'churn_pct', CASE WHEN (v_base_ativa + v_perdidos) > 0
      THEN round(v_perdidos::numeric / (v_base_ativa + v_perdidos), 4)
      ELSE 0 END,
    'resgatados', v_resgatados,
    'tempo_medio_resgate', round(COALESCE(v_tempo_medio, 0), 1),
    'valor_perdido_estimado', round(COALESCE(v_valor_perdido, 0), 2)
  );
END;
$$;

-- ============================================================
-- 2) rpc_clientes_churn_series
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_clientes_churn_series(
  p_inicio text,
  p_fim text,
  p_janela_dias int DEFAULT 60,
  p_excluir_sem_cadastro bool DEFAULT true
)
RETURNS TABLE(ano_mes text, base_ativa bigint, perdidos bigint, churn_pct numeric, resgatados bigint)
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_mes date;
  v_inicio date := p_inicio::date;
  v_fim date := p_fim::date;
  v_result jsonb;
BEGIN
  v_mes := date_trunc('month', v_inicio)::date;
  WHILE v_mes <= v_fim LOOP
    v_result := rpc_clientes_churn_resumo(
      (v_mes + interval '1 month' - interval '1 day')::date::text,
      p_janela_dias,
      p_excluir_sem_cadastro
    );
    ano_mes := to_char(v_mes, 'YYYY-MM');
    base_ativa := (v_result->>'base_ativa')::bigint;
    perdidos := (v_result->>'perdidos')::bigint;
    churn_pct := (v_result->>'churn_pct')::numeric;
    resgatados := (v_result->>'resgatados')::bigint;
    RETURN NEXT;
    v_mes := v_mes + interval '1 month';
  END LOOP;
END;
$$;

-- ============================================================
-- 3) rpc_clientes_churn_barbeiros
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_clientes_churn_barbeiros(
  p_ref text,
  p_janela_dias int DEFAULT 60,
  p_excluir_sem_cadastro bool DEFAULT true
)
RETURNS TABLE(
  colaborador_id text,
  colaborador_nome text,
  base_ativa bigint,
  perdidos bigint,
  churn_pct numeric,
  exclusivos_pct numeric,
  compartilhados_pct numeric
)
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_ref date := p_ref::date;
  v_cutoff date := v_ref - p_janela_dias;
  v_cutoff2 date := v_ref - (2 * p_janela_dias);
BEGIN
  RETURN QUERY
  WITH vendas_periodo AS (
    SELECT
      v.cliente_id,
      v.cliente_nome,
      v.colaborador_id,
      v.colaborador_nome,
      v.venda_dia
    FROM vw_vendas_kpi_base v
    WHERE v.is_credito = false
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.venda_dia <= v_ref
      AND v.venda_dia >= v_cutoff2
      AND v.colaborador_id IS NOT NULL AND v.colaborador_id <> ''
      AND (NOT p_excluir_sem_cadastro OR v.cliente_nome NOT ILIKE '%sem cadastro%')
  ),
  cliente_ultimo AS (
    SELECT DISTINCT ON (vp.cliente_id)
      vp.cliente_id,
      vp.colaborador_id,
      vp.colaborador_nome,
      MAX(vp.venda_dia) OVER (PARTITION BY vp.cliente_id) AS ultima_visita
    FROM vendas_periodo vp
    ORDER BY vp.cliente_id, vp.venda_dia DESC
  ),
  cliente_barbeiros AS (
    SELECT
      vp.cliente_id,
      count(DISTINCT vp.colaborador_id) AS n_barbeiros
    FROM vendas_periodo vp
    GROUP BY vp.cliente_id
  ),
  por_barbeiro AS (
    SELECT
      cu.colaborador_id,
      cu.colaborador_nome,
      count(*) FILTER (WHERE cu.ultima_visita >= v_cutoff) AS cnt_ativa,
      count(*) FILTER (WHERE cu.ultima_visita < v_cutoff) AS cnt_perdidos,
      count(*) FILTER (WHERE cb.n_barbeiros = 1) AS cnt_exclusivos,
      count(*) AS cnt_total
    FROM cliente_ultimo cu
    JOIN cliente_barbeiros cb ON cb.cliente_id = cu.cliente_id
    GROUP BY cu.colaborador_id, cu.colaborador_nome
  )
  SELECT
    pb.colaborador_id,
    pb.colaborador_nome,
    pb.cnt_ativa,
    pb.cnt_perdidos,
    CASE WHEN (pb.cnt_ativa + pb.cnt_perdidos) > 0
      THEN round(pb.cnt_perdidos::numeric / (pb.cnt_ativa + pb.cnt_perdidos), 4)
      ELSE 0 END,
    CASE WHEN pb.cnt_total > 0
      THEN round(pb.cnt_exclusivos::numeric / pb.cnt_total, 4)
      ELSE 0 END,
    CASE WHEN pb.cnt_total > 0
      THEN round((pb.cnt_total - pb.cnt_exclusivos)::numeric / pb.cnt_total, 4)
      ELSE 0 END
  FROM por_barbeiro pb
  ORDER BY pb.cnt_perdidos DESC;
END;
$$;

-- ============================================================
-- 4) rpc_clientes_cohort_geral
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_clientes_cohort_geral(
  p_inicio text,
  p_fim text,
  p_excluir_sem_cadastro bool DEFAULT true
)
RETURNS TABLE(
  cohort_ano_mes text,
  size bigint,
  m1_pct numeric,
  m2_pct numeric,
  m3_pct numeric,
  m6_pct numeric
)
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_inicio date := p_inicio::date;
  v_fim date := p_fim::date;
BEGIN
  RETURN QUERY
  WITH clientes_cohort AS (
    SELECT
      dc.cliente_id,
      date_trunc('month', dc.first_seen)::date AS cohort_mes
    FROM dimensao_clientes dc
    WHERE dc.first_seen IS NOT NULL
      AND dc.first_seen >= v_inicio
      AND dc.first_seen <= v_fim
      AND dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''
      AND (NOT p_excluir_sem_cadastro OR dc.cliente_nome NOT ILIKE '%sem cadastro%')
  ),
  visitas AS (
    SELECT
      v.cliente_id,
      date_trunc('month', v.venda_dia)::date AS mes_visita
    FROM vw_vendas_kpi_base v
    WHERE v.is_credito = false
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.venda_dia >= v_inicio
      AND (NOT p_excluir_sem_cadastro OR v.cliente_nome NOT ILIKE '%sem cadastro%')
    GROUP BY v.cliente_id, date_trunc('month', v.venda_dia)::date
  ),
  cohort_data AS (
    SELECT
      cc.cohort_mes,
      cc.cliente_id,
      vi.mes_visita
    FROM clientes_cohort cc
    LEFT JOIN visitas vi ON vi.cliente_id = cc.cliente_id
      AND vi.mes_visita > cc.cohort_mes
  )
  SELECT
    to_char(cd.cohort_mes, 'YYYY-MM'),
    count(DISTINCT cd.cliente_id),
    CASE WHEN count(DISTINCT cd.cliente_id) > 0
      THEN round(count(DISTINCT cd.cliente_id) FILTER (
        WHERE cd.mes_visita = cd.cohort_mes + interval '1 month'
      )::numeric / count(DISTINCT cd.cliente_id), 4) ELSE NULL END,
    CASE WHEN count(DISTINCT cd.cliente_id) > 0
      THEN round(count(DISTINCT cd.cliente_id) FILTER (
        WHERE cd.mes_visita = cd.cohort_mes + interval '2 months'
      )::numeric / count(DISTINCT cd.cliente_id), 4) ELSE NULL END,
    CASE WHEN count(DISTINCT cd.cliente_id) > 0
      THEN round(count(DISTINCT cd.cliente_id) FILTER (
        WHERE cd.mes_visita = cd.cohort_mes + interval '3 months'
      )::numeric / count(DISTINCT cd.cliente_id), 4) ELSE NULL END,
    CASE WHEN count(DISTINCT cd.cliente_id) > 0
      THEN round(count(DISTINCT cd.cliente_id) FILTER (
        WHERE cd.mes_visita = cd.cohort_mes + interval '6 months'
      )::numeric / count(DISTINCT cd.cliente_id), 4) ELSE NULL END
  FROM cohort_data cd
  GROUP BY cd.cohort_mes
  ORDER BY cd.cohort_mes;
END;
$$;

-- ============================================================
-- 5) rpc_clientes_cohort_barbeiros
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_clientes_cohort_barbeiros(
  p_inicio text,
  p_fim text,
  p_excluir_sem_cadastro bool DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_inicio date := p_inicio::date;
  v_fim date := p_fim::date;
BEGIN
  RETURN (
    WITH clientes_cohort AS (
      SELECT
        dc.cliente_id,
        dc.cliente_nome,
        date_trunc('month', dc.first_seen)::date AS cohort_mes,
        dc.first_seen
      FROM dimensao_clientes dc
      WHERE dc.first_seen IS NOT NULL
        AND dc.first_seen >= v_inicio
        AND dc.first_seen <= v_fim
        AND dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''
        AND (NOT p_excluir_sem_cadastro OR dc.cliente_nome NOT ILIKE '%sem cadastro%')
    ),
    barbeiro_aquisicao AS (
      SELECT DISTINCT ON (cc.cliente_id)
        cc.cliente_id,
        cc.cohort_mes,
        v.colaborador_id,
        v.colaborador_nome
      FROM clientes_cohort cc
      JOIN vw_vendas_kpi_base v ON v.cliente_id = cc.cliente_id
        AND v.venda_dia = cc.first_seen
        AND v.is_credito = false
        AND v.produto IS NOT NULL AND v.produto <> ''
        AND v.colaborador_id IS NOT NULL AND v.colaborador_id <> ''
      ORDER BY cc.cliente_id, v.id
    ),
    visitas AS (
      SELECT
        v.cliente_id,
        date_trunc('month', v.venda_dia)::date AS mes_visita
      FROM vw_vendas_kpi_base v
      WHERE v.is_credito = false
        AND v.produto IS NOT NULL AND v.produto <> ''
        AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
        AND v.venda_dia >= v_inicio
        AND (NOT p_excluir_sem_cadastro OR v.cliente_nome NOT ILIKE '%sem cadastro%')
      GROUP BY v.cliente_id, date_trunc('month', v.venda_dia)::date
    ),
    cohort_barbeiro AS (
      SELECT
        ba.colaborador_id,
        ba.colaborador_nome,
        ba.cohort_mes,
        ba.cliente_id,
        vi.mes_visita
      FROM barbeiro_aquisicao ba
      LEFT JOIN visitas vi ON vi.cliente_id = ba.cliente_id
        AND vi.mes_visita > ba.cohort_mes
    ),
    agg AS (
      SELECT
        cb.colaborador_id,
        cb.colaborador_nome,
        to_char(cb.cohort_mes, 'YYYY-MM') AS cohort_ano_mes,
        count(DISTINCT cb.cliente_id) AS size,
        CASE WHEN count(DISTINCT cb.cliente_id) > 0
          THEN round(count(DISTINCT cb.cliente_id) FILTER (
            WHERE cb.mes_visita = cb.cohort_mes + interval '1 month'
          )::numeric / count(DISTINCT cb.cliente_id), 4) ELSE NULL END AS m1_pct,
        CASE WHEN count(DISTINCT cb.cliente_id) > 0
          THEN round(count(DISTINCT cb.cliente_id) FILTER (
            WHERE cb.mes_visita = cb.cohort_mes + interval '2 months'
          )::numeric / count(DISTINCT cb.cliente_id), 4) ELSE NULL END AS m2_pct,
        CASE WHEN count(DISTINCT cb.cliente_id) > 0
          THEN round(count(DISTINCT cb.cliente_id) FILTER (
            WHERE cb.mes_visita = cb.cohort_mes + interval '3 months'
          )::numeric / count(DISTINCT cb.cliente_id), 4) ELSE NULL END AS m3_pct,
        CASE WHEN count(DISTINCT cb.cliente_id) > 0
          THEN round(count(DISTINCT cb.cliente_id) FILTER (
            WHERE cb.mes_visita = cb.cohort_mes + interval '6 months'
          )::numeric / count(DISTINCT cb.cliente_id), 4) ELSE NULL END AS m6_pct
      FROM cohort_barbeiro cb
      GROUP BY cb.colaborador_id, cb.colaborador_nome, cb.cohort_mes
      ORDER BY cb.colaborador_nome, cb.cohort_mes
    )
    SELECT COALESCE(jsonb_agg(row_to_json(grouped)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        a.colaborador_id,
        a.colaborador_nome,
        jsonb_agg(
          jsonb_build_object(
            'cohort_ano_mes', a.cohort_ano_mes,
            'size', a.size,
            'm1_pct', a.m1_pct,
            'm2_pct', a.m2_pct,
            'm3_pct', a.m3_pct,
            'm6_pct', a.m6_pct
          ) ORDER BY a.cohort_ano_mes
        ) AS cohorts
      FROM agg a
      GROUP BY a.colaborador_id, a.colaborador_nome
      ORDER BY a.colaborador_nome
    ) grouped
  );
END;
$$;

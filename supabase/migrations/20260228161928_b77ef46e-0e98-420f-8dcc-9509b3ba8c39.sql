
-- ============================================================
-- MIGRATION: Add AGUARDANDO_RETORNO status for 1-visit clients
-- and expand frequency ranges (10-12, 13-15, 16-20, 21-30, 30+)
-- ============================================================

-- 1. Update rpc_clientes_painel_completo
CREATE OR REPLACE FUNCTION public.rpc_clientes_painel_completo(
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
  v_fim date := p_data_fim::date;
  v_ref date := COALESCE(p_ref_date::date, v_fim);
  v_result jsonb;
BEGIN

  WITH
  base AS (
    SELECT
      v.cliente_id, v.cliente_nome, v.colaborador_id, v.colaborador_nome,
      v.venda_dia, v.valor_faturamento, v.venda_id
    FROM vw_vendas_kpi_base v
    WHERE v.venda_dia BETWEEN v_inicio AND v_fim
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.is_credito = false
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND v.cliente_nome NOT ILIKE '%sem cadastro%'
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
  ),

  clientes_periodo AS (
    SELECT
      b.cliente_id,
      MAX(b.cliente_nome) AS cliente_nome,
      MIN(b.venda_dia) AS primeira_visita_periodo,
      MAX(b.venda_dia) AS ultima_visita_periodo,
      COUNT(DISTINCT b.venda_dia) AS dias_distintos,
      COUNT(DISTINCT b.venda_id) AS atendimentos,
      SUM(b.valor_faturamento) AS valor_total,
      COUNT(DISTINCT b.colaborador_id) AS qtd_barbeiros
    FROM base b
    GROUP BY b.cliente_id
  ),

  primeira_visita_global AS (
    SELECT v.cliente_id, MIN(v.venda_dia) AS primeira_visita_historica
    FROM vw_vendas_kpi_base v
    WHERE v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.is_credito = false
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND v.cliente_nome NOT ILIKE '%sem cadastro%'
      AND v.venda_dia >= (v_inicio - interval '5 years')::date
    GROUP BY v.cliente_id
  ),
  novos AS (
    SELECT cp.cliente_id
    FROM clientes_periodo cp
    JOIN primeira_visita_global pvg ON pvg.cliente_id = cp.cliente_id
    WHERE pvg.primeira_visita_historica BETWEEN v_inicio AND v_fim
  ),
  novos_retornaram AS (
    SELECT cp.cliente_id
    FROM clientes_periodo cp
    JOIN novos n ON n.cliente_id = cp.cliente_id
    WHERE cp.dias_distintos > 1
  ),

  historico_visitas AS (
    SELECT v.cliente_id, v.venda_dia
    FROM vw_vendas_kpi_base v
    WHERE v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.is_credito = false
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND v.cliente_nome NOT ILIKE '%sem cadastro%'
      AND v.venda_dia <= v_ref
      AND v.venda_dia >= (v_inicio - interval '3 years')::date
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
    GROUP BY v.cliente_id, v.venda_dia
  ),
  dias_cliente AS (
    SELECT cliente_id, venda_dia,
           LAG(venda_dia) OVER (PARTITION BY cliente_id ORDER BY venda_dia) AS dia_anterior
    FROM historico_visitas
  ),
  cadencia_calc AS (
    SELECT cliente_id,
      AVG(venda_dia - dia_anterior) AS cadencia_bruta,
      CASE
        WHEN COUNT(dia_anterior) >= 3 THEN PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (venda_dia - dia_anterior)::numeric)
        WHEN COUNT(dia_anterior) >= 1 THEN AVG(venda_dia - dia_anterior)
        ELSE NULL
      END AS cadencia_dias,
      CASE
        WHEN COUNT(dia_anterior) >= 3 THEN 'mediana'
        WHEN COUNT(dia_anterior) >= 1 THEN 'media'
        ELSE 'sem_dados'
      END AS cadencia_metodo
    FROM dias_cliente
    GROUP BY cliente_id
  ),
  status_calc AS (
    SELECT
      cp.cliente_id,
      cp.dias_distintos,
      (v_ref - cp.ultima_visita_periodo) AS dias_sem_vir,
      cc.cadencia_dias, cc.cadencia_metodo,
      CASE
        -- Clients with exactly 1 visit: separate classification
        WHEN cp.dias_distintos = 1 THEN
          CASE
            WHEN (v_ref - cp.ultima_visita_periodo) <= 30 THEN 'AGUARDANDO_RETORNO'
            WHEN (v_ref - cp.ultima_visita_periodo) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        -- Clients with 2+ visits: cadence-based classification
        WHEN cc.cadencia_dias IS NOT NULL AND cc.cadencia_dias > 0 THEN
          CASE
            WHEN (v_ref - cp.ultima_visita_periodo) <= cc.cadencia_dias * 0.8 THEN 'ATIVO_VIP'
            WHEN (v_ref - cp.ultima_visita_periodo) <= cc.cadencia_dias * 1.2 THEN 'ATIVO_FORTE'
            WHEN (v_ref - cp.ultima_visita_periodo) <= cc.cadencia_dias * 1.8 THEN 'ATIVO_LEVE'
            WHEN (v_ref - cp.ultima_visita_periodo) <= cc.cadencia_dias * 2.5 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        ELSE
          -- fallback: 2+ visits without calculable cadence
          CASE
            WHEN (v_ref - cp.ultima_visita_periodo) <= 20 THEN 'ATIVO_VIP'
            WHEN (v_ref - cp.ultima_visita_periodo) <= 30 THEN 'ATIVO_FORTE'
            WHEN (v_ref - cp.ultima_visita_periodo) <= 45 THEN 'ATIVO_LEVE'
            WHEN (v_ref - cp.ultima_visita_periodo) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
      END AS status_cliente
    FROM clientes_periodo cp
    LEFT JOIN cadencia_calc cc ON cc.cliente_id = cp.cliente_id
  ),

  kpis AS (
    SELECT jsonb_build_object(
      'total_clientes', (SELECT COUNT(*) FROM clientes_periodo),
      'clientes_novos', (SELECT COUNT(*) FROM novos),
      'clientes_novos_retornaram', (SELECT COUNT(*) FROM novos_retornaram),
      'total_atendimentos', (SELECT COALESCE(SUM(atendimentos), 0) FROM clientes_periodo),
      'ticket_medio', (SELECT COALESCE(ROUND(AVG(valor_total / NULLIF(atendimentos, 0)), 2), 0) FROM clientes_periodo),
      'valor_total', (SELECT COALESCE(SUM(valor_total), 0) FROM clientes_periodo)
    ) AS val
  ),

  status_dist AS (
    SELECT jsonb_agg(jsonb_build_object('status', sub.status_cliente, 'count', sub.cnt) ORDER BY sub.ord) AS val
    FROM (
      SELECT sc.status_cliente, COUNT(*) AS cnt,
        CASE sc.status_cliente
          WHEN 'ATIVO_VIP' THEN 1
          WHEN 'ATIVO_FORTE' THEN 2
          WHEN 'ATIVO_LEVE' THEN 3
          WHEN 'AGUARDANDO_RETORNO' THEN 4
          WHEN 'EM_RISCO' THEN 5
          WHEN 'PERDIDO' THEN 6
          ELSE 7
        END AS ord
      FROM status_calc sc GROUP BY sc.status_cliente
    ) sub
  ),

  mensal AS (
    SELECT jsonb_agg(jsonb_build_object(
      'ano_mes', sub.ano_mes, 'clientes_unicos', sub.clientes_unicos,
      'clientes_novos', sub.clientes_novos, 'atendimentos', sub.atendimentos, 'valor', sub.valor
    ) ORDER BY sub.ano_mes) AS val
    FROM (
      SELECT TO_CHAR(b.venda_dia, 'YYYY-MM') AS ano_mes,
        COUNT(DISTINCT b.cliente_id) AS clientes_unicos,
        COUNT(DISTINCT b.cliente_id) FILTER (
          WHERE b.cliente_id IN (SELECT n.cliente_id FROM novos n)
          AND TO_CHAR(pvg.primeira_visita_historica, 'YYYY-MM') = TO_CHAR(b.venda_dia, 'YYYY-MM')
        ) AS clientes_novos,
        COUNT(DISTINCT b.venda_id) AS atendimentos,
        SUM(b.valor_faturamento) AS valor
      FROM base b
      LEFT JOIN primeira_visita_global pvg ON pvg.cliente_id = b.cliente_id
      GROUP BY TO_CHAR(b.venda_dia, 'YYYY-MM')
    ) sub
  ),

  por_barbeiro AS (
    SELECT jsonb_agg(jsonb_build_object(
      'colaborador_id', sub.colaborador_id, 'colaborador_nome', sub.colaborador_nome,
      'clientes_unicos', sub.clientes_unicos, 'clientes_novos', sub.clientes_novos,
      'clientes_exclusivos', sub.clientes_exclusivos, 'valor_total', sub.valor_total
    ) ORDER BY sub.clientes_unicos DESC) AS val
    FROM (
      SELECT b.colaborador_id, MAX(b.colaborador_nome) AS colaborador_nome,
        COUNT(DISTINCT b.cliente_id) AS clientes_unicos,
        COUNT(DISTINCT b.cliente_id) FILTER (WHERE b.cliente_id IN (SELECT n.cliente_id FROM novos n)) AS clientes_novos,
        COUNT(DISTINCT b.cliente_id) FILTER (WHERE b.cliente_id IN (SELECT cp2.cliente_id FROM clientes_periodo cp2 WHERE cp2.qtd_barbeiros = 1)) AS clientes_exclusivos,
        SUM(b.valor_faturamento) AS valor_total
      FROM base b WHERE b.colaborador_id IS NOT NULL GROUP BY b.colaborador_id
    ) sub
  ),

  faixas AS (
    SELECT jsonb_build_object(
      'ate_20d', COUNT(*) FILTER (WHERE sc.dias_sem_vir <= 20),
      '21_30d', COUNT(*) FILTER (WHERE sc.dias_sem_vir BETWEEN 21 AND 30),
      '31_45d', COUNT(*) FILTER (WHERE sc.dias_sem_vir BETWEEN 31 AND 45),
      '46_75d', COUNT(*) FILTER (WHERE sc.dias_sem_vir BETWEEN 46 AND 75),
      'mais_75d', COUNT(*) FILTER (WHERE sc.dias_sem_vir > 75)
    ) AS val
    FROM status_calc sc
  ),

  faixas_freq AS (
    SELECT jsonb_build_object(
      'uma_vez', COUNT(*) FILTER (WHERE cp.dias_distintos = 1),
      'uma_vez_aguardando', COUNT(*) FILTER (WHERE cp.dias_distintos = 1 AND (v_ref - cp.ultima_visita_periodo) <= 30),
      'uma_vez_30d', COUNT(*) FILTER (WHERE cp.dias_distintos = 1 AND (v_ref - cp.ultima_visita_periodo) > 30 AND (v_ref - cp.ultima_visita_periodo) <= 60),
      'uma_vez_60d', COUNT(*) FILTER (WHERE cp.dias_distintos = 1 AND (v_ref - cp.ultima_visita_periodo) > 60),
      'duas_vezes', COUNT(*) FILTER (WHERE cp.dias_distintos = 2),
      'tres_quatro', COUNT(*) FILTER (WHERE cp.dias_distintos BETWEEN 3 AND 4),
      'cinco_nove', COUNT(*) FILTER (WHERE cp.dias_distintos BETWEEN 5 AND 9),
      'dez_doze', COUNT(*) FILTER (WHERE cp.dias_distintos BETWEEN 10 AND 12),
      'treze_quinze', COUNT(*) FILTER (WHERE cp.dias_distintos BETWEEN 13 AND 15),
      'dezesseis_vinte', COUNT(*) FILTER (WHERE cp.dias_distintos BETWEEN 16 AND 20),
      'vinte_um_trinta', COUNT(*) FILTER (WHERE cp.dias_distintos BETWEEN 21 AND 30),
      'trinta_mais', COUNT(*) FILTER (WHERE cp.dias_distintos > 30)
    ) AS val
    FROM clientes_periodo cp
  )

  SELECT jsonb_build_object(
    'kpis', (SELECT val FROM kpis),
    'status_distribuicao', COALESCE((SELECT val FROM status_dist), '[]'::jsonb),
    'evolucao_mensal', COALESCE((SELECT val FROM mensal), '[]'::jsonb),
    'por_barbeiro', COALESCE((SELECT val FROM por_barbeiro), '[]'::jsonb),
    'faixas_dias', (SELECT val FROM faixas),
    'faixas_frequencia', (SELECT val FROM faixas_freq),
    'periodo', jsonb_build_object('data_inicio', v_inicio, 'data_fim', v_fim, 'ref_date', v_ref)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 2. Update rpc_clientes_barbearia_detalhe — add AGUARDANDO_RETORNO for 1-visit clients
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
  vendas AS (
    SELECT v.cliente_id, v.cliente_nome, v.colaborador_id, v.colaborador_nome,
           v.venda_dia, v.valor_faturamento, v.telefone
    FROM vw_vendas_kpi_base v
    WHERE v.venda_dia BETWEEN v_inicio AND v_fim
      AND v.is_credito = false
      AND v.cliente_id IS NOT NULL
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

  cadencia AS (
    SELECT
      cliente_id,
      CASE
        WHEN COUNT(DISTINCT venda_dia) < 2 THEN NULL
        ELSE ROUND(
          (MAX(venda_dia) - MIN(venda_dia))::numeric / NULLIF(COUNT(DISTINCT venda_dia) - 1, 0), 1
        )
      END AS cadencia_dias
    FROM vendas
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
        -- 1 visit: separate classification
        WHEN cb.atendimentos = 1 THEN
          CASE
            WHEN (v_ref - cb.ultima_visita) <= 30 THEN 'AGUARDANDO_RETORNO'
            WHEN (v_ref - cb.ultima_visita) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        -- 2+ visits: cadence-based
        WHEN c.cadencia_dias IS NULL OR c.cadencia_dias = 0 THEN
          CASE
            WHEN (v_ref - cb.ultima_visita) <= 30 THEN 'ATIVO_LEVE'
            WHEN (v_ref - cb.ultima_visita) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 0.8) THEN 'ATIVO_VIP'
        WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 1.2) THEN 'ATIVO_FORTE'
        WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 1.8) THEN 'ATIVO_LEVE'
        WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 2.5) THEN 'EM_RISCO'
        ELSE 'PERDIDO'
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

-- 3. Update rpc_clientes_barbeiro_detalhe — add AGUARDANDO_RETORNO for 1-visit clients
-- First read the current function to preserve its logic, then update status_calc
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
  vendas AS (
    SELECT v.cliente_id, v.cliente_nome, v.colaborador_id, v.colaborador_nome,
           v.venda_dia, v.valor_faturamento, v.telefone
    FROM vw_vendas_kpi_base v
    WHERE v.venda_dia BETWEEN v_inicio AND v_fim
      AND v.is_credito = false
      AND v.cliente_id IS NOT NULL
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

  cadencia AS (
    SELECT
      cliente_id,
      CASE
        WHEN COUNT(DISTINCT venda_dia) < 2 THEN NULL
        ELSE ROUND(
          (MAX(venda_dia) - MIN(venda_dia))::numeric / NULLIF(COUNT(DISTINCT venda_dia) - 1, 0), 1
        )
      END AS cadencia_dias
    FROM vendas_barb
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
        -- 1 visit: separate classification
        WHEN cb.atendimentos = 1 THEN
          CASE
            WHEN (v_ref - cb.ultima_visita) <= 30 THEN 'AGUARDANDO_RETORNO'
            WHEN (v_ref - cb.ultima_visita) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        -- 2+ visits: cadence-based
        WHEN c.cadencia_dias IS NULL OR c.cadencia_dias = 0 THEN
          CASE
            WHEN (v_ref - cb.ultima_visita) <= 30 THEN 'ATIVO_LEVE'
            WHEN (v_ref - cb.ultima_visita) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 0.8) THEN 'ATIVO_VIP'
        WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 1.2) THEN 'ATIVO_FORTE'
        WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 1.8) THEN 'ATIVO_LEVE'
        WHEN (v_ref - cb.ultima_visita) <= (c.cadencia_dias * 2.5) THEN 'EM_RISCO'
        ELSE 'PERDIDO'
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
      COUNT(*) FILTER (WHERE sc.status_cliente = 'PERDIDO' AND NOT EXISTS (SELECT 1 FROM exclusivos e WHERE e.cliente_id = sc.cliente_id))::int AS para_outro,
      COUNT(*) FILTER (WHERE sc.status_cliente = 'PERDIDO' AND EXISTS (SELECT 1 FROM exclusivos e WHERE e.cliente_id = sc.cliente_id))::int AS exclusivos_perdidos
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
      ROUND(COALESCE(SUM(valor_faturamento), 0), 2)::numeric AS valor
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
      ROUND(COALESCE(AVG(valor_total), 0), 2)::numeric AS valor_medio_cliente,
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
    'perdidos_para_outro', p.para_outro,
    'exclusivos_perdidos', p.exclusivos_perdidos,
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

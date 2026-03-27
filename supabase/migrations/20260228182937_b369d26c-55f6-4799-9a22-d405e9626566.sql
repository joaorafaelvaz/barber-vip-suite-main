
-- ============================================================
-- FIX: Align rpc_clientes_drill_faixa with rpc_clientes_painel_completo
-- - Add standard filters (is_credito, produto, sem cadastro)
-- - Use valor_faturamento instead of valor_bruto
-- - Add AGUARDANDO_RETORNO for 1-visit clients
-- - Expand FAIXA_FREQ with all 9+ buckets
-- - Include cadencia_dias in output
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_clientes_drill_faixa(
  p_data_inicio text,
  p_data_fim text,
  p_ref_date text DEFAULT NULL,
  p_tipo text DEFAULT 'STATUS',
  p_valor text DEFAULT 'ATIVO_VIP',
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
      v.cliente_id,
      v.cliente_nome,
      v.colaborador_id,
      v.colaborador_nome,
      v.venda_dia,
      v.valor_faturamento,
      v.venda_id,
      v.telefone
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
      MAX(b.telefone) AS telefone,
      MIN(b.venda_dia) AS primeira_visita_periodo,
      MAX(b.venda_dia) AS ultima_visita_periodo,
      COUNT(DISTINCT b.venda_dia) AS dias_distintos,
      COUNT(DISTINCT b.venda_id) AS atendimentos,
      SUM(b.valor_faturamento) AS valor_total,
      COUNT(DISTINCT b.colaborador_id) AS qtd_barbeiros
    FROM base b
    GROUP BY b.cliente_id
  ),

  ultimo_barbeiro AS (
    SELECT DISTINCT ON (b.cliente_id)
      b.cliente_id,
      b.colaborador_id,
      b.colaborador_nome
    FROM base b
    ORDER BY b.cliente_id, b.venda_dia DESC
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
      cc.cadencia_dias,
      CASE
        -- 1 visit: separate classification
        WHEN cp.dias_distintos = 1 THEN
          CASE
            WHEN (v_ref - cp.ultima_visita_periodo) <= 30 THEN 'AGUARDANDO_RETORNO'
            WHEN (v_ref - cp.ultima_visita_periodo) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        -- 2+ visits: cadence-based
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

  -- Apply filter based on p_tipo / p_valor
  filtered AS (
    SELECT cp.*, sc.dias_sem_vir, sc.status_cliente, sc.cadencia_dias,
           ub.colaborador_id, ub.colaborador_nome
    FROM clientes_periodo cp
    JOIN status_calc sc ON sc.cliente_id = cp.cliente_id
    JOIN ultimo_barbeiro ub ON ub.cliente_id = cp.cliente_id
    WHERE
      CASE p_tipo
        WHEN 'STATUS' THEN sc.status_cliente = p_valor
        WHEN 'FAIXA_DIAS' THEN
          CASE p_valor
            WHEN 'ate_20d' THEN sc.dias_sem_vir <= 20
            WHEN '21_30d' THEN sc.dias_sem_vir BETWEEN 21 AND 30
            WHEN '31_45d' THEN sc.dias_sem_vir BETWEEN 31 AND 45
            WHEN '46_75d' THEN sc.dias_sem_vir BETWEEN 46 AND 75
            WHEN 'mais_75d' THEN sc.dias_sem_vir > 75
            ELSE TRUE
          END
        WHEN 'FAIXA_FREQ' THEN
          CASE p_valor
            WHEN 'uma_vez' THEN cp.dias_distintos = 1
            WHEN 'uma_vez_aguardando' THEN cp.dias_distintos = 1 AND sc.dias_sem_vir <= 30
            WHEN 'uma_vez_30d' THEN cp.dias_distintos = 1 AND sc.dias_sem_vir > 30 AND sc.dias_sem_vir <= 60
            WHEN 'uma_vez_60d' THEN cp.dias_distintos = 1 AND sc.dias_sem_vir > 60
            WHEN 'duas_vezes' THEN cp.dias_distintos = 2
            WHEN 'tres_quatro' THEN cp.dias_distintos BETWEEN 3 AND 4
            WHEN 'cinco_nove' THEN cp.dias_distintos BETWEEN 5 AND 9
            WHEN 'dez_doze' THEN cp.dias_distintos BETWEEN 10 AND 12
            WHEN 'treze_quinze' THEN cp.dias_distintos BETWEEN 13 AND 15
            WHEN 'dezesseis_vinte' THEN cp.dias_distintos BETWEEN 16 AND 20
            WHEN 'vinte_um_trinta' THEN cp.dias_distintos BETWEEN 21 AND 30
            WHEN 'trinta_mais' THEN cp.dias_distintos > 30
            WHEN 'dez_mais' THEN cp.dias_distintos >= 10
            ELSE TRUE
          END
        ELSE TRUE
      END
  ),

  por_barbeiro AS (
    SELECT jsonb_agg(sub ORDER BY sub.colaborador_nome) AS val
    FROM (
      SELECT
        f.colaborador_id,
        f.colaborador_nome,
        COUNT(*) AS total_clientes,
        jsonb_agg(jsonb_build_object(
          'cliente_id', f.cliente_id,
          'cliente_nome', f.cliente_nome,
          'telefone', f.telefone,
          'ultima_visita', f.ultima_visita_periodo,
          'dias_sem_vir', f.dias_sem_vir,
          'dias_distintos', f.dias_distintos,
          'valor_total', ROUND(f.valor_total, 2),
          'status_cliente', f.status_cliente,
          'cadencia_dias', ROUND(COALESCE(f.cadencia_dias, 0), 1)
        ) ORDER BY f.cliente_nome) AS clientes
      FROM filtered f
      GROUP BY f.colaborador_id, f.colaborador_nome
    ) sub
  ),

  resumo AS (
    SELECT jsonb_build_object(
      'media_dias_sem_vir', ROUND(COALESCE(AVG(f.dias_sem_vir), 0), 1),
      'media_frequencia', ROUND(COALESCE(AVG(f.dias_distintos), 0), 1),
      'valor_total', ROUND(COALESCE(SUM(f.valor_total), 0), 2),
      'ticket_medio', ROUND(COALESCE(AVG(f.valor_total / NULLIF(f.atendimentos, 0)), 0), 2)
    ) AS val
    FROM filtered f
  )

  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM filtered),
    'por_barbeiro', COALESCE((SELECT val FROM por_barbeiro), '[]'::jsonb),
    'resumo', (SELECT val FROM resumo)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

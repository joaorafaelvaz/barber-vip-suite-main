
-- =====================================================
-- 1) Replace rpc_clientes_drill_faixa: add CHURN_* cases + outros_barbeiros
-- =====================================================
CREATE OR REPLACE FUNCTION public.rpc_clientes_drill_faixa(
  p_data_inicio text DEFAULT NULL,
  p_data_fim text DEFAULT NULL,
  p_ref_date text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_valor text DEFAULT NULL,
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
  v_tipo_upper text := UPPER(COALESCE(p_tipo, 'TODOS'));
  v_janela int;
BEGIN

  -- Extract janela from p_valor for CHURN_* types (format: "60" or similar)
  IF v_tipo_upper IN ('CHURN_PERDIDO','CHURN_ATIVO','CHURN_RESGATADO') THEN
    v_janela := COALESCE(NULLIF(p_valor,'')::int, 60);
  END IF;

  -- For CHURN types, use window-based logic matching rpc_clientes_churn_resumo
  IF v_tipo_upper IN ('CHURN_PERDIDO','CHURN_ATIVO','CHURN_RESGATADO') THEN

    WITH base AS (
      SELECT
        v.cliente_id,
        v.cliente_nome,
        v.telefone,
        v.venda_dia,
        v.valor_faturamento,
        v.venda_id,
        v.colaborador_id,
        v.colaborador_nome
      FROM vw_vendas_kpi_base v
      WHERE v.is_credito = false
        AND v.produto IS NOT NULL AND v.produto <> ''
        AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
        AND v.cliente_nome NOT ILIKE '%sem cadastro%'
        AND v.venda_dia <= v_ref
        AND v.venda_dia >= (v_ref - (2 * v_janela))
    ),
    clientes_janela AS (
      SELECT
        b.cliente_id,
        MAX(b.cliente_nome) AS cliente_nome,
        MAX(b.telefone) AS telefone,
        MAX(b.venda_dia) AS ultima_visita,
        COUNT(DISTINCT b.venda_dia) AS atendimentos,
        SUM(b.valor_faturamento) AS valor_total
      FROM base b
      GROUP BY b.cliente_id
    ),
    ultimo_barb AS (
      SELECT DISTINCT ON (b.cliente_id)
        b.cliente_id, b.colaborador_id, b.colaborador_nome
      FROM base b
      ORDER BY b.cliente_id, b.venda_dia DESC
    ),
    -- Identify all barbers per client for "outros_barbeiros"
    barbeiros_por_cliente AS (
      SELECT b.cliente_id,
             jsonb_agg(DISTINCT jsonb_build_object('id', b.colaborador_id, 'nome', b.colaborador_nome))
               FILTER (WHERE b.colaborador_id IS NOT NULL) AS todos_barbeiros
      FROM base b
      GROUP BY b.cliente_id
    ),
    classified AS (
      SELECT
        cj.*,
        ub.colaborador_id,
        ub.colaborador_nome,
        (v_ref - cj.ultima_visita) AS dias_sem_vir,
        CASE
          WHEN cj.ultima_visita >= (v_ref - v_janela) THEN 'ATIVO'
          WHEN cj.ultima_visita < (v_ref - v_janela) AND cj.ultima_visita >= (v_ref - 2*v_janela) THEN 'PERDIDO'
          ELSE 'FORA'
        END AS churn_status,
        bpc.todos_barbeiros
      FROM clientes_janela cj
      JOIN ultimo_barb ub ON ub.cliente_id = cj.cliente_id
      LEFT JOIN barbeiros_por_cliente bpc ON bpc.cliente_id = cj.cliente_id
    ),
    -- Resgatados: currently active but were outside window in previous period
    resgatados AS (
      SELECT c.cliente_id
      FROM classified c
      WHERE c.churn_status = 'ATIVO'
        AND EXISTS (
          SELECT 1 FROM vw_vendas_kpi_base v2
          WHERE v2.cliente_id = c.cliente_id
            AND v2.is_credito = false
            AND v2.produto IS NOT NULL AND v2.produto <> ''
            AND v2.venda_dia < (v_ref - v_janela)
            AND v2.venda_dia >= (v_ref - 3*v_janela)
          HAVING MAX(v2.venda_dia) < (v_ref - 2*v_janela)
        )
    ),
    filtered AS (
      SELECT c.*,
             -- Remove the "ultimo barbeiro" from outros_barbeiros to get only "others"
             CASE
               WHEN jsonb_array_length(COALESCE(c.todos_barbeiros,'[]'::jsonb)) > 1
               THEN (
                 SELECT jsonb_agg(elem)
                 FROM jsonb_array_elements(c.todos_barbeiros) elem
                 WHERE elem->>'id' <> c.colaborador_id
               )
               ELSE NULL
             END AS outros_barbeiros
      FROM classified c
      WHERE
        CASE v_tipo_upper
          WHEN 'CHURN_PERDIDO' THEN c.churn_status = 'PERDIDO'
          WHEN 'CHURN_ATIVO' THEN c.churn_status = 'ATIVO'
          WHEN 'CHURN_RESGATADO' THEN c.cliente_id IN (SELECT r.cliente_id FROM resgatados r)
        END
        AND (p_colaborador_id IS NULL OR c.colaborador_id = p_colaborador_id)
    )
    SELECT jsonb_build_object(
      'total', (SELECT COUNT(*) FROM filtered),
      'rows', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'cliente_id', f.cliente_id,
          'cliente_nome', f.cliente_nome,
          'telefone', f.telefone,
          'atendimentos', f.atendimentos,
          'valor_total', ROUND(f.valor_total::numeric, 2),
          'ultima_visita', f.ultima_visita::text,
          'dias_sem_vir', f.dias_sem_vir,
          'colaborador_nome', f.colaborador_nome,
          'colaborador_id', f.colaborador_id,
          'outros_barbeiros', f.outros_barbeiros
        ) ORDER BY f.valor_total DESC)
        FROM filtered f
      ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;

  END IF;

  -- ===== Original logic for non-CHURN types =====
  WITH
  base AS (
    SELECT
      v.cliente_id, v.cliente_nome, v.colaborador_id, v.colaborador_nome,
      v.venda_dia, v.valor_faturamento, v.venda_id, v.telefone
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
      b.cliente_id, b.colaborador_id, b.colaborador_nome
    FROM base b
    ORDER BY b.cliente_id, b.venda_dia DESC
  ),
  -- outros_barbeiros for non-churn types too
  barbeiros_por_cliente AS (
    SELECT b.cliente_id,
           jsonb_agg(DISTINCT jsonb_build_object('id', b.colaborador_id, 'nome', b.colaborador_nome))
             FILTER (WHERE b.colaborador_id IS NOT NULL) AS todos_barbeiros
    FROM base b
    GROUP BY b.cliente_id
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
        WHEN COUNT(dia_anterior) >= 1 THEN AVG((venda_dia - dia_anterior)::numeric)
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
      cp.cliente_id, cp.dias_distintos,
      (v_ref - cp.ultima_visita_periodo) AS dias_sem_vir,
      cc.cadencia_dias,
      CASE
        WHEN cp.dias_distintos = 1 AND cc.cadencia_dias IS NULL THEN
          CASE
            WHEN (v_ref - cp.ultima_visita_periodo) <= 30 THEN 'AGUARDANDO_RETORNO'
            WHEN (v_ref - cp.ultima_visita_periodo) <= 75 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        WHEN cc.cadencia_dias IS NOT NULL AND cc.cadencia_dias > 0 THEN
          CASE
            WHEN (v_ref - cp.ultima_visita_periodo) <= cc.cadencia_dias * 0.8 THEN 'ATIVO_VIP'
            WHEN (v_ref - cp.ultima_visita_periodo) <= cc.cadencia_dias * 1.2 THEN 'ATIVO_FORTE'
            WHEN (v_ref - cp.ultima_visita_periodo) <= cc.cadencia_dias * 1.8 THEN 'ATIVO_LEVE'
            WHEN (v_ref - cp.ultima_visita_periodo) <= cc.cadencia_dias * 2.5 THEN 'EM_RISCO'
            ELSE 'PERDIDO'
          END
        ELSE
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

  filtered AS (
    SELECT cp.*, sc.dias_sem_vir, sc.status_cliente, sc.cadencia_dias,
           ub.colaborador_id, ub.colaborador_nome,
           dc.first_seen,
           CASE
             WHEN jsonb_array_length(COALESCE(bpc.todos_barbeiros,'[]'::jsonb)) > 1
             THEN (
               SELECT jsonb_agg(elem)
               FROM jsonb_array_elements(bpc.todos_barbeiros) elem
               WHERE elem->>'id' <> ub.colaborador_id
             )
             ELSE NULL
           END AS outros_barbeiros
    FROM clientes_periodo cp
    JOIN status_calc sc ON sc.cliente_id = cp.cliente_id
    JOIN ultimo_barbeiro ub ON ub.cliente_id = cp.cliente_id
    LEFT JOIN dimensao_clientes dc ON dc.cliente_id = cp.cliente_id
    LEFT JOIN barbeiros_por_cliente bpc ON bpc.cliente_id = cp.cliente_id
    WHERE
      CASE UPPER(COALESCE(p_tipo, 'TODOS'))
        WHEN 'STATUS' THEN
          CASE UPPER(COALESCE(p_valor, ''))
            WHEN 'ATIVO' THEN sc.status_cliente IN ('ATIVO_VIP', 'ATIVO_FORTE', 'ATIVO_LEVE')
            WHEN 'PERDIDO' THEN sc.status_cliente = 'PERDIDO'
            WHEN 'RESGATADO' THEN
              dc.first_seen IS NOT NULL AND dc.first_seen < v_inicio
              AND sc.status_cliente IN ('ATIVO_VIP', 'ATIVO_FORTE', 'ATIVO_LEVE', 'AGUARDANDO_RETORNO')
              AND cp.primeira_visita_periodo >= v_inicio
            ELSE sc.status_cliente = UPPER(p_valor)
          END
        WHEN 'COHORT' THEN
          dc.first_seen IS NOT NULL AND TO_CHAR(dc.first_seen, 'YYYY-MM') = p_valor
        WHEN 'DIAS' THEN
          CASE p_valor
            WHEN 'ate_20d' THEN sc.dias_sem_vir <= 20
            WHEN '21_30d' THEN sc.dias_sem_vir BETWEEN 21 AND 30
            WHEN '31_45d' THEN sc.dias_sem_vir BETWEEN 31 AND 45
            WHEN '46_75d' THEN sc.dias_sem_vir BETWEEN 46 AND 75
            WHEN 'mais_75d' THEN sc.dias_sem_vir > 75
            ELSE true
          END
        WHEN 'FAIXA_DIAS' THEN
          CASE p_valor
            WHEN 'ate_20d' THEN sc.dias_sem_vir <= 20
            WHEN '21_30d' THEN sc.dias_sem_vir BETWEEN 21 AND 30
            WHEN '31_45d' THEN sc.dias_sem_vir BETWEEN 31 AND 45
            WHEN '46_75d' THEN sc.dias_sem_vir BETWEEN 46 AND 75
            WHEN 'mais_75d' THEN sc.dias_sem_vir > 75
            ELSE true
          END
        WHEN 'FREQUENCIA' THEN
          CASE p_valor
            WHEN 'uma_vez' THEN cp.dias_distintos = 1
            WHEN 'uma_vez_aguardando' THEN cp.dias_distintos = 1 AND sc.dias_sem_vir <= 30
            WHEN 'uma_vez_30d' THEN cp.dias_distintos = 1 AND sc.dias_sem_vir > 30 AND sc.dias_sem_vir <= 60
            WHEN 'uma_vez_60d' THEN cp.dias_distintos = 1 AND sc.dias_sem_vir > 60
            WHEN 'uma_vez_novo' THEN cp.dias_distintos = 1 AND dc.first_seen IS NOT NULL AND dc.first_seen >= v_inicio AND dc.first_seen <= v_fim
            WHEN 'uma_vez_novo_aguardando' THEN cp.dias_distintos = 1 AND dc.first_seen IS NOT NULL AND dc.first_seen >= v_inicio AND dc.first_seen <= v_fim AND sc.dias_sem_vir <= 30
            WHEN 'uma_vez_novo_30d' THEN cp.dias_distintos = 1 AND dc.first_seen IS NOT NULL AND dc.first_seen >= v_inicio AND dc.first_seen <= v_fim AND sc.dias_sem_vir > 30 AND sc.dias_sem_vir <= 60
            WHEN 'uma_vez_novo_60d' THEN cp.dias_distintos = 1 AND dc.first_seen IS NOT NULL AND dc.first_seen >= v_inicio AND dc.first_seen <= v_fim AND sc.dias_sem_vir > 60
            WHEN 'duas_vezes' THEN cp.dias_distintos = 2
            WHEN 'tres_quatro' THEN cp.dias_distintos BETWEEN 3 AND 4
            WHEN 'cinco_nove' THEN cp.dias_distintos BETWEEN 5 AND 9
            WHEN 'dez_doze' THEN cp.dias_distintos BETWEEN 10 AND 12
            WHEN 'treze_quinze' THEN cp.dias_distintos BETWEEN 13 AND 15
            WHEN 'dezesseis_vinte' THEN cp.dias_distintos BETWEEN 16 AND 20
            WHEN 'vinte_um_trinta' THEN cp.dias_distintos BETWEEN 21 AND 30
            WHEN 'trinta_mais' THEN cp.dias_distintos > 30
            ELSE true
          END
        WHEN 'TODOS' THEN true
        ELSE true
      END
  )

  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM filtered),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'cliente_id', f.cliente_id,
        'cliente_nome', f.cliente_nome,
        'telefone', f.telefone,
        'dias_distintos', f.dias_distintos,
        'atendimentos', f.atendimentos,
        'valor_total', ROUND(f.valor_total::numeric, 2),
        'ultima_visita', f.ultima_visita_periodo::text,
        'dias_sem_vir', f.dias_sem_vir,
        'status', f.status_cliente,
        'cadencia_dias', ROUND(f.cadencia_dias::numeric, 0),
        'colaborador_nome', f.colaborador_nome,
        'colaborador_id', f.colaborador_id,
        'first_seen', f.first_seen::text,
        'outros_barbeiros', f.outros_barbeiros
      ) ORDER BY f.valor_total DESC)
      FROM filtered f
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =====================================================
-- 2) New RPC: rpc_clientes_saldo_base
-- =====================================================
CREATE OR REPLACE FUNCTION public.rpc_clientes_saldo_base(
  p_ref text,
  p_janela_dias int DEFAULT 60,
  p_excluir_sem_cadastro boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref date := p_ref::date;
  v_cutoff date := v_ref - p_janela_dias;
  v_cutoff2 date := v_ref - (2 * p_janela_dias);
  v_prev_ref date := v_ref - p_janela_dias;
  v_prev_cutoff date := v_prev_ref - p_janela_dias;
  v_result jsonb;
BEGIN
  WITH vendas_filtered AS (
    SELECT v.cliente_id, v.cliente_nome, v.venda_dia
    FROM vw_vendas_kpi_base v
    WHERE v.is_credito = false
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND (NOT p_excluir_sem_cadastro OR v.cliente_nome NOT ILIKE '%sem cadastro%')
  ),
  -- Base at start of current window: clients active in prev window
  base_inicio_set AS (
    SELECT DISTINCT vf.cliente_id
    FROM vendas_filtered vf
    WHERE vf.venda_dia >= v_prev_cutoff AND vf.venda_dia <= v_prev_ref
  ),
  -- Current active: visited within current window
  base_atual_set AS (
    SELECT DISTINCT vf.cliente_id
    FROM vendas_filtered vf
    WHERE vf.venda_dia > v_cutoff AND vf.venda_dia <= v_ref
  ),
  -- Novos: first_seen within current window
  novos_set AS (
    SELECT dc.cliente_id
    FROM dimensao_clientes dc
    WHERE dc.first_seen > v_cutoff AND dc.first_seen <= v_ref
      AND (NOT p_excluir_sem_cadastro OR dc.cliente_nome NOT ILIKE '%sem cadastro%')
  ),
  -- Novos que ficaram (estão na base atual)
  novos_ficaram AS (
    SELECT n.cliente_id FROM novos_set n
    WHERE n.cliente_id IN (SELECT ba.cliente_id FROM base_atual_set ba)
  ),
  -- Saíram: were in base_inicio but NOT in base_atual
  sairam_set AS (
    SELECT bi.cliente_id FROM base_inicio_set bi
    WHERE bi.cliente_id NOT IN (SELECT ba.cliente_id FROM base_atual_set ba)
  )
  SELECT jsonb_build_object(
    'base_inicio', (SELECT count(*) FROM base_inicio_set),
    'novos_entraram', (SELECT count(*) FROM novos_set),
    'novos_ficaram', (SELECT count(*) FROM novos_ficaram),
    'sairam', (SELECT count(*) FROM sairam_set),
    'base_atual', (SELECT count(*) FROM base_atual_set),
    'saldo', (SELECT count(*) FROM base_atual_set) - (SELECT count(*) FROM base_inicio_set)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

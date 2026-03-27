
CREATE OR REPLACE FUNCTION public.rpc_clientes_drill_faixa(
  p_data_inicio text, p_data_fim text, p_ref_date text DEFAULT NULL::text,
  p_tipo text DEFAULT NULL::text, p_valor text DEFAULT NULL::text,
  p_colaborador_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout = '120s'
AS $function$
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
           dc.first_seen
    FROM clientes_periodo cp
    JOIN status_calc sc ON sc.cliente_id = cp.cliente_id
    JOIN ultimo_barbeiro ub ON ub.cliente_id = cp.cliente_id
    LEFT JOIN dimensao_clientes dc ON dc.cliente_id = cp.cliente_id
    WHERE
      CASE UPPER(COALESCE(p_tipo, 'TODOS'))
        WHEN 'STATUS' THEN
          CASE UPPER(COALESCE(p_valor, ''))
            WHEN 'ATIVO' THEN sc.status_cliente IN ('ATIVO_VIP', 'ATIVO_FORTE', 'ATIVO_LEVE')
            WHEN 'PERDIDO' THEN sc.status_cliente = 'PERDIDO'
            WHEN 'RESGATADO' THEN
              -- Resgatados: clientes que estavam perdidos (first_seen < v_inicio) e voltaram no período
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
        'first_seen', f.first_seen::text
      ) ORDER BY f.valor_total DESC)
      FROM filtered f
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

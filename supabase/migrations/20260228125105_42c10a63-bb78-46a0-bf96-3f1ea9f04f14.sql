
-- ============================================================
-- 1) Fix rpc_clientes_novos_resumo: limit base CTE to avoid full table scan
-- 2) Fix rpc_clientes_painel_completo: use valor_faturamento instead of valor_bruto
-- ============================================================

-- 1) Optimized rpc_clientes_novos_resumo
CREATE OR REPLACE FUNCTION public.rpc_clientes_novos_resumo(
  p_data_inicio text,
  p_data_fim text,
  p_ref_date text DEFAULT NULL,
  p_janela_conversao int DEFAULT 60,
  p_excluir_sem_cadastro boolean DEFAULT true
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
  -- OPTIMIZATION: Only scan data from (inicio - 5 years) to (ref + janela_conversao)
  -- This avoids full table scan that caused timeouts on multi-year queries
  base AS (
    SELECT
      v.cliente_id,
      v.cliente_nome,
      v.colaborador_id,
      v.colaborador_nome,
      v.tipo_colaborador,
      v.venda_dia,
      v.valor_faturamento,
      v.venda_id
    FROM vw_vendas_kpi_base v
    WHERE v.cliente_id IS NOT NULL
      AND v.cliente_id <> ''
      AND v.produto IS NOT NULL
      AND v.produto <> ''
      AND NOT v.is_credito
      AND v.venda_dia >= (v_inicio - interval '5 years')::date
      AND v.venda_dia <= (v_ref + p_janela_conversao)
      AND (NOT p_excluir_sem_cadastro OR lower(v.cliente_nome) NOT LIKE '%sem cadastro%')
  ),

  first_seen_global AS (
    SELECT cliente_id, MIN(venda_dia) AS first_seen
    FROM base
    GROUP BY cliente_id
  ),

  novos AS (
    SELECT fs.cliente_id, fs.first_seen
    FROM first_seen_global fs
    WHERE fs.first_seen BETWEEN v_inicio AND v_fim
  ),

  barbeiro_aquisicao AS (
    SELECT DISTINCT ON (n.cliente_id)
      n.cliente_id,
      b.colaborador_id AS barb_id,
      b.colaborador_nome AS barb_nome
    FROM novos n
    JOIN base b ON b.cliente_id = n.cliente_id
                AND b.venda_dia = n.first_seen
    JOIN dimensao_colaboradores dc ON dc.colaborador_id = b.colaborador_id
                                   AND dc.tipo_colaborador = 'barbeiro'
    ORDER BY n.cliente_id, b.venda_dia, b.colaborador_id
  ),

  visitas_futuras AS (
    SELECT
      n.cliente_id,
      n.first_seen,
      b.venda_dia,
      b.colaborador_id,
      (b.venda_dia - n.first_seen) AS dias_apos
    FROM novos n
    JOIN base b ON b.cliente_id = n.cliente_id AND b.venda_dia > n.first_seen
  ),

  metricas_novo AS (
    SELECT
      n.cliente_id,
      n.first_seen,
      EXISTS (SELECT 1 FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id AND vf.dias_apos <= 30) AS ret_30d,
      EXISTS (SELECT 1 FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id AND vf.dias_apos <= 60) AS ret_60d,
      EXISTS (SELECT 1 FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id AND vf.dias_apos <= 90) AS ret_90d,
      (SELECT COUNT(DISTINCT venda_dia) FROM base bb WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS dias_visita_conv,
      (SELECT COUNT(DISTINCT bb.colaborador_id) FROM base bb
        JOIN dimensao_colaboradores dc2 ON dc2.colaborador_id = bb.colaborador_id AND dc2.tipo_colaborador = 'barbeiro'
        WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS qtd_barbeiros_conv,
      (SELECT MIN(vf.venda_dia) FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id) AS segunda_visita,
      (SELECT COALESCE(SUM(bb.valor_faturamento), 0) FROM base bb
        WHERE bb.cliente_id = n.cliente_id AND bb.venda_dia = n.first_seen) AS ticket_first,
      EXISTS (SELECT 1 FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id AND vf.dias_apos <= 21) AS voltou_21d
    FROM novos n
  ),

  unicos_periodo AS (
    SELECT COUNT(DISTINCT cliente_id) AS total
    FROM base
    WHERE venda_dia BETWEEN v_inicio AND v_fim
  ),

  ticket_recorrente AS (
    SELECT ROUND(AVG(gasto_por_visita)::numeric, 2) AS val
    FROM (
      SELECT mn.cliente_id, bb.venda_dia,
             SUM(bb.valor_faturamento) AS gasto_por_visita
      FROM metricas_novo mn
      JOIN base bb ON bb.cliente_id = mn.cliente_id
        AND bb.venda_dia BETWEEN mn.first_seen AND mn.first_seen + p_janela_conversao
      WHERE mn.dias_visita_conv >= 2
      GROUP BY mn.cliente_id, bb.venda_dia
    ) sub
  ),

  kpis AS (
    SELECT jsonb_build_object(
      'novos_total', (SELECT COUNT(*) FROM novos),
      'pct_novos_sobre_unicos', CASE WHEN (SELECT total FROM unicos_periodo) > 0
        THEN ROUND(100.0 * (SELECT COUNT(*) FROM novos) / (SELECT total FROM unicos_periodo), 1) ELSE 0 END,
      'retencao_30d', ROUND(100.0 * COUNT(*) FILTER (WHERE ret_30d) / NULLIF(COUNT(*), 0), 1),
      'retencao_60d', ROUND(100.0 * COUNT(*) FILTER (WHERE ret_60d) / NULLIF(COUNT(*), 0), 1),
      'retencao_90d', ROUND(100.0 * COUNT(*) FILTER (WHERE ret_90d) / NULLIF(COUNT(*), 0), 1),
      'pct_recorrente_60d', ROUND(100.0 * COUNT(*) FILTER (WHERE dias_visita_conv >= 2) / NULLIF(COUNT(*), 0), 1),
      'tempo_mediano_2a_visita', (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (segunda_visita - first_seen))
        FROM metricas_novo WHERE segunda_visita IS NOT NULL),
      'tempo_medio_2a_visita', (SELECT ROUND(AVG(segunda_visita - first_seen)::numeric, 1)
        FROM metricas_novo WHERE segunda_visita IS NOT NULL),
      'pct_voltou_ate_21d', ROUND(100.0 * COUNT(*) FILTER (WHERE voltou_21d) / NULLIF(COUNT(*), 0), 1),
      'ticket_primeira_visita', ROUND(AVG(ticket_first)::numeric, 2),
      'ticket_medio_recorrente', (SELECT val FROM ticket_recorrente),
      'novos_exclusivos', COUNT(*) FILTER (WHERE qtd_barbeiros_conv = 1 AND dias_visita_conv >= 2),
      'novos_compartilhados', COUNT(*) FILTER (WHERE qtd_barbeiros_conv > 1),
      'pct_novos_exclusivos', ROUND(100.0 * COUNT(*) FILTER (WHERE qtd_barbeiros_conv = 1 AND dias_visita_conv >= 2)
        / NULLIF(COUNT(*), 0), 1)
    ) AS val
    FROM metricas_novo
  ),

  por_barbeiro AS (
    SELECT jsonb_agg(row_obj ORDER BY novos DESC) AS val
    FROM (
      SELECT jsonb_build_object(
        'colaborador_id', ba.barb_id,
        'colaborador_nome', ba.barb_nome,
        'novos', COUNT(DISTINCT ba.cliente_id),
        'retencao_30d', ROUND(100.0 * COUNT(DISTINCT ba.cliente_id) FILTER (WHERE mn.ret_30d) / NULLIF(COUNT(DISTINCT ba.cliente_id), 0), 1),
        'retencao_60d', ROUND(100.0 * COUNT(DISTINCT ba.cliente_id) FILTER (WHERE mn.ret_60d) / NULLIF(COUNT(DISTINCT ba.cliente_id), 0), 1),
        'pct_recorrente_60d', ROUND(100.0 * COUNT(DISTINCT ba.cliente_id) FILTER (WHERE mn.dias_visita_conv >= 2) / NULLIF(COUNT(DISTINCT ba.cliente_id), 0), 1),
        'pct_fieis', ROUND(100.0 * COUNT(DISTINCT ba.cliente_id) FILTER (WHERE mn.qtd_barbeiros_conv = 1 AND mn.dias_visita_conv >= 2) / NULLIF(COUNT(DISTINCT ba.cliente_id), 0), 1),
        'ticket_medio_novo', ROUND(AVG(mn.ticket_first)::numeric, 2)
      ) AS row_obj, COUNT(DISTINCT ba.cliente_id) AS novos
      FROM barbeiro_aquisicao ba
      JOIN metricas_novo mn ON mn.cliente_id = ba.cliente_id
      GROUP BY ba.barb_id, ba.barb_nome
    ) sub
  ),

  tendencia AS (
    SELECT jsonb_agg(jsonb_build_object(
      'semana_inicio', semana_inicio,
      'novos', novos
    ) ORDER BY semana_inicio) AS val
    FROM (
      SELECT date_trunc('week', n.first_seen)::date AS semana_inicio,
             COUNT(*) AS novos
      FROM novos n
      GROUP BY 1
    ) sub
  ),

  cohort AS (
    SELECT jsonb_agg(jsonb_build_object(
      'mes', mes,
      'novos', novos,
      'ret_30d', ret_30d,
      'ret_60d', ret_60d,
      'ret_90d', ret_90d,
      'pct_ret_30d', CASE WHEN novos > 0 THEN ROUND(100.0 * ret_30d / novos, 1) ELSE 0 END,
      'pct_ret_60d', CASE WHEN novos > 0 THEN ROUND(100.0 * ret_60d / novos, 1) ELSE 0 END,
      'pct_ret_90d', CASE WHEN novos > 0 THEN ROUND(100.0 * ret_90d / novos, 1) ELSE 0 END
    ) ORDER BY mes) AS val
    FROM (
      SELECT
        to_char(mn.first_seen, 'YYYY-MM') AS mes,
        COUNT(*) AS novos,
        COUNT(*) FILTER (WHERE mn.ret_30d) AS ret_30d,
        COUNT(*) FILTER (WHERE mn.ret_60d) AS ret_60d,
        COUNT(*) FILTER (WHERE mn.ret_90d) AS ret_90d
      FROM metricas_novo mn
      GROUP BY 1
    ) sub
  )

  SELECT jsonb_build_object(
    'kpis', (SELECT val FROM kpis),
    'por_barbeiro_aquisicao', COALESCE((SELECT val FROM por_barbeiro), '[]'::jsonb),
    'tendencia_semanal', COALESCE((SELECT val FROM tendencia), '[]'::jsonb),
    'cohort_mensal', COALESCE((SELECT val FROM cohort), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- 2) Fix rpc_clientes_painel_completo: valor_bruto → valor_faturamento
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
      v.cliente_id,
      v.cliente_nome,
      v.colaborador_id,
      v.colaborador_nome,
      v.venda_dia,
      v.valor_faturamento,
      v.venda_id
    FROM vw_vendas_kpi_base v
    WHERE v.venda_dia BETWEEN v_inicio AND v_fim
      AND v.cliente_id IS NOT NULL
      AND v.cliente_id <> ''
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
    SELECT
      v.cliente_id,
      MIN(v.venda_dia) AS primeira_visita_historica
    FROM vw_vendas_kpi_base v
    WHERE v.cliente_id IS NOT NULL AND v.cliente_id <> ''
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
    SELECT
      v.cliente_id,
      v.venda_dia
    FROM vw_vendas_kpi_base v
    WHERE v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.venda_dia <= v_ref
      AND v.venda_dia >= (v_inicio - interval '3 years')::date
      AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
    GROUP BY v.cliente_id, v.venda_dia
  ),
  dias_cliente AS (
    SELECT
      cliente_id,
      venda_dia,
      LAG(venda_dia) OVER (PARTITION BY cliente_id ORDER BY venda_dia) AS dia_anterior
    FROM historico_visitas
  ),
  cadencia_calc AS (
    SELECT
      cliente_id,
      AVG(venda_dia - dia_anterior) AS cadencia_bruta,
      CASE
        WHEN COUNT(dia_anterior) >= 3 THEN
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (venda_dia - dia_anterior)::numeric)
        WHEN COUNT(dia_anterior) >= 1 THEN
          AVG(venda_dia - dia_anterior)
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
      (v_ref - cp.ultima_visita_periodo) AS dias_sem_vir,
      cc.cadencia_dias,
      cc.cadencia_metodo,
      CASE
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
    SELECT jsonb_agg(jsonb_build_object(
      'status', sub.status_cliente,
      'count', sub.cnt
    ) ORDER BY sub.ord) AS val
    FROM (
      SELECT
        sc.status_cliente,
        COUNT(*) AS cnt,
        CASE sc.status_cliente
          WHEN 'ATIVO_VIP' THEN 1
          WHEN 'ATIVO_FORTE' THEN 2
          WHEN 'ATIVO_LEVE' THEN 3
          WHEN 'EM_RISCO' THEN 4
          WHEN 'PERDIDO' THEN 5
          ELSE 6
        END AS ord
      FROM status_calc sc
      GROUP BY sc.status_cliente
    ) sub
  ),

  mensal AS (
    SELECT jsonb_agg(jsonb_build_object(
      'ano_mes', sub.ano_mes,
      'clientes_unicos', sub.clientes_unicos,
      'clientes_novos', sub.clientes_novos,
      'atendimentos', sub.atendimentos,
      'valor', sub.valor
    ) ORDER BY sub.ano_mes) AS val
    FROM (
      SELECT
        TO_CHAR(b.venda_dia, 'YYYY-MM') AS ano_mes,
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
      'colaborador_id', sub.colaborador_id,
      'colaborador_nome', sub.colaborador_nome,
      'clientes_unicos', sub.clientes_unicos,
      'clientes_novos', sub.clientes_novos,
      'clientes_exclusivos', sub.clientes_exclusivos,
      'valor_total', sub.valor_total
    ) ORDER BY sub.clientes_unicos DESC) AS val
    FROM (
      SELECT
        b.colaborador_id,
        MAX(b.colaborador_nome) AS colaborador_nome,
        COUNT(DISTINCT b.cliente_id) AS clientes_unicos,
        COUNT(DISTINCT b.cliente_id) FILTER (
          WHERE b.cliente_id IN (SELECT n.cliente_id FROM novos n)
        ) AS clientes_novos,
        COUNT(DISTINCT b.cliente_id) FILTER (
          WHERE b.cliente_id IN (
            SELECT cp2.cliente_id FROM clientes_periodo cp2 WHERE cp2.qtd_barbeiros = 1
          )
        ) AS clientes_exclusivos,
        SUM(b.valor_faturamento) AS valor_total
      FROM base b
      WHERE b.colaborador_id IS NOT NULL
      GROUP BY b.colaborador_id
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
      'duas_vezes', COUNT(*) FILTER (WHERE cp.dias_distintos = 2),
      'tres_quatro', COUNT(*) FILTER (WHERE cp.dias_distintos BETWEEN 3 AND 4),
      'cinco_nove', COUNT(*) FILTER (WHERE cp.dias_distintos BETWEEN 5 AND 9),
      'dez_mais', COUNT(*) FILTER (WHERE cp.dias_distintos >= 10)
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
    'periodo', jsonb_build_object(
      'data_inicio', v_inicio,
      'data_fim', v_fim,
      'ref_date', v_ref
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

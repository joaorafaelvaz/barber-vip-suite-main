
-- ============================================================
-- Fix: Subdividir NAO_RETORNOU em AGUARDANDO, NAO_30D, NAO_60D
-- em rpc_clientes_novos_resumo e rpc_clientes_novos_drill_retencao
-- ============================================================

-- 1. Update rpc_clientes_novos_resumo
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
  novos AS (
    SELECT dc.cliente_id, dc.first_seen
    FROM dimensao_clientes dc
    WHERE dc.first_seen BETWEEN v_inicio AND v_fim
      AND dc.cliente_id IS NOT NULL
      AND dc.cliente_id <> ''
      AND (NOT p_excluir_sem_cadastro OR lower(dc.cliente_nome) NOT LIKE '%sem cadastro%')
  ),

  vendas_novos AS (
    SELECT
      v.cliente_id,
      v.colaborador_id,
      v.colaborador_nome,
      v.venda_dia,
      v.valor_faturamento
    FROM vw_vendas_kpi_base v
    WHERE v.cliente_id IN (SELECT cliente_id FROM novos)
      AND v.venda_dia >= v_inicio
      AND v.venda_dia <= (v_ref + p_janela_conversao)
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND NOT v.is_credito
      AND (NOT p_excluir_sem_cadastro OR lower(v.cliente_nome) NOT LIKE '%sem cadastro%')
  ),

  barbeiro_aquisicao AS (
    SELECT DISTINCT ON (n.cliente_id)
      n.cliente_id,
      vn.colaborador_id AS barb_id,
      vn.colaborador_nome AS barb_nome
    FROM novos n
    JOIN vendas_novos vn ON vn.cliente_id = n.cliente_id AND vn.venda_dia = n.first_seen
    JOIN dimensao_colaboradores dc ON dc.colaborador_id = vn.colaborador_id AND dc.tipo_colaborador = 'barbeiro'
    ORDER BY n.cliente_id, vn.venda_dia, vn.colaborador_id
  ),

  visitas_futuras AS (
    SELECT
      n.cliente_id,
      n.first_seen,
      vn.venda_dia,
      vn.colaborador_id,
      (vn.venda_dia - n.first_seen) AS dias_apos
    FROM novos n
    JOIN vendas_novos vn ON vn.cliente_id = n.cliente_id AND vn.venda_dia > n.first_seen
  ),

  metricas_novo AS (
    SELECT
      n.cliente_id,
      n.first_seen,
      EXISTS (SELECT 1 FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id AND vf.dias_apos <= 30) AS ret_30d,
      EXISTS (SELECT 1 FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id AND vf.dias_apos <= 60) AS ret_60d,
      EXISTS (SELECT 1 FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id AND vf.dias_apos <= 90) AS ret_90d,
      (SELECT COUNT(DISTINCT venda_dia) FROM vendas_novos bb WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS dias_visita_conv,
      (SELECT COUNT(DISTINCT bb.colaborador_id) FROM vendas_novos bb
        JOIN dimensao_colaboradores dc2 ON dc2.colaborador_id = bb.colaborador_id AND dc2.tipo_colaborador = 'barbeiro'
        WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS qtd_barbeiros_conv,
      (SELECT MIN(vf.venda_dia) FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id) AS segunda_visita,
      (SELECT COALESCE(SUM(bb.valor_faturamento), 0) FROM vendas_novos bb
        WHERE bb.cliente_id = n.cliente_id AND bb.venda_dia = n.first_seen) AS ticket_first,
      EXISTS (SELECT 1 FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id AND vf.dias_apos <= 21) AS voltou_21d,
      (SELECT MIN(vf.dias_apos) FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id) AS dias_ate_retorno
    FROM novos n
  ),

  unicos_periodo AS (
    SELECT COUNT(DISTINCT cliente_id) AS total
    FROM vw_vendas_kpi_base
    WHERE venda_dia BETWEEN v_inicio AND v_fim
      AND cliente_id IS NOT NULL AND cliente_id <> ''
      AND produto IS NOT NULL AND produto <> ''
      AND NOT is_credito
  ),

  ticket_recorrente AS (
    SELECT ROUND(AVG(gasto_por_visita)::numeric, 2) AS val
    FROM (
      SELECT mn.cliente_id, bb.venda_dia,
             SUM(bb.valor_faturamento) AS gasto_por_visita
      FROM metricas_novo mn
      JOIN vendas_novos bb ON bb.cliente_id = mn.cliente_id
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

  -- UPDATED: Retention distribution with subdivided non-return faixas
  retencao_dist AS (
    SELECT jsonb_agg(jsonb_build_object(
      'faixa', faixa,
      'count', cnt,
      'pct', CASE WHEN total > 0 THEN ROUND(100.0 * cnt / total, 1) ELSE 0 END
    ) ORDER BY faixa_order) AS val
    FROM (
      SELECT
        CASE
          WHEN dias_ate_retorno IS NOT NULL AND dias_ate_retorno <= 30 THEN 'ATE_30D'
          WHEN dias_ate_retorno IS NOT NULL AND dias_ate_retorno <= 45 THEN '31_45D'
          WHEN dias_ate_retorno IS NOT NULL THEN '46_60D'
          -- Subdivided non-return faixas based on time since first visit
          WHEN (v_ref - first_seen) <= 30 THEN 'AGUARDANDO'
          WHEN (v_ref - first_seen) <= 60 THEN 'NAO_30D'
          ELSE 'NAO_60D'
        END AS faixa,
        CASE
          WHEN dias_ate_retorno IS NOT NULL AND dias_ate_retorno <= 30 THEN 1
          WHEN dias_ate_retorno IS NOT NULL AND dias_ate_retorno <= 45 THEN 2
          WHEN dias_ate_retorno IS NOT NULL THEN 3
          WHEN (v_ref - first_seen) <= 30 THEN 4
          WHEN (v_ref - first_seen) <= 60 THEN 5
          ELSE 6
        END AS faixa_order,
        COUNT(*) AS cnt,
        (SELECT COUNT(*) FROM metricas_novo) AS total
      FROM metricas_novo
      GROUP BY 1, 2
    ) sub
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
    'cohort_mensal', COALESCE((SELECT val FROM cohort), '[]'::jsonb),
    'retencao_distribuicao', COALESCE((SELECT val FROM retencao_dist), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 2. Update rpc_clientes_novos_drill_retencao with subdivided faixas
CREATE OR REPLACE FUNCTION public.rpc_clientes_novos_drill_retencao(
  p_data_inicio text,
  p_data_fim text,
  p_faixa text DEFAULT 'ATE_30D',
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
  novos AS (
    SELECT dc.cliente_id, dc.first_seen, dc.cliente_nome, dc.telefone
    FROM dimensao_clientes dc
    WHERE dc.first_seen BETWEEN v_inicio AND v_fim
      AND dc.cliente_id IS NOT NULL AND dc.cliente_id <> ''
      AND (NOT p_excluir_sem_cadastro OR lower(dc.cliente_nome) NOT LIKE '%sem cadastro%')
  ),

  vendas_novos AS (
    SELECT v.cliente_id, v.colaborador_id, v.colaborador_nome, v.venda_dia, v.valor_faturamento
    FROM vw_vendas_kpi_base v
    WHERE v.cliente_id IN (SELECT cliente_id FROM novos)
      AND v.venda_dia >= v_inicio
      AND v.venda_dia <= (v_fim + p_janela_conversao)
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND NOT v.is_credito
  ),

  visitas_futuras AS (
    SELECT n.cliente_id, n.first_seen,
           vn.venda_dia, vn.colaborador_id, vn.colaborador_nome,
           (vn.venda_dia - n.first_seen) AS dias_apos
    FROM novos n
    JOIN vendas_novos vn ON vn.cliente_id = n.cliente_id AND vn.venda_dia > n.first_seen
  ),

  metricas AS (
    SELECT
      n.cliente_id, n.first_seen, n.cliente_nome, n.telefone,
      (SELECT MIN(vf.dias_apos) FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id) AS dias_ate_retorno,
      (SELECT COUNT(DISTINCT vf.venda_dia) FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id) AS total_retornos
    FROM novos n
  ),

  faixa_filtered AS (
    SELECT * FROM metricas m
    WHERE
      CASE p_faixa
        WHEN 'ATE_30D' THEN m.dias_ate_retorno IS NOT NULL AND m.dias_ate_retorno <= 30
        WHEN '31_45D' THEN m.dias_ate_retorno IS NOT NULL AND m.dias_ate_retorno > 30 AND m.dias_ate_retorno <= 45
        WHEN '46_60D' THEN m.dias_ate_retorno IS NOT NULL AND m.dias_ate_retorno > 45
        WHEN 'AGUARDANDO' THEN m.dias_ate_retorno IS NULL AND (v_ref - m.first_seen) <= 30
        WHEN 'NAO_30D' THEN m.dias_ate_retorno IS NULL AND (v_ref - m.first_seen) > 30 AND (v_ref - m.first_seen) <= 60
        WHEN 'NAO_60D' THEN m.dias_ate_retorno IS NULL AND (v_ref - m.first_seen) > 60
        -- Legacy fallback
        WHEN 'NAO_RETORNOU' THEN m.dias_ate_retorno IS NULL
        ELSE true
      END
  ),

  barb_aquisicao AS (
    SELECT DISTINCT ON (n.cliente_id)
      n.cliente_id,
      vn.colaborador_id AS barb_id,
      vn.colaborador_nome AS barb_nome
    FROM faixa_filtered n
    JOIN vendas_novos vn ON vn.cliente_id = n.cliente_id AND vn.venda_dia = n.first_seen
    JOIN dimensao_colaboradores dc ON dc.colaborador_id = vn.colaborador_id AND dc.tipo_colaborador = 'barbeiro'
    ORDER BY n.cliente_id, vn.venda_dia, vn.colaborador_id
  ),

  ultimo_barbeiro AS (
    SELECT DISTINCT ON (vf.cliente_id)
      vf.cliente_id,
      vf.colaborador_id AS ultimo_barb_id,
      vf.colaborador_nome AS ultimo_barb_nome
    FROM visitas_futuras vf
    WHERE vf.cliente_id IN (SELECT cliente_id FROM faixa_filtered)
    ORDER BY vf.cliente_id, vf.venda_dia DESC
  ),

  visitas_por_barbeiro AS (
    SELECT
      vf.cliente_id,
      vf.colaborador_id,
      vf.colaborador_nome,
      COUNT(DISTINCT vf.venda_dia) AS visitas
    FROM visitas_futuras vf
    WHERE vf.cliente_id IN (SELECT cliente_id FROM faixa_filtered)
    GROUP BY vf.cliente_id, vf.colaborador_id, vf.colaborador_nome
  ),

  client_rows AS (
    SELECT jsonb_agg(jsonb_build_object(
      'cliente_id', f.cliente_id,
      'cliente_nome', f.cliente_nome,
      'telefone', f.telefone,
      'first_seen', f.first_seen,
      'dias_ate_retorno', f.dias_ate_retorno,
      'total_retornos', f.total_retornos,
      'barb_aquisicao_nome', ba.barb_nome,
      'barb_aquisicao_id', ba.barb_id,
      'ultimo_barb_nome', ub.ultimo_barb_nome,
      'ultimo_barb_id', ub.ultimo_barb_id,
      'dias_desde_primeira', (v_ref - f.first_seen)
    ) ORDER BY f.first_seen DESC) AS val
    FROM faixa_filtered f
    LEFT JOIN barb_aquisicao ba ON ba.cliente_id = f.cliente_id
    LEFT JOIN ultimo_barbeiro ub ON ub.cliente_id = f.cliente_id
  ),

  resumo AS (
    SELECT jsonb_build_object(
      'total', COUNT(*),
      'media_dias_retorno', ROUND(AVG(dias_ate_retorno)::numeric, 1),
      'por_barbeiro_aquisicao', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'colaborador_id', barb_id,
          'colaborador_nome', barb_nome,
          'count', cnt
        ) ORDER BY cnt DESC), '[]'::jsonb)
        FROM (
          SELECT barb_id, barb_nome, COUNT(*) AS cnt
          FROM barb_aquisicao GROUP BY barb_id, barb_nome
        ) sub
      )
    ) AS val
    FROM faixa_filtered
  )

  SELECT jsonb_build_object(
    'faixa', p_faixa,
    'resumo', (SELECT val FROM resumo),
    'clientes', COALESCE((SELECT val FROM client_rows), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

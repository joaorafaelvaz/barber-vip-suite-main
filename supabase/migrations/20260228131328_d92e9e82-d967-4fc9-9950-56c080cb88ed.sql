
-- ============================================================
-- 1. Fix rpc_clientes_novos_lista: use dimensao_clientes.first_seen instead of full table scan
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_clientes_novos_lista(
  p_data_inicio text,
  p_data_fim text,
  p_ref_date text DEFAULT NULL,
  p_modo text DEFAULT 'TODOS',
  p_barbeiro_aquisicao text DEFAULT NULL,
  p_status_novo text DEFAULT NULL,
  p_janela_conversao int DEFAULT 60,
  p_excluir_sem_cadastro boolean DEFAULT true,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_export boolean DEFAULT false
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
  v_lim    int := CASE WHEN p_export THEN 10000 ELSE p_limit END;
  v_off    int := CASE WHEN p_export THEN 0 ELSE p_offset END;
BEGIN
  WITH
  -- Use dimensao_clientes.first_seen instead of scanning all vendas
  novos AS (
    SELECT dc.cliente_id, dc.first_seen,
           dc.cliente_nome, dc.telefone
    FROM dimensao_clientes dc
    WHERE dc.first_seen BETWEEN v_inicio AND v_fim
      AND dc.cliente_id IS NOT NULL
      AND dc.cliente_id <> ''
      AND (NOT p_excluir_sem_cadastro OR lower(dc.cliente_nome) NOT LIKE '%sem cadastro%')
  ),

  -- Only scan vendas for novos clients in the relevant window
  vendas_novos AS (
    SELECT
      v.cliente_id, v.colaborador_id, v.colaborador_nome,
      v.venda_dia, v.valor_faturamento, v.venda_id
    FROM vw_vendas_kpi_base v
    WHERE v.cliente_id IN (SELECT cliente_id FROM novos)
      AND v.venda_dia >= v_inicio
      AND v.venda_dia <= (v_fim + p_janela_conversao)
      AND v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND NOT v.is_credito
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

  enriched AS (
    SELECT
      n.cliente_id,
      n.cliente_nome,
      n.telefone,
      n.first_seen,
      COALESCE(ba.barb_id, '') AS barbeiro_aquisicao_id,
      COALESCE(ba.barb_nome, 'N/A') AS barbeiro_aquisicao_nome,
      (SELECT COUNT(DISTINCT venda_dia) FROM vendas_novos bb WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS total_visitas_conv,
      (SELECT COALESCE(SUM(valor_faturamento), 0) FROM vendas_novos bb WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS gasto_conv,
      (v_ref - n.first_seen) AS dias_desde_first_seen,
      (SELECT ARRAY_AGG(DISTINCT dc2.colaborador_nome) FROM vendas_novos bb
        JOIN dimensao_colaboradores dc2 ON dc2.colaborador_id = bb.colaborador_id AND dc2.tipo_colaborador = 'barbeiro'
        WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS barbeiros_visitados,
      (SELECT COUNT(DISTINCT bb.colaborador_id) FROM vendas_novos bb
        JOIN dimensao_colaboradores dc2 ON dc2.colaborador_id = bb.colaborador_id AND dc2.tipo_colaborador = 'barbeiro'
        WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS qtd_barbeiros,
      (SELECT MIN(bb.venda_dia) FROM vendas_novos bb WHERE bb.cliente_id = n.cliente_id AND bb.venda_dia > n.first_seen) AS segunda_visita,
      (SELECT bb.colaborador_nome FROM vendas_novos bb
        JOIN dimensao_colaboradores dc2 ON dc2.colaborador_id = bb.colaborador_id AND dc2.tipo_colaborador = 'barbeiro'
        WHERE bb.cliente_id = n.cliente_id AND bb.venda_dia > n.first_seen
        ORDER BY bb.venda_dia LIMIT 1) AS barbeiro_2a_visita_nome
    FROM novos n
    LEFT JOIN barbeiro_aquisicao ba ON ba.cliente_id = n.cliente_id
  ),

  classified AS (
    SELECT
      e.*,
      CASE
        WHEN e.total_visitas_conv >= 2 AND e.qtd_barbeiros = 1 THEN 'NOVO_FIEL'
        WHEN e.qtd_barbeiros > 1 THEN 'NOVO_COMPARTILHADO'
        WHEN e.total_visitas_conv >= 2 THEN 'NOVO_RECORRENTE'
        WHEN e.segunda_visita IS NOT NULL AND (e.segunda_visita - e.first_seen) > p_janela_conversao THEN 'NOVO_VOLTOU_TARDE'
        ELSE 'NOVO_1X'
      END AS status_novo,
      CASE WHEN e.segunda_visita IS NOT NULL THEN (e.segunda_visita - e.first_seen) ELSE NULL END AS dias_ate_2a_visita
    FROM enriched e
  ),

  filtered AS (
    SELECT *
    FROM classified c
    WHERE
      (p_modo = 'TODOS'
        OR (p_modo = 'NAO_VOLTARAM' AND c.status_novo = 'NOVO_1X')
        OR (p_modo = 'TROCARAM_BARBEIRO' AND c.segunda_visita IS NOT NULL AND c.barbeiro_2a_visita_nome IS NOT NULL AND c.barbeiro_2a_visita_nome <> c.barbeiro_aquisicao_nome)
        OR (p_modo = 'FIEIS' AND c.status_novo = 'NOVO_FIEL'))
      AND (p_barbeiro_aquisicao IS NULL OR c.barbeiro_aquisicao_id = p_barbeiro_aquisicao)
      AND (p_status_novo IS NULL OR c.status_novo = p_status_novo)
  ),

  total_count AS (
    SELECT COUNT(*) AS total FROM filtered
  )

  SELECT jsonb_build_object(
    'total', (SELECT total FROM total_count),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'cliente_id', f.cliente_id,
        'cliente_nome', f.cliente_nome,
        'telefone', f.telefone,
        'first_seen', f.first_seen,
        'barbeiro_aquisicao_id', f.barbeiro_aquisicao_id,
        'barbeiro_aquisicao_nome', f.barbeiro_aquisicao_nome,
        'status_novo', f.status_novo,
        'total_visitas_60d', f.total_visitas_conv,
        'gasto_60d', ROUND(f.gasto_conv::numeric, 2),
        'dias_desde_first_seen', f.dias_desde_first_seen,
        'barbeiros_visitados_60d', COALESCE(f.barbeiros_visitados, ARRAY[]::text[]),
        'qtd_barbeiros_60d', f.qtd_barbeiros,
        'barbeiro_2a_visita_nome', f.barbeiro_2a_visita_nome,
        'dias_ate_2a_visita', f.dias_ate_2a_visita
      ))
      FROM (SELECT * FROM filtered ORDER BY first_seen DESC LIMIT v_lim OFFSET v_off) f
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 2. Add retention distribution to rpc_clientes_novos_resumo
-- ============================================================
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
      -- For retention distribution: find first return days
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

  -- NEW: Retention distribution by faixa
  retencao_dist AS (
    SELECT jsonb_agg(jsonb_build_object(
      'faixa', faixa,
      'count', cnt,
      'pct', CASE WHEN total > 0 THEN ROUND(100.0 * cnt / total, 1) ELSE 0 END
    ) ORDER BY faixa_order) AS val
    FROM (
      SELECT
        CASE
          WHEN dias_ate_retorno IS NULL THEN 'NAO_RETORNOU'
          WHEN dias_ate_retorno <= 30 THEN 'ATE_30D'
          WHEN dias_ate_retorno <= 45 THEN '31_45D'
          ELSE '46_60D'
        END AS faixa,
        CASE
          WHEN dias_ate_retorno IS NULL THEN 4
          WHEN dias_ate_retorno <= 30 THEN 1
          WHEN dias_ate_retorno <= 45 THEN 2
          ELSE 3
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

-- ============================================================
-- 3. New RPC: rpc_clientes_novos_drill_retencao
-- Returns clients for a specific retention faixa with barbeiro analysis
-- ============================================================
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
        WHEN 'NAO_RETORNOU' THEN m.dias_ate_retorno IS NULL
        ELSE true
      END
  ),

  -- Get barbeiro aquisicao for each client
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

  -- Last barbeiro that attended each client
  ultimo_barbeiro AS (
    SELECT DISTINCT ON (vf.cliente_id)
      vf.cliente_id,
      vf.colaborador_id AS ultimo_barb_id,
      vf.colaborador_nome AS ultimo_barb_nome
    FROM visitas_futuras vf
    WHERE vf.cliente_id IN (SELECT cliente_id FROM faixa_filtered)
    ORDER BY vf.cliente_id, vf.venda_dia DESC
  ),

  -- Visits per barbeiro per client
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

  -- Client rows
  client_rows AS (
    SELECT jsonb_agg(jsonb_build_object(
      'cliente_id', f.cliente_id,
      'cliente_nome', f.cliente_nome,
      'telefone', f.telefone,
      'first_seen', f.first_seen,
      'dias_ate_retorno', f.dias_ate_retorno,
      'total_retornos', f.total_retornos,
      'barbeiro_aquisicao_id', COALESCE(ba.barb_id, ''),
      'barbeiro_aquisicao_nome', COALESCE(ba.barb_nome, 'N/A'),
      'ultimo_barbeiro_nome', ub.ultimo_barb_nome,
      'barbeiros_retorno', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'colaborador_id', vpb.colaborador_id,
          'colaborador_nome', vpb.colaborador_nome,
          'visitas', vpb.visitas
        ) ORDER BY vpb.visitas DESC)
        FROM visitas_por_barbeiro vpb WHERE vpb.cliente_id = f.cliente_id
      ), '[]'::jsonb)
    ) ORDER BY f.first_seen DESC) AS val
    FROM faixa_filtered f
    LEFT JOIN barb_aquisicao ba ON ba.cliente_id = f.cliente_id
    LEFT JOIN ultimo_barbeiro ub ON ub.cliente_id = f.cliente_id
  ),

  -- Summary by barbeiro aquisicao
  por_barbeiro_resumo AS (
    SELECT jsonb_agg(jsonb_build_object(
      'colaborador_id', barb_id,
      'colaborador_nome', barb_nome,
      'count', cnt
    ) ORDER BY cnt DESC) AS val
    FROM (
      SELECT ba.barb_id, ba.barb_nome, COUNT(*) AS cnt
      FROM faixa_filtered f
      JOIN barb_aquisicao ba ON ba.cliente_id = f.cliente_id
      GROUP BY ba.barb_id, ba.barb_nome
    ) sub
  )

  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM faixa_filtered),
    'faixa', p_faixa,
    'clientes', COALESCE((SELECT val FROM client_rows), '[]'::jsonb),
    'por_barbeiro', COALESCE((SELECT val FROM por_barbeiro_resumo), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

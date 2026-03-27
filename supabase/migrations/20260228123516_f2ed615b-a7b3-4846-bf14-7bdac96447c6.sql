
-- ============================================================
-- RPC 1: rpc_clientes_novos_resumo
-- Retorna KPIs de captação + conversão, tabela por barbeiro,
-- tendência semanal e cohort mensal para clientes novos.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_clientes_novos_resumo(
  p_data_inicio text,
  p_data_fim text,
  p_ref_date text DEFAULT NULL,
  p_janela_conversao int DEFAULT 60,
  p_excluir_sem_cadastro bool DEFAULT true
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
  -- Base filtrada (exclui crédito, exige cliente_id)
  base AS (
    SELECT
      v.cliente_id,
      v.cliente_nome,
      v.colaborador_id,
      v.colaborador_nome,
      v.tipo_colaborador,
      v.venda_dia,
      v.valor_bruto,
      v.venda_id
    FROM vw_vendas_kpi_base v
    WHERE v.cliente_id IS NOT NULL
      AND v.cliente_id <> ''
      AND v.produto IS NOT NULL
      AND v.produto <> ''
      AND NOT v.is_credito
      AND (NOT p_excluir_sem_cadastro OR lower(v.cliente_nome) NOT LIKE '%sem cadastro%')
  ),

  -- first_seen global por cliente (histórico completo)
  first_seen_global AS (
    SELECT cliente_id, MIN(venda_dia) AS first_seen
    FROM base
    GROUP BY cliente_id
  ),

  -- Clientes novos no período
  novos AS (
    SELECT fs.cliente_id, fs.first_seen
    FROM first_seen_global fs
    WHERE fs.first_seen BETWEEN v_inicio AND v_fim
  ),

  -- Barbeiro de aquisição (barbeiro que atendeu no dia do first_seen)
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

  -- Visitas futuras dos novos (após first_seen)
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

  -- Métricas por cliente novo
  metricas_novo AS (
    SELECT
      n.cliente_id,
      n.first_seen,
      -- Retenção
      EXISTS (SELECT 1 FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id AND vf.dias_apos <= 30) AS ret_30d,
      EXISTS (SELECT 1 FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id AND vf.dias_apos <= 60) AS ret_60d,
      EXISTS (SELECT 1 FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id AND vf.dias_apos <= 90) AS ret_90d,
      -- Dias distintos com visita em janela de conversão (incluindo first_seen)
      (SELECT COUNT(DISTINCT venda_dia) FROM base bb WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS dias_visita_conv,
      -- Barbeiros distintos na janela de conversão
      (SELECT COUNT(DISTINCT bb.colaborador_id) FROM base bb
        JOIN dimensao_colaboradores dc2 ON dc2.colaborador_id = bb.colaborador_id AND dc2.tipo_colaborador = 'barbeiro'
        WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS qtd_barbeiros_conv,
      -- Segunda visita
      (SELECT MIN(vf.venda_dia) FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id) AS segunda_visita,
      -- Ticket primeira visita
      (SELECT COALESCE(SUM(bb.valor_bruto), 0) FROM base bb
        WHERE bb.cliente_id = n.cliente_id AND bb.venda_dia = n.first_seen) AS ticket_first,
      -- Voltou até 21d
      EXISTS (SELECT 1 FROM visitas_futuras vf WHERE vf.cliente_id = n.cliente_id AND vf.dias_apos <= 21) AS voltou_21d
    FROM novos n
  ),

  -- Clientes únicos no período (para % novos)
  unicos_periodo AS (
    SELECT COUNT(DISTINCT cliente_id) AS total
    FROM base
    WHERE venda_dia BETWEEN v_inicio AND v_fim
  ),

  -- KPIs
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
      'ticket_medio_recorrente', (
        SELECT ROUND(AVG(bb.valor_bruto)::numeric, 2) FROM base bb
        JOIN metricas_novo mn ON mn.cliente_id = bb.cliente_id AND mn.dias_visita_conv >= 2
        WHERE bb.venda_dia BETWEEN mn.first_seen AND mn.first_seen + p_janela_conversao
      ),
      'novos_exclusivos', COUNT(*) FILTER (WHERE qtd_barbeiros_conv = 1 AND dias_visita_conv >= 2),
      'novos_compartilhados', COUNT(*) FILTER (WHERE qtd_barbeiros_conv > 1),
      'pct_novos_exclusivos', ROUND(100.0 * COUNT(*) FILTER (WHERE qtd_barbeiros_conv = 1 AND dias_visita_conv >= 2)
        / NULLIF(COUNT(*), 0), 1)
    ) AS val
    FROM metricas_novo
  ),

  -- Por barbeiro de aquisição
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

  -- Tendência semanal
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

  -- Cohort mensal
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


-- ============================================================
-- RPC 2: rpc_clientes_novos_lista
-- Retorna lista paginada de clientes novos com filtros de modo
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_clientes_novos_lista(
  p_data_inicio text,
  p_data_fim text,
  p_ref_date text DEFAULT NULL,
  p_modo text DEFAULT 'TODOS',
  p_barbeiro_aquisicao text DEFAULT NULL,
  p_status_novo text DEFAULT NULL,
  p_janela_conversao int DEFAULT 60,
  p_excluir_sem_cadastro bool DEFAULT true,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_export bool DEFAULT false
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
  base AS (
    SELECT
      v.cliente_id, v.cliente_nome, v.telefone,
      v.colaborador_id, v.colaborador_nome,
      v.tipo_colaborador, v.venda_dia, v.valor_bruto, v.venda_id
    FROM vw_vendas_kpi_base v
    WHERE v.cliente_id IS NOT NULL AND v.cliente_id <> ''
      AND v.produto IS NOT NULL AND v.produto <> ''
      AND NOT v.is_credito
      AND (NOT p_excluir_sem_cadastro OR lower(v.cliente_nome) NOT LIKE '%sem cadastro%')
  ),

  first_seen_global AS (
    SELECT cliente_id, MIN(venda_dia) AS first_seen
    FROM base GROUP BY cliente_id
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
    JOIN base b ON b.cliente_id = n.cliente_id AND b.venda_dia = n.first_seen
    JOIN dimensao_colaboradores dc ON dc.colaborador_id = b.colaborador_id AND dc.tipo_colaborador = 'barbeiro'
    ORDER BY n.cliente_id, b.venda_dia, b.colaborador_id
  ),

  enriched AS (
    SELECT
      n.cliente_id,
      (SELECT b2.cliente_nome FROM base b2 WHERE b2.cliente_id = n.cliente_id LIMIT 1) AS cliente_nome,
      (SELECT b2.telefone FROM base b2 WHERE b2.cliente_id = n.cliente_id AND b2.telefone IS NOT NULL LIMIT 1) AS telefone,
      n.first_seen,
      COALESCE(ba.barb_id, '') AS barbeiro_aquisicao_id,
      COALESCE(ba.barb_nome, 'N/A') AS barbeiro_aquisicao_nome,
      -- dias distintos na janela conversão
      (SELECT COUNT(DISTINCT venda_dia) FROM base bb WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS total_visitas_conv,
      -- gasto na janela conversão
      (SELECT COALESCE(SUM(valor_bruto), 0) FROM base bb WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS gasto_conv,
      -- dias desde first_seen
      (v_ref - n.first_seen) AS dias_desde_first_seen,
      -- barbeiros na janela de conversão (tipo barbeiro)
      (SELECT ARRAY_AGG(DISTINCT dc2.colaborador_nome) FROM base bb
        JOIN dimensao_colaboradores dc2 ON dc2.colaborador_id = bb.colaborador_id AND dc2.tipo_colaborador = 'barbeiro'
        WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS barbeiros_visitados,
      (SELECT COUNT(DISTINCT bb.colaborador_id) FROM base bb
        JOIN dimensao_colaboradores dc2 ON dc2.colaborador_id = bb.colaborador_id AND dc2.tipo_colaborador = 'barbeiro'
        WHERE bb.cliente_id = n.cliente_id
        AND bb.venda_dia BETWEEN n.first_seen AND n.first_seen + p_janela_conversao) AS qtd_barbeiros,
      -- segunda visita
      (SELECT MIN(bb.venda_dia) FROM base bb WHERE bb.cliente_id = n.cliente_id AND bb.venda_dia > n.first_seen) AS segunda_visita,
      -- barbeiro 2a visita
      (SELECT bb.colaborador_nome FROM base bb
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
      -- Modo filter
      (p_modo = 'TODOS'
        OR (p_modo = 'NAO_VOLTARAM' AND c.status_novo = 'NOVO_1X')
        OR (p_modo = 'TROCARAM_BARBEIRO' AND c.segunda_visita IS NOT NULL AND c.barbeiro_2a_visita_nome IS NOT NULL AND c.barbeiro_2a_visita_nome <> c.barbeiro_aquisicao_nome)
        OR (p_modo = 'FIEIS' AND c.status_novo = 'NOVO_FIEL'))
      -- Barbeiro filter
      AND (p_barbeiro_aquisicao IS NULL OR c.barbeiro_aquisicao_id = p_barbeiro_aquisicao)
      -- Status filter
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

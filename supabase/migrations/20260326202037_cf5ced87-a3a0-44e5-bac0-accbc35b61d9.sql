
CREATE OR REPLACE FUNCTION public.rpc_servicos_barbeiro_categoria(
  p_data_inicio date,
  p_data_fim date,
  p_colaborador_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'filtros', jsonb_build_object(
      'data_inicio', p_data_inicio,
      'data_fim', p_data_fim,
      'colaborador_id', p_colaborador_id
    ),
    'items', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.faturamento DESC)
      FROM (
        SELECT
          v.colaborador_id,
          v.colaborador_nome,
          COALESCE(v.grupo_de_produto, v.servicos_ou_produtos, 'N/A') AS categoria,
          v.grupo_de_produto,
          SUM(v.valor_faturamento) AS faturamento,
          COUNT(*) AS quantidade,
          CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(v.valor_faturamento) / COUNT(*), 2) ELSE 0 END AS ticket_medio
        FROM vw_vendas_kpi_base v
        WHERE v.venda_dia BETWEEN p_data_inicio AND p_data_fim
          AND v.produto IS NOT NULL AND v.produto != ''
          AND v.is_credito = false
          AND v.cliente_nome NOT ILIKE '%sem cadastro%'
          AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
          AND v.tipo_colaborador = 'barbeiro'
          AND v.valor_faturamento > 0
        GROUP BY v.colaborador_id, v.colaborador_nome, v.grupo_de_produto, v.servicos_ou_produtos
      ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

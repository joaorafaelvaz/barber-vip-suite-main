-- RPC to get services aggregated by barber + categoria (grupo_de_produto)
CREATE OR REPLACE FUNCTION public.rpc_servicos_barbeiro_categoria(
  p_data_inicio date,
  p_data_fim date,
  p_colaborador_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
          COALESCE(dp.grupo_de_produto, dp.servicos_ou_produtos, 'N/A') AS categoria,
          dp.grupo_de_produto,
          SUM(v.valor_liquido) AS faturamento,
          COUNT(*) AS quantidade,
          CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(v.valor_liquido) / COUNT(*), 2) ELSE 0 END AS ticket_medio
        FROM vendas_api_raw v
        LEFT JOIN dimensao_produtos dp ON dp.produto = v.produto
        LEFT JOIN dimensao_colaboradores dc ON dc.colaborador_id = v.colaborador_id
        WHERE v.venda_data_ts::date BETWEEN p_data_inicio AND p_data_fim
          AND (p_colaborador_id IS NULL OR v.colaborador_id = p_colaborador_id)
          AND dc.tipo_colaborador = 'barbeiro'
          AND v.valor_liquido > 0
        GROUP BY v.colaborador_id, v.colaborador_nome, dp.grupo_de_produto, dp.servicos_ou_produtos
      ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.rpc_servicos_barbeiro_categoria(date, date, text) TO authenticated;
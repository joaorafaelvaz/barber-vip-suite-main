
DROP FUNCTION IF EXISTS public.rpc_faturamento_resumo(date,date,text,text,text,text,text);

CREATE FUNCTION public.rpc_faturamento_resumo(
  p_inicio date,
  p_fim date,
  p_colaborador_id text default null,
  p_grupo_de_produto text default null,
  p_servicos_ou_produtos text default null,
  p_forma_pagamento text default null,
  p_produto text default null
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
with base as (
  select
    venda_data_ts,
    venda_dia,
    valor_faturamento,
    colaborador_id,
    colaborador_nome,
    tipo_colaborador,
    produto,
    grupo_de_produto,
    servicos_ou_produtos,
    forma_pagamento,
    is_credito
  from public.vw_vendas_kpi_base
  where venda_dia between p_inicio and p_fim
    and coalesce(is_credito, false) = false
    and (p_colaborador_id is null or colaborador_id = p_colaborador_id)
    and (p_grupo_de_produto is null or grupo_de_produto = p_grupo_de_produto)
    and (p_servicos_ou_produtos is null or servicos_ou_produtos = p_servicos_ou_produtos)
    and (p_forma_pagamento is null or forma_pagamento = p_forma_pagamento)
    and (p_produto is null or produto = p_produto)
),
tot as (
  select
    coalesce(sum(valor_faturamento),0)::numeric as total,
    coalesce(sum(valor_faturamento) filter (where grupo_de_produto = 'Serviço Base'),0)::numeric as faturamento_base,
    coalesce(sum(valor_faturamento) filter (where grupo_de_produto = 'Serviço Extra'),0)::numeric as extras_valor,
    coalesce(sum(valor_faturamento) filter (where servicos_ou_produtos ilike '%Produtos%'),0)::numeric as produtos_valor
  from base
),
mix as (
  select
    grupo_de_produto as bucket,
    coalesce(sum(valor_faturamento),0)::numeric as valor
  from base
  group by 1
  order by valor desc
),
top_colab as (
  select
    colaborador_nome as bucket,
    coalesce(sum(valor_faturamento),0)::numeric as valor
  from base
  group by 1
  order by valor desc
  limit 10
),
top_item as (
  select
    produto as bucket,
    coalesce(sum(valor_faturamento),0)::numeric as valor
  from base
  group by 1
  order by valor desc
  limit 10
)
select jsonb_build_object(
  'meta', jsonb_build_object(
    'inicio', p_inicio,
    'fim', p_fim,
    'filtros', jsonb_build_object(
      'colaborador_id', p_colaborador_id,
      'grupo_de_produto', p_grupo_de_produto,
      'servicos_ou_produtos', p_servicos_ou_produtos,
      'forma_pagamento', p_forma_pagamento,
      'produto', p_produto
    ),
    'total', (select total from tot),
    'faturamento_base', (select faturamento_base from tot),
    'extras_valor', (select extras_valor from tot),
    'produtos_valor', (select produtos_valor from tot)
  ),
  'series', jsonb_build_array(),
  'table', jsonb_build_object(
    'mix_grupo_de_produto', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bucket', bucket,
        'valor', valor,
        'share', case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end
      ) order by valor desc)
      from mix
    ), '[]'::jsonb),
    'top_colaboradores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bucket', bucket,
        'valor', valor,
        'share', case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end
      ) order by valor desc)
      from top_colab
    ), '[]'::jsonb),
    'top_itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bucket', bucket,
        'valor', valor,
        'share', case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end
      ) order by valor desc)
      from top_item
    ), '[]'::jsonb)
  ),
  'insights', jsonb_build_array(
    'Total considera valor_faturamento e exclui is_credito = true.',
    'Mix mostra participação por grupo_de_produto (ex.: Serviço Base/Extra).',
    'Top 10 mostra principais colaboradores e itens no período.'
  )
);
$$;


CREATE OR REPLACE FUNCTION public.rpc_faturamento_periodo(
  p_inicio date,
  p_fim date,
  p_granularidade text,
  p_colaborador_id text DEFAULT NULL,
  p_grupo_de_produto text DEFAULT NULL,
  p_servicos_ou_produtos text DEFAULT NULL,
  p_forma_pagamento text DEFAULT NULL,
  p_produto text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
with base as (
  select venda_data_ts, venda_dia, valor_faturamento, venda_id
  from public.vw_vendas_kpi_base
  where venda_dia between p_inicio and p_fim
    and coalesce(is_credito, false) = false
    and produto is not null and produto <> ''
    and (p_colaborador_id is null or colaborador_id = p_colaborador_id)
    and (p_grupo_de_produto is null or grupo_de_produto = p_grupo_de_produto)
    and (p_servicos_ou_produtos is null or servicos_ou_produtos = p_servicos_ou_produtos)
    and (p_forma_pagamento is null or forma_pagamento = p_forma_pagamento)
    and (p_produto is null or produto = p_produto)
),
buckets as (
  select
    case
      when lower(p_granularidade) = 'day' then venda_dia::date
      when lower(p_granularidade) = 'week' then date_trunc('week', venda_data_ts)::date
      when lower(p_granularidade) = 'month' then date_trunc('month', venda_data_ts)::date
      else venda_dia::date
    end as bucket,
    coalesce(sum(valor_faturamento),0)::numeric as valor,
    count(distinct venda_id)::int as qtd
  from base group by 1
),
tot as (select coalesce(sum(valor),0)::numeric as total from buckets),
tab as (
  select bucket, valor, qtd,
    case when qtd > 0 then round(valor / qtd::numeric, 2) else 0 end as ticket,
    case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end as share
  from buckets order by bucket
)
select jsonb_build_object(
  'meta', jsonb_build_object(
    'inicio', p_inicio, 'fim', p_fim, 'granularidade', lower(p_granularidade),
    'filtros', jsonb_build_object(
      'colaborador_id', p_colaborador_id, 'grupo_de_produto', p_grupo_de_produto,
      'servicos_ou_produtos', p_servicos_ou_produtos, 'forma_pagamento', p_forma_pagamento, 'produto', p_produto
    ),
    'total', (select total from tot)
  ),
  'series', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'valor', valor, 'qtd', qtd, 'ticket', ticket) order by bucket) from tab), '[]'::jsonb),
  'table', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'valor', valor, 'qtd', qtd, 'ticket', ticket, 'share', share) order by bucket) from tab), '[]'::jsonb),
  'insights', jsonb_build_array('Drill por período com filtro de produto válido.', 'Bucket week usa date_trunc(week).')
);
$$;

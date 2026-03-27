
-- Drop and recreate 3 RPCs adding qtd_registros

DROP FUNCTION IF EXISTS public.rpc_faturamento_por_colaborador(date, date, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_faturamento_por_dia_semana(date, date, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_faturamento_por_pagamento(date, date, text, text, text);

-- 1) rpc_faturamento_por_colaborador
CREATE OR REPLACE FUNCTION public.rpc_faturamento_por_colaborador(
  p_inicio date, p_fim date,
  p_tipo_colaborador text default null,
  p_grupo_de_produto text default null,
  p_servicos_ou_produtos text default null,
  p_forma_pagamento text default null,
  p_produto text default null
) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
with base as (
  select colaborador_id, colaborador_nome, tipo_colaborador, valor_faturamento
  from public.vw_vendas_kpi_base
  where venda_dia between p_inicio and p_fim
    and coalesce(is_credito, false) = false
    and produto is not null and produto <> ''
    and (p_tipo_colaborador is null or tipo_colaborador = p_tipo_colaborador)
    and (p_grupo_de_produto is null or grupo_de_produto = p_grupo_de_produto)
    and (p_servicos_ou_produtos is null or servicos_ou_produtos = p_servicos_ou_produtos)
    and (p_forma_pagamento is null or forma_pagamento = p_forma_pagamento)
    and (p_produto is null or produto = p_produto)
),
agg as (
  select colaborador_id, coalesce(colaborador_nome,'(Sem nome)') as colaborador_nome,
    coalesce(sum(valor_faturamento),0)::numeric as valor,
    count(*)::int as qtd_registros
  from base group by 1, 2
),
tot as (select coalesce(sum(valor),0)::numeric as total from agg),
ranked as (
  select colaborador_id, colaborador_nome, valor, qtd_registros,
    case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end as share,
    row_number() over(order by valor desc, colaborador_nome) as rank
  from agg
)
select jsonb_build_object(
  'meta', jsonb_build_object(
    'inicio', p_inicio, 'fim', p_fim, 'tipo_colaborador', p_tipo_colaborador,
    'filtros', jsonb_build_object(
      'grupo_de_produto', p_grupo_de_produto, 'servicos_ou_produtos', p_servicos_ou_produtos,
      'forma_pagamento', p_forma_pagamento, 'produto', p_produto
    ),
    'total', (select total from tot)
  ),
  'series', coalesce((select jsonb_agg(jsonb_build_object('bucket', colaborador_nome, 'valor', valor) order by valor desc) from ranked), '[]'::jsonb),
  'table', coalesce((select jsonb_agg(jsonb_build_object(
    'rank', rank, 'colaborador_id', colaborador_id, 'colaborador_nome', colaborador_nome,
    'valor', valor, 'qtd_registros', qtd_registros, 'share', share
  ) order by valor desc) from ranked), '[]'::jsonb),
  'insights', jsonb_build_array('Ranking por barbeiro com filtro de produto válido.')
);
$$;

-- 2) rpc_faturamento_por_dia_semana
CREATE OR REPLACE FUNCTION public.rpc_faturamento_por_dia_semana(
  p_inicio date, p_fim date,
  p_colaborador_id text default null,
  p_grupo_de_produto text default null,
  p_servicos_ou_produtos text default null
) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
with base as (
  select venda_data_ts, valor_faturamento
  from public.vw_vendas_kpi_base
  where venda_dia between p_inicio and p_fim
    and coalesce(is_credito, false) = false
    and produto is not null and produto <> ''
    and (p_colaborador_id is null or colaborador_id = p_colaborador_id)
    and (p_grupo_de_produto is null or grupo_de_produto = p_grupo_de_produto)
    and (p_servicos_ou_produtos is null or servicos_ou_produtos = p_servicos_ou_produtos)
),
agg as (
  select extract(dow from venda_data_ts)::int as dow,
    coalesce(sum(valor_faturamento),0)::numeric as valor,
    count(*)::int as qtd_registros
  from base group by 1
),
tot as (select coalesce(sum(valor),0)::numeric as total from agg),
dim as (select * from (values (0,'Dom'),(1,'Seg'),(2,'Ter'),(3,'Qua'),(4,'Qui'),(5,'Sex'),(6,'Sáb')) as t(dow, dia_semana)),
tab as (
  select d.dow, d.dia_semana as bucket, coalesce(a.valor,0)::numeric as valor, coalesce(a.qtd_registros,0)::int as qtd_registros
  from dim d left join agg a using (dow) order by d.dow
)
select jsonb_build_object(
  'meta', jsonb_build_object(
    'inicio', p_inicio, 'fim', p_fim,
    'filtros', jsonb_build_object('colaborador_id', p_colaborador_id, 'grupo_de_produto', p_grupo_de_produto, 'servicos_ou_produtos', p_servicos_ou_produtos),
    'total', (select total from tot)
  ),
  'series', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'valor', valor) order by dow) from tab), '[]'::jsonb),
  'table', coalesce((select jsonb_agg(jsonb_build_object(
    'dow', dow, 'bucket', bucket, 'valor', valor, 'qtd_registros', qtd_registros,
    'share', case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end
  ) order by dow) from tab), '[]'::jsonb),
  'insights', jsonb_build_array('Distribuição por dia da semana com filtro de produto válido.')
);
$$;

-- 3) rpc_faturamento_por_pagamento
CREATE OR REPLACE FUNCTION public.rpc_faturamento_por_pagamento(
  p_inicio date, p_fim date,
  p_colaborador_id text default null,
  p_grupo_de_produto text default null,
  p_servicos_ou_produtos text default null
) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
with base as (
  select forma_pagamento, valor_faturamento
  from public.vw_vendas_kpi_base
  where venda_dia between p_inicio and p_fim
    and coalesce(is_credito, false) = false
    and produto is not null and produto <> ''
    and (p_colaborador_id is null or colaborador_id = p_colaborador_id)
    and (p_grupo_de_produto is null or grupo_de_produto = p_grupo_de_produto)
    and (p_servicos_ou_produtos is null or servicos_ou_produtos = p_servicos_ou_produtos)
),
agg as (
  select coalesce(forma_pagamento,'(Não informado)') as bucket,
    coalesce(sum(valor_faturamento),0)::numeric as valor,
    count(*)::int as qtd_registros
  from base group by 1
),
tot as (select coalesce(sum(valor),0)::numeric as total from agg),
tab as (
  select bucket, valor, qtd_registros, case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end as share
  from agg order by valor desc
)
select jsonb_build_object(
  'meta', jsonb_build_object(
    'inicio', p_inicio, 'fim', p_fim,
    'filtros', jsonb_build_object('colaborador_id', p_colaborador_id, 'grupo_de_produto', p_grupo_de_produto, 'servicos_ou_produtos', p_servicos_ou_produtos),
    'total', (select total from tot)
  ),
  'series', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'valor', valor) order by valor desc) from tab), '[]'::jsonb),
  'table', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'valor', valor, 'qtd_registros', qtd_registros, 'share', share) order by valor desc) from tab), '[]'::jsonb),
  'insights', jsonb_build_array('Distribuição por forma de pagamento com filtro de produto válido.')
);
$$;

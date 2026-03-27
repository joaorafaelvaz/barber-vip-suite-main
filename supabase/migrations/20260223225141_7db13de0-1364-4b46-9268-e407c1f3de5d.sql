
-- ============================================================
-- FIX: Add mandatory product filter (produto IS NOT NULL AND produto <> '')
-- to ALL rpc_faturamento_* functions for consistency with Dashboard RPCs.
-- Also enrich context columns (grupo fallback, qtd, itens_exemplo).
-- ============================================================

-- 1) rpc_faturamento_resumo
CREATE OR REPLACE FUNCTION public.rpc_faturamento_resumo(
  p_inicio date, p_fim date,
  p_colaborador_id text DEFAULT NULL, p_grupo_de_produto text DEFAULT NULL,
  p_servicos_ou_produtos text DEFAULT NULL, p_forma_pagamento text DEFAULT NULL,
  p_produto text DEFAULT NULL
)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
with base as (
  select venda_data_ts, venda_dia, valor_faturamento, colaborador_id, colaborador_nome,
         tipo_colaborador, produto, grupo_de_produto, servicos_ou_produtos, forma_pagamento, is_credito
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
    coalesce(grupo_de_produto,'(Sem grupo)') as bucket,
    coalesce(sum(valor_faturamento),0)::numeric as valor,
    count(*)::int as qtd_registros,
    (array_agg(distinct produto order by produto) filter (where produto is not null))[1:3] as itens_exemplo
  from base group by 1 order by valor desc
),
top_colab as (
  select
    coalesce(colaborador_nome,'(Sem nome)') as bucket,
    coalesce(sum(valor_faturamento),0)::numeric as valor
  from base group by 1 order by valor desc limit 10
),
top_item as (
  select
    produto as bucket,
    coalesce(max(grupo_de_produto),'(Sem grupo)') as grupo_de_produto,
    coalesce(sum(valor_faturamento),0)::numeric as valor
  from base group by 1 order by valor desc limit 10
)
select jsonb_build_object(
  'meta', jsonb_build_object(
    'inicio', p_inicio, 'fim', p_fim,
    'filtros', jsonb_build_object(
      'colaborador_id', p_colaborador_id, 'grupo_de_produto', p_grupo_de_produto,
      'servicos_ou_produtos', p_servicos_ou_produtos, 'forma_pagamento', p_forma_pagamento, 'produto', p_produto
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
        'bucket', bucket, 'valor', valor, 'qtd_registros', qtd_registros,
        'itens_exemplo', to_jsonb(itens_exemplo),
        'share', case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end
      ) order by valor desc) from mix
    ), '[]'::jsonb),
    'top_colaboradores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bucket', bucket, 'valor', valor,
        'share', case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end
      ) order by valor desc) from top_colab
    ), '[]'::jsonb),
    'top_itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bucket', bucket, 'grupo_de_produto', grupo_de_produto, 'valor', valor,
        'share', case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end
      ) order by valor desc) from top_item
    ), '[]'::jsonb)
  ),
  'insights', jsonb_build_array(
    'Total considera apenas registros com produto válido (exclui linhas sem produto).',
    'Mix mostra participação por grupo_de_produto (ex.: Serviço Base/Extra).',
    'Top 10 mostra principais colaboradores e itens no período.'
  )
);
$function$;

-- 2) rpc_faturamento_periodo
CREATE OR REPLACE FUNCTION public.rpc_faturamento_periodo(
  p_inicio date, p_fim date, p_granularidade text,
  p_colaborador_id text DEFAULT NULL, p_grupo_de_produto text DEFAULT NULL,
  p_servicos_ou_produtos text DEFAULT NULL, p_forma_pagamento text DEFAULT NULL,
  p_produto text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE
AS $function$
with base as (
  select venda_data_ts, venda_dia, valor_faturamento
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
    coalesce(sum(valor_faturamento),0)::numeric as valor
  from base group by 1
),
tot as (select coalesce(sum(valor),0)::numeric as total from buckets),
tab as (
  select bucket, valor,
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
  'series', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'valor', valor) order by bucket) from tab), '[]'::jsonb),
  'table', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'valor', valor, 'share', share) order by bucket) from tab), '[]'::jsonb),
  'insights', jsonb_build_array('Drill por período com filtro de produto válido.', 'Bucket week usa date_trunc(week).')
);
$function$;

-- 3) rpc_faturamento_por_colaborador
CREATE OR REPLACE FUNCTION public.rpc_faturamento_por_colaborador(
  p_inicio date, p_fim date,
  p_tipo_colaborador text DEFAULT 'barbeiro', p_grupo_de_produto text DEFAULT NULL,
  p_servicos_ou_produtos text DEFAULT NULL, p_forma_pagamento text DEFAULT NULL,
  p_produto text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE
AS $function$
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
    coalesce(sum(valor_faturamento),0)::numeric as valor
  from base group by 1, 2
),
tot as (select coalesce(sum(valor),0)::numeric as total from agg),
ranked as (
  select colaborador_id, colaborador_nome, valor,
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
    'valor', valor, 'share', share
  ) order by valor desc) from ranked), '[]'::jsonb),
  'insights', jsonb_build_array('Ranking por barbeiro com filtro de produto válido.')
);
$function$;

-- 4) rpc_faturamento_por_grupo_de_produto
CREATE OR REPLACE FUNCTION public.rpc_faturamento_por_grupo_de_produto(
  p_inicio date, p_fim date,
  p_colaborador_id text DEFAULT NULL, p_servicos_ou_produtos text DEFAULT NULL,
  p_forma_pagamento text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE
AS $function$
with base as (
  select grupo_de_produto, produto, valor_faturamento
  from public.vw_vendas_kpi_base
  where venda_dia between p_inicio and p_fim
    and coalesce(is_credito, false) = false
    and produto is not null and produto <> ''
    and (p_colaborador_id is null or colaborador_id = p_colaborador_id)
    and (p_servicos_ou_produtos is null or servicos_ou_produtos = p_servicos_ou_produtos)
    and (p_forma_pagamento is null or forma_pagamento = p_forma_pagamento)
),
agg as (
  select
    coalesce(grupo_de_produto,'(Sem grupo)') as bucket,
    coalesce(sum(valor_faturamento),0)::numeric as valor,
    count(*)::int as qtd_registros,
    (array_agg(distinct produto order by produto))[1:3] as itens_exemplo
  from base group by 1
),
tot as (select coalesce(sum(valor),0)::numeric as total from agg),
tab as (
  select bucket, valor, qtd_registros, itens_exemplo,
    case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end as share
  from agg order by valor desc, bucket
)
select jsonb_build_object(
  'meta', jsonb_build_object(
    'inicio', p_inicio, 'fim', p_fim,
    'filtros', jsonb_build_object('colaborador_id', p_colaborador_id, 'servicos_ou_produtos', p_servicos_ou_produtos, 'forma_pagamento', p_forma_pagamento),
    'total', (select total from tot)
  ),
  'series', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'valor', valor) order by valor desc) from tab), '[]'::jsonb),
  'table', coalesce((select jsonb_agg(jsonb_build_object(
    'bucket', bucket, 'valor', valor, 'share', share, 'qtd_registros', qtd_registros, 'itens_exemplo', to_jsonb(itens_exemplo)
  ) order by valor desc) from tab), '[]'::jsonb),
  'insights', jsonb_build_array('Composição por grupo_de_produto com filtro de produto válido.')
);
$function$;

-- 5) rpc_faturamento_por_item
CREATE OR REPLACE FUNCTION public.rpc_faturamento_por_item(
  p_inicio date, p_fim date, p_limit integer DEFAULT 20,
  p_colaborador_id text DEFAULT NULL, p_grupo_de_produto text DEFAULT NULL,
  p_servicos_ou_produtos text DEFAULT NULL, p_forma_pagamento text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE
AS $function$
with base as (
  select produto, grupo_de_produto, valor_faturamento
  from public.vw_vendas_kpi_base
  where venda_dia between p_inicio and p_fim
    and coalesce(is_credito, false) = false
    and produto is not null and produto <> ''
    and (p_colaborador_id is null or colaborador_id = p_colaborador_id)
    and (p_grupo_de_produto is null or grupo_de_produto = p_grupo_de_produto)
    and (p_servicos_ou_produtos is null or servicos_ou_produtos = p_servicos_ou_produtos)
    and (p_forma_pagamento is null or forma_pagamento = p_forma_pagamento)
),
agg as (
  select
    produto as item,
    coalesce(max(grupo_de_produto),'(Sem grupo)') as grupo_de_produto,
    coalesce(sum(valor_faturamento),0)::numeric as valor,
    count(*)::int as qtd_registros
  from base group by 1
),
ranked as (select *, row_number() over(order by valor desc, item) as rank from agg),
cut as (select * from ranked where (p_limit is null or p_limit <= 0) or rank <= p_limit),
tot as (select coalesce(sum(valor),0)::numeric as total from agg)
select jsonb_build_object(
  'meta', jsonb_build_object(
    'inicio', p_inicio, 'fim', p_fim, 'limit', p_limit,
    'filtros', jsonb_build_object('colaborador_id', p_colaborador_id, 'grupo_de_produto', p_grupo_de_produto, 'servicos_ou_produtos', p_servicos_ou_produtos, 'forma_pagamento', p_forma_pagamento),
    'total', (select total from tot)
  ),
  'series', coalesce((select jsonb_agg(jsonb_build_object('bucket', item, 'valor', valor) order by valor desc) from cut), '[]'::jsonb),
  'table', coalesce((select jsonb_agg(jsonb_build_object(
    'rank', rank, 'item', item, 'grupo_de_produto', grupo_de_produto, 'qtd_registros', qtd_registros,
    'valor', valor, 'share', case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end
  ) order by valor desc) from cut), '[]'::jsonb),
  'insights', jsonb_build_array('Ranking por item com filtro de produto válido.')
);
$function$;

-- 6) rpc_faturamento_por_dia_semana
CREATE OR REPLACE FUNCTION public.rpc_faturamento_por_dia_semana(
  p_inicio date, p_fim date,
  p_colaborador_id text DEFAULT NULL, p_grupo_de_produto text DEFAULT NULL,
  p_servicos_ou_produtos text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE
AS $function$
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
  select extract(dow from venda_data_ts)::int as dow, coalesce(sum(valor_faturamento),0)::numeric as valor
  from base group by 1
),
tot as (select coalesce(sum(valor),0)::numeric as total from agg),
dim as (select * from (values (0,'Dom'),(1,'Seg'),(2,'Ter'),(3,'Qua'),(4,'Qui'),(5,'Sex'),(6,'Sáb')) as t(dow, dia_semana)),
tab as (
  select d.dow, d.dia_semana as bucket, coalesce(a.valor,0)::numeric as valor
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
    'dow', dow, 'bucket', bucket, 'valor', valor,
    'share', case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end
  ) order by dow) from tab), '[]'::jsonb),
  'insights', jsonb_build_array('Distribuição por dia da semana com filtro de produto válido.')
);
$function$;

-- 7) rpc_faturamento_por_pagamento
CREATE OR REPLACE FUNCTION public.rpc_faturamento_por_pagamento(
  p_inicio date, p_fim date,
  p_colaborador_id text DEFAULT NULL, p_grupo_de_produto text DEFAULT NULL,
  p_servicos_ou_produtos text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE
AS $function$
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
  select coalesce(forma_pagamento,'(Não informado)') as bucket, coalesce(sum(valor_faturamento),0)::numeric as valor
  from base group by 1
),
tot as (select coalesce(sum(valor),0)::numeric as total from agg),
tab as (
  select bucket, valor, case when (select total from tot) = 0 then 0 else (valor/(select total from tot)) end as share
  from agg order by valor desc
)
select jsonb_build_object(
  'meta', jsonb_build_object(
    'inicio', p_inicio, 'fim', p_fim,
    'filtros', jsonb_build_object('colaborador_id', p_colaborador_id, 'grupo_de_produto', p_grupo_de_produto, 'servicos_ou_produtos', p_servicos_ou_produtos),
    'total', (select total from tot)
  ),
  'series', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'valor', valor) order by valor desc) from tab), '[]'::jsonb),
  'table', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'valor', valor, 'share', share) order by valor desc) from tab), '[]'::jsonb),
  'insights', jsonb_build_array('Distribuição por forma de pagamento com filtro de produto válido.')
);
$function$;

-- 8) rpc_faturamento_por_faixa_horaria
CREATE OR REPLACE FUNCTION public.rpc_faturamento_por_faixa_horaria(
  p_inicio date, p_fim date,
  p_colaborador_id text DEFAULT NULL, p_grupo_de_produto text DEFAULT NULL,
  p_servicos_ou_produtos text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE
AS $function$
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
bucketed as (
  select
    case
      when extract(hour from venda_data_ts) >= 9  and extract(hour from venda_data_ts) < 11 then '09–11'
      when extract(hour from venda_data_ts) >= 11 and extract(hour from venda_data_ts) < 14 then '11–14'
      when extract(hour from venda_data_ts) >= 14 and extract(hour from venda_data_ts) < 17 then '14–17'
      when extract(hour from venda_data_ts) >= 17 and extract(hour from venda_data_ts) < 20 then '17–20'
      else 'Outros'
    end as bucket,
    valor_faturamento
  from base
),
agg as (select bucket, coalesce(sum(valor_faturamento),0)::numeric as valor from bucketed group by 1),
tot as (select coalesce(sum(valor),0)::numeric as total from agg),
ord as (select * from (values ('09–11',1),('11–14',2),('14–17',3),('17–20',4),('Outros',5)) as t(bucket,ordem)),
tab as (
  select o.ordem, o.bucket, coalesce(a.valor,0)::numeric as valor,
    case when (select total from tot) = 0 then 0 else (coalesce(a.valor,0)/(select total from tot)) end as share
  from ord o left join agg a using (bucket) order by o.ordem
)
select jsonb_build_object(
  'meta', jsonb_build_object(
    'inicio', p_inicio, 'fim', p_fim,
    'filtros', jsonb_build_object('colaborador_id', p_colaborador_id, 'grupo_de_produto', p_grupo_de_produto, 'servicos_ou_produtos', p_servicos_ou_produtos),
    'total', (select total from tot)
  ),
  'series', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'valor', valor) order by ordem) from tab), '[]'::jsonb),
  'table', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'valor', valor, 'share', share) order by ordem) from tab), '[]'::jsonb),
  'insights', jsonb_build_array('Faixas horárias com filtro de produto válido.')
);
$function$;

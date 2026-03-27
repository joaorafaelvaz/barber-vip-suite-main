-- Fix SECURITY DEFINER functions missing SET search_path = public

ALTER FUNCTION public.admin_truncate_vendas_api_raw_tmp() SET search_path = public;
ALTER FUNCTION public.app_is_master() SET search_path = public;
ALTER FUNCTION public.fn_current_user_context() SET search_path = public;
ALTER FUNCTION public.fn_raw_replace_period(p_inicio date, p_fim date) SET search_path = public;

ALTER FUNCTION public.rpc_clientes_carteira_compartilhada(p_ref date, p_janelas integer[]) SET search_path = public;

ALTER FUNCTION public.rpc_clientes_lista_carteira(p_ref date, p_janela_dias integer, p_colaborador_id text, p_modo text, p_limit integer, p_offset integer, p_export boolean) SET search_path = public;

ALTER FUNCTION public.rpc_clientes_lista_carteira(p_ref date, p_janela_dias integer, p_colaborador_id text, p_modo text, p_limit integer, p_offset integer, p_export boolean, p_excluir_sem_cadastro boolean) SET search_path = public;

ALTER FUNCTION public.rpc_clientes_unicos_evolucao(p_ref date, p_janelas integer[], p_tipo text) SET search_path = public;

ALTER FUNCTION public.rpc_clientes_unicos_evolucao(p_ref date, p_janelas integer[]) SET search_path = public;

ALTER FUNCTION public.rpc_dashboard_daily(p_inicio date, p_fim date, p_colaborador_id text, p_tipo_colaborador text) SET search_path = public;

ALTER FUNCTION public.rpc_dashboard_kpis(p_inicio date, p_fim date, p_colaborador_id text, p_tipo_colaborador text) SET search_path = public;

ALTER FUNCTION public.rpc_raiox_clientes_churn_drill_v1(p_inicio text, p_fim text, p_janela_dias integer, p_colaborador_id text, p_excluir_sem_cadastro boolean, p_tipo text, p_valor text, p_limit integer, p_churn_dias_sem_voltar integer, p_risco_min_dias integer, p_risco_max_dias integer, p_cadencia_min_visitas integer, p_atribuicao_modo text, p_atribuicao_janela_meses integer, p_base_mode text, p_base_corte_meses integer, p_ref_mode text) SET search_path = public;

ALTER FUNCTION public.rpc_raiox_clientes_churn_evolucao_barbeiro_v1(p_inicio text, p_fim text, p_janela_dias integer, p_colaborador_id text, p_excluir_sem_cadastro boolean, p_churn_dias_sem_voltar integer, p_risco_min_dias integer, p_risco_max_dias integer, p_cadencia_min_visitas integer, p_resgate_dias_minimos integer, p_atribuicao_modo text, p_atribuicao_janela_meses integer, p_base_mode text, p_base_corte_meses integer, p_ref_mode text) SET search_path = public;

ALTER FUNCTION public.rpc_raiox_clientes_churn_evolucao_v1(p_inicio text, p_fim text, p_janela_dias integer, p_colaborador_id text, p_excluir_sem_cadastro boolean, p_churn_dias_sem_voltar integer, p_risco_min_dias integer, p_risco_max_dias integer, p_cadencia_min_visitas integer, p_resgate_dias_minimos integer, p_atribuicao_modo text, p_atribuicao_janela_meses integer, p_base_mode text, p_base_corte_meses integer, p_ref_mode text) SET search_path = public;

ALTER FUNCTION public.rpc_raiox_clientes_churn_evolucao_v2(p_inicio text, p_fim text, p_janela_dias integer, p_colaborador_id text, p_excluir_sem_cadastro boolean, p_churn_dias_sem_voltar integer, p_risco_min_dias integer, p_risco_max_dias integer, p_cadencia_min_visitas integer, p_resgate_dias_minimos integer, p_atribuicao_modo text, p_atribuicao_janela_meses integer, p_base_mode text, p_base_corte_meses integer, p_ref_mode text) SET search_path = public;

ALTER FUNCTION public.rpc_raiox_clientes_churn_v1(p_inicio text, p_fim text, p_janela_dias integer, p_colaborador_id text, p_excluir_sem_cadastro boolean, p_churn_dias_sem_voltar integer, p_risco_min_dias integer, p_risco_max_dias integer, p_cadencia_min_visitas integer, p_resgate_dias_minimos integer, p_atribuicao_modo text, p_atribuicao_janela_meses integer, p_base_mode text, p_base_corte_meses integer, p_ref_mode text) SET search_path = public;

ALTER FUNCTION public.rpc_raiox_visaogeral_drill_mensal_v1(p_ano_mes text, p_tipo text, p_colaborador_id text, p_risco_min_dias integer, p_risco_max_dias integer, p_resgate_dias_minimos integer, p_excluir_sem_cadastro boolean, p_limit integer, p_offset integer) SET search_path = public;

ALTER FUNCTION public.rpc_servicos_analise(p_data_inicio date, p_data_fim date, p_colaborador_id text, p_tipo_servico text, p_agrupamento text) SET search_path = public;

ALTER FUNCTION public.rpc_sync_contaazul_to_finance(p_tenant_id uuid, p_data_inicio date, p_data_fim date) SET search_path = public;
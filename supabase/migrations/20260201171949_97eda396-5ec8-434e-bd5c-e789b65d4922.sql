-- ============================================================
-- MIGRAÇÃO: Corrigir rpc_get_last_faturamento_date
-- PROBLEMA: Função retorna primeiro dia do mês quando não há
--           dados no mês atual, ao invés da última data real
-- SOLUÇÃO: Buscar globalmente a última data com faturamento
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_get_last_faturamento_date()
 RETURNS date
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_last_date date;
BEGIN
  -- Busca a última data com faturamento em toda a base
  -- (não limitado ao mês atual)
  SELECT MAX(venda_dia::date)
  INTO v_last_date
  FROM vw_vendas_kpi_base
  WHERE valor_faturamento > 0;
  
  -- Se não encontrou dados, retorna primeiro dia do mês atual
  IF v_last_date IS NULL THEN
    RETURN date_trunc('month', CURRENT_DATE)::date;
  END IF;
  
  RETURN v_last_date;
END;
$function$;
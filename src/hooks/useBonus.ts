/**
 * Hook para gerenciar regras de bônus e calcular bônus dos colaboradores
 * 
 * IMPORTANTE:
 * - NÃO recalcula KPIs a partir de vendas
 * - Usa KPIs já existentes da RPC rpc_dashboard_period
 * - Bônus = regra + lookup de KPI + matemática simples
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  BonusRegra,
  BonusFaixa,
  BonusRegraPeriodo,
  BonusRegraCompleta,
  BonusResultado,
  BonusRegraInput,
  ColaboradorKpis,
  KpiKey,
  MetaOperador,
} from '@/types/bonus';

// ============================================================
// QUERIES
// ============================================================

/**
 * Busca regras de bônus ativas para um período específico
 */
export function useBonusRegrasPeriodo(ano: number, mes: number) {
  return useQuery({
    queryKey: ['bonus-regras-periodo', ano, mes],
    queryFn: async (): Promise<BonusRegraCompleta[]> => {
      // Buscar IDs das regras ativas no período
      const { data: periodos, error: errPer } = await supabase
        .from('bonus_regras_periodos')
        .select('regra_id')
        .eq('ano', ano)
        .eq('mes', mes);

      if (errPer) throw errPer;
      if (!periodos || periodos.length === 0) return [];

      const regraIds = periodos.map((p) => p.regra_id);

      // Buscar regras
      const { data: regras, error: errRegras } = await supabase
        .from('bonus_regras')
        .select('*')
        .in('id', regraIds)
        .eq('ativo', true);

      if (errRegras) throw errRegras;
      if (!regras || regras.length === 0) return [];

      // Buscar faixas
      const { data: faixas, error: errFaixas } = await supabase
        .from('bonus_faixas')
        .select('*')
        .in('regra_id', regraIds)
        .order('faixa_ordem');

      if (errFaixas) throw errFaixas;

      // Buscar todos os períodos das regras
      const { data: todosPeriodos, error: errTodosPer } = await supabase
        .from('bonus_regras_periodos')
        .select('*')
        .in('regra_id', regraIds);

      if (errTodosPer) throw errTodosPer;

      // Montar estrutura completa
      return regras.map((regra) => ({
        regra: regra as BonusRegra,
        faixas: (faixas || []).filter((f) => f.regra_id === regra.id) as BonusFaixa[],
        periodos: (todosPeriodos || []).filter((p) => p.regra_id === regra.id) as BonusRegraPeriodo[],
      }));
    },
  });
}

/**
 * Busca todas as regras de bônus (para listagem/edição)
 */
export function useBonusRegrasAll() {
  return useQuery({
    queryKey: ['bonus-regras-all'],
    queryFn: async (): Promise<BonusRegraCompleta[]> => {
      const { data: regras, error: errRegras } = await supabase
        .from('bonus_regras')
        .select('*')
        .order('created_at', { ascending: false });

      if (errRegras) throw errRegras;
      if (!regras || regras.length === 0) return [];

      const regraIds = regras.map((r) => r.id);

      const { data: faixas } = await supabase
        .from('bonus_faixas')
        .select('*')
        .in('regra_id', regraIds)
        .order('faixa_ordem');

      const { data: periodos } = await supabase
        .from('bonus_regras_periodos')
        .select('*')
        .in('regra_id', regraIds);

      return regras.map((regra) => ({
        regra: regra as BonusRegra,
        faixas: (faixas || []).filter((f) => f.regra_id === regra.id) as BonusFaixa[],
        periodos: (periodos || []).filter((p) => p.regra_id === regra.id) as BonusRegraPeriodo[],
      }));
    },
  });
}

/**
 * Busca histórico de resultados de bônus
 */
export function useBonusHistorico(ano?: number, mes?: number, colaboradorId?: string) {
  return useQuery({
    queryKey: ['bonus-historico', ano, mes, colaboradorId],
    queryFn: async () => {
      let query = supabase
        .from('bonus_historico_resultado')
        .select('*, bonus_regras(nome_bonus, descricao_regra)')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });

      if (ano) query = query.eq('ano', ano);
      if (mes) query = query.eq('mes', mes);
      if (colaboradorId) query = query.eq('colaborador_id', colaboradorId);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Criar nova regra de bônus
 */
export function useCreateBonusRegra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BonusRegraInput) => {
      // 1. Inserir regra
      const { data: regra, error: errRegra } = await supabase
        .from('bonus_regras')
        .insert({
          nome_bonus: input.nome_bonus,
          descricao_regra: input.descricao_regra,
          colaborador_id: input.colaborador_id,
          ativo: input.ativo ?? true,
          tipo_bonus: input.tipo_bonus,
          base_calculo: input.base_calculo,
          bonus_valor: input.bonus_valor,
          depende_meta: input.depende_meta ?? false,
          kpi_key: input.kpi_key,
          item_alvo: input.item_alvo,
          meta_operador: input.meta_operador ?? '>=',
          meta_valor: input.meta_valor,
          usa_escalonamento: input.usa_escalonamento ?? false,
        })
        .select()
        .single();

      if (errRegra) throw errRegra;

      // 2. Inserir faixas (se houver)
      if (input.faixas && input.faixas.length > 0) {
        const faixasData = input.faixas.map((f) => ({
          regra_id: regra.id,
          faixa_ordem: f.faixa_ordem,
          valor_minimo: f.valor_minimo,
          valor_maximo: f.valor_maximo,
          bonus_valor: f.bonus_valor,
          nome: f.nome,
        }));

        const { error: errFaixas } = await supabase.from('bonus_faixas').insert(faixasData);
        if (errFaixas) throw errFaixas;
      }

      // 3. Inserir períodos
      if (input.periodos && input.periodos.length > 0) {
        const periodosData = input.periodos.map((p) => ({
          regra_id: regra.id,
          ano: p.ano,
          mes: p.mes,
        }));

        const { error: errPer } = await supabase.from('bonus_regras_periodos').insert(periodosData);
        if (errPer) throw errPer;
      }

      return regra;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus-regras'] });
      toast.success('Regra de bônus criada com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao criar regra: ${error.message}`);
    },
  });
}

/**
 * Atualizar regra de bônus existente
 */
export function useUpdateBonusRegra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: BonusRegraInput & { id: string }) => {
      // 1. Atualizar regra
      const { error: errRegra } = await supabase
        .from('bonus_regras')
        .update({
          nome_bonus: input.nome_bonus,
          descricao_regra: input.descricao_regra,
          colaborador_id: input.colaborador_id,
          ativo: input.ativo,
          tipo_bonus: input.tipo_bonus,
          base_calculo: input.base_calculo,
          bonus_valor: input.bonus_valor,
          depende_meta: input.depende_meta,
          kpi_key: input.kpi_key,
          item_alvo: input.item_alvo,
          meta_operador: input.meta_operador,
          meta_valor: input.meta_valor,
          usa_escalonamento: input.usa_escalonamento,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (errRegra) throw errRegra;

      // 2. Recriar faixas
      if (input.faixas !== undefined) {
        await supabase.from('bonus_faixas').delete().eq('regra_id', id);

        if (input.faixas.length > 0) {
          const faixasData = input.faixas.map((f) => ({
            regra_id: id,
            faixa_ordem: f.faixa_ordem,
            valor_minimo: f.valor_minimo,
            valor_maximo: f.valor_maximo,
            bonus_valor: f.bonus_valor,
            nome: f.nome,
          }));

          const { error: errFaixas } = await supabase.from('bonus_faixas').insert(faixasData);
          if (errFaixas) throw errFaixas;
        }
      }

      // 3. Recriar períodos
      if (input.periodos !== undefined) {
        await supabase.from('bonus_regras_periodos').delete().eq('regra_id', id);

        if (input.periodos.length > 0) {
          const periodosData = input.periodos.map((p) => ({
            regra_id: id,
            ano: p.ano,
            mes: p.mes,
          }));

          const { error: errPer } = await supabase.from('bonus_regras_periodos').insert(periodosData);
          if (errPer) throw errPer;
        }
      }

      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus-regras'] });
      toast.success('Regra de bônus atualizada');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar regra: ${error.message}`);
    },
  });
}

/**
 * Excluir regra de bônus
 */
export function useDeleteBonusRegra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bonus_regras').delete().eq('id', id);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus-regras'] });
      toast.success('Regra de bônus excluída');
    },
    onError: (error) => {
      toast.error(`Erro ao excluir regra: ${error.message}`);
    },
  });
}

// ============================================================
// CÁLCULO DE BÔNUS
// ============================================================

/**
 * Avalia se a meta foi atingida
 */
function avaliarMeta(kpiValor: number, operador: MetaOperador, metaValor: number): boolean {
  switch (operador) {
    case '>=':
      return kpiValor >= metaValor;
    case '>':
      return kpiValor > metaValor;
    case '=':
      return kpiValor === metaValor;
    case 'faixa':
      // Para faixas, retorna true se estiver em alguma faixa (verificar separadamente)
      return true;
    default:
      return false;
  }
}

/**
 * Encontra a faixa correspondente ao valor do KPI
 */
function encontrarFaixa(kpiValor: number, faixas: BonusFaixa[]): BonusFaixa | null {
  for (const faixa of faixas.sort((a, b) => a.faixa_ordem - b.faixa_ordem)) {
    const min = faixa.valor_minimo;
    const max = faixa.valor_maximo;

    if (kpiValor >= min && (max === null || kpiValor <= max)) {
      return faixa;
    }
  }
  return null;
}

/**
 * Encontra a próxima faixa
 */
function encontrarProximaFaixa(faixaAtual: BonusFaixa | null, faixas: BonusFaixa[]): BonusFaixa | null {
  if (!faixaAtual) return faixas[0] || null;

  const sorted = faixas.sort((a, b) => a.faixa_ordem - b.faixa_ordem);
  const idx = sorted.findIndex((f) => f.id === faixaAtual.id);
  return sorted[idx + 1] || null;
}

/**
 * Obtém o valor do KPI de um colaborador
 */
function obterValorKpi(kpis: ColaboradorKpis, kpiKey: KpiKey | null): number {
  if (!kpiKey) return 0;

  switch (kpiKey) {
    case 'faturamento':
      return kpis.faturamento || 0;
    case 'atendimentos':
      return kpis.atendimentos || 0;
    case 'clientes':
      return kpis.clientes || 0;
    case 'clientes_novos':
      return kpis.clientes_novos || 0;
    case 'servicos_totais':
      return kpis.servicos_totais || 0;
    case 'extras_qtd':
      return kpis.extras_qtd || 0;
    case 'extras_valor':
      return kpis.extras_valor || 0;
    case 'dias_trabalhados':
      return kpis.dias_trabalhados || 0;
    case 'ticket_medio':
      return kpis.ticket_medio || 0;
    case 'faturamento_por_dia':
      return kpis.faturamento_por_dia || 0;
    case 'item_qtd':
      return kpis.item_qtd || 0;
    case 'item_valor':
      return kpis.item_valor || 0;
    default:
      return 0;
  }
}

/**
 * Obtém o valor da base de cálculo
 */
function obterValorBase(kpis: ColaboradorKpis, baseCalculo: string | null): number {
  switch (baseCalculo) {
    case 'faturamento_total':
      return kpis.faturamento || 0;
    case 'faturamento_extras':
      return kpis.faturamento_extras || kpis.extras_valor || 0;
    case 'faturamento_base':
      return kpis.faturamento_base || 0;
    case 'comissao_total':
      return kpis.comissao_total || 0;
    default:
      return 0;
  }
}

/**
 * Calcula o bônus para um colaborador com base em uma regra
 */
export function calcularBonus(
  regra: BonusRegraCompleta,
  kpis: ColaboradorKpis
): BonusResultado {
  const { regra: r, faixas } = regra;

  // Verificar se aplica ao colaborador
  if (r.colaborador_id && r.colaborador_id !== kpis.colaborador_id) {
    return {
      regra_id: r.id,
      nome_bonus: r.nome_bonus,
      descricao: r.descricao_regra,
      aplicavel: false,
      atingiu: false,
      kpi_realizado: 0,
      meta: r.meta_valor,
      bonus_calculado: 0,
      progresso_meta: 0,
    };
  }

  // Obter valor do KPI
  const kpiValor = obterValorKpi(kpis, r.kpi_key);
  const meta = r.meta_valor || 0;
  const dias = kpis.dias_trabalhados || 1;

  // Calcular progresso
  const progressoMeta = meta > 0 ? Math.min((kpiValor / meta) * 100, 100) : 100;
  const metaPorDia = meta / 30; // Assumindo 30 dias no mês
  const realizadoPorDia = kpiValor / dias;
  const diferencaMeta = kpiValor - meta;

  // Verificar meta (se aplicável)
  let atingiu = true;
  if (r.depende_meta && r.meta_valor !== null) {
    atingiu = avaliarMeta(kpiValor, r.meta_operador as MetaOperador, r.meta_valor);
  }

  // Se não atingiu a meta, bônus = 0
  if (!atingiu) {
    return {
      regra_id: r.id,
      nome_bonus: r.nome_bonus,
      descricao: r.descricao_regra,
      aplicavel: true,
      atingiu: false,
      kpi_realizado: kpiValor,
      meta: r.meta_valor,
      bonus_calculado: 0,
      progresso_meta: progressoMeta,
      meta_por_dia: metaPorDia,
      realizado_por_dia: realizadoPorDia,
      diferenca_meta: diferencaMeta,
    };
  }

  // Calcular bônus
  let bonus = 0;
  let faixaAtual: BonusFaixa | null = null;
  let proximaFaixa: BonusFaixa | null = null;

  if (r.usa_escalonamento && faixas.length > 0) {
    faixaAtual = encontrarFaixa(kpiValor, faixas);
    proximaFaixa = encontrarProximaFaixa(faixaAtual, faixas);
    bonus = faixaAtual?.bonus_valor || 0;
  } else {
    const valorBonus = r.bonus_valor || 0;

    switch (r.tipo_bonus) {
      case 'percentual_extra':
        // +X% sobre comissão
        bonus = (kpis.comissao_total || 0) * (valorBonus / 100);
        break;
      case 'percentual_faturamento':
        // X% sobre base
        const base = obterValorBase(kpis, r.base_calculo);
        bonus = base * (valorBonus / 100);
        break;
      case 'valor_fixo':
        // R$ X fixo
        bonus = valorBonus;
        break;
      case 'valor_por_unidade':
        // R$ X por unidade acima da meta
        const excedente = kpiValor - (r.meta_valor || 0);
        bonus = excedente > 0 ? excedente * valorBonus : 0;
        break;
    }
  }

  return {
    regra_id: r.id,
    nome_bonus: r.nome_bonus,
    descricao: r.descricao_regra,
    aplicavel: true,
    atingiu: true,
    kpi_realizado: kpiValor,
    meta: r.meta_valor,
    bonus_calculado: bonus,
    faixa_atual: faixaAtual,
    proxima_faixa: proximaFaixa,
    progresso_meta: progressoMeta,
    meta_por_dia: metaPorDia,
    realizado_por_dia: realizadoPorDia,
    diferenca_meta: diferencaMeta,
  };
}

/**
 * Hook para calcular bônus de todos os colaboradores em um período
 */
export function useBonusCalculado(ano: number, mes: number, colaboradores: ColaboradorKpis[]) {
  const { data: regras, isLoading } = useBonusRegrasPeriodo(ano, mes);

  const bonusCalculados = useMemo(() => {
    if (!regras || regras.length === 0) return new Map<string, BonusResultado[]>();

    const resultado = new Map<string, BonusResultado[]>();

    for (const colab of colaboradores) {
      const bonusList: BonusResultado[] = [];

      for (const regra of regras) {
        const bonus = calcularBonus(regra, colab);
        if (bonus.aplicavel) {
          bonusList.push(bonus);
        }
      }

      if (bonusList.length > 0) {
        resultado.set(colab.colaborador_id, bonusList);
      }
    }

    return resultado;
  }, [regras, colaboradores]);

  return { bonusCalculados, isLoading };
}

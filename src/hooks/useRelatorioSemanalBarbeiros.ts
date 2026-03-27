// ============================================================
// FILE: src/hooks/useRelatorioSemanalBarbeiros.ts
// PROPÓSITO: Fetch de dados por barbeiro para semana específica
// FONTE: rpc_dashboard_period (by_colaborador field)
// CORREÇÃO: Usa comissao_pct do mês inteiro (não da semana)
//           + breakdown serviços/produtos via vw_vendas_kpi_base
//           + regras comissão por tipo (SERVICO/PRODUTO)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { lastDayOfMonth, parseISO } from 'date-fns';
import type { ByColaborador, DashboardData } from '@/components/dashboard/types';
import {
  calcularComissaoPorRegraComBaseDiferente,
  calcularComissaoPorRegra,
} from './useRegrasComissao';
import type { RegraComissaoCompleta, FaixaComissaoPeriodo, RegraComissaoPeriodo } from '@/types/comissao';

interface BarbeirosWeekData {
  barbeiros: ByColaborador[];
  barbeirosAnterior: ByColaborador[];
}

interface BreakdownItem {
  base: number;
  extras: number;
  produtos: number;
}

function safeNumber(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function parseValorFaturamento(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!/^\s*-?\d+(\.\d+)?\s*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Busca breakdown base/extras/produtos da vw_vendas_kpi_base para um período */
async function fetchBreakdown(inicio: string, fim: string): Promise<Map<string, BreakdownItem>> {
  const map = new Map<string, BreakdownItem>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('vw_vendas_kpi_base')
      .select('colaborador_id,is_servico,is_extra,is_produto,is_base,valor_faturamento')
      .gte('venda_dia', inicio)
      .lte('venda_dia', fim)
      .not('colaborador_id', 'is', null)
      .not('produto', 'is', null)
      .neq('produto', '')
      .or('is_credito.is.null,is_credito.eq.false')
      .order('venda_dia', { ascending: true })
      .range(from, to);

    if (error) throw error;
    const rows = data || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const colabId = (row as any).colaborador_id as string | null;
      if (!colabId) continue;
      const valorNum = parseValorFaturamento((row as any).valor_faturamento);
      if (valorNum === null) continue;

      const isExtra = Boolean((row as any).is_extra);
      const isProduto = Boolean((row as any).is_produto);
      const isBaseFlag = (row as any).is_base;
      const isServico = Boolean((row as any).is_servico);
      const isBase = isBaseFlag === true ? true : (isBaseFlag === false ? false : (isServico && !isExtra));

      const existing = map.get(colabId) || { base: 0, extras: 0, produtos: 0 };
      if (isBase) existing.base += valorNum;
      if (isExtra) existing.extras += valorNum;
      if (isProduto) existing.produtos += valorNum;
      map.set(colabId, existing);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return map;
}

/** Busca regras de comissão (SERVICO e PRODUTO) para o mês */
async function fetchRegras(ano: number, mes: number): Promise<{
  regraServicos: RegraComissaoCompleta | null;
  regraProdutos: RegraComissaoCompleta | null;
}> {
  // Buscar regras globais do mês (ou fallback para mês anterior)
  async function buscarRegra(tipo: string): Promise<RegraComissaoCompleta | null> {
    // 1. Regra global do mês
    const { data: regraGlobal } = await supabase
      .from('regras_comissao_periodo')
      .select('*')
      .eq('ano', ano)
      .eq('mes', mes)
      .eq('tipo', tipo)
      .is('colaborador_id', null)
      .maybeSingle();

    if (regraGlobal) {
      const { data: faixas } = await supabase
        .from('faixas_comissao_periodo')
        .select('*')
        .eq('regra_id', regraGlobal.id)
        .order('faixa_ordem', { ascending: true });

      return {
        regra: regraGlobal as RegraComissaoPeriodo,
        faixas: (faixas || []) as FaixaComissaoPeriodo[],
      };
    }

    // 2. Fallback: mês anterior mais recente
    const { data: regraAnterior } = await supabase
      .from('regras_comissao_periodo')
      .select('*')
      .eq('tipo', tipo)
      .is('colaborador_id', null)
      .or(`ano.lt.${ano},and(ano.eq.${ano},mes.lt.${mes})`)
      .order('ano', { ascending: false })
      .order('mes', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (regraAnterior) {
      const { data: faixas } = await supabase
        .from('faixas_comissao_periodo')
        .select('*')
        .eq('regra_id', regraAnterior.id)
        .order('faixa_ordem', { ascending: true });

      return {
        regra: regraAnterior as RegraComissaoPeriodo,
        faixas: (faixas || []) as FaixaComissaoPeriodo[],
      };
    }

    return null;
  }

  const [regraServicos, regraProdutos] = await Promise.all([
    buscarRegra('SERVICO'),
    buscarRegra('PRODUTO'),
  ]);

  return { regraServicos, regraProdutos };
}

async function fetchBarbeirosWeek(
  inicio: string,
  fim: string,
  inicioAnterior: string | null,
  fimAnterior: string | null
): Promise<BarbeirosWeekData> {
  const inicioMes = `${inicio.slice(0, 7)}-01`;
  const fimMes = lastDayOfMonth(parseISO(inicio)).toISOString().slice(0, 10);
  const ano = parseInt(inicio.slice(0, 4));
  const mes = parseInt(inicio.slice(5, 7));

  const [atual, anterior, mensal, breakdownSemanal, regras] = await Promise.all([
    supabase.rpc('rpc_dashboard_period', {
      p_inicio: inicio,
      p_fim: fim,
      p_colaborador_id: null,
      p_tipo_colaborador: null,
    }),
    inicioAnterior && fimAnterior
      ? supabase.rpc('rpc_dashboard_period', {
          p_inicio: inicioAnterior,
          p_fim: fimAnterior,
          p_colaborador_id: null,
          p_tipo_colaborador: null,
        })
      : Promise.resolve({ data: null, error: null }),
    // Mês inteiro para faturamento total mensal (determina faixa)
    supabase.rpc('rpc_dashboard_period', {
      p_inicio: inicioMes,
      p_fim: fimMes,
      p_colaborador_id: null,
      p_tipo_colaborador: null,
    }),
    // Breakdown semanal (base/extras/produtos)
    fetchBreakdown(inicio, fim),
    // Regras de comissão do mês
    fetchRegras(ano, mes),
  ]);

  if (atual.error) throw new Error(atual.error.message);

  const atualData = atual.data as unknown as DashboardData;
  const anteriorData = anterior.data as unknown as DashboardData | null;
  const mensalData = mensal.data as unknown as DashboardData | null;

  // Mapa de faturamento TOTAL mensal por barbeiro (para determinar faixa)
  const fatMensalMap = new Map<string, number>();
  if (mensalData?.by_colaborador) {
    for (const b of mensalData.by_colaborador) {
      if (b.colaborador_id) {
        fatMensalMap.set(b.colaborador_id, safeNumber(b.faturamento));
      }
    }
  }

  const { regraServicos, regraProdutos } = regras;

  // Enriquecer barbeiros com comissão correta
  const barbeiros = (atualData?.by_colaborador ?? []).map(b => {
    const bd = breakdownSemanal.get(b.colaborador_id) || { base: 0, extras: 0, produtos: 0 };
    const fatBase = safeNumber(bd.base);
    const fatExtras = safeNumber(bd.extras);
    const fatProdutos = safeNumber(bd.produtos);
    const fatTotalMensal = fatMensalMap.get(b.colaborador_id) ?? safeNumber(b.faturamento);

    // Comissão sobre BASE (faixa baseada no total MENSAL)
    const rBase = calcularComissaoPorRegraComBaseDiferente(fatTotalMensal, fatBase, regraServicos || null);
    // Comissão sobre EXTRAS (faixa baseada no total MENSAL)
    const rExtras = calcularComissaoPorRegraComBaseDiferente(fatTotalMensal, fatExtras, regraServicos || null);
    // Comissão sobre PRODUTOS (regra própria)
    const rProd = calcularComissaoPorRegra(fatProdutos, regraProdutos || null);

    const comissaoServicos = safeNumber(rBase.comissao) + safeNumber(rExtras.comissao);
    const comissaoProdutos = safeNumber(rProd.comissao);
    const comissaoTotal = comissaoServicos + comissaoProdutos;

    return {
      ...b,
      comissao_pct: safeNumber(rBase.percentual),
      comissao: Math.round(comissaoTotal * 100) / 100,
      // Campos adicionais para breakdown
      faturamento_servicos_base: fatBase,
      faturamento_produtos: fatProdutos,
      comissao_servicos: Math.round(comissaoServicos * 100) / 100,
      comissao_produtos: Math.round(comissaoProdutos * 100) / 100,
      comissao_extras: Math.round(safeNumber(rExtras.comissao) * 100) / 100,
      comissao_pct_servicos: safeNumber(rBase.percentual),
      comissao_pct_produtos: safeNumber(rProd.percentual),
    };
  });

  return {
    barbeiros,
    barbeirosAnterior: anteriorData?.by_colaborador ?? [],
  };
}

export function useRelatorioSemanalBarbeiros(
  inicio: string | null,
  fim: string | null,
  inicioAnterior: string | null,
  fimAnterior: string | null,
  enabled = true
) {
  const { data, isFetching, error } = useQuery({
    queryKey: ['semanal-barbeiros', inicio, fim, inicioAnterior, fimAnterior],
    queryFn: () => fetchBarbeirosWeek(inicio!, fim!, inicioAnterior, fimAnterior),
    enabled: enabled && !!inicio && !!fim,
    staleTime: 5 * 60 * 1000,
  });

  return {
    barbeiros: data?.barbeiros ?? [],
    barbeirosAnterior: data?.barbeirosAnterior ?? [],
    loading: isFetching,
    error: error ? (error as Error).message : null,
  };
}

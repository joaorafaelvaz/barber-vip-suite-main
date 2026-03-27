/**
 * Hook para calcular comissões dos colaboradores
 *
 * Conceitos:
 * - Serviços TOTAL = Base + Extras
 * - S. Base = somente base
 * - Extras = somente extras
 * - Comissão total = comissão(base) + comissão(extras) + comissão(produtos)
 *
 * Origens:
 * 1) TOTAL + dias: rpc_dashboard_period (fonte de verdade do TOTAL)
 * 2) BASE/EXTRAS/PRODUTOS: vw_vendas_kpi_base (com paginação, sem corte ~1000)
 * 3) Regras: regras_comissao_periodo + faixas_comissao_periodo
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useRegrasEfetivasMes,
  calcularComissaoPorRegra,
  calcularComissaoPorRegraComBaseDiferente,
} from './useRegrasComissao';
import { ComissaoColaborador, ResumoComissoes } from '@/types/comissao';
import { ByColaborador } from '@/components/dashboard/types';

interface ColaboradorFaturamentoInternal {
  colaborador_id: string;
  colaborador_nome: string;

  servicos_base: number;   // somente base
  servicos_extras: number; // somente extras
  produtos: number;

  total: number;           // RPC
  dias_trabalhados: number;// RPC

  // ✅ KPIs da RPC para bônus
  atendimentos: number;
  clientes: number;
  clientes_novos: number;
  servicos_totais: number;
  extras_qtd: number;
  ticket_medio: number;
}

function safeNumber(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/** YYYY-MM-DD do último dia do mês (sem risco de timezone) */
function lastDayOfMonthISO(ano: number, mes: number) {
  const d = new Date(Date.UTC(ano, mes, 0));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Conversão segura (igual ao seu SQL):
 * aceita "65", "32.5", "-10", "0.99", com espaços
 */
function parseValorFaturamento(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!/^\s*-?\d+(\.\d+)?\s*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function useFaturamentoColaboradores(ano: number, mes: number, tipoColaborador: 'barbeiro' | null = null) {
  return useQuery({
    queryKey: ['faturamento-colaboradores', ano, mes, tipoColaborador],
    queryFn: async (): Promise<ColaboradorFaturamentoInternal[]> => {
      const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const fimMes = lastDayOfMonthISO(ano, mes);

      // 1) RPC (TOTAL + dias)
      const { data: dashboardData, error: rpcError } = await supabase.rpc('rpc_dashboard_period', {
        p_inicio: inicioMes,
        p_fim: fimMes,
        p_colaborador_id: null,
        p_tipo_colaborador: tipoColaborador,
      });
      if (rpcError) throw rpcError;

      const byColaborador: ByColaborador[] = (dashboardData as any)?.by_colaborador || [];

      // 2) View breakdown com paginação
      const pageSize = 1000;
      let from = 0;

      const map = new Map<string, { base: number; extras: number; produtos: number }>();

      while (true) {
        const to = from + pageSize - 1;

        let q = supabase
          .from('vw_vendas_kpi_base')
          .select(
            [
              'colaborador_id',
              'tipo_colaborador',
              'venda_dia',
              'produto',
              'is_credito',
              'is_servico',
              'is_extra',
              'is_produto',
              'is_base',
              'valor_faturamento',
            ].join(',')
          )
          .gte('venda_dia', inicioMes)
          .lte('venda_dia', fimMes)
          .not('colaborador_id', 'is', null)
          .not('produto', 'is', null)
          .neq('produto', '')
          // COALESCE(is_credito,false)=false => inclui NULL e FALSE
          .or('is_credito.is.null,is_credito.eq.false')
          .order('venda_dia', { ascending: true })
          .order('colaborador_id', { ascending: true })
          .range(from, to);

        if (tipoColaborador) q = q.eq('tipo_colaborador', tipoColaborador);

        const { data, error } = await q;
        if (error) throw error;

        const rows = data || [];
        if (rows.length === 0) break;

        for (const row of rows) {
          const colabId = (row as any).colaborador_id as string | null;
          if (!colabId) continue;

          const valorNum = parseValorFaturamento((row as any).valor_faturamento);
          if (valorNum === null) continue;

          const isServico = Boolean((row as any).is_servico);
          const isExtra = Boolean((row as any).is_extra);
          const isProduto = Boolean((row as any).is_produto);

          // Preferir is_base; fallback: serviço e NÃO extra => base
          const isBaseFlag = (row as any).is_base;
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

      // 3) Merge (RPC + VIEW)
      return byColaborador.map((c) => {
        const b = map.get(c.colaborador_id) || { base: 0, extras: 0, produtos: 0 };
        return {
          colaborador_id: c.colaborador_id,
          colaborador_nome: c.colaborador_nome,
          servicos_base: safeNumber(b.base),
          servicos_extras: safeNumber(b.extras),
          produtos: safeNumber(b.produtos),
          total: safeNumber((c as any).faturamento),
          dias_trabalhados: safeNumber((c as any).dias_trabalhados),
          // ✅ KPIs da RPC para bônus
          atendimentos: safeNumber((c as any).atendimentos),
          clientes: safeNumber((c as any).clientes),
          clientes_novos: safeNumber((c as any).clientes_novos),
          servicos_totais: safeNumber((c as any).servicos_totais),
          extras_qtd: safeNumber((c as any).extras_qtd),
          ticket_medio: safeNumber((c as any).ticket_medio),
        };
      });
    },
  });
}

export function useComissoesMes(ano: number, mes: number, tipoColaborador: 'barbeiro' | null = null) {
  const { regraServicos, regraProdutos, isLoading: loadingRegras } = useRegrasEfetivasMes(ano, mes);
  const { data: faturamentos, isLoading: loadingFaturamentos } = useFaturamentoColaboradores(ano, mes, tipoColaborador);

  const comissoes = useMemo((): ComissaoColaborador[] => {
    if (!faturamentos) return [];

    return faturamentos
      .filter((f) => safeNumber(f.total) > 0)
      .map((f) => {
        const total = safeNumber(f.total);
        const base = safeNumber(f.servicos_base);
        const extras = safeNumber(f.servicos_extras);
        const produtos = safeNumber(f.produtos);

        const servicosTotal = base + extras;

        // Comissão sobre BASE (faixa baseada no TOTAL)
        const rBase = calcularComissaoPorRegraComBaseDiferente(total, base, regraServicos || null);

        // Comissão sobre EXTRAS (faixa baseada no TOTAL)
        const rExtras = calcularComissaoPorRegraComBaseDiferente(total, extras, regraServicos || null);

        // Comissão produtos
        const rProdutos = calcularComissaoPorRegra(produtos, regraProdutos || null);

        // ✅ Total correto (sem duplicar extras)
        const comissaoTotal =
          safeNumber(rBase.comissao) + safeNumber(rExtras.comissao) + safeNumber(rProdutos.comissao);

        const dias = safeNumber(f.dias_trabalhados);
        const faturamentoPorDia = dias > 0 ? total / dias : 0;

        return {
          colaborador_id: f.colaborador_id,
          colaborador_nome: f.colaborador_nome,

          // ✅ Novos campos (conceito explícito)
          faturamento_servicos_total: servicosTotal,
          faturamento_servicos_base: base,

          // ✅ Campos antigos (compat)
          faturamento_servicos: servicosTotal, // agora = serviços total
          faturamento_extras: extras,
          faturamento_produtos: produtos,
          faturamento_total: total,

          // Card: vamos usar "servicos" como S. Base (nome do card muda)
          servicos: {
            tipo: 'SERVICO' as const,
            faturamento: base,
            faixa: rBase.faixa,
            percentual: safeNumber(rBase.percentual),
            comissao: safeNumber(rBase.comissao),
            progressoProximaFaixa: safeNumber(rBase.progressoProximaFaixa),
            proximaFaixa: rBase.proximaFaixa,
          },

          extras: {
            tipo: 'SERVICO' as const,
            faturamento: extras,
            faixa: rExtras.faixa,
            percentual: safeNumber(rExtras.percentual),
            comissao: safeNumber(rExtras.comissao),
            progressoProximaFaixa: safeNumber(rExtras.progressoProximaFaixa),
            proximaFaixa: rExtras.proximaFaixa,
          },

          produtos: {
            tipo: 'PRODUTO' as const,
            faturamento: produtos,
            faixa: rProdutos.faixa,
            percentual: safeNumber(rProdutos.percentual),
            comissao: safeNumber(rProdutos.comissao),
            progressoProximaFaixa: safeNumber(rProdutos.progressoProximaFaixa),
            proximaFaixa: rProdutos.proximaFaixa,
          },

          comissao_total: comissaoTotal,
          dias_trabalhados: dias,
          faturamento_por_dia: faturamentoPorDia,

          // ✅ KPIs para bônus
          atendimentos: safeNumber(f.atendimentos),
          clientes: safeNumber(f.clientes),
          clientes_novos: safeNumber(f.clientes_novos),
          servicos_totais: safeNumber(f.servicos_totais),
          extras_qtd: safeNumber(f.extras_qtd),
          ticket_medio: safeNumber(f.ticket_medio),
        };
      })
      .sort((a, b) => safeNumber(b.faturamento_por_dia) - safeNumber(a.faturamento_por_dia));
  }, [faturamentos, regraServicos, regraProdutos]);

  const resumo = useMemo((): ResumoComissoes => {
    const totalFaturamento = comissoes.reduce((sum, c) => sum + safeNumber(c.faturamento_total), 0);

    // ✅ Serviços no resumo = SERVIÇOS TOTAL (base+extras)
    const totalServicos = comissoes.reduce((sum, c) => sum + safeNumber(c.faturamento_servicos_total ?? c.faturamento_servicos), 0);

    const totalExtras = comissoes.reduce((sum, c) => sum + safeNumber(c.faturamento_extras), 0);
    const totalProdutos = comissoes.reduce((sum, c) => sum + safeNumber(c.faturamento_produtos), 0);

    const totalComissoes = comissoes.reduce((sum, c) => sum + safeNumber(c.comissao_total), 0);
    const totalComissoesBase = comissoes.reduce((sum, c) => sum + safeNumber(c.servicos?.comissao), 0);
    const totalComissoesExtras = comissoes.reduce((sum, c) => sum + safeNumber(c.extras?.comissao), 0);
    const totalComissoesProdutos = comissoes.reduce((sum, c) => sum + safeNumber(c.produtos?.comissao), 0);

    const totalColaboradores = comissoes.length;
    const percentualMedio = totalFaturamento > 0 ? (totalComissoes / totalFaturamento) * 100 : 0;
    const mediaPorColaborador = totalColaboradores > 0 ? totalComissoes / totalColaboradores : 0;

    return {
      total_faturamento: totalFaturamento,
      total_faturamento_servicos: totalServicos,
      total_faturamento_extras: totalExtras,
      total_faturamento_produtos: totalProdutos,
      total_comissoes: totalComissoes,
      total_comissoes_servicos: totalComissoesBase,
      total_comissoes_extras: totalComissoesExtras,
      total_comissoes_produtos: totalComissoesProdutos,
      percentual_medio: percentualMedio,
      total_colaboradores: totalColaboradores,
      media_por_colaborador: mediaPorColaborador,
    };
  }, [comissoes]);

  return {
    comissoes,
    resumo,
    regraServicos,
    regraProdutos,
    isLoading: loadingRegras || loadingFaturamentos,
  };
}

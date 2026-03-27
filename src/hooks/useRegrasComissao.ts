/**
 * Hook para gerenciar regras de comissão por período
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  RegraComissaoPeriodo,
  FaixaComissaoPeriodo,
  RegraComissaoCompleta,
  TipoComissao,
  ConfiguracaoMesData,
} from '@/types/comissao';

/**
 * Busca regras de comissão de um período específico
 */
export function useRegrasComissaoPeriodo(ano: number, mes: number, colaboradorId?: string | null) {
  return useQuery({
    queryKey: ['regras-comissao-periodo', ano, mes, colaboradorId],
    queryFn: async (): Promise<RegraComissaoCompleta[]> => {
      let query = supabase
        .from('regras_comissao_periodo')
        .select('*')
        .eq('ano', ano)
        .eq('mes', mes);

      if (colaboradorId) {
        query = query.or(`colaborador_id.eq.${colaboradorId},colaborador_id.is.null`);
      } else {
        query = query.is('colaborador_id', null);
      }

      const { data: regras, error: regrasError } = await query;

      if (regrasError) throw regrasError;
      if (!regras?.length) return [];

      const { data: faixas, error: faixasError } = await supabase
        .from('faixas_comissao_periodo')
        .select('*')
        .in('regra_id', regras.map((r) => r.id))
        .order('faixa_ordem', { ascending: true });

      if (faixasError) throw faixasError;

      return regras.map((regra) => ({
        regra: regra as RegraComissaoPeriodo,
        faixas: (faixas?.filter((f) => f.regra_id === regra.id) || []) as FaixaComissaoPeriodo[],
      }));
    },
  });
}

/**
 * Busca regra efetiva para um colaborador/tipo
 * Prioriza: regra específica > regra global do mês > regra do mês anterior
 */
export function useRegraEfetiva(
  ano: number,
  mes: number,
  tipo: TipoComissao,
  colaboradorId?: string | null
) {
  return useQuery({
    queryKey: ['regra-efetiva', ano, mes, tipo, colaboradorId],
    queryFn: async (): Promise<RegraComissaoCompleta | null> => {
      // 1. Tentar regra específica do colaborador
      if (colaboradorId) {
        const { data: regraEspecifica } = await supabase
          .from('regras_comissao_periodo')
          .select('*')
          .eq('ano', ano)
          .eq('mes', mes)
          .eq('tipo', tipo)
          .eq('colaborador_id', colaboradorId)
          .maybeSingle();

        if (regraEspecifica) {
          const { data: faixas } = await supabase
            .from('faixas_comissao_periodo')
            .select('*')
            .eq('regra_id', regraEspecifica.id)
            .order('faixa_ordem', { ascending: true });

          return {
            regra: regraEspecifica as RegraComissaoPeriodo,
            faixas: (faixas || []) as FaixaComissaoPeriodo[],
          };
        }
      }

      // 2. Tentar regra global do mês
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

      // 3. Fallback: buscar mês anterior mais recente
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
    },
  });
}

/**
 * Hook para buscar regras efetivas de serviços e produtos de uma vez
 */
export function useRegrasEfetivasMes(ano: number, mes: number, colaboradorId?: string | null) {
  const { data: regraServicos, isLoading: loadingServicos } = useRegraEfetiva(
    ano,
    mes,
    'SERVICO',
    colaboradorId
  );
  const { data: regraProdutos, isLoading: loadingProdutos } = useRegraEfetiva(
    ano,
    mes,
    'PRODUTO',
    colaboradorId
  );

  return {
    regraServicos,
    regraProdutos,
    isLoading: loadingServicos || loadingProdutos,
  };
}

/**
 * Salvar configuração completa do mês
 */
export function useSalvarConfiguracaoMes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ano,
      mes,
      colaboradorId,
      config,
    }: {
      ano: number;
      mes: number;
      colaboradorId?: string | null;
      config: ConfiguracaoMesData;
    }) => {
      await salvarRegra(ano, mes, colaboradorId || null, 'SERVICO', config.servicos);
      await salvarRegra(ano, mes, colaboradorId || null, 'PRODUTO', config.produtos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regras-comissao-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['regra-efetiva'] });
      toast.success('Regras de comissão salvas com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao salvar regras:', error);
      toast.error('Erro ao salvar regras de comissão');
    },
  });
}

async function salvarRegra(
  ano: number,
  mes: number,
  colaboradorId: string | null,
  tipo: TipoComissao,
  data: ConfiguracaoMesData['servicos']
) {
  let queryExistente = supabase
    .from('regras_comissao_periodo')
    .select('id')
    .eq('ano', ano)
    .eq('mes', mes)
    .eq('tipo', tipo);

  if (colaboradorId) {
    queryExistente = queryExistente.eq('colaborador_id', colaboradorId);
  } else {
    queryExistente = queryExistente.is('colaborador_id', null);
  }

  const { data: regraExistente } = await queryExistente.maybeSingle();

  let regraId: string;

  if (regraExistente) {
    const { error } = await supabase
      .from('regras_comissao_periodo')
      .update({
        usa_escalonamento: data.usa_escalonamento,
        percentual_fixo: data.usa_escalonamento ? null : data.percentual_fixo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', regraExistente.id);

    if (error) throw error;
    regraId = regraExistente.id;

    await supabase.from('faixas_comissao_periodo').delete().eq('regra_id', regraId);
  } else {
    const { data: novaRegra, error } = await supabase
      .from('regras_comissao_periodo')
      .insert({
        ano,
        mes,
        colaborador_id: colaboradorId,
        tipo,
        usa_escalonamento: data.usa_escalonamento,
        percentual_fixo: data.usa_escalonamento ? null : data.percentual_fixo,
      })
      .select()
      .single();

    if (error) throw error;
    regraId = novaRegra.id;
  }

  if (data.usa_escalonamento && data.faixas.length > 0) {
    const faixasToInsert = data.faixas.map((f, index) => ({
      regra_id: regraId,
      faixa_ordem: index + 1,
      nome: f.nome,
      valor_minimo: f.valor_minimo,
      valor_maximo: f.valor_maximo,
      percentual: f.percentual,
      cor: f.cor,
    }));

    const { error } = await supabase.from('faixas_comissao_periodo').insert(faixasToInsert);
    if (error) throw error;
  }
}

/**
 * Copiar regras de um mês para outro
 */
export function useCopiarRegrasMes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      origemAno,
      origemMes,
      destinoAno,
      destinoMes,
      substituirExistente,
    }: {
      origemAno: number;
      origemMes: number;
      destinoAno: number;
      destinoMes: number;
      substituirExistente: boolean;
    }) => {
      const { data: regrasOrigem, error: erroOrigem } = await supabase
        .from('regras_comissao_periodo')
        .select('*')
        .eq('ano', origemAno)
        .eq('mes', origemMes);

      if (erroOrigem) throw erroOrigem;
      if (!regrasOrigem?.length) throw new Error('Nenhuma regra encontrada no mês de origem');

      for (const regraOrigem of regrasOrigem) {
        let queryDestino = supabase
          .from('regras_comissao_periodo')
          .select('id')
          .eq('ano', destinoAno)
          .eq('mes', destinoMes)
          .eq('tipo', regraOrigem.tipo);

        if (regraOrigem.colaborador_id) {
          queryDestino = queryDestino.eq('colaborador_id', regraOrigem.colaborador_id);
        } else {
          queryDestino = queryDestino.is('colaborador_id', null);
        }

        const { data: regraDestino } = await queryDestino.maybeSingle();

        if (regraDestino && !substituirExistente) {
          continue;
        }

        const { data: faixasOrigem } = await supabase
          .from('faixas_comissao_periodo')
          .select('*')
          .eq('regra_id', regraOrigem.id);

        if (regraDestino) {
          await supabase
            .from('regras_comissao_periodo')
            .update({
              usa_escalonamento: regraOrigem.usa_escalonamento,
              percentual_fixo: regraOrigem.percentual_fixo,
            })
            .eq('id', regraDestino.id);

          await supabase.from('faixas_comissao_periodo').delete().eq('regra_id', regraDestino.id);

          if (faixasOrigem?.length) {
            await supabase.from('faixas_comissao_periodo').insert(
              faixasOrigem.map((f) => ({
                regra_id: regraDestino.id,
                faixa_ordem: f.faixa_ordem,
                nome: f.nome,
                valor_minimo: f.valor_minimo,
                valor_maximo: f.valor_maximo,
                percentual: f.percentual,
                cor: f.cor,
              }))
            );
          }
        } else {
          const { data: novaRegra, error } = await supabase
            .from('regras_comissao_periodo')
            .insert({
              ano: destinoAno,
              mes: destinoMes,
              colaborador_id: regraOrigem.colaborador_id,
              tipo: regraOrigem.tipo,
              usa_escalonamento: regraOrigem.usa_escalonamento,
              percentual_fixo: regraOrigem.percentual_fixo,
            })
            .select()
            .single();

          if (error) throw error;

          if (faixasOrigem?.length) {
            await supabase.from('faixas_comissao_periodo').insert(
              faixasOrigem.map((f) => ({
                regra_id: novaRegra.id,
                faixa_ordem: f.faixa_ordem,
                nome: f.nome,
                valor_minimo: f.valor_minimo,
                valor_maximo: f.valor_maximo,
                percentual: f.percentual,
                cor: f.cor,
              }))
            );
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regras-comissao-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['regra-efetiva'] });
      toast.success('Regras copiadas com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao copiar regras:', error);
      toast.error('Erro ao copiar regras');
    },
  });
}

/**
 * Buscar histórico de regras
 */
export function useHistoricoRegras() {
  return useQuery({
    queryKey: ['historico-regras-comissao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regras_comissao_periodo')
        .select('*')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });

      if (error) throw error;
      return data as RegraComissaoPeriodo[];
    },
  });
}

/**
 * Calcular comissão com base nas regras do período
 */
export function calcularComissaoPorRegra(
  faturamento: number,
  regra: RegraComissaoCompleta | null
): {
  comissao: number;
  percentual: number;
  faixa: FaixaComissaoPeriodo | null;
  progressoProximaFaixa: number;
  proximaFaixa: FaixaComissaoPeriodo | null;
} {
  return calcularComissaoPorRegraComBaseDiferente(faturamento, faturamento, regra);
}

/**
 * Calcular comissão com base diferente para faixa e para cálculo
 */
export function calcularComissaoPorRegraComBaseDiferente(
  faturamentoParaFaixa: number,
  faturamentoParaComissao: number,
  regra: RegraComissaoCompleta | null
): {
  comissao: number;
  percentual: number;
  faixa: FaixaComissaoPeriodo | null;
  progressoProximaFaixa: number;
  proximaFaixa: FaixaComissaoPeriodo | null;
} {
  if (!regra) {
    return { comissao: 0, percentual: 0, faixa: null, progressoProximaFaixa: 0, proximaFaixa: null };
  }

  if (!regra.regra.usa_escalonamento) {
    const percentual = regra.regra.percentual_fixo || 0;
    return {
      comissao: faturamentoParaComissao * (percentual / 100),
      percentual,
      faixa: null,
      progressoProximaFaixa: 100,
      proximaFaixa: null,
    };
  }

  const faixas = regra.faixas.sort((a, b) => a.faixa_ordem - b.faixa_ordem);
  if (!faixas.length) {
    return { comissao: 0, percentual: 0, faixa: null, progressoProximaFaixa: 0, proximaFaixa: null };
  }

  const faixaAtual = faixas.find(
    (f) =>
      faturamentoParaFaixa >= f.valor_minimo &&
      (f.valor_maximo === null || faturamentoParaFaixa <= f.valor_maximo)
  );

  if (!faixaAtual) {
    const primeiraFaixa = faixas[0];
    return {
      comissao: faturamentoParaComissao * (primeiraFaixa.percentual / 100),
      percentual: primeiraFaixa.percentual,
      faixa: primeiraFaixa,
      progressoProximaFaixa: 0,
      proximaFaixa: faixas[1] || null,
    };
  }

  const comissao = faturamentoParaComissao * (faixaAtual.percentual / 100);
  const indexAtual = faixas.indexOf(faixaAtual);
  const proximaFaixa = faixas[indexAtual + 1] || null;

  let progressoProximaFaixa = 100;
  if (proximaFaixa && faixaAtual.valor_maximo) {
    const rangeAtual = faixaAtual.valor_maximo - faixaAtual.valor_minimo;
    const progressoNoRange = faturamentoParaFaixa - faixaAtual.valor_minimo;
    progressoProximaFaixa = rangeAtual > 0 ? (progressoNoRange / rangeAtual) * 100 : 0;
  }

  return {
    comissao,
    percentual: faixaAtual.percentual,
    faixa: faixaAtual,
    progressoProximaFaixa,
    proximaFaixa,
  };
}

/**
 * Salvar configuração em lote para múltiplos meses/colaboradores
 */
export function useSalvarConfiguracaoBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ano,
      meses,
      colaboradoresIds,
      config,
      aplicarAteAlterada,
    }: {
      ano: number;
      meses: number[];
      colaboradoresIds: string[] | null;
      config: ConfiguracaoMesData;
      aplicarAteAlterada: boolean;
    }) => {
      for (const mes of meses) {
        if (colaboradoresIds === null) {
          // Regra global
          await salvarRegra(ano, mes, null, 'SERVICO', config.servicos);
          await salvarRegra(ano, mes, null, 'PRODUTO', config.produtos);
        } else {
          for (const colaboradorId of colaboradoresIds) {
            await salvarRegra(ano, mes, colaboradorId, 'SERVICO', config.servicos);
            await salvarRegra(ano, mes, colaboradorId, 'PRODUTO', config.produtos);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regras-comissao-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['regra-efetiva'] });
      queryClient.invalidateQueries({ queryKey: ['historico-regras-comissao'] });
      queryClient.invalidateQueries({ queryKey: ['historico-regras-completo'] });
      toast.success('Regras de comissão salvas com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao salvar regras:', error);
      toast.error('Erro ao salvar regras de comissão');
    },
  });
}

interface FiltrosHistorico {
  ano: number | null;
  mes: number | null;
  colaboradorId: string | null;
}

interface Colaborador {
  colaborador_id: string;
  colaborador_nome: string;
  tipo_colaborador: string | null;
}

/**
 * Buscar histórico completo com faixas e nome do colaborador
 * Colaboradores filtrados por período (quem teve vendas no ano/mês selecionado)
 */
export function useHistoricoRegrasCompleto(filtros: FiltrosHistorico) {
  // Buscar colaboradores que tiveram vendas no período selecionado
  const colaboradoresQuery = useQuery({
    queryKey: ['colaboradores-periodo-comissao', filtros.ano, filtros.mes],
    queryFn: async (): Promise<Colaborador[]> => {
      // Se não tiver ano/mês definido, buscar ativos atuais
      if (!filtros.ano) {
        const { data, error } = await supabase
          .from('dimensao_colaboradores')
          .select('colaborador_id, colaborador_nome, tipo_colaborador')
          .eq('ativo', true)
          .in('tipo_colaborador', ['barbeiro', 'recepcao'])
          .order('colaborador_nome');

        if (error) throw error;
        return data || [];
      }

      // Buscar colaboradores que tiveram vendas no período
      const inicioMes = filtros.mes 
        ? `${filtros.ano}-${String(filtros.mes).padStart(2, '0')}-01`
        : `${filtros.ano}-01-01`;
      
      const fimMes = filtros.mes
        ? new Date(filtros.ano, filtros.mes, 0).toISOString().split('T')[0]
        : `${filtros.ano}-12-31`;

      const { data: vendasPeriodo, error } = await supabase
        .from('vw_vendas_kpi_base')
        .select('colaborador_id, colaborador_nome, tipo_colaborador')
        .gte('venda_dia', inicioMes)
        .lte('venda_dia', fimMes)
        .in('tipo_colaborador', ['barbeiro', 'recepcao'])
        .not('colaborador_id', 'is', null);

      if (error) throw error;

      // Remover duplicatas e ordenar
      const colaboradoresUnicos = [...new Map(
        (vendasPeriodo || [])
          .filter(c => c.colaborador_id && c.colaborador_nome)
          .map(c => [c.colaborador_id, {
            colaborador_id: c.colaborador_id!,
            colaborador_nome: c.colaborador_nome!,
            tipo_colaborador: c.tipo_colaborador,
          }])
      ).values()];

      return colaboradoresUnicos.sort((a, b) => 
        (a.colaborador_nome || '').localeCompare(b.colaborador_nome || '')
      );
    },
  });

  const regrasQuery = useQuery({
    queryKey: ['historico-regras-completo', filtros],
    queryFn: async () => {
      let query = supabase.from('regras_comissao_periodo').select('*');

      if (filtros.ano !== null) {
        query = query.eq('ano', filtros.ano);
      }

      if (filtros.mes !== null) {
        query = query.eq('mes', filtros.mes);
      }

      if (filtros.colaboradorId === 'global') {
        query = query.is('colaborador_id', null);
      } else if (filtros.colaboradorId !== null) {
        query = query.eq('colaborador_id', filtros.colaboradorId);
      }

      const { data: regras, error } = await query
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });

      if (error) throw error;
      if (!regras?.length) return [];

      // Buscar faixas para todas as regras
      const { data: faixas } = await supabase
        .from('faixas_comissao_periodo')
        .select('*')
        .in('regra_id', regras.map((r) => r.id))
        .order('faixa_ordem', { ascending: true });

      // Buscar nomes dos colaboradores
      const colaboradorIds = [...new Set(regras.filter((r) => r.colaborador_id).map((r) => r.colaborador_id))];
      
      let colaboradoresMap: Record<string, string> = {};
      if (colaboradorIds.length > 0) {
        const { data: colaboradores } = await supabase
          .from('dimensao_colaboradores')
          .select('colaborador_id, colaborador_nome')
          .in('colaborador_id', colaboradorIds as string[]);

        colaboradoresMap = (colaboradores || []).reduce((acc, c) => {
          acc[c.colaborador_id] = c.colaborador_nome || 'Desconhecido';
          return acc;
        }, {} as Record<string, string>);
      }

      return regras.map((regra) => ({
        regra: regra as RegraComissaoPeriodo,
        faixas: (faixas?.filter((f) => f.regra_id === regra.id) || []) as FaixaComissaoPeriodo[],
        colaborador_nome: regra.colaborador_id ? colaboradoresMap[regra.colaborador_id] : undefined,
      }));
    },
  });

  return {
    data: regrasQuery.data,
    isLoading: regrasQuery.isLoading,
    colaboradores: colaboradoresQuery.data,
  };
}

/**
 * Excluir uma regra e suas faixas
 */
export function useExcluirRegra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (regraId: string) => {
      // Deletar faixas primeiro (FK constraint)
      const { error: faixasError } = await supabase
        .from('faixas_comissao_periodo')
        .delete()
        .eq('regra_id', regraId);

      if (faixasError) throw faixasError;

      // Deletar regra
      const { error: regraError } = await supabase
        .from('regras_comissao_periodo')
        .delete()
        .eq('id', regraId);

      if (regraError) throw regraError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regras-comissao-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['regra-efetiva'] });
      queryClient.invalidateQueries({ queryKey: ['historico-regras-comissao'] });
      queryClient.invalidateQueries({ queryKey: ['historico-regras-completo'] });
      toast.success('Regra excluída com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao excluir regra:', error);
      toast.error('Erro ao excluir regra');
    },
  });
}

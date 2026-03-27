// ============================================================
// FILE: src/hooks/useRelatorioSemanal.ts
// PROPÓSITO: Hook para buscar e calcular dados de relatórios semanais
// FONTE DE DADOS: rpc_dashboard_period (Supabase)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  format, 
  addDays, 
  differenceInDays,
  getDay,
  isAfter,
  isBefore,
  startOfMonth,
  endOfMonth,
  getDaysInMonth
} from 'date-fns';
import type { 
  RelatorioSemanalData, 
  RelatorioSemanalFilters, 
  SemanaData, 
  AcumuladoMes, 
  ProjecaoMes 
} from '@/types/relatorio-semanal';
import type { DashboardData } from '@/components/dashboard/types';

/**
 * Calcula as semanas de um período (Domingo a Sábado por default)
 */
function calcularSemanas(
  inicio: Date, 
  fim: Date, 
  inicioSemana: 'dom' | 'seg' = 'dom'
): { inicio: Date; fim: Date; parcial: boolean }[] {
  const semanas: { inicio: Date; fim: Date; parcial: boolean }[] = [];
  
  let atual = inicio;
  
  while (isBefore(atual, fim) || format(atual, 'yyyy-MM-dd') === format(fim, 'yyyy-MM-dd')) {
    // Encontra o próximo sábado (ou domingo se semana começa seg)
    const diaSemana = getDay(atual);
    const diasAteFimSemana = inicioSemana === 'dom' 
      ? (6 - diaSemana + 7) % 7 
      : (7 - diaSemana) % 7;
    
    let fimSemana = addDays(atual, diasAteFimSemana);
    let parcial = false;
    
    // Verifica se é semana parcial no início
    const diaInicioEsperado = inicioSemana === 'dom' ? 0 : 1;
    if (getDay(atual) !== diaInicioEsperado) {
      parcial = true;
    }
    
    // Se fim da semana passa do período, usa o fim do período
    if (isAfter(fimSemana, fim)) {
      fimSemana = fim;
      parcial = true;
    }
    
    const dias = differenceInDays(fimSemana, atual) + 1;
    if (dias < 7) {
      parcial = true;
    }
    
    semanas.push({
      inicio: atual,
      fim: fimSemana,
      parcial
    });
    
    atual = addDays(fimSemana, 1);
  }
  
  return semanas;
}

/**
 * Formata período para exibição
 */
function formatarPeriodoSemana(inicio: Date, fim: Date): string {
  const dias = differenceInDays(fim, inicio) + 1;
  return `${format(inicio, 'dd/MM')} - ${format(fim, 'dd/MM')} (${dias} ${dias === 1 ? 'dia' : 'dias'})`;
}

/**
 * Calcula variação percentual
 */
function calcularVariacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100 * 10) / 10;
}

/**
 * Determina tendência baseada na variação
 */
function determinarTendencia(variacao: number | null): 'up' | 'down' | 'stable' {
  if (variacao === null || Math.abs(variacao) < 3) return 'stable';
  return variacao > 0 ? 'up' : 'down';
}

async function fetchRelatorioSemanal(filters: RelatorioSemanalFilters): Promise<RelatorioSemanalData> {
    const inicio = filters.data_inicio;
      const fim = filters.data_fim;
      const hoje = new Date();
      
      // Se fim é depois de hoje, limita até hoje
      const fimPeriodo = isAfter(fim, hoje) ? hoje : fim;
      
      // Divide em semanas
      const periodosSemanas = calcularSemanas(inicio, fimPeriodo, filters.inicio_semana);
      
      // Busca dados de cada semana em paralelo
      const promises = periodosSemanas.map(({ inicio: semanaInicio, fim: semanaFim }) => 
        supabase.rpc('rpc_dashboard_period', {
          p_inicio: format(semanaInicio, 'yyyy-MM-dd'),
          p_fim: format(semanaFim, 'yyyy-MM-dd'),
          p_colaborador_id: filters.colaborador_id,
          p_tipo_colaborador: null
        })
      );
      
      const results = await Promise.all(promises);
      
      // Processa resultados
      const semanas: SemanaData[] = [];
      let colaboradores: { colaborador_id: string; colaborador_nome: string }[] = [];
      
      for (let i = 0; i < results.length; i++) {
        const { data: rpcData, error: rpcError } = results[i];
        
        if (rpcError) {
          console.error(`[useRelatorioSemanal] Erro semana ${i + 1}:`, rpcError);
          continue;
        }
        
        const dashData = rpcData as unknown as DashboardData;
        const periodo = periodosSemanas[i];
        const dias = differenceInDays(periodo.fim, periodo.inicio) + 1;
        
        // Pega colaboradores do primeiro resultado (são os mesmos)
        if (i === 0 && dashData.colaboradores_periodo) {
          colaboradores = dashData.colaboradores_periodo;
        }
        
        const kpis = dashData.kpis;
        const semanaAnterior = i > 0 ? semanas[i - 1] : null;
        
        const varFaturamento = semanaAnterior 
          ? calcularVariacao(kpis.faturamento, semanaAnterior.faturamento) 
          : null;
        
        semanas.push({
          semana_numero: i + 1,
          data_inicio: periodo.inicio,
          data_fim: periodo.fim,
          dias_na_semana: dias,
          label: formatarPeriodoSemana(periodo.inicio, periodo.fim),
          parcial: periodo.parcial,
          
          faturamento: kpis.faturamento,
          atendimentos: kpis.atendimentos,
          clientes: kpis.clientes,
          clientes_novos: kpis.clientes_novos,
          extras_qtd: kpis.extras_qtd,
          extras_valor: kpis.extras_valor,
          ticket_medio: kpis.ticket_medio,
          servicos_totais: kpis.servicos_totais,
          
          comissao: dashData.by_colaborador?.reduce((s, b) => s + (b.comissao ?? 0), 0) ?? 0,
          bonus: dashData.by_colaborador?.reduce((s, b) => s + (b.bonus ?? 0), 0) ?? 0,
          media_dia: dias > 0 ? kpis.faturamento / dias : 0,
          
          var_faturamento_pct: varFaturamento,
          var_atendimentos_pct: semanaAnterior 
            ? calcularVariacao(kpis.atendimentos, semanaAnterior.atendimentos) 
            : null,
          var_ticket_pct: semanaAnterior 
            ? calcularVariacao(kpis.ticket_medio, semanaAnterior.ticket_medio) 
            : null,
          var_extras_pct: semanaAnterior 
            ? calcularVariacao(kpis.extras_qtd, semanaAnterior.extras_qtd) 
            : null,
          
          tendencia: determinarTendencia(varFaturamento)
        });
      }
      
      // Calcula acumulado do período
      const acumulado: AcumuladoMes = semanas.reduce((acc, s) => ({
        faturamento: acc.faturamento + s.faturamento,
        atendimentos: acc.atendimentos + s.atendimentos,
        clientes: acc.clientes + s.clientes,
        clientes_novos: acc.clientes_novos + s.clientes_novos,
        extras_qtd: acc.extras_qtd + s.extras_qtd,
        extras_valor: acc.extras_valor + s.extras_valor,
        ticket_medio: 0, // Recalcula depois
        servicos_totais: acc.servicos_totais + s.servicos_totais,
        dias_trabalhados: acc.dias_trabalhados + s.dias_na_semana,
        comissao: acc.comissao + s.comissao,
        bonus: acc.bonus + s.bonus
      }), {
        faturamento: 0,
        atendimentos: 0,
        clientes: 0,
        clientes_novos: 0,
        extras_qtd: 0,
        extras_valor: 0,
        ticket_medio: 0,
        servicos_totais: 0,
        dias_trabalhados: 0,
        comissao: 0,
        bonus: 0
      });
      
      // Ticket médio do acumulado
      acumulado.ticket_medio = acumulado.atendimentos > 0 
        ? acumulado.faturamento / acumulado.atendimentos 
        : 0;
      
      // Calcular projeção baseada no MÊS DE REFERÊNCIA (mês da data_fim)
      const mesRef = filters.data_fim;
      const anoRef = mesRef.getFullYear();
      const mesNumRef = mesRef.getMonth() + 1;
      const inicioMesRef = startOfMonth(mesRef);
      const fimMesRef = endOfMonth(mesRef);
      const diasNoMesRef = getDaysInMonth(mesRef);
      
      // Formatar nome do mês
      const mesesNome = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                         'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const mesNome = `${mesesNome[mesNumRef - 1]}/${anoRef}`;
      
      // Buscar dados APENAS do mês de referência para projeção
      const { data: dadosMesRef, error: erroMesRef } = await supabase.rpc('rpc_dashboard_period', {
        p_inicio: format(inicioMesRef, 'yyyy-MM-dd'),
        p_fim: format(isAfter(fimMesRef, hoje) ? hoje : fimMesRef, 'yyyy-MM-dd'),
        p_colaborador_id: filters.colaborador_id,
        p_tipo_colaborador: null
      });
      
      const kpisMesRef = (erroMesRef || !dadosMesRef) 
        ? { faturamento: 0, atendimentos: 0, dias_trabalhados: 0 } 
        : (dadosMesRef as unknown as DashboardData).kpis;
      
      // Dias trabalhados no mês de referência
      const diasTrabalhadosMes = kpisMesRef.dias_trabalhados || acumulado.dias_trabalhados;
      const faturamentoMes = kpisMesRef.faturamento || acumulado.faturamento;
      const atendimentosMes = kpisMesRef.atendimentos || acumulado.atendimentos;
      
      // Dias restantes até o fim do mês de referência
      const diasRestantesMes = Math.max(0, differenceInDays(fimMesRef, isAfter(fimMesRef, hoje) ? hoje : fimMesRef));
      
      // Média diária e projeções
      const mediaDia = diasTrabalhadosMes > 0 ? faturamentoMes / diasTrabalhadosMes : 0;
      const faturamentoProjetado = faturamentoMes + (mediaDia * diasRestantesMes);
      
      // Comissão projetada (estima baseado no percentual atual, default 35%)
      const comissaoMes = acumulado.comissao;
      const percentualComissao = faturamentoMes > 0 && comissaoMes > 0
        ? (comissaoMes / faturamentoMes) * 100 
        : 35;
      const comissaoProjetada = faturamentoProjetado * (percentualComissao / 100);
      
      // Atendimentos projetados
      const mediaAtendimentoDia = diasTrabalhadosMes > 0 ? atendimentosMes / diasTrabalhadosMes : 0;
      const atendimentosProjetados = Math.round(atendimentosMes + (mediaAtendimentoDia * diasRestantesMes));
      
      const projecao: ProjecaoMes = {
        mes_referencia: mesNumRef,
        ano_referencia: anoRef,
        mes_nome: mesNome,
        
        dias_trabalhados_mes: diasTrabalhadosMes,
        dias_restantes_mes: diasRestantesMes,
        dias_totais_mes: diasNoMesRef,
        
        media_dia_atual: mediaDia,
        faturamento_acumulado_mes: faturamentoMes,
        faturamento_projetado_mes: faturamentoProjetado,
        
        comissao_acumulada_mes: comissaoMes,
        comissao_projetada_mes: comissaoProjetada,
        percentual_comissao: percentualComissao,
        
        atendimentos_acumulados_mes: atendimentosMes,
        atendimentos_projetados_mes: atendimentosProjetados
      };
      
      // Calcula médias para orientações
      const medias = {
        faturamento: semanas.length > 0 
          ? semanas.reduce((s, w) => s + w.faturamento, 0) / semanas.length 
          : 0,
        atendimentos: semanas.length > 0 
          ? semanas.reduce((s, w) => s + w.atendimentos, 0) / semanas.length 
          : 0,
        ticket_medio: semanas.length > 0 
          ? semanas.reduce((s, w) => s + w.ticket_medio, 0) / semanas.length 
          : 0,
        extras_qtd: semanas.length > 0 
          ? semanas.reduce((s, w) => s + w.extras_qtd, 0) / semanas.length 
          : 0
      };
      
      return { semanas, acumulado, projecao, colaboradores, medias };
}

export function useRelatorioSemanal(filters: RelatorioSemanalFilters | null) {
  const { data, isFetching, error } = useQuery({
    queryKey: [
      'relatorio-semanal',
      filters?.data_inicio ? format(filters.data_inicio, 'yyyy-MM-dd') : null,
      filters?.data_fim ? format(filters.data_fim, 'yyyy-MM-dd') : null,
      filters?.colaborador_id,
      filters?.inicio_semana,
    ],
    queryFn: () => fetchRelatorioSemanal(filters!),
    enabled: !!filters,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data ?? null,
    loading: isFetching,
    error: error ? (error as Error).message : null,
  };
}

export default useRelatorioSemanal;

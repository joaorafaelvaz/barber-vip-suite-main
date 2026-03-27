// ============================================================
// FILE: src/hooks/useCalendarioColaborador.ts
// PROPÓSITO: Hook que monta calendário individual com faturamento + folgas
// ============================================================

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  getDay, 
  isBefore, 
  isSameDay, 
  startOfDay,
  lastDayOfMonth
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useFolgas } from './useFolgas';
import { useFeriados } from './useFeriados';
import { useBarbeariaConfig } from './useBarbeariaConfig';
import { DIAS_SEMANA } from '@/types/colaborador';
import type { 
  CalendarioColaboradorMensal, 
  DiaCalendarioColaborador,
  HistoricoFolgaMes 
} from '@/types/colaborador';

interface UseCalendarioColaboradorParams {
  colaboradorId: string;
  ano: number;
  mes: number;
}

interface DashboardDaily {
  dia: string;
  faturamento: number;
  atendimentos: number;
}

interface DashboardResponse {
  daily?: DashboardDaily[];
  by_colaborador?: Array<{ colaborador_nome: string }>;
}

export function useCalendarioColaborador({ colaboradorId, ano, mes }: UseCalendarioColaboradorParams) {
  // 1. Buscar faturamento diário do colaborador via RPC
  const { data: dashboardData, isLoading: loadingDashboard } = useQuery({
    queryKey: ['calendario-colaborador-dashboard', colaboradorId, ano, mes],
    queryFn: async () => {
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const ultimoDia = lastDayOfMonth(new Date(ano, mes - 1));
      const fim = format(ultimoDia, 'yyyy-MM-dd');
      
      const { data, error } = await supabase.rpc('rpc_dashboard_period', {
        p_inicio: inicio,
        p_fim: fim,
        p_colaborador_id: colaboradorId,
        p_tipo_colaborador: null,
      });
      
      if (error) throw error;
      return data as DashboardResponse | null;
    },
    enabled: !!colaboradorId,
  });
  
  // 2. Buscar folgas do colaborador
  const { folgasAvulsas, folgasFixas, isLoading: loadingFolgas } = useFolgas({ 
    colaboradorId, 
    ano, 
    mes 
  });
  
  // 3. Buscar feriados
  const { feriados, isLoading: loadingFeriados } = useFeriados(ano);
  
  // 4. Buscar config da barbearia
  const { barbeariaFecha, isLoading: loadingConfig } = useBarbeariaConfig();
  
  // 5. Montar calendário
  const calendario = useMemo((): CalendarioColaboradorMensal => {
    const dailyData = dashboardData?.daily || [];
    const faturamentoPorDia = new Map<string, { faturamento: number; atendimentos: number }>(
      dailyData.map(d => [d.dia, { faturamento: d.faturamento, atendimentos: d.atendimentos }])
    );
    
    const inicioMes = startOfMonth(new Date(ano, mes - 1));
    const fimMes = endOfMonth(new Date(ano, mes - 1));
    const hoje = startOfDay(new Date());
    const diasDoMes = eachDayOfInterval({ start: inicioMes, end: fimMes });
    
    let diasTrabalhados = 0;
    let diasDeFolga = 0;
    let diasFaltados = 0;
    let faturamentoTotal = 0;
    
    const dias: DiaCalendarioColaborador[] = diasDoMes.map(data => {
      const dataStr = format(data, 'yyyy-MM-dd');
      const diaSemana = getDay(data);
      const ehPassado = isBefore(data, hoje);
      const ehHoje = isSameDay(data, hoje);
      const ehFuturo = !ehPassado && !ehHoje;
      
      // Verificar situação da barbearia
      const feriado = feriados.find(f => f.data === dataStr);
      const ehFeriado = !!feriado && feriado.barbearia_fecha;
      const fechaPorConfig = barbeariaFecha(diaSemana);
      const barbeariaFechada = ehFeriado || fechaPorConfig;
      
      // Verificar folga fixa (tabela legada - considera vigência)
      const temFolgaFixaLegado = folgasFixas.some(f => {
        if (f.colaborador_id !== colaboradorId) return false;
        if (f.dia_semana !== diaSemana) return false;
        if (!f.ativo) return false;
        
        // Verificar vigência
        const vigenciaInicio = new Date(f.vigencia_inicio + 'T00:00:00');
        if (data < vigenciaInicio) return false;
        
        if (f.vigencia_fim) {
          const vigenciaFim = new Date(f.vigencia_fim + 'T00:00:00');
          if (data > vigenciaFim) return false;
        }
        
        return true;
      });
      
      // Verificar folga avulsa ou folga_fixa na tabela colaborador_folgas
      const folgaRegistrada = folgasAvulsas.find(
        f => f.colaborador_id === colaboradorId && f.data === dataStr
      );
      const temFolgaAvulsa = !!folgaRegistrada && folgaRegistrada.tipo === 'avulsa';
      const temFolgaFixaNova = !!folgaRegistrada && folgaRegistrada.tipo === 'folga_fixa';
      
      // Combinar: considera folga fixa de qualquer fonte
      const temFolgaFixa = temFolgaFixaLegado || temFolgaFixaNova;
      
      // Dados de faturamento
      const dadosDia = faturamentoPorDia.get(dataStr);
      const faturamento = dadosDia?.faturamento || 0;
      const atendimentos = dadosDia?.atendimentos || 0;
      
      // Status calculado
      const deviaTrabalhar = !barbeariaFechada && !temFolgaFixa && !temFolgaAvulsa;
      const trabalhou = (ehPassado || ehHoje) && faturamento > 0;
      const trabalha = ehFuturo && deviaTrabalhar;
      
      // Contagens
      if (trabalhou) {
        diasTrabalhados++;
        faturamentoTotal += faturamento;
      }
      if (temFolgaFixa || temFolgaAvulsa) diasDeFolga++;
      if (ehPassado && deviaTrabalhar && !trabalhou) diasFaltados++;
      
      return {
        data,
        dataStr,
        diaSemana,
        ehPassado,
        ehHoje,
        ehFuturo,
        barbeariaFechada,
        ehFeriado,
        nomeFeriado: feriado?.nome,
        temFolgaFixa,
        temFolgaAvulsa,
        motivoFolga: folgaRegistrada?.motivo || undefined,
        trabalhou,
        trabalha,
        faturamento: (ehPassado || ehHoje) ? faturamento : undefined,
        atendimentos: (ehPassado || ehHoje) ? atendimentos : undefined,
      };
    });
    
    const diasRestantes = dias.filter(d => d.ehFuturo).length;
    const diasProgramadosRestantes = dias.filter(d => d.ehFuturo && d.trabalha).length;
    
    return {
      ano,
      mes,
      colaboradorId,
      colaboradorNome: dashboardData?.by_colaborador?.[0]?.colaborador_nome || '',
      dias,
      resumo: {
        diasTrabalhados,
        diasDeFolga,
        diasFaltados,
        faturamentoTotal,
        mediaFaturamentoDia: diasTrabalhados > 0 ? faturamentoTotal / diasTrabalhados : 0,
        diasRestantes,
        diasProgramadosRestantes,
      },
    };
  }, [dashboardData, folgasAvulsas, folgasFixas, feriados, barbeariaFecha, colaboradorId, ano, mes]);
  
  // 6. Histórico de folgas do mês
  const historicoFolgas = useMemo((): HistoricoFolgaMes[] => {
    return calendario.dias
      .filter(d => d.barbeariaFechada || d.temFolgaFixa || d.temFolgaAvulsa)
      .map(d => ({
        data: d.dataStr,
        diaSemana: d.diaSemana,
        diaSemanaLabel: DIAS_SEMANA.find(ds => ds.value === d.diaSemana)?.label || '',
        tipo: d.ehFeriado 
          ? 'feriado' as const
          : d.temFolgaFixa 
            ? 'fixa' as const
            : d.temFolgaAvulsa 
              ? 'avulsa' as const
              : 'fechado' as const,
        descricao: d.nomeFeriado || d.motivoFolga || (d.temFolgaFixa ? 'Folga Fixa' : 'Fechado'),
      }));
  }, [calendario]);
  
  return {
    calendario,
    historicoFolgas,
    isLoading: loadingDashboard || loadingFolgas || loadingFeriados || loadingConfig,
  };
}

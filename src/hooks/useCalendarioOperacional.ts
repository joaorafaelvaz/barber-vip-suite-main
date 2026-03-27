import { useMemo } from 'react';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay,
  getDay 
} from 'date-fns';
import { useFolgas } from './useFolgas';
import { useFeriados } from './useFeriados';
import { useBarbeariaConfig } from './useBarbeariaConfig';
import type { 
  DiaCalendario, 
  CalendarioMensal, 
  Colaborador,
  ColaboradorDiaCalendario 
} from '@/types/colaborador';
import { getIniciais } from '@/types/colaborador';

interface UseCalendarioParams {
  ano: number;
  mes: number;
  colaboradores: Colaborador[];
}

export function useCalendarioOperacional({ ano, mes, colaboradores }: UseCalendarioParams) {
  const { folgasFixas, folgasAvulsas, isLoading: loadingFolgas } = useFolgas({ ano, mes });
  const { feriados, isLoading: loadingFeriados } = useFeriados(ano);
  const { barbeariaFecha, isLoading: loadingConfig } = useBarbeariaConfig();

  const calendario = useMemo<CalendarioMensal>(() => {
    const inicio = startOfMonth(new Date(ano, mes - 1));
    const fim = endOfMonth(new Date(ano, mes - 1));
    const diasDoMes = eachDayOfInterval({ start: inicio, end: fim });

    let diasUteis = 0;
    let feriadosCount = 0;
    let domingosFechados = 0;

    const dias: DiaCalendario[] = diasDoMes.map(data => {
      const diaSemana = getDay(data);
      const dataStr = data.toISOString().split('T')[0];

      // Verifica feriado
      const feriado = feriados.find(f => f.data === dataStr);
      const ehFeriado = !!feriado && feriado.barbearia_fecha;
      const nomeFeriado = feriado?.nome;

      // Verifica se barbearia fecha nesse dia
      const ehDomingo = diaSemana === 0;
      const fechaPorConfig = barbeariaFecha(diaSemana);
      const barbeariaFechaHoje = ehFeriado || fechaPorConfig;

      // Contagem de resumo
      if (ehFeriado) feriadosCount++;
      if (ehDomingo && fechaPorConfig) domingosFechados++;
      if (!barbeariaFechaHoje) diasUteis++;

      // Monta lista de colaboradores
      const colaboradoresTrabalham: ColaboradorDiaCalendario[] = colaboradores.map(colab => {
        // Folga fixa
        const temFolgaFixa = folgasFixas.some(
          f => f.colaborador_id === colab.colaborador_id && 
               f.dia_semana === diaSemana && 
               f.ativo
        );

        // Folga avulsa
        const temFolgaAvulsa = folgasAvulsas.some(
          f => f.colaborador_id === colab.colaborador_id && f.data === dataStr
        );

        const trabalha = !barbeariaFechaHoje && !temFolgaFixa && !temFolgaAvulsa;

        return {
          id: colab.colaborador_id,
          nome: colab.colaborador_nome || 'Sem nome',
          iniciais: getIniciais(colab.colaborador_nome),
          temFolgaFixa,
          temFolgaAvulsa,
          trabalha,
        };
      });

      return {
        data,
        diaSemana,
        ehFeriado,
        nomeFeriado,
        ehDomingo,
        barbeariaFecha: barbeariaFechaHoje,
        colaboradoresTrabalham,
      };
    });

    return {
      ano,
      mes,
      dias,
      resumo: {
        totalDias: diasDoMes.length,
        diasUteis,
        feriados: feriadosCount,
        domingosFechados,
      },
    };
  }, [ano, mes, colaboradores, folgasFixas, folgasAvulsas, feriados, barbeariaFecha]);

  return {
    calendario,
    isLoading: loadingFolgas || loadingFeriados || loadingConfig,
  };
}

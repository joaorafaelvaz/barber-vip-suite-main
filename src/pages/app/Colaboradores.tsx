import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, PartyPopper, UserCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ColaboradoresLista,
  ColaboradoresFilters,
  CalendarioOperacional,
  FeriadosManager,
  ColaboradoresEquipeLista
} from '@/components/colaboradores';
import { useComissoesMes } from '@/hooks/useComissoes';
import { useCalendarioOperacional } from '@/hooks/useCalendarioOperacional';
import { HowToReadSection } from '@/components/help/HowToReadSection';
import type { ColaboradorComDados, ColaboradoresFilters as FiltersType, Colaborador } from '@/types/colaborador';

// Componente isolado: só monta (e só busca dados) quando a aba Calendário é clicada
function CalendarioTab({ ano, mes, colaboradores, onMesAnterior, onProximoMes }: {
  ano: number; mes: number; colaboradores: Colaborador[];
  onMesAnterior: () => void; onProximoMes: () => void;
}) {
  const { calendario } = useCalendarioOperacional({ ano, mes, colaboradores });
  return <CalendarioOperacional calendario={calendario} onMesAnterior={onMesAnterior} onProximoMes={onProximoMes} />;
}

export default function Colaboradores() {
  const navigate = useNavigate();
  const currentDate = new Date();
  const [filters, setFilters] = useState<FiltersType>({
    mes: currentDate.getMonth() + 1,
    ano: currentDate.getFullYear(),
    tipo: null,
    apenasAtivos: false,
  });

  // Buscar dados de comissões
  const { comissoes, isLoading: loadingComissoes } = useComissoesMes(filters.ano, filters.mes);

  // Converter dados de comissões para o formato de colaboradores
  const colaboradoresComDados: ColaboradorComDados[] = useMemo(() => {
    if (!comissoes) return [];

    return comissoes.map(c => ({
      colaborador_id: c.colaborador_id,
      colaborador_nome: c.colaborador_nome,
      tipo_colaborador: null,
      ativo: c.faturamento_total > 0,
      first_seen: null,
      last_seen: null,
      faturamento: c.faturamento_total,
      comissao: c.comissao_total,
      bonus: 0,
      totalReceber: c.comissao_total,
      percentualTotal: c.faturamento_total > 0 ? (c.comissao_total / c.faturamento_total) * 100 : 0,
      diasTrabalhados: c.dias_trabalhados,
      faixa: c.servicos?.faixa ? {
        nome: c.servicos.faixa.nome,
        cor: c.servicos.faixa.cor || 'primary',
        percentual: c.servicos.percentual,
      } : null,
    }));
  }, [comissoes]);

  // Filtra colaboradores
  const colaboradoresFiltrados = useMemo(() => {
    let lista = colaboradoresComDados;
    
    if (filters.apenasAtivos) {
      lista = lista.filter(c => c.faturamento > 0);
    }
    
    if (filters.tipo) {
      lista = lista.filter(c => c.tipo_colaborador === filters.tipo);
    }

    return lista.sort((a, b) => b.faturamento - a.faturamento);
  }, [colaboradoresComDados, filters]);

  // Tipos únicos de colaborador
  const tiposColaborador = useMemo(() => {
    const tipos = new Set(colaboradoresComDados.map(c => c.tipo_colaborador).filter(Boolean));
    return Array.from(tipos) as string[];
  }, [colaboradoresComDados]);

  // Dados para calendário — memoizado para não recalcular o calendário a cada render
  const colaboradoresBase: Colaborador[] = useMemo(() => colaboradoresComDados.map(c => ({
    colaborador_id: c.colaborador_id,
    colaborador_nome: c.colaborador_nome,
    tipo_colaborador: c.tipo_colaborador,
    ativo: c.ativo,
    first_seen: c.first_seen,
    last_seen: c.last_seen,
  })), [colaboradoresComDados]);

  const handleVerDetalhes = (colaborador: ColaboradorComDados) => {
    navigate(`/app/colaboradores/${colaborador.colaborador_id}`);
  };

  const handleMesAnterior = () => {
    if (filters.mes === 1) {
      setFilters({ ...filters, mes: 12, ano: filters.ano - 1 });
    } else {
      setFilters({ ...filters, mes: filters.mes - 1 });
    }
  };

  const handleProximoMes = () => {
    if (filters.mes === 12) {
      setFilters({ ...filters, mes: 1, ano: filters.ano + 1 });
    } else {
      setFilters({ ...filters, mes: filters.mes + 1 });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Colaboradores</h1>
        <p className="text-muted-foreground">
          Gerencie a equipe, folgas e acompanhe as comissões
        </p>
      </div>

      <HowToReadSection
        bullets={[
          'Visão Geral = lista de colaboradores com faturamento, comissão e faixa do mês.',
          'Calendário = escala operacional com folgas fixas e avulsas.',
          'Equipe = visão de gestão da equipe com dados de cada colaborador.',
          'Feriados = cadastro de feriados que afetam o calendário operacional.',
        ]}
        expandedText="Use o filtro de mês/ano para navegar entre períodos. Clique em um colaborador para ver detalhes individuais. As comissões mostradas aqui vêm das regras configuradas na página de Comissões."
      />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <Users className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="equipe" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="feriados" className="gap-2">
            <PartyPopper className="h-4 w-4" />
            Feriados
          </TabsTrigger>
        </TabsList>

        {/* Tab: Visão Geral */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <ColaboradoresFilters 
            filters={filters}
            onFiltersChange={setFilters}
            tiposColaborador={tiposColaborador}
          />
          
          <ColaboradoresLista
            colaboradores={colaboradoresFiltrados}
            isLoading={loadingComissoes}
            onVerDetalhes={handleVerDetalhes}
          />
        </TabsContent>

        {/* Tab: Calendário — CalendarioTab monta aqui apenas quando a aba for clicada */}
        <TabsContent value="calendario" className="mt-4">
          <CalendarioTab
            ano={filters.ano}
            mes={filters.mes}
            colaboradores={colaboradoresBase}
            onMesAnterior={handleMesAnterior}
            onProximoMes={handleProximoMes}
          />
        </TabsContent>

        {/* Tab: Equipe */}
        <TabsContent value="equipe" className="mt-4">
          <ColaboradoresEquipeLista
            colaboradores={colaboradoresFiltrados}
            ano={filters.ano}
            mes={filters.mes}
            isLoading={loadingComissoes}
          />
        </TabsContent>

        {/* Tab: Feriados */}
        <TabsContent value="feriados" className="mt-4">
          <FeriadosManager ano={filters.ano} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

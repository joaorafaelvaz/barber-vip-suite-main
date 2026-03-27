// ============================================================
// FILE: src/components/dashboard/DashboardKpiCards.tsx
// PROPÓSITO: Grid de cards de KPIs do Dashboard
// LAYOUT: 2 colunas mobile, 3 colunas tablet, 5 colunas desktop
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  Users,
  ShoppingCart,
  UserPlus,
  Gift,
  Briefcase,
  Calendar,
  TrendingUp,
  Scissors,
  ArrowUpRight,
} from 'lucide-react';

import { DashboardKpiCard } from './DashboardKpiCard';
import type { DashboardKpis, KpiDetails, KpiComparisons, DashboardComparacoes } from './types';

// ============================================================
// TIPOS
// ============================================================

interface DashboardKpiCardsProps {
  kpis: DashboardKpis;
  comparacoes?: DashboardComparacoes;
  dateFrom?: string;
  dateTo?: string;
  colaboradorId?: string | null;
  tipoColaborador?: string | null;
}

// ============================================================
// CONFIGURAÇÃO DOS DETALHES DE CADA KPI
// ============================================================

const KPI_DETAILS: Record<string, KpiDetails> = {
  faturamento: {
    description: 'Soma total de todos os serviços prestados no período, incluindo cortes, barbas e serviços extras.',
    formula: 'SUM(valor_faturamento)',
    source: 'vw_vendas_kpi_base'
  },
  atendimentos: {
    description: 'Quantidade de atendimentos únicos realizados. Cada venda única conta como um atendimento.',
    formula: 'COUNT(DISTINCT venda_id)',
    source: 'vw_vendas_kpi_base'
  },
  ticket_medio: {
    description: 'Valor médio gasto por atendimento no período selecionado.',
    formula: 'Faturamento ÷ Atendimentos',
    source: 'Calculado'
  },
  clientes: {
    description: 'Quantidade de clientes únicos que foram atendidos no período.',
    formula: 'COUNT(DISTINCT cliente_id)',
    source: 'vw_vendas_kpi_base'
  },
  clientes_novos: {
    description: 'Clientes que fizeram sua primeira visita dentro do período selecionado.',
    formula: 'Clientes com primeira visita no período',
    source: 'vw_vendas_kpi_base'
  },
  extras_qtd: {
    description: 'Quantidade de serviços extras vendidos (produtos ou serviços adicionais).',
    formula: 'COUNT(*) WHERE is_extra = true',
    source: 'vw_vendas_kpi_base'
  },
  extras_valor: {
    description: 'Valor total arrecadado com serviços extras no período.',
    formula: 'SUM(valor_faturamento) WHERE is_extra = true',
    source: 'vw_vendas_kpi_base'
  },
  servicos_totais: {
    description: 'Total de serviços prestados, incluindo cortes, barbas e extras.',
    formula: 'COUNT(*) WHERE is_servico OR is_extra',
    source: 'vw_vendas_kpi_base'
  },
  dias_trabalhados: {
    description: 'Quantidade de dias em que houve pelo menos um atendimento com faturamento.',
    formula: 'COUNT(DISTINCT venda_dia) WHERE faturamento > 0',
    source: 'vw_vendas_kpi_base'
  },
  faturamento_por_dia: {
    description: 'Faturamento médio por dia trabalhado no período.',
    formula: 'Faturamento ÷ Dias Trabalhados',
    source: 'Calculado no backend'
  }
};

// ============================================================
// CONFIGURAÇÃO DOS CARDS
// ============================================================

const KPI_CONFIG = [
  {
    key: 'faturamento' as const,
    title: 'Faturamento',
    format: 'currency' as const,
    icon: DollarSign,
    iconColor: 'text-green-500',
    subtitle: 'Total do período'
  },
  {
    key: 'atendimentos' as const,
    title: 'Atendimentos',
    format: 'number' as const,
    icon: Users,
    iconColor: 'text-blue-500',
    subtitle: 'Total de serviços'
  },
  {
    key: 'ticket_medio' as const,
    title: 'Ticket Médio',
    format: 'currency' as const,
    icon: ShoppingCart,
    iconColor: 'text-purple-500',
    subtitle: 'Fat. / Atendimentos'
  },
  {
    key: 'clientes' as const,
    title: 'Clientes',
    format: 'number' as const,
    icon: TrendingUp,
    iconColor: 'text-orange-500',
    subtitle: 'Clientes únicos'
  },
  {
    key: 'clientes_novos' as const,
    title: 'Clientes Novos',
    format: 'number' as const,
    icon: UserPlus,
    iconColor: 'text-cyan-500',
    subtitle: 'Primeira visita'
  },
  {
    key: 'extras_qtd' as const,
    title: 'Extras (Qtd)',
    format: 'number' as const,
    icon: Gift,
    iconColor: 'text-pink-500',
    subtitle: 'Quantidade de extras'
  },
  {
    key: 'extras_valor' as const,
    title: 'Extras (R$)',
    format: 'currency' as const,
    icon: Briefcase,
    iconColor: 'text-amber-500',
    subtitle: 'Valor dos extras'
  },
  {
    key: 'servicos_totais' as const,
    title: 'Serviços Totais',
    format: 'number' as const,
    icon: Scissors,
    iconColor: 'text-indigo-500',
    subtitle: 'Cortes + barba + extras'
  },
  {
    key: 'dias_trabalhados' as const,
    title: 'Dias Trabalhados',
    format: 'number' as const,
    icon: Calendar,
    iconColor: 'text-emerald-500',
    subtitle: 'Dias com movimento'
  },
  {
    key: 'faturamento_por_dia' as const,
    title: 'Fat./Dia Trabalhado',
    format: 'currency' as const,
    icon: TrendingUp,
    iconColor: 'text-primary',
    subtitle: 'Média por dia de trabalho'
  }
];

// ============================================================
// HELPER: Monta comparações para um KPI específico
// ============================================================

function buildComparisonsForKpi(
  key: string,
  comparacoes?: DashboardComparacoes
): KpiComparisons {
  if (!comparacoes) {
    return { sply: null, mom: null, avg_12m: null, avg_6m: null };
  }

  // Mapeia o nome do KPI para o campo de valor absoluto no bloco de comparações
  const kpiFieldMap: Record<string, string> = {
    faturamento: 'faturamento',
    atendimentos: 'atendimentos',
    clientes: 'clientes',
    dias_trabalhados: 'dias_trabalhados',
    faturamento_por_dia: 'faturamento_por_dia',
  };

  const fieldName = kpiFieldMap[key];
  
  if (!fieldName) {
    // KPIs que não têm comparação ainda (ticket_medio, extras, etc.)
    return { sply: null, mom: null, avg_12m: null, avg_6m: null };
  }

  return {
    sply: comparacoes.sply?.[fieldName as keyof typeof comparacoes.sply] as number ?? null,
    mom: comparacoes.mom?.[fieldName as keyof typeof comparacoes.mom] as number ?? null,
    avg_12m: null, // Não implementado ainda
    avg_6m: null   // Não implementado ainda
  };
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function DashboardKpiCards({ kpis, comparacoes, dateFrom, dateTo, colaboradorId, tipoColaborador }: DashboardKpiCardsProps) {
  const navigate = useNavigate();

  const handleDrillFaturamento = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('inicio', dateFrom);
    if (dateTo) params.set('fim', dateTo);
    if (colaboradorId) params.set('colaborador_id', colaboradorId);
    if (tipoColaborador) params.set('tipo_colaborador', tipoColaborador);
    navigate(`/app/faturamento?${params.toString()}`);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {KPI_CONFIG.map((config) => (
        <div key={config.key}>
          <DashboardKpiCard
            title={config.title}
            value={kpis[config.key]}
            format={config.format}
            icon={config.icon}
            iconColor={config.iconColor}
            subtitle={config.subtitle}
            details={KPI_DETAILS[config.key]}
            comparisons={buildComparisonsForKpi(config.key, comparacoes)}
          />
          {config.key === 'faturamento' && dateFrom && dateTo && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-1"
              onClick={handleDrillFaturamento}
            >
              Detalhar
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export default DashboardKpiCards;

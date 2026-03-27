// ============================================================
// FILE: src/components/clientes/ClientesPainelKpis.tsx
// PROPÓSITO: KPI cards do painel completo de clientes
// ============================================================

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserPlus, UserCheck, CalendarDays, Receipt, DollarSign, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { PainelKpis } from '@/hooks/useClientes';
import { fmtInt, fmtMoney } from '@/hooks/useClientes';
import type { NovosResumo } from '@/hooks/useClientesNovos';
import { InfoPopover } from './InfoPopover';

interface Props {
  kpis: PainelKpis | null;
  periodoLabel: string;
  refDate?: string;
  novosResumo?: NovosResumo | null;
  onDrillFaixa?: (tipo: string, valor: string, label: string) => void;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  info,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  info: { title: string; description: string; example?: string; periodLabel?: string };
  onClick?: () => void;
}) {
  return (
    <Card className={`overflow-hidden relative group border-border/50 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all' : ''}`} onClick={onClick}>
      <div
        className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity"
        style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, transparent 60%)' }}
      />
      <CardContent className="relative p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-tight flex-1 min-w-0">
            {label}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <InfoPopover
              title={info.title}
              description={info.description}
              example={info.example}
              periodLabel={info.periodLabel}
            />
            <Icon className="h-4 w-4 opacity-60 text-primary" />
          </div>
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {sub && (
          <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border/30">
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ClientesPainelKpis({ kpis, periodoLabel, refDate, novosResumo, onDrillFaixa }: Props) {
  if (!kpis) return null;

  const refFormatted = refDate ? format(parseISO(refDate), 'dd/MM/yyyy') : null;
  const refLabel = refFormatted ? `Data de referência do status: ${refFormatted}` : `Período: ${periodoLabel}`;
  const retencao30d = novosResumo?.kpis?.retencao_30d;
  const pctNovos = novosResumo?.kpis?.pct_novos_sobre_unicos;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCard
        icon={Users}
        label="Total Clientes"
        value={fmtInt(kpis.total_clientes)}
        onClick={() => onDrillFaixa?.('TODOS', 'TODOS', 'Todos os Clientes')}
        info={{
          title: 'Total de clientes no período',
          description: `Quantidade de clientes distintos que foram atendidos no período selecionado. Cada cliente conta uma vez, independente de quantas vezes veio. O status (VIP, Em Risco, etc.) é calculado na data de referência${refFormatted ? ` (${refFormatted})` : ''}.`,
          example: 'Se 300 clientes vieram no período, mesmo que um deles tenha vindo 10 vezes, o total é 300.',
          periodLabel: refLabel,
        }}
      />
      <KpiCard
        icon={UserPlus}
        label="Novos"
        value={fmtInt(kpis.clientes_novos)}
        sub={kpis.total_clientes > 0 ? `${((kpis.clientes_novos / kpis.total_clientes) * 100).toFixed(1)}% do total` : undefined}
        onClick={() => onDrillFaixa?.('STATUS', 'AGUARDANDO_RETORNO', 'Clientes: Aguardando Retorno')}
        info={{
          title: 'Clientes novos no período',
          description: `Clientes cuja PRIMEIRA visita histórica aconteceu dentro do período selecionado. O status é uma fotografia calculada na data de referência${refFormatted ? ` (${refFormatted})` : ''}.`,
          example: 'Se um cliente veio pela primeira vez em março/2026 e o período é jan-mar/2026, ele conta como novo.',
          periodLabel: refLabel,
        }}
      />
      <KpiCard
        icon={UserCheck}
        label="Novos que Retornaram"
        value={fmtInt(kpis.clientes_novos_retornaram)}
        sub={kpis.clientes_novos > 0 ? `${((kpis.clientes_novos_retornaram / kpis.clientes_novos) * 100).toFixed(1)}% dos novos` : undefined}
        info={{
          title: 'Novos que já retornaram',
          description: 'Dos clientes novos (primeira visita no período), quantos voltaram ao menos uma segunda vez em um dia diferente. Indica a capacidade de fidelização.',
          example: 'Se 50 clientes vieram pela primeira vez e 20 deles voltaram, são 20 novos que retornaram (40% de retenção).',
          periodLabel: `Período: ${periodoLabel}`,
        }}
      />
      <KpiCard
        icon={CalendarDays}
        label="Atendimentos"
        value={fmtInt(kpis.total_atendimentos)}
        info={{
          title: 'Total de atendimentos',
          description: 'Número total de serviços/vendas realizados no período. Um cliente que veio 3 vezes e fez 2 serviços por visita gera 6 atendimentos.',
          periodLabel: `Período: ${periodoLabel}`,
        }}
      />
      <KpiCard
        icon={Receipt}
        label="Ticket Médio"
        value={fmtMoney(kpis.ticket_medio)}
        info={{
          title: 'Ticket médio por cliente',
          description: 'Valor médio gasto por cliente no período. Calculado como: valor total gasto pelo cliente ÷ número de atendimentos dele, e então a média de todos os clientes.',
          periodLabel: `Período: ${periodoLabel}`,
        }}
      />
      <KpiCard
        icon={DollarSign}
        label="Valor Total"
        value={fmtMoney(kpis.valor_total)}
        info={{
          title: 'Valor total no período',
          description: 'Soma de todos os valores brutos de serviços e produtos vendidos aos clientes identificados no período.',
          periodLabel: `Período: ${periodoLabel}`,
        }}
      />
      {retencao30d != null && (
        <KpiCard
          icon={RotateCcw}
          label="Ret. 30d Novos"
          value={`${retencao30d}%`}
          sub={pctNovos != null ? `${pctNovos}% são novos` : undefined}
          info={{
            title: 'Retenção 30 dias dos novos',
            description: 'Dos clientes cuja primeira visita foi no período, qual % voltou em até 30 dias. Indica a capacidade de transformar um visitante novo em cliente recorrente.',
            example: 'Se 100 novos vieram e 35 voltaram em até 30 dias, a retenção é 35%.',
            periodLabel: `Período: ${periodoLabel}`,
          }}
        />
      )}
    </div>
  );
}

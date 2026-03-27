import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoIconTooltip } from '@/components/help/InfoIconTooltip';
import type { ServicoItem } from '@/hooks/useServicos';

interface ServicosChartsProps {
  items: ServicoItem[];
  agrupamento: 'servico' | 'barbeiro' | 'mes';
  onDrillDown?: (item: ServicoItem) => void;
}

// VIP Palette — aligned with design system
// Uses gold (primary), emerald (success), blue (info), warning tones
const VIBRANT_COLORS = [
  'hsl(43, 72%, 54%)',   // Gold (primary)
  'hsl(156, 78%, 40%)',  // Emerald (success)
  'hsl(205, 78%, 54%)',  // Blue (info)
  'hsl(42, 92%, 52%)',   // Warning gold
  'hsl(43, 72%, 44%)',   // Gold darker
  'hsl(156, 78%, 35%)',  // Emerald darker
  'hsl(205, 78%, 44%)',  // Blue darker
  'hsl(43, 72%, 64%)',   // Gold lighter
];

const AXIS_STYLE = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 };
const GRID_STROKE = 'hsl(var(--border))';
const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--popover-foreground))',
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat('pt-BR').format(v);

// Chart info definitions
const CHART_INFO = {
  faturamento: {
    title: 'Faturamento por Item',
    short: 'Valor total faturado por serviço/produto',
    details: (
      <>
        <p>Mostra o faturamento de cada item no período selecionado.</p>
        <p className="mt-2"><strong>Clique em uma barra</strong> para ver detalhamento por barbeiro.</p>
      </>
    ),
  },
  quantidade: {
    title: 'Quantidade por Item',
    short: 'Número de vezes que cada item foi vendido',
    details: (
      <>
        <p>Mostra quantas vezes cada serviço/produto foi vendido no período.</p>
        <p className="mt-2"><strong>Dica:</strong> Compare com faturamento para identificar itens de alto volume vs. alto valor.</p>
      </>
    ),
  },
  ticket: {
    title: 'Ticket Médio por Item',
    short: 'Valor médio de cada item',
    details: (
      <>
        <p>Ticket médio individual de cada serviço ou produto.</p>
        <p className="mt-2"><strong>Fórmula:</strong> Faturamento do item ÷ Quantidade vendida</p>
      </>
    ),
  },
  participacao: {
    title: 'Participação no Faturamento',
    short: 'Distribuição percentual da receita',
    details: (
      <>
        <p>Mostra quanto cada item contribui para o faturamento total.</p>
        <p className="mt-2"><strong>Análise:</strong> Identifique concentração de receita e oportunidades de diversificação.</p>
      </>
    ),
  },
};

interface ChartCardProps {
  title: string;
  infoKey?: keyof typeof CHART_INFO;
  children: React.ReactNode;
}
function ChartCard({ title, infoKey, children }: ChartCardProps) {
  const info = infoKey ? CHART_INFO[infoKey] : null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-1">
          {title}
          {info && (
            <InfoIconTooltip
              title={info.title}
              short={info.short}
              details={info.details}
              size="sm"
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const CustomTooltipFat = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="p-3 text-xs shadow-lg">
      <p className="font-semibold mb-1 text-foreground">{label}</p>
      <p style={{ color: payload[0]?.fill ?? '#3b82f6' }}>
        Faturamento: <span className="font-bold">{formatCurrency(payload[0]?.value ?? 0)}</span>
      </p>
    </div>
  );
};

const CustomTooltipQtd = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="p-3 text-xs shadow-lg">
      <p className="font-semibold mb-1 text-foreground">{label}</p>
      <p style={{ color: 'hsl(156, 78%, 40%)' }}>
        Quantidade: <span className="font-bold">{formatNumber(payload[0]?.value ?? 0)}</span>
      </p>
    </div>
  );
};

const CustomTooltipTicket = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="p-3 text-xs shadow-lg">
      <p className="font-semibold mb-1 text-foreground">{label}</p>
      <p style={{ color: 'hsl(43, 72%, 54%)' }}>
        Ticket Médio: <span className="font-bold">{formatCurrency(payload[0]?.value ?? 0)}</span>
      </p>
    </div>
  );
};

const CustomTooltipPie = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="p-3 text-xs shadow-lg">
      <p className="font-semibold mb-1 text-foreground">{payload[0]?.name}</p>
      <p style={{ color: payload[0]?.payload?.fill ?? '#3b82f6' }}>
        Participação: <span className="font-bold">{Number(payload[0]?.value).toFixed(1)}%</span>
      </p>
      <p className="text-muted-foreground">
        Faturamento: <span className="font-medium">{formatCurrency(payload[0]?.payload?.faturamento ?? 0)}</span>
      </p>
    </div>
  );
};

function getAxisLabel(agrupamento: string) {
  if (agrupamento === 'barbeiro') return 'Barbeiro';
  if (agrupamento === 'mes') return 'Mês';
  return 'Serviço';
}

export function ServicosCharts({ items, agrupamento, onDrillDown }: ServicosChartsProps) {
  const topItems = items.slice(0, 10);

  const getDisplayName = (item: ServicoItem) => {
    if (agrupamento === 'barbeiro') return item.colaborador_nome || item.nome;
    if (agrupamento === 'mes') return item.mes_ano || item.nome;
    return item.nome;
  };

  const chartData = topItems.map((item, index) => ({
    name: getDisplayName(item),
    faturamento: item.faturamento,
    quantidade: item.quantidade,
    ticket_medio: item.ticket_medio,
    participacao: item.participacao_pct,
    fill: VIBRANT_COLORS[index % VIBRANT_COLORS.length],
    _item: item,
  }));

  const axisProps = {
    tick: { ...AXIS_STYLE, fontSize: 10 },
    axisLine: { stroke: GRID_STROKE },
    tickLine: false,
  };

  const xAxisProps = {
    ...axisProps,
    dataKey: 'name',
    angle: -45,
    textAnchor: 'end' as const,
    height: 56,
    interval: 0,
    tick: { ...AXIS_STYLE, fontSize: 9 },
  };

  const clickable = !!onDrillDown && agrupamento !== 'mes';

  const handleBarClick = (data: any) => {
    if (onDrillDown && data?._item) onDrillDown(data._item);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Faturamento */}
      <ChartCard title={`Faturamento por ${getAxisLabel(agrupamento)} (Top 10)`} infoKey="faturamento">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis {...axisProps} tickFormatter={formatCurrency} width={60} />
            <Tooltip content={<CustomTooltipFat />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
            <Bar
              dataKey="faturamento"
              radius={[4, 4, 0, 0]}
              cursor={clickable ? 'pointer' : 'default'}
              onClick={clickable ? handleBarClick : undefined}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {clickable && (
          <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-1">
            Clique em uma barra para detalhar
          </p>
        )}
      </ChartCard>

      {/* Participação Pie */}
      <ChartCard title="Participação no Faturamento (%)" infoKey="participacao">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="participacao"
              nameKey="name"
              cx="50%"
              cy="45%"
              outerRadius={70}
              innerRadius={28}
              paddingAngle={2}
              cursor={clickable ? 'pointer' : 'default'}
              onClick={clickable ? (_, __, e: any) => {
                const entry = chartData[e?.index ?? -1];
                if (entry && onDrillDown) onDrillDown(entry._item);
              } : undefined}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="hsl(var(--background))" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltipPie />} />
            <Legend
              iconType="circle"
              iconSize={6}
              wrapperStyle={{ fontSize: 10 }}
              formatter={(value) => (
                <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }}>
                  {value.length > 14 ? value.slice(0, 12) + '…' : value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Quantidade */}
      <ChartCard title={`Quantidade por ${getAxisLabel(agrupamento)}`} infoKey="quantidade">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis {...axisProps} tickFormatter={formatNumber} width={48} />
            <Tooltip content={<CustomTooltipQtd />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
            <Bar
              dataKey="quantidade"
              fill="hsl(156, 78%, 40%)"
              radius={[4, 4, 0, 0]}
              cursor={clickable ? 'pointer' : 'default'}
              onClick={clickable ? handleBarClick : undefined}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Ticket Médio */}
      <ChartCard title={`Ticket Médio por ${getAxisLabel(agrupamento)}`} infoKey="ticket">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis {...axisProps} tickFormatter={formatCurrency} width={60} />
            <Tooltip content={<CustomTooltipTicket />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
            <Bar
              dataKey="ticket_medio"
              fill="hsl(43, 72%, 54%)"
              radius={[4, 4, 0, 0]}
              cursor={clickable ? 'pointer' : 'default'}
              onClick={clickable ? handleBarClick : undefined}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

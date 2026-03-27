import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoPopover } from './InfoPopover';
import { ArrowUpRight, ArrowDownRight, Users, UserPlus, UserMinus, TrendingUp } from 'lucide-react';

export interface SaldoBaseData {
  base_inicio: number;
  novos_entraram: number;
  novos_ficaram: number;
  sairam: number;
  base_atual: number;
  saldo: number;
}

interface Props {
  loading: boolean;
  data: SaldoBaseData | null;
  janelaDias: number;
}

function fmtInt(v: number) {
  return new Intl.NumberFormat('pt-BR').format(v);
}

function SaldoItem({ icon: Icon, label, value, color, sign }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  sign?: '+' | '-' | '=';
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${color}`}>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">
          {sign && <span className="text-muted-foreground mr-0.5">{sign}</span>}
          {fmtInt(value)}
        </p>
      </div>
    </div>
  );
}

export function ClientesSaldoBase({ loading, data, janelaDias }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const saldoPositivo = data.saldo >= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1">
          <CardTitle className="text-sm">Saldo de Clientes</CardTitle>
          <InfoPopover
            title="Saldo de Clientes"
            description={`Movimentação líquida da base considerando janela de ${janelaDias} dias. Compara a base ativa do período anterior com a atual.`}
            example="Base Início + Novos − Saíram ≈ Base Atual. Saldo positivo = base crescendo."
          />
          <div className={`ml-auto flex items-center gap-1 text-xs font-semibold ${saldoPositivo ? 'text-emerald-500' : 'text-red-400'}`}>
            {saldoPositivo ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {saldoPositivo ? '+' : ''}{fmtInt(data.saldo)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <SaldoItem
            icon={Users}
            label="Base Início"
            value={data.base_inicio}
            color="bg-muted/30"
          />
          <SaldoItem
            icon={UserPlus}
            label="Novos Entraram"
            value={data.novos_entraram}
            color="bg-blue-500/5 border-blue-500/20"
            sign="+"
          />
          <SaldoItem
            icon={TrendingUp}
            label="Novos Ficaram"
            value={data.novos_ficaram}
            color="bg-emerald-500/5 border-emerald-500/20"
          />
          <SaldoItem
            icon={UserMinus}
            label="Saíram"
            value={data.sairam}
            color="bg-red-500/5 border-red-500/20"
            sign="-"
          />
          <SaldoItem
            icon={Users}
            label="Base Atual"
            value={data.base_atual}
            color={`${saldoPositivo ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}
            sign="="
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Card de comissão individual do colaborador
 * Mobile-first, valores sempre com centavos
 * Integrado com sistema de bônus
 */

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, Layers, Sparkles, Package, Gift } from 'lucide-react';
import { ComissaoColaborador } from '@/types/comissao';
import { useBonusRegrasPeriodo, calcularBonus } from '@/hooks/useBonus';
import { ColaboradorKpis } from '@/types/bonus';
import BonusBlocoCard from './BonusBlocoCard';

interface ComissaoColaboradorCardProps {
  comissao: ComissaoColaborador;
  ranking: number;
  ano?: number;
  mes?: number;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Cores das faixas: transparência >50%, sem borda, escrita forte
const FAIXA_STYLES: Record<string, { bg: string; text: string }> = {
  'tier-1': { // Bronze
    bg: 'bg-amber-900/20',
    text: 'text-amber-500',
  },
  'tier-2': { // Prata
    bg: 'bg-slate-400/20',
    text: 'text-slate-300',
  },
  'tier-3': { // Ouro
    bg: 'bg-yellow-600/20',
    text: 'text-yellow-400',
  },
  'tier-4': { // Platina
    bg: 'bg-cyan-400/20',
    text: 'text-cyan-300',
  },
  'tier-5': { // Diamante
    bg: 'bg-purple-400/20',
    text: 'text-purple-300',
  },
};

export default function ComissaoColaboradorCard({ comissao, ranking, ano, mes }: ComissaoColaboradorCardProps) {
  // Buscar regras de bônus do período
  const { data: bonusRegras } = useBonusRegrasPeriodo(ano || new Date().getFullYear(), mes || new Date().getMonth() + 1);

  // Calcular bônus para este colaborador usando KPIs REAIS
  const kpis: ColaboradorKpis = {
    colaborador_id: comissao.colaborador_id,
    colaborador_nome: comissao.colaborador_nome,
    faturamento: comissao.faturamento_total,
    atendimentos: comissao.atendimentos,
    clientes: comissao.clientes,
    clientes_novos: comissao.clientes_novos,
    servicos_totais: comissao.servicos_totais,
    extras_qtd: comissao.extras_qtd,
    extras_valor: comissao.faturamento_extras,
    dias_trabalhados: comissao.dias_trabalhados,
    ticket_medio: comissao.ticket_medio,
    faturamento_por_dia: comissao.faturamento_por_dia,
    comissao_total: comissao.comissao_total,
    faturamento_base: comissao.faturamento_servicos_base,
    faturamento_extras: comissao.faturamento_extras,
  };

  const bonusResultados = (bonusRegras || [])
    .map((regra) => calcularBonus(regra, kpis))
    .filter((b) => b.aplicavel);

  const totalBonus = bonusResultados.reduce((sum, b) => sum + (b.atingiu ? b.bonus_calculado : 0), 0);
  const totalAReceber = comissao.comissao_total + totalBonus;

  const servicosBase = comissao.servicos;
  const faturamentoBase = comissao.faturamento_servicos_base;

  const faixaServicos = servicosBase?.faixa;
  const proximaFaixa = servicosBase?.proximaFaixa;
  const progresso = Number(servicosBase?.progressoProximaFaixa ?? 0);

  const percBase = Number(servicosBase?.percentual ?? 0);
  const comissaoBase = Number(servicosBase?.comissao ?? 0);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border/50">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 text-primary font-bold text-xs sm:text-sm flex-shrink-0">
              {ranking}º
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm truncate">{comissao.colaborador_nome}</h3>
              <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span>{comissao.dias_trabalhados} dias</span>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{formatBRL(comissao.faturamento_por_dia)}/dia</span>
            </div>
            {faixaServicos && (
              <Badge
                className={`mt-1 text-[10px] sm:text-xs border-none shadow-sm ${
                  FAIXA_STYLES[faixaServicos.cor]?.bg || 'bg-muted'
                } ${
                  FAIXA_STYLES[faixaServicos.cor]?.text || 'text-foreground'
                }`}
              >
                {faixaServicos.nome} ({faixaServicos.percentual}%)
              </Badge>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-3 sm:p-4 space-y-1.5">
          {/* Faturamento Total */}
          <div className="flex justify-between items-center">
            <span className="text-xs sm:text-sm text-muted-foreground">Faturamento</span>
            <span className="font-semibold text-xs sm:text-sm">{formatBRL(comissao.faturamento_total)}</span>
          </div>

          {/* Breakdown Serviço Base (linha principal) */}
          <div className="flex justify-between items-center text-xs sm:text-sm">
            <div className="flex items-center gap-1 sm:gap-2">
              <Layers className="h-3 w-3 text-blue-500 flex-shrink-0" />
              <span className="text-muted-foreground">S. Base</span>
            </div>
            <div className="text-right flex items-center gap-1 flex-wrap justify-end">
              <span className="text-muted-foreground">{formatBRL(faturamentoBase)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-green-500 font-medium">{formatBRL(comissaoBase)}</span>
              <span className="text-[10px] text-muted-foreground">({percBase}%)</span>
            </div>
          </div>

          {/* Breakdown Serviços Extras */}
          {comissao.faturamento_extras > 0 && (
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <div className="flex items-center gap-1 sm:gap-2">
                <Sparkles className="h-3 w-3 text-violet-500 flex-shrink-0" />
                <span className="text-muted-foreground">S. Extra</span>
              </div>
              <div className="text-right flex items-center gap-1 flex-wrap justify-end">
                <span className="text-muted-foreground">{formatBRL(comissao.faturamento_extras)}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-green-500 font-medium">{formatBRL(comissao.extras.comissao)}</span>
                <span className="text-[10px] text-muted-foreground">({comissao.extras.percentual}%)</span>
              </div>
            </div>
          )}

          {/* Breakdown Produtos */}
          <div className="flex justify-between items-center text-xs sm:text-sm">
            <div className="flex items-center gap-1 sm:gap-2">
              <Package className="h-3 w-3 text-amber-500 flex-shrink-0" />
              <span className="text-muted-foreground">Produtos</span>
            </div>
            <div className="text-right flex items-center gap-1 flex-wrap justify-end">
              <span className="text-muted-foreground">{formatBRL(comissao.faturamento_produtos)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-green-500 font-medium">{formatBRL(comissao.produtos.comissao)}</span>
              <span className="text-[10px] text-muted-foreground">({comissao.produtos.percentual}%)</span>
            </div>
          </div>

          {/* Divider - Total Comissão */}
          <div className="border-t border-border/50 pt-2 mt-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs sm:text-sm">Total Comissão</span>
                {comissao.faturamento_total > 0 && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    ({((comissao.comissao_total / comissao.faturamento_total) * 100).toFixed(1)}%)
                  </span>
                )}
              </div>
              <span className="text-sm sm:text-lg font-bold text-green-500">
                {formatBRL(comissao.comissao_total)}
              </span>
            </div>
          </div>

          {/* Progresso para próxima faixa (MOVIDO PARA CÁ) */}
          {proximaFaixa && progresso < 100 && (
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                <span>Próxima faixa: {proximaFaixa.nome}</span>
                <span>{progresso.toFixed(0)}%</span>
              </div>
              <Progress value={progresso} className="h-1.5 sm:h-2" />
            </div>
          )}

          {/* Bloco de Bônus com Total */}
          {bonusResultados.length > 0 && (
            <BonusBlocoCard bonus={bonusResultados} />
          )}

          {/* Total a Receber (Comissão + Bônus) - sempre se houver regras */}
          {bonusResultados.length > 0 && (
            <div className="border-t border-border/50 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm text-foreground">TOTAL A RECEBER</span>
                  {comissao.faturamento_total > 0 && (
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      ({((totalAReceber / comissao.faturamento_total) * 100).toFixed(1)}%)
                    </span>
                  )}
                </div>
                <span className="text-sm sm:text-lg font-bold text-primary">
                  {formatBRL(totalAReceber)}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

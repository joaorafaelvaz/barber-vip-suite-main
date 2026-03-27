/**
 * Bloco de bônus para exibir no card do colaborador
 */

import { Gift } from 'lucide-react';
import { BonusResultado } from '@/types/bonus';

interface BonusBlocoCardProps {
  bonus: BonusResultado[];
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export default function BonusBlocoCard({ bonus }: BonusBlocoCardProps) {
  if (!bonus || bonus.length === 0) return null;

  const totalBonus = bonus.reduce((sum, b) => sum + (b.atingiu ? b.bonus_calculado : 0), 0);

  if (totalBonus === 0 && bonus.every((b) => !b.aplicavel)) return null;

  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <div className="flex items-center gap-1 mb-2">
        <Gift className="h-3 w-3 text-violet-500" />
        <span className="text-xs font-medium text-foreground">BÔNUS</span>
      </div>

      <div className="space-y-1.5">
        {bonus.map((b) => {
          if (!b.aplicavel) return null;

          const diferenca = b.diferenca_meta || 0;

          return (
            <div
              key={b.regra_id}
              className="flex justify-between items-start text-xs"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{b.nome_bonus}</div>
                {b.meta !== null && (
                  <div className="text-muted-foreground">
                    Meta: {formatNumber(b.meta)} | Real: {formatNumber(b.kpi_realizado)}
                    {diferenca !== 0 && (
                      <span className={diferenca > 0 ? 'text-green-500' : 'text-red-500'}>
                        {' '}({diferenca > 0 ? '+' : ''}{formatNumber(diferenca)})
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right ml-2">
                {b.atingiu ? (
                  <span className="text-green-500 font-medium">
                    {formatBRL(b.bonus_calculado)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sempre mostrar Total Bônus */}
      <div className="flex justify-between items-center mt-2 pt-1 border-t border-border/30">
        <span className="text-xs font-medium text-foreground">Total Bônus</span>
        <span className={`text-sm font-bold ${totalBonus > 0 ? 'text-violet-500' : 'text-muted-foreground'}`}>
          {formatBRL(totalBonus)}
        </span>
      </div>
    </div>
  );
}

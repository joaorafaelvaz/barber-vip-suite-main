/**
 * Componente para seleção múltipla de meses
 */

import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface MesesSelectorProps {
  mesesSelecionados: number[];
  onChange: (meses: number[]) => void;
  aplicarAteAlterada: boolean;
  onAplicarAteAlteradaChange: (value: boolean) => void;
  mesInicial: number;
}

const MESES = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Fev' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Ago' },
  { value: 9, label: 'Set' },
  { value: 10, label: 'Out' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dez' },
];

export default function MesesSelector({
  mesesSelecionados,
  onChange,
  aplicarAteAlterada,
  onAplicarAteAlteradaChange,
  mesInicial,
}: MesesSelectorProps) {
  const handleToggle = (mesValue: number) => {
    if (aplicarAteAlterada) return;
    const isSelected = mesesSelecionados.includes(mesValue);
    if (isSelected) {
      onChange(mesesSelecionados.filter((m) => m !== mesValue));
    } else {
      onChange([...mesesSelecionados, mesValue]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="aplicar-ate-alterada"
          checked={aplicarAteAlterada}
          onCheckedChange={(checked) => {
            onAplicarAteAlteradaChange(!!checked);
            if (checked) {
              // Quando marca "até ser alterada", seleciona a partir do mês inicial
              onChange([mesInicial]);
            }
          }}
        />
        <Label htmlFor="aplicar-ate-alterada" className="text-sm cursor-pointer">
          Aplicar nos meses seguintes até ser alterada
        </Label>
      </div>

      {!aplicarAteAlterada && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">
              Ou selecione meses específicos:
            </Label>
            <button
              type="button"
              onClick={() => onChange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
              className="text-xs text-primary hover:underline"
            >
              Todos
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {MESES.map((mes) => {
              const selecionado = mesesSelecionados.includes(mes.value);
              return (
                <Badge
                  key={mes.value}
                  variant={selecionado ? 'default' : 'outline'}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => handleToggle(mes.value)}
                >
                  {mes.label}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

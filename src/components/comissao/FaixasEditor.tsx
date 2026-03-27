/**
 * Editor de faixas de comissão
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { CORES_FAIXAS, NOMES_FAIXAS_PADRAO } from '@/types/comissao';

interface Faixa {
  faixa_ordem: number;
  nome: string;
  valor_minimo: number;
  valor_maximo: number | null;
  percentual: number;
  cor: string;
}

interface FaixasEditorProps {
  faixas: Faixa[];
  onChange: (faixas: Faixa[]) => void;
}

export default function FaixasEditor({ faixas, onChange }: FaixasEditorProps) {
  const addFaixa = () => {
    const ultimaFaixa = faixas[faixas.length - 1];
    const novaOrdem = faixas.length + 1;
    const novoMinimo = ultimaFaixa ? (ultimaFaixa.valor_maximo || 0) + 1 : 0;
    
    onChange([
      ...faixas.slice(0, -1),
      // Atualiza a última faixa para ter valor_maximo
      ...(ultimaFaixa ? [{
        ...ultimaFaixa,
        valor_maximo: ultimaFaixa.valor_maximo || novoMinimo - 1,
      }] : []),
      {
        faixa_ordem: novaOrdem,
        nome: NOMES_FAIXAS_PADRAO[novaOrdem - 1] || `Faixa ${novaOrdem}`,
        valor_minimo: novoMinimo,
        valor_maximo: null,
        percentual: (ultimaFaixa?.percentual || 30) + 5,
        cor: CORES_FAIXAS[Math.min(novaOrdem - 1, CORES_FAIXAS.length - 1)],
      },
    ]);
  };

  const removeFaixa = (index: number) => {
    if (faixas.length <= 1) return;
    const novasFaixas = faixas.filter((_, i) => i !== index).map((f, i) => ({
      ...f,
      faixa_ordem: i + 1,
      cor: CORES_FAIXAS[Math.min(i, CORES_FAIXAS.length - 1)],
    }));
    // A última faixa não tem máximo
    if (novasFaixas.length > 0) {
      novasFaixas[novasFaixas.length - 1].valor_maximo = null;
    }
    onChange(novasFaixas);
  };

  const updateFaixa = (index: number, field: keyof Faixa, value: string | number | null) => {
    const novasFaixas = [...faixas];
    novasFaixas[index] = { ...novasFaixas[index], [field]: value };
    
    // Auto-ajustar valor_minimo da próxima faixa
    if (field === 'valor_maximo' && index < faixas.length - 1 && value !== null) {
      novasFaixas[index + 1] = {
        ...novasFaixas[index + 1],
        valor_minimo: Number(value) + 1,
      };
    }
    
    onChange(novasFaixas);
  };

  return (
    <div className="space-y-3">
      {faixas.map((faixa, index) => (
        <Card key={index} className="relative">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded bg-muted text-xs font-medium">
                <GripVertical className="h-3 w-3 text-muted-foreground" />
              </div>
              
              <div className="flex-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={faixa.nome}
                    onChange={(e) => updateFaixa(index, 'nome', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                
                <div>
                  <Label className="text-xs">De (R$)</Label>
                  <Input
                    type="number"
                    value={faixa.valor_minimo}
                    onChange={(e) => updateFaixa(index, 'valor_minimo', Number(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>
                
                <div>
                  <Label className="text-xs">Até (R$)</Label>
                  <Input
                    type="number"
                    value={faixa.valor_maximo ?? ''}
                    placeholder={index === faixas.length - 1 ? '∞' : ''}
                    onChange={(e) => updateFaixa(index, 'valor_maximo', e.target.value ? Number(e.target.value) : null)}
                    className="h-8 text-sm"
                    disabled={index === faixas.length - 1}
                  />
                </div>
                
                <div>
                  <Label className="text-xs">Comissão (%)</Label>
                  <Input
                    type="number"
                    value={faixa.percentual}
                    onChange={(e) => updateFaixa(index, 'percentual', Number(e.target.value))}
                    className="h-8 text-sm"
                    min={0}
                    max={100}
                  />
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => removeFaixa(index)}
                disabled={faixas.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" size="sm" onClick={addFaixa} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Faixa
      </Button>
    </div>
  );
}

/**
 * Filtros para a página de comissões
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ComissaoFiltersProps {
  ano: number;
  mes: number;
  onAnoChange: (ano: number) => void;
  onMesChange: (mes: number) => void;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function ComissaoFilters({ ano, mes, onAnoChange, onMesChange }: ComissaoFiltersProps) {
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 5 }, (_, i) => anoAtual - i);

  return (
    <div className="flex gap-2">
      <Select value={String(mes)} onValueChange={(v) => onMesChange(Number(v))}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {MESES.map((nomeMes, index) => (
            <SelectItem key={index + 1} value={String(index + 1)}>
              {nomeMes}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(ano)} onValueChange={(v) => onAnoChange(Number(v))}>
        <SelectTrigger className="w-[90px]">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {anos.map((a) => (
            <SelectItem key={a} value={String(a)}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

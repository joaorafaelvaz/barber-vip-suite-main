import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ColaboradoresFilters as FiltersType } from '@/types/colaborador';

interface ColaboradoresFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  tiposColaborador: string[];
}

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

export function ColaboradoresFilters({ filters, onFiltersChange, tiposColaborador }: ColaboradoresFiltersProps) {
  const currentYear = new Date().getFullYear();
  const anos = Array.from({ length: 3 }, (_, i) => currentYear - i);

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Mês:</Label>
        <Select
          value={String(filters.mes)}
          onValueChange={(value) => onFiltersChange({ ...filters, mes: Number(value) })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESES.map(mes => (
              <SelectItem key={mes.value} value={String(mes.value)}>
                {mes.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Ano:</Label>
        <Select
          value={String(filters.ano)}
          onValueChange={(value) => onFiltersChange({ ...filters, ano: Number(value) })}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {anos.map(ano => (
              <SelectItem key={ano} value={String(ano)}>
                {ano}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tiposColaborador.length > 0 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Tipo:</Label>
          <Select
            value={filters.tipo || 'all'}
            onValueChange={(value) => onFiltersChange({ ...filters, tipo: value === 'all' ? null : value })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {tiposColaborador.map(tipo => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto">
        <Checkbox
          id="apenas-ativos"
          checked={filters.apenasAtivos}
          onCheckedChange={(checked) => onFiltersChange({ ...filters, apenasAtivos: !!checked })}
        />
        <Label htmlFor="apenas-ativos" className="text-sm cursor-pointer">
          Apenas com faturamento
        </Label>
      </div>
    </div>
  );
}

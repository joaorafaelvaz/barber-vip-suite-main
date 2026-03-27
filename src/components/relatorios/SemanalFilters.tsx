// ============================================================
// FILE: src/components/relatorios/SemanalFilters.tsx
// PROPÓSITO: Filtros para relatório semanal com date range picker
// ============================================================

import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DateRange } from 'react-day-picker';

interface SemanalFiltersProps {
  dataInicio: Date;
  dataFim: Date;
  colaboradorId: string | null;
  colaboradores: { colaborador_id: string; colaborador_nome: string }[];
  loading?: boolean;
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
  onColaboradorChange: (id: string | null) => void;
  onApply: () => void;
}

export function SemanalFilters({
  dataInicio,
  dataFim,
  colaboradorId,
  colaboradores,
  loading,
  onDateRangeChange,
  onColaboradorChange,
  onApply
}: SemanalFiltersProps) {
  const dateRange: DateRange = {
    from: dataInicio,
    to: dataFim
  };

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onDateRangeChange({ from: range.from, to: range.to });
    } else if (range?.from) {
      onDateRangeChange({ from: range.from, to: range.from });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
      {/* Date Range Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full sm:w-[280px] justify-start text-left font-normal",
              !dataInicio && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dataInicio && dataFim ? (
              <>
                {format(dataInicio, 'dd/MM/yyyy', { locale: ptBR })} -{' '}
                {format(dataFim, 'dd/MM/yyyy', { locale: ptBR })}
              </>
            ) : (
              <span>Selecione o período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dataInicio}
            selected={dateRange}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={ptBR}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      
      {/* Colaborador */}
      <Select 
        value={colaboradorId || 'todos'} 
        onValueChange={(v) => onColaboradorChange(v === 'todos' ? null : v)}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Colaborador" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {colaboradores.map((c) => (
            <SelectItem key={c.colaborador_id} value={c.colaborador_id}>
              {c.colaborador_nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Botão Aplicar */}
      <Button onClick={onApply} disabled={loading} size="sm">
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Atualizar
      </Button>
    </div>
  );
}

export default SemanalFilters;

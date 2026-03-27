// ============================================================
// FILE: src/components/dashboard/DashboardFilters.tsx
// PROPÓSITO: Bloco de filtros do Dashboard com defaults inteligentes
// COMPORTAMENTO: 
//   - NÃO dispara RPC automaticamente ao mudar filtros
//   - Somente ao clicar em "Aplicar Filtros"
//   - Data início: primeiro dia do mês atual
//   - Data fim: último dia com faturamento (ou primeiro dia se não houver)
// ============================================================

import React, { useState, useRef } from 'react';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Search, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { DashboardFilters as FiltersType, DashboardColaborador } from './types';

// ============================================================
// TIPOS LOCAIS
// ============================================================

interface DashboardFiltersProps {
  onApply: (filters: FiltersType) => void;
  colaboradores: DashboardColaborador[];
  loading: boolean;
  onTipoChange?: (tipo: string | null) => void;
  initialDateTo?: Date;
  initialDateFrom?: Date;
  initialColaboradorId?: string | null;
  initialTipoColaborador?: string | null;
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function DashboardFilters({ 
  onApply, 
  colaboradores, 
  loading,
  onTipoChange,
  initialDateTo,
  initialDateFrom,
  initialColaboradorId,
  initialTipoColaborador
}: DashboardFiltersProps) {
  const [dateFrom, setDateFrom] = useState<Date>(initialDateFrom || startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(initialDateTo || new Date());
  const [tipoColaborador, setTipoColaborador] = useState<string>(initialTipoColaborador || 'all');
  const [colaboradorId, setColaboradorId] = useState<string>(initialColaboradorId || 'all');
  
  // Track if initial dates have been applied (only set defaults once)
  const initialDatesApplied = useRef(!!(initialDateFrom || initialDateTo));

  // Only set defaults from initialDateTo on first load when no URL params provided
  if (!initialDatesApplied.current && initialDateTo) {
    initialDatesApplied.current = true;
    setDateTo(initialDateTo);
    setDateFrom(startOfMonth(initialDateTo));
  }

  // Handle tipo change — only reset colaborador on user interaction
  const handleTipoChange = (newTipo: string) => {
    setTipoColaborador(newTipo);
    setColaboradorId('all');
    onTipoChange?.(newTipo === 'all' ? null : newTipo);
  };

  // Handler do botão "Aplicar Filtros"
  const handleApply = () => {
    const filters: FiltersType = {
      dateFrom,
      dateTo,
      colaboradorId: colaboradorId === 'all' ? null : colaboradorId,
      tipoColaborador: tipoColaborador === 'all' ? null : (tipoColaborador as 'barbeiro' | 'recepcao')
    };
    
    onApply(filters);
  };

  // Handler para restaurar período padrão
  const handleResetDates = () => {
    const defaultDateTo = initialDateTo || new Date();
    setDateTo(defaultDateTo);
    setDateFrom(startOfMonth(defaultDateTo));
  };

  // Formata data para exibição
  const formatDate = (date: Date) => {
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col gap-3">
          {/* Linha 1: Date Pickers + Reset */}
          <div className="flex items-end gap-2">
            <div className="grid grid-cols-2 gap-2 flex-1">
              {/* Data Início */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  Início
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'w-full justify-start text-left font-normal h-9',
                        !dateFrom && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{dateFrom ? formatDate(dateFrom) : 'Selecione'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => date && setDateFrom(date)}
                      disabled={(date) => date > dateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Data Fim */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  Fim
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'w-full justify-start text-left font-normal h-9',
                        !dateTo && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{dateTo ? formatDate(dateTo) : 'Selecione'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => date && setDateTo(date)}
                      disabled={(date) => date < dateFrom || date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Botão Reset */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetDates}
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Restaurar período padrão</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Linha 2: Selects de Tipo e Colaborador */}
          <div className="grid grid-cols-2 gap-2">
            {/* Tipo de Colaborador */}
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                Tipo
              </label>
              <Select value={tipoColaborador} onValueChange={handleTipoChange}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="barbeiro">Barbeiros</SelectItem>
                  <SelectItem value="recepcao">Recepção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Colaborador */}
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                Colaborador
                {colaboradores.length > 0 && (
                  <span className="ml-1 opacity-60">
                    ({colaboradores.length})
                  </span>
                )}
              </label>
              <Select value={colaboradorId} onValueChange={setColaboradorId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {colaboradores.map((colab) => (
                    <SelectItem 
                      key={colab.colaborador_id} 
                      value={colab.colaborador_id}
                    >
                      {colab.colaborador_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 3: Botão de Ação */}
          <Button 
            onClick={handleApply} 
            disabled={loading}
            className="w-full h-10 font-medium"
          >
            <Search className="mr-2 h-4 w-4" />
            {loading ? 'Carregando...' : 'Aplicar Filtros'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default DashboardFilters;

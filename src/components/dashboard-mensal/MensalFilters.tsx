import React, { useState, useEffect } from 'react';
import { Search, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { DashboardColaborador } from '@/components/dashboard/types';
import type { DashboardMensalFilters } from '@/hooks/useDashboardMensal';

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

const ANOS = [2023, 2024, 2025, 2026];

interface MensalFiltersProps {
  onApply: (filters: DashboardMensalFilters) => void;
  colaboradores: DashboardColaborador[];
  loading: boolean;
  onTipoChange?: (tipo: string | null) => void;
  initialAnoInicio?: number;
  initialMesInicio?: number;
  initialAnoFim?: number;
  initialMesFim?: number;
  initialColaboradorId?: string | null;
  initialTipoColaborador?: string | null;
}

export function MensalFilters({ onApply, colaboradores, loading, onTipoChange, initialAnoInicio, initialMesInicio, initialAnoFim, initialMesFim, initialColaboradorId, initialTipoColaborador }: MensalFiltersProps) {
  const now = new Date();
  const [anoInicio, setAnoInicio] = useState(initialAnoInicio ?? now.getFullYear());
  const [mesInicio, setMesInicio] = useState(initialMesInicio ?? 1);
  const [anoFim, setAnoFim] = useState(initialAnoFim ?? now.getFullYear());
  const [mesFim, setMesFim] = useState(initialMesFim ?? (now.getMonth() + 1));
  const [tipoColaborador, setTipoColaborador] = useState<string>(initialTipoColaborador || 'all');
  const [colaboradorId, setColaboradorId] = useState<string>(initialColaboradorId || 'all');

  useEffect(() => {
    setColaboradorId('all');
    onTipoChange?.(tipoColaborador === 'all' ? null : tipoColaborador);
  }, [tipoColaborador, onTipoChange]);

  const handleApply = () => {
    onApply({
      anoInicio,
      mesInicio,
      anoFim,
      mesFim,
      colaboradorId: colaboradorId === 'all' ? null : colaboradorId,
      tipoColaborador: tipoColaborador === 'all' ? null : (tipoColaborador as 'barbeiro' | 'recepcao'),
    });
  };

  const handleReset = () => {
    const n = new Date();
    setAnoInicio(n.getFullYear());
    setMesInicio(1);
    setAnoFim(n.getFullYear());
    setMesFim(n.getMonth() + 1);
    setTipoColaborador('all');
    setColaboradorId('all');
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col gap-3">
          {/* Linha 1: Período Início + Fim + Reset */}
          <div className="flex items-end gap-2">
            <div className="grid grid-cols-2 gap-2 flex-1">
              {/* Início */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  Início
                </label>
                <div className="grid grid-cols-2 gap-1">
                  <Select value={String(mesInicio)} onValueChange={(v) => setMesInicio(Number(v))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)} className="text-xs">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(anoInicio)} onValueChange={(v) => setAnoInicio(Number(v))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANOS.map((a) => (
                        <SelectItem key={a} value={String(a)} className="text-xs">
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fim */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  Fim
                </label>
                <div className="grid grid-cols-2 gap-1">
                  <Select value={String(mesFim)} onValueChange={(v) => setMesFim(Number(v))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)} className="text-xs">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(anoFim)} onValueChange={(v) => setAnoFim(Number(v))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANOS.map((a) => (
                        <SelectItem key={a} value={String(a)} className="text-xs">
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
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

          {/* Linha 2: Tipo + Colaborador */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                Tipo
              </label>
              <Select value={tipoColaborador} onValueChange={setTipoColaborador}>
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

            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                Colaborador
                {colaboradores.length > 0 && (
                  <span className="ml-1 opacity-60">({colaboradores.length})</span>
                )}
              </label>
              <Select value={colaboradorId} onValueChange={setColaboradorId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {colaboradores.map((c) => (
                    <SelectItem key={c.colaborador_id} value={c.colaborador_id}>
                      {c.colaborador_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botão */}
          <Button onClick={handleApply} disabled={loading} className="w-full h-10 font-medium">
            <Search className="mr-2 h-4 w-4" />
            {loading ? 'Carregando...' : 'Aplicar Filtros'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

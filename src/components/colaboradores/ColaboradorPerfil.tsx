import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, TrendingUp, Calendar, History, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolgasEditor } from './FolgasEditor';
import type { ColaboradorComDados, ProjecaoFaixa } from '@/types/colaborador';

interface ColaboradorPerfilProps {
  colaborador: ColaboradorComDados | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mes: number;
  ano: number;
  onPeriodoChange: (mes: number, ano: number) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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

export function ColaboradorPerfil({ 
  colaborador, 
  open, 
  onOpenChange,
  mes,
  ano,
  onPeriodoChange,
}: ColaboradorPerfilProps) {
  const currentYear = new Date().getFullYear();
  const anos = Array.from({ length: 3 }, (_, i) => currentYear - i);

  if (!colaborador) return null;

  const temFaturamento = colaborador.faturamento > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">
                {colaborador.colaborador_nome || 'Sem nome'}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {colaborador.tipo_colaborador || 'Colaborador'} 
                {colaborador.first_seen && (
                  <> • Desde {format(new Date(colaborador.first_seen), 'MMM/yyyy', { locale: ptBR })}</>
                )}
              </p>
            </div>
            <div className={`w-3 h-3 rounded-full ${temFaturamento ? 'bg-green-500' : 'bg-muted-foreground'}`} />
          </div>
        </SheetHeader>

        <div className="py-4">
          {/* Seletor de período */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm text-muted-foreground">Período:</span>
            <Select
              value={String(mes)}
              onValueChange={(v) => onPeriodoChange(Number(v), ano)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map(m => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(ano)}
              onValueChange={(v) => onPeriodoChange(mes, Number(v))}
            >
              <SelectTrigger className="w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map(a => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="resumo" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="resumo">
                <DollarSign className="h-4 w-4 mr-1" />
                Resumo
              </TabsTrigger>
              <TabsTrigger value="folgas">
                <Calendar className="h-4 w-4 mr-1" />
                Folgas
              </TabsTrigger>
              <TabsTrigger value="historico">
                <History className="h-4 w-4 mr-1" />
                Histórico
              </TabsTrigger>
            </TabsList>

            {/* Tab: Resumo */}
            <TabsContent value="resumo" className="mt-4 space-y-4">
              {/* Card de métricas principais */}
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Faturamento</div>
                      <div className="text-2xl font-bold">{formatCurrency(colaborador.faturamento)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Dias Trabalhados</div>
                      <div className="text-2xl font-bold">{colaborador.diasTrabalhados}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Comissão</div>
                      <div className="text-lg font-semibold text-primary">
                        {formatCurrency(colaborador.comissao)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Bônus</div>
                      <div className="text-lg font-semibold text-primary">
                        {formatCurrency(colaborador.bonus)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">Total a Receber</div>
                        <div className="text-2xl font-bold text-primary">
                          {formatCurrency(colaborador.totalReceber)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">% do Faturamento</div>
                        <div className="text-xl font-semibold">
                          {colaborador.percentualTotal.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {colaborador.faixa && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Faixa atual:</span>
                        <Badge variant="outline">
                          {colaborador.faixa.nome} ({colaborador.faixa.percentual}%)
                        </Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Projeção (se tiver faturamento) */}
              {temFaturamento && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Projeção do Mês
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Média por dia:</span>
                        <span className="font-medium">
                          {formatCurrency(colaborador.diasTrabalhados > 0 
                            ? colaborador.faturamento / colaborador.diasTrabalhados 
                            : 0
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pt-2">
                        Configure as folgas para ver projeções mais precisas baseadas nos dias restantes programados.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab: Folgas */}
            <TabsContent value="folgas" className="mt-4">
              <FolgasEditor
                colaboradorId={colaborador.colaborador_id}
                colaboradorNome={colaborador.colaborador_nome || 'Colaborador'}
                ano={ano}
                mes={mes}
              />
            </TabsContent>

            {/* Tab: Histórico */}
            <TabsContent value="historico" className="mt-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Histórico de períodos anteriores será exibido aqui.
                    <br />
                    <span className="text-xs">Funcionalidade em desenvolvimento.</span>
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

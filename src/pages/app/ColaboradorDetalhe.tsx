// ============================================================
// FILE: src/pages/app/ColaboradorDetalhe.tsx
// PROPÓSITO: Página dedicada de configuração do colaborador
// ============================================================

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Award,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useComissoesMes } from '@/hooks/useComissoes';
import { useCalendarioColaborador } from '@/hooks/useCalendarioColaborador';
import { 
  FolgasFixasConfig,
  FolgasAvulsasConfig,
  CalendarioColaborador,
  ResumoAusenciasPeriodo,
  ColaboradorComissoesView,
  ColaboradorBonusView,
  ColaboradorHistorico
} from '@/components/colaboradores';

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ColaboradorDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentDate = new Date();
  
  const [mes, setMes] = useState(currentDate.getMonth() + 1);
  const [ano, setAno] = useState(currentDate.getFullYear());
  
  // 1. Query independente para dados base do colaborador (NUNCA depende de faturamento)
  const { data: colaboradorBase, isLoading: loadingBase } = useQuery({
    queryKey: ['colaborador-base', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dimensao_colaboradores')
        .select('colaborador_id, colaborador_nome, tipo_colaborador, ativo')
        .eq('colaborador_id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
  
  // 2. Dados financeiros (opcionais - pode retornar vazio para meses futuros)
  const { comissoes, isLoading: loadingComissoes } = useComissoesMes(ano, mes);
  
  // 3. Calendário individual
  const { 
    calendario, 
    historicoFolgas, 
    isLoading: loadingCalendario 
  } = useCalendarioColaborador({ 
    colaboradorId: id || '', 
    ano, 
    mes 
  });
  
  // Dados financeiros do colaborador (opcional)
  const dadosFinanceiros = useMemo(() => {
    if (!comissoes || !id) return null;
    return comissoes.find(c => c.colaborador_id === id) || null;
  }, [comissoes, id]);
  
  const anos = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 1 + i);
  
  // Navegação do calendário
  const handleMesAnterior = () => {
    if (mes === 1) {
      setMes(12);
      setAno(ano - 1);
    } else {
      setMes(mes - 1);
    }
  };
  
  const handleProximoMes = () => {
    if (mes === 12) {
      setMes(1);
      setAno(ano + 1);
    } else {
      setMes(mes + 1);
    }
  };
  
  if (loadingBase) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  
  if (!colaboradorBase) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/app/colaboradores')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Colaborador não encontrado.
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const colaboradorNome = colaboradorBase.colaborador_nome || 'Sem nome';
  const colaboradorId = colaboradorBase.colaborador_id;
  const temFaturamento = (dadosFinanceiros?.faturamento_total || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/colaboradores')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {colaboradorNome}
              </h1>
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${temFaturamento ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
            </div>
            <p className="text-muted-foreground text-sm">
              Configurações e histórico do colaborador
            </p>
          </div>
        </div>

        {/* Seletor de período */}
        <div className="flex items-center gap-2 pl-14 sm:pl-0">
          <span className="text-sm text-muted-foreground shrink-0">Período:</span>
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
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
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[85px]">
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
      </div>
      
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xs text-muted-foreground mb-1">Faturamento</div>
            <div className="text-base sm:text-xl font-bold text-foreground">
              {formatCurrency(dadosFinanceiros?.faturamento_total || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xs text-muted-foreground mb-1">Comissão</div>
            <div className="text-base sm:text-xl font-bold text-primary">
              {formatCurrency(dadosFinanceiros?.comissao_total || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xs text-muted-foreground mb-1">Dias Trabalhados</div>
            <div className="text-base sm:text-xl font-bold text-foreground">
              {dadosFinanceiros?.dias_trabalhados || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xs text-muted-foreground mb-1">Faixa Atual</div>
            {dadosFinanceiros?.servicos?.faixa ? (
              <Badge variant="outline" className="text-sm sm:text-base">
                {dadosFinanceiros.servicos.faixa.nome} ({dadosFinanceiros.servicos.percentual}%)
              </Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs de configuração */}
      <Tabs defaultValue="folgas" className="w-full">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="folgas" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Folgas</span>
          </TabsTrigger>
          <TabsTrigger value="comissoes" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Comissões</span>
          </TabsTrigger>
          <TabsTrigger value="bonus" className="gap-2">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Bônus</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Tab: Folgas */}
        <TabsContent value="folgas" className="mt-6 space-y-6">
          {/* Calendário visual - sempre renderiza */}
          {loadingCalendario ? (
            <Skeleton className="h-64" />
          ) : (
            calendario && (
              <CalendarioColaborador 
                calendario={calendario}
                percentualComissao={dadosFinanceiros?.servicos?.percentual || 0}
                onMesAnterior={handleMesAnterior}
                onProximoMes={handleProximoMes}
              />
            )
          )}
          
          {/* Folgas avulsas */}
          <FolgasAvulsasConfig
            colaboradorId={colaboradorId}
            colaboradorNome={colaboradorNome}
            ano={ano}
            mes={mes}
          />
          
          {/* Resumo do período */}
          {!loadingCalendario && calendario && (
            <ResumoAusenciasPeriodo 
              calendario={calendario}
              ano={ano}
              mes={mes}
            />
          )}
          
          {/* Configuração de folgas fixas */}
          <FolgasFixasConfig 
            colaboradorId={colaboradorId}
            colaboradorNome={colaboradorNome}
            calendario={calendario}
            ano={ano}
            mes={mes}
          />
        </TabsContent>
        
        {/* Tab: Comissões */}
        <TabsContent value="comissoes" className="mt-6">
          <ColaboradorComissoesView
            colaboradorId={colaboradorId}
            colaboradorNome={colaboradorNome}
            ano={ano}
            mes={mes}
          />
        </TabsContent>
        
        {/* Tab: Bônus */}
        <TabsContent value="bonus" className="mt-6">
          <ColaboradorBonusView
            colaboradorId={colaboradorId}
            colaboradorNome={colaboradorNome}
            ano={ano}
            mes={mes}
          />
        </TabsContent>
        
        {/* Tab: Histórico */}
        <TabsContent value="historico" className="mt-6">
          <ColaboradorHistorico
            colaboradorId={colaboradorId}
            colaboradorNome={colaboradorNome}
          />
        </TabsContent>
        
      </Tabs>
    </div>
  );
}

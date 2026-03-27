// ============================================================
// FILE: src/pages/app/RelatoriosSemanal.tsx
// PROPÓSITO: Página de Relatórios Semanais
// ============================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { format, startOfMonth, parseISO } from 'date-fns';
import { Calendar, Users, BarChart2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRelatorioSemanal } from '@/hooks/useRelatorioSemanal';
import { useRelatorioComentarios } from '@/hooks/useRelatorioComentarios';
import {
  SemanalFilters,
  SemanalResumoCards,
  SemanalProjecao,
  SemanalCharts,
  SemanaCard,
  SemanalPainelExecutivo,
  SemanalEnvioBarbeiros
} from '@/components/relatorios';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { RelatorioSemanalFilters } from '@/types/relatorio-semanal';

// ── Skeletons de carregamento ────────────────────────────────
function GeralLoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="bg-card/50 border-border/40">
            <CardContent className="p-4 space-y-2">
              <div className="h-3 w-16 bg-muted/60 rounded" />
              <div className="h-7 w-24 bg-muted/80 rounded" />
              <div className="h-2.5 w-20 bg-muted/40 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Painel executivo */}
      <Card className="bg-card/50 border-border/40">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 w-36 bg-muted/70 rounded" />
            <div className="h-5 w-24 bg-muted/40 rounded" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-14 bg-muted/50 rounded" />
                <div className="h-5 w-20 bg-muted/70 rounded" />
                <div className="h-2.5 w-16 bg-muted/40 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Semana cards */}
      <div className="space-y-2">
        <div className="h-5 w-40 bg-muted/60 rounded" />
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="bg-card/50 border-border/40">
            <CardContent className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 bg-muted/50 rounded" />
                <div className="h-4 w-32 bg-muted/60 rounded" />
              </div>
              <div className="h-5 w-24 bg-muted/70 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Chart */}
      <Card className="bg-card/50 border-border/40">
        <CardContent className="p-5">
          <div className="h-4 w-32 bg-muted/60 rounded mb-4" />
          <div className="h-[220px] bg-muted/20 rounded-lg flex items-end gap-3 px-4 pb-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-1 rounded-t"
                style={{ height: `${40 + Math.random() * 50}%`, background: 'hsl(var(--muted)/0.4)' }} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BarbeirosLoadingSkeleton() {
  return (
    <Card className="bg-card/60 border-border/40 animate-pulse overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
        <div className="h-4 w-28 bg-muted/60 rounded" />
        <div className="h-6 w-20 bg-muted/40 rounded" />
      </div>
      <CardContent className="px-5 pt-4 pb-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/30 bg-card/50 p-3 space-y-2">
              <div className="h-3.5 w-16 bg-muted/60 rounded" />
              <div className="h-6 w-20 bg-muted/80 rounded" />
              <div className="h-2.5 w-full bg-muted/30 rounded-full" />
              <div className="h-3 w-24 bg-muted/40 rounded" />
              <div className="h-3 w-20 bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RelatoriosSemanal() {
  const hoje = new Date();

  // Filtros do formulário (pending) vs filtros aplicados (enviados ao hook)
  const [filters, setFilters] = useState<RelatorioSemanalFilters>({
    data_inicio: startOfMonth(hoje),
    data_fim: hoje,
    colaborador_id: null,
    inicio_semana: 'dom'
  });
  // Aplica imediatamente com default — não espera RPC de última data
  const [appliedFilters, setAppliedFilters] = useState<RelatorioSemanalFilters>({
    data_inicio: startOfMonth(hoje),
    data_fim: hoje,
    colaborador_id: null,
    inicio_semana: 'dom'
  });

  const [activeSection, setActiveSection] = useState<'geral' | 'barbeiros'>('geral');
  const [mostrarFaturamento, setMostrarFaturamento] = useState(true);
  const [painelAberto, setPainelAberto] = useState(true);

  // Hook com React Query — cacheado por 5min, não refaz ao navegar de volta
  const { data, loading, error } = useRelatorioSemanal(appliedFilters);
  const {
    fetchComentarios,
    saveComentario,
    getComentarioSemana,
    saving: savingComentario
  } = useRelatorioComentarios();

  // Colaboradores extraídos dos dados carregados
  const [colaboradores, setColaboradores] = useState<{ colaborador_id: string; colaborador_nome: string }[]>([]);

  // Inicialização: carrega comentários e silenciosamente ajusta para última data real
  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    fetchComentarios(hoje.getFullYear(), hoje.getMonth() + 1, null);
    // Atualiza para a data real de último faturamento sem bloquear o carregamento
    supabase.rpc('rpc_get_last_faturamento_date').then(({ data: lastDate }) => {
      if (!lastDate) return;
      const dataFim = parseISO(lastDate as string);
      if (format(dataFim, 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd')) return;
      const dataInicio = startOfMonth(dataFim);
      const updated: RelatorioSemanalFilters = {
        data_inicio: dataInicio,
        data_fim: dataFim,
        colaborador_id: null,
        inicio_semana: 'dom'
      };
      setFilters(updated);
      setAppliedFilters(updated);
      fetchComentarios(dataFim.getFullYear(), dataFim.getMonth() + 1, null);
    });
  }, []);

  // Atualiza colaboradores quando dados carregam
  useEffect(() => {
    if (data?.colaboradores && data.colaboradores.length > 0) {
      setColaboradores(data.colaboradores);
    }
  }, [data?.colaboradores]);

  // Handler para aplicar filtros — apenas atualiza appliedFilters, React Query refaz a query
  const handleApply = useCallback(() => {
    setAppliedFilters({ ...filters });
    fetchComentarios(
      filters.data_fim.getFullYear(),
      filters.data_fim.getMonth() + 1,
      filters.colaborador_id
    );
  }, [filters, fetchComentarios]);
  
  // Handler para salvar comentário
  const handleSaveComentario = useCallback((semanaInicio: Date, semanaFim: Date, comentario: string) => {
    saveComentario({
      colaborador_id: filters.colaborador_id,
      ano: filters.data_fim.getFullYear(),
      semana_inicio: format(semanaInicio, 'yyyy-MM-dd'),
      semana_fim: format(semanaFim, 'yyyy-MM-dd'),
      comentario
    });
  }, [filters, saveComentario]);

  // Handler para mudança de intervalo de datas
  const handleDateRangeChange = useCallback((range: { from: Date; to: Date }) => {
    setFilters(f => ({ 
      ...f, 
      data_inicio: range.from, 
      data_fim: range.to 
    }));
  }, []);

  return (
    <div className="space-y-5">
      {/* Barra de progresso global */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-primary/20 overflow-hidden">
          <div className="h-full bg-primary w-1/2 animate-pulse" style={{ animation: 'loadbar 1.4s ease-in-out infinite' }} />
          <style>{`@keyframes loadbar { 0%{transform:translateX(-100%)} 100%{transform:translateX(300%)} }`}</style>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Relatórios Semanais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhamento semanal de performance
          </p>
        </div>
        <SemanalFilters
          dataInicio={filters.data_inicio}
          dataFim={filters.data_fim}
          colaboradorId={filters.colaborador_id}
          colaboradores={colaboradores}
          loading={loading}
          onDateRangeChange={handleDateRangeChange}
          onColaboradorChange={(id) => setFilters(f => ({ ...f, colaborador_id: id }))}
          onApply={handleApply}
        />
      </div>

      {/* ── Submenu principal ── */}
      <div className="flex gap-2 border-b border-border/40 pb-0">
        <button
          onClick={() => setActiveSection('geral')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeSection === 'geral'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          Resultado Semanal
        </button>
        <button
          onClick={() => setActiveSection('barbeiros')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeSection === 'barbeiros'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" />
          Barbeiros
        </button>
      </div>
      
      {/* ── Seção: Barbeiros ── */}
      {activeSection === 'barbeiros' && (
        <>
          {loading && <BarbeirosLoadingSkeleton />}
          {!loading && data && data.semanas.length > 0 && (() => {
            const semanas = data.semanas;
            const ultima = semanas[semanas.length - 1];
            const penultima = semanas.length >= 2 ? semanas[semanas.length - 2] : null;
            return (
              <SemanalEnvioBarbeiros
                semanaAtual={ultima}
                semanaAnterior={penultima ?? null}
                allSemanas={data.semanas}
              />
            );
          })()}
          {!loading && (!data || data.semanas.length === 0) && (
            <Card className="bg-card/50">
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                Nenhum dado disponível. Aplique os filtros para carregar.
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Seção: Resultado Semanal ── */}
      {activeSection === 'geral' && (
        <>
      {/* Loading State */}
      {loading && <GeralLoadingSkeleton />}

      {/* Error State */}
      {error && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="p-4 text-destructive">
            Erro ao carregar dados: {error}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !data && !error && (
        <Card className="bg-card/50">
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            Nenhum dado carregado. Ajuste o período e clique em Aplicar.
          </CardContent>
        </Card>
      )}

      {/* Data */}
      {!loading && data && (
        <div className="space-y-6">
          <SemanalResumoCards acumulado={data.acumulado} />

          {data.semanas.length > 0 && (
            <SemanalPainelExecutivo
              semanas={data.semanas}
              medias={data.medias}
              open={painelAberto}
              onToggle={setPainelAberto}
            />
          )}

          {/* 2. Detalhamento por Semana (última primeiro) */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">
              Resultado por Semana
            </h3>
            
            {data.semanas.length === 0 ? (
              <Card className="bg-card/50">
                <CardContent className="p-8 text-center text-muted-foreground">
                  Nenhum dado encontrado para o período selecionado
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {[...data.semanas].reverse().map((semana) => {
                  const comentarioExistente = getComentarioSemana(
                    format(semana.data_inicio, 'yyyy-MM-dd'),
                    filters.colaborador_id
                  );
                  
                  return (
                    <SemanaCard
                      key={semana.semana_numero}
                      semana={semana}
                      medias={data.medias}
                      comentarioInicial={comentarioExistente?.comentario}
                      onSaveComentario={(comentario) => 
                        handleSaveComentario(semana.data_inicio, semana.data_fim, comentario)
                      }
                      savingComentario={savingComentario}
                    />
                  );
                })}
              </div>
            )}
          </div>
          
          {/* 3. Gráfico de Evolução */}
          <SemanalCharts semanas={data.semanas} medias={data.medias} />
          
          {/* 4. Projeção do Mês */}
          <SemanalProjecao
            projecao={data.projecao}
            mostrarFaturamento={mostrarFaturamento}
            onToggleFaturamento={setMostrarFaturamento}
          />
        </div>
      )}
    </>
  )}

    </div>
  );
}

// ============================================================
// FILE: src/components/dashboard/DashboardBarberTable.tsx
// PROPÓSITO: Cards de desempenho por barbeiro/colaborador
// ============================================================

import React, { useMemo } from 'react';
import { Users, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ByColaborador } from './types';

// ============================================================
// HELPERS DE FORMATAÇÃO (PADRÃO DEFINIDO)
// ============================================================

// Dinheiro: milhar com ponto + 2 casas decimais
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

// Inteiros (atendimentos, clientes, serviços)
function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value || 0);
}

// ============================================================
// RESOLVERS (compatibilidade de chaves vindas do Supabase)
// - Evita "extras = 0" quando o backend manda nomes diferentes
// ============================================================

/**
 * Lê um número de um objeto, tentando várias chaves (fallback).
 * - Se não existir/for inválido, retorna 0.
 */
function pickNumber(obj: any, keys: string[]): number {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    // alguns backends retornam numeric como string
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  }
  return 0;
}

/**
 * Extras (qtd e valor) — tenta os nomes mais comuns.
 * Ajuste aqui se você confirmar que o JSON vem com outro nome específico.
 */
function getExtrasQtd(barber: any): number {
  return pickNumber(barber, [
    'extras_qtd',
    'extrasQtd',
    'servicos_extras_qtd',
    'servicosExtrasQtd',
    'qtd_extras',
    'extrasQuantidade',
  ]);
}

function getExtrasValor(barber: any): number {
  return pickNumber(barber, [
    'extras_valor',
    'extrasValor',
    'servicos_extras_valor',
    'servicosExtrasValor',
    'valor_extras',
    'extrasFaturamento',
  ]);
}

/**
 * Faturamento por dia trabalhado (vem do Supabase; NÃO calcular no front)
 */
function getFaturamentoDia(barber: any): number {
  return pickNumber(barber, [
    'faturamento_por_dia_trabalhado',
    'faturamento_dia_trabalhado',
    'faturamento_por_dia',
    'faturamentoDia',
  ]);
}

// ============================================================
// TIPOS
// ============================================================

interface DashboardBarberTableProps {
  data: ByColaborador[];
}

// ============================================================
// COMPONENTE: LINHA DE INDICADOR (3 COLUNAS) — MAIS "COLADO" À ESQUERDA
// - label (esq)
// - valor (meio, alinhado mais pra esquerda e sem "empurrar")
// - comparação placeholder (dir, colada também)
// ============================================================

interface IndicatorRowProps {
  label: string;
  value: string;
  secondary?: string; // comparações futuras (MOM / SPLY / etc)
}

function IndicatorRow({ label, value, secondary = '*#' }: IndicatorRowProps) {
  return (
    <div className="flex items-start gap-3 py-0.5 text-sm">
      {/* LABEL */}
      <span className="min-w-[128px] text-muted-foreground leading-tight">
        {label}
      </span>

      {/* VALOR (mais perto do label, sem ficar "jogado" pra direita) */}
      <span className="min-w-[110px] text-foreground font-semibold leading-tight">
        {value}
      </span>

      {/* COMPARAÇÃO (placeholder) */}
      <span className="text-[11px] text-muted-foreground leading-tight">
        {secondary}
      </span>
    </div>
  );
}

// ============================================================
// COMPONENTE: CARD DO BARBEIRO
// ============================================================

interface BarberRowProps {
  barber: ByColaborador;
  rank: number;
}

function BarberRow({ barber, rank }: BarberRowProps) {
  // ✅ pega extras do JSON real (com fallback)
  const extrasQtd = getExtrasQtd(barber);
  const extrasValor = getExtrasValor(barber);

  // ✅ pega faturamento/dia do JSON real (com fallback)
  const faturamentoDia = getFaturamentoDia(barber);

  return (
    <div className="bg-muted/10 p-4 rounded-xl">
      <div className="space-y-3">
        {/* HEADER: RANK + NOME + FAT/DIA + DIAS */}
        <div className="flex items-center justify-between bg-background/80 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-3">
            {/* RANK */}
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                rank === 1 && 'bg-amber-500 text-white',
                rank === 2 && 'bg-gray-400 text-white',
                rank === 3 && 'bg-orange-600 text-white',
                rank > 3 && 'bg-muted text-muted-foreground'
              )}
            >
              {rank}º
            </div>

            {/* NOME + FAT/DIA + DIAS */}
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground leading-tight">
                  {barber.colaborador_nome || 'Sem nome'}
                </p>

                {/* BADGE: Fat./Dia */}
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {formatBRL(faturamentoDia)}/dia
                </span>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground leading-tight mt-0.5">
                <Calendar className="h-3 w-3" />
                {formatNumber(barber.dias_trabalhados || 0)} dias trabalhados
              </div>
            </div>
          </div>
        </div>

        {/* BLOCO DE INDICADORES (neutro com leve destaque) */}
        <div className="bg-background/60 rounded-lg px-3 py-2 space-y-0.5">
          <IndicatorRow label="Faturamento" value={formatBRL(barber.faturamento)} />
          <IndicatorRow label="Atendimentos" value={formatNumber(barber.atendimentos)} />
          <IndicatorRow label="Ticket Médio" value={formatBRL(barber.ticket_medio)} />

          {/* ✅ KPI que faltava no card do barbeiro */}
          <IndicatorRow label="Faturamento / dia" value={formatBRL(faturamentoDia)} />

          <IndicatorRow label="Serviços" value={formatNumber(barber.servicos_totais || 0)} />

          {/* ✅ EXTRAS: agora pega do JSON real (não any / não nomes quebrados) */}
          <IndicatorRow label="Extras (qtd)" value={formatNumber(extrasQtd)} />
          <IndicatorRow label="Extras (R$)" value={formatBRL(extrasValor)} />

          <IndicatorRow label="Clientes" value={formatNumber(barber.clientes || 0)} />
          <IndicatorRow label="Novos Clientes" value={formatNumber(barber.clientes_novos || 0)} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// - CARD "lá em cima" com MÉDIA DE FATURAMENTO POR DIA TRABALHADO
// - IMPORTANTE: NÃO calcular no front; vem direto do Supabase
//   Então aqui usamos média simples dos valores que vieram por colaborador
//   (se quiser um valor "geral do período" 100% correto, traga um KPI geral no payload)
// ============================================================

export function DashboardBarberTable({ data }: DashboardBarberTableProps) {
  if (!data || data.length === 0) return null;

  /**
   * ✅ Média geral do "faturamento_por_dia_trabalhado" vindo do Supabase
   * - Estratégia: média ponderada pelo número de dias trabalhados, para não distorcer.
   * - Isso continua respeitando sua regra: NÃO inventa o KPI; só agrega o que veio pronto.
   */
  const avgFaturamentoDia = useMemo(() => {
    let somaPonderada = 0;
    let somaDias = 0;

    for (const d of data) {
      const dias = Number(d.dias_trabalhados || 0);
      const fatDia = getFaturamentoDia(d);

      if (dias > 0 && Number.isFinite(fatDia)) {
        somaPonderada += fatDia * dias;
        somaDias += dias;
      }
    }

    return somaDias > 0 ? somaPonderada / somaDias : 0;
  }, [data]);

  // Ranking: mantém igual (ordem recebida); se quiser ordenar por faturamento, faça no pai (onde busca).
  return (
    <div className="space-y-3">
      {/* CARD SUPERIOR: MÉDIA FATURAMENTO / DIA TRABALHADO */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Média de faturamento por dia trabalhado
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="bg-muted/10 rounded-xl px-4 py-3 flex items-end justify-between">
            <div className="space-y-1">
              <div className="text-2xl font-semibold text-foreground leading-none">
                {formatBRL(avgFaturamentoDia)}
              </div>
              <div className="text-xs text-muted-foreground">
                Agregado a partir do KPI "faturamento_por_dia_trabalhado" vindo do Supabase
              </div>
            </div>

            {/* placeholder comparações futuras */}
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground">Comparações</div>
              <div className="text-sm font-medium text-muted-foreground">*#</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CARD LISTA: DESEMPENHO POR BARBEIRO */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Desempenho por Barbeiro
            </CardTitle>
            <span className="text-[10px] text-muted-foreground">
              {data.length} colaboradores
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-2">
            {data.map((barber, index) => (
              <BarberRow key={barber.colaborador_id} barber={barber} rank={index + 1} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DashboardBarberTable;

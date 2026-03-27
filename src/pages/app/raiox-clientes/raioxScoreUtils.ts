/**
 * Score de Saúde da Base — utilitário compartilhado
 * Algoritmo: interpolação linear por dimensão (0-100).
 */

import type { OverviewData } from '@/hooks/raiox-clientes/useRaioXClientesOverview';
import type { CadenciaData } from '@/hooks/raiox-clientes/useRaioXClientesCadencia';

export type ScoreRange = { min: number; max: number; pts: number }[];

export function interpolateAsc(value: number, ranges: ScoreRange): number {
  for (let i = ranges.length - 1; i >= 0; i--) {
    const r = ranges[i];
    if (value >= r.min) {
      const span = r.max - r.min;
      if (span <= 0) return r.pts;
      const progress = Math.min((value - r.min) / span, 1);
      const prevPts = i > 0 ? ranges[i - 1].pts : 0;
      return prevPts + (r.pts - prevPts) * progress;
    }
  }
  return 0;
}

export function interpolateDesc(value: number, ranges: ScoreRange): number {
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (value < r.max || i === ranges.length - 1) {
      const span = r.max - r.min;
      if (span <= 0) return r.pts;
      const progress = Math.min((value - r.min) / span, 1);
      const nextPts = i < ranges.length - 1 ? ranges[i + 1].pts : 0;
      return r.pts - (r.pts - nextPts) * progress;
    }
  }
  return 0;
}

export const SCORE_RANGES_ATIVOS: ScoreRange = [
  { min: 0,  max: 10,  pts: 0  },
  { min: 10, max: 30,  pts: 10 },
  { min: 30, max: 50,  pts: 22 },
  { min: 50, max: 100, pts: 30 },
];
export const SCORE_RANGES_PERDIDOS: ScoreRange = [
  { min: 0,  max: 15,  pts: 25 },
  { min: 15, max: 30,  pts: 15 },
  { min: 30, max: 50,  pts: 5  },
  { min: 50, max: 100, pts: 0  },
];
export const SCORE_RANGES_RISCO: ScoreRange = [
  { min: 0,  max: 10,  pts: 20 },
  { min: 10, max: 20,  pts: 12 },
  { min: 20, max: 35,  pts: 4  },
  { min: 35, max: 100, pts: 0  },
];
export const SCORE_RANGES_CADENCIA: ScoreRange = [
  { min: 0,  max: 15,  pts: 0  },
  { min: 15, max: 35,  pts: 10 },
  { min: 35, max: 55,  pts: 18 },
  { min: 55, max: 100, pts: 25 },
];

export function pct(num: number, den: number): number {
  return den > 0 ? (num / den) * 100 : 0;
}

export function computeScore(
  kpis: OverviewData['kpis'] | undefined,
  cadKpis: CadenciaData['kpis'] | undefined,
  baseTotal: number,
): number {
  if (!kpis || !baseTotal) return 0;
  const pAtivos = pct(kpis.clientes_ativos_janela ?? 0, baseTotal);
  const pPerd = pct(kpis.clientes_perdidos_macro ?? 0, baseTotal);
  const pRisco = pct(kpis.clientes_em_risco_macro ?? 0, baseTotal);

  let score = 0;
  score += interpolateAsc(pAtivos, SCORE_RANGES_ATIVOS);
  score += interpolateDesc(pPerd, SCORE_RANGES_PERDIDOS);
  score += interpolateDesc(pRisco, SCORE_RANGES_RISCO);

  if (cadKpis && cadKpis.total > 0) {
    const pSaude = pct((cadKpis.assiduo ?? 0) + (cadKpis.regular ?? 0), cadKpis.total);
    score += interpolateAsc(pSaude, SCORE_RANGES_CADENCIA);
  } else {
    score += 12;
  }

  return Math.min(100, Math.round(score * 10) / 10);
}

export function computeDimensionScore(value: number, ranges: ScoreRange, ascending: boolean): number {
  return ascending ? interpolateAsc(value, ranges) : interpolateDesc(value, ranges);
}

export function scoreLabel(score: number) {
  if (score >= 75) return { label: 'Saudável', color: 'text-emerald-400', dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' };
  if (score >= 50) return { label: 'Atenção', color: 'text-amber-400', dot: 'bg-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' };
  if (score >= 25) return { label: 'Em risco', color: 'text-orange-400', dot: 'bg-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/25' };
  return { label: 'Crítico', color: 'text-rose-400', dot: 'bg-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/25' };
}

import type { RaioXPeriodo } from './raioxTypes';

export const MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

export function getYears(rangeBack = 5): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: rangeBack + 1 }, (_, i) => current - rangeBack + i);
}

export function buildDateStart(p: RaioXPeriodo): string {
  const mm = String(p.month).padStart(2, '0');
  return `${p.year}-${mm}-01`;
}

export function buildDateEnd(p: RaioXPeriodo): string {
  const lastDay = new Date(p.year, p.month, 0).getDate();
  const mm = String(p.month).padStart(2, '0');
  return `${p.year}-${mm}-${String(lastDay).padStart(2, '0')}`;
}

export function calcPeriodoLabel(inicio: RaioXPeriodo, fim: RaioXPeriodo): string {
  return `${MONTHS[inicio.month - 1]}/${inicio.year} – ${MONTHS[fim.month - 1]}/${fim.year}`;
}

export function parsePeriod(iso: string): RaioXPeriodo {
  const [y, m] = iso.split('-').map(Number);
  return { year: y, month: m };
}

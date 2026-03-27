export interface ServicosPeriodo {
  month: number; // 1-12
  year: number;
}

export const MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

export function getYears(rangeBack = 5): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: rangeBack + 1 }, (_, i) => current - rangeBack + i);
}

export function buildDateStart(p: ServicosPeriodo): string {
  const mm = String(p.month).padStart(2, '0');
  return `${p.year}-${mm}-01`;
}

export function buildDateEnd(p: ServicosPeriodo): string {
  const lastDay = new Date(p.year, p.month, 0).getDate();
  const mm = String(p.month).padStart(2, '0');
  return `${p.year}-${mm}-${String(lastDay).padStart(2, '0')}`;
}

export function parseDateToPeriodo(dateStr: string): ServicosPeriodo {
  const [y, m] = dateStr.split('-').map(Number);
  return { year: y, month: m };
}

export function formatPeriodoLabel(p: ServicosPeriodo): string {
  return `${MONTHS[p.month - 1]}/${String(p.year).slice(-2)}`;
}

export function getCurrentPeriodo(): ServicosPeriodo {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export const CATEGORIAS = [
  { value: 'Base', label: 'Serviço Base' },
  { value: 'Extra', label: 'Serviço Extra' },
  { value: 'Produtos', label: 'Produtos' },
] as const;

export const AGRUPAMENTOS = [
  { value: 'servico', label: 'Serviço' },
  { value: 'barbeiro', label: 'Barbeiro' },
  { value: 'mes', label: 'Mês' },
] as const;

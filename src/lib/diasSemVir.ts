/**
 * Calcula "dias sem vir" relativo a HOJE (não à data-fim do período).
 * Usado em todas as visualizações que exibem dias_sem_vir por cliente individual.
 *
 * @param ultimaVisita  ISO date string (yyyy-MM-dd) ou null
 * @param fallback      valor da RPC (calculado relativo ao fim do período) — usado se ultimaVisita é null
 */
export function calcDiasSemVir(ultimaVisita: string | null, fallback: number): number {
  if (!ultimaVisita) return fallback;
  const diff = Date.now() - new Date(ultimaVisita + 'T12:00:00').getTime();
  const days = Math.floor(diff / 86_400_000);
  return days >= 0 ? days : fallback;
}

/**
 * Recalcula a média de dias sem vir a partir de uma lista de clientes,
 * usando datas reais relativas a hoje.
 */
export function calcMediaDiasSemVir(
  clientes: Array<{ ultima_visita?: string | null; dias_sem_vir?: number }>,
): number {
  if (!clientes.length) return 0;
  const total = clientes.reduce(
    (acc, c) => acc + calcDiasSemVir(c.ultima_visita ?? null, c.dias_sem_vir ?? 0),
    0,
  );
  return total / clientes.length;
}

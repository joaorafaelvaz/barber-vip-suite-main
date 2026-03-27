import { useState } from 'react';
import type { RaioXComputedFilters } from '@/pages/app/raiox-clientes/raioxTypes';
import { defaultRaioxClientesConfig } from '@/pages/app/raiox-clientes/config/defaultConfig';

const MOCK_DATA = {
  cohorts: [
    { mes: '2025-01', size: 45, m1: 62, m2: 48, m3: 41 },
    { mes: '2025-02', size: 52, m1: 58, m2: 44, m3: 38 },
    { mes: '2025-03', size: 38, m1: 65, m2: 50, m3: 0 },
  ],
};

export function useRaioXClientesCohort(_filters: RaioXComputedFilters) {
  const [loading] = useState(false);
  const [error] = useState<Error | null>(null);

  const _cfg = {
    cohort_meses_max: defaultRaioxClientesConfig.cohort_meses_max,
  };

  const refetch = () => {
    // RPC integration pending
  };

  return { loading, error, data: MOCK_DATA, refetch };
}

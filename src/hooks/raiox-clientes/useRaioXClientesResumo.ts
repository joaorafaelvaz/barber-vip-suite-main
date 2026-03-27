import { useState } from 'react';
import type { RaioXComputedFilters } from '@/pages/app/raiox-clientes/raioxTypes';
import { defaultRaioxClientesConfig } from '@/pages/app/raiox-clientes/config/defaultConfig';
import type { RaioxConfigParams } from './useRaioXClientesOverview';

const MOCK_DATA = {
  totalClientes: 842,
  ativos: 534,
  inativos: 198,
  perdidos: 110,
  ticketMedio: 85.50,
  recorrencia: 72.3,
};

export function useRaioXClientesResumo(_filters: RaioXComputedFilters, _configOverrides?: RaioxConfigParams) {
  const [loading] = useState(false);
  const [error] = useState<Error | null>(null);

  // Config values ready for future RPC integration
  const _cfg = {
    base_mode: _configOverrides?.base_mode ?? defaultRaioxClientesConfig.base_mode,
    status12m_meses: _configOverrides?.status12m_meses ?? defaultRaioxClientesConfig.status12m_meses,
  };

  const refetch = () => {
    // RPC integration pending
  };

  return { loading, error, data: MOCK_DATA, refetch };
}

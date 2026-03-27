import { useState } from 'react';
import type { RaioXComputedFilters } from '@/pages/app/raiox-clientes/raioxTypes';
import { defaultRaioxClientesConfig } from '@/pages/app/raiox-clientes/config/defaultConfig';

const MOCK_DATA = {
  barbeiros: [
    { id: '1', nome: 'Carlos', ativos: 120, perdidos: 18, churnPct: 13.0 },
    { id: '2', nome: 'João', ativos: 98, perdidos: 25, churnPct: 20.3 },
    { id: '3', nome: 'Pedro', ativos: 85, perdidos: 12, churnPct: 12.4 },
  ],
};

export function useRaioXClientesCarteira(_filters: RaioXComputedFilters) {
  const [loading] = useState(false);
  const [error] = useState<Error | null>(null);

  const _cfg = {
    atribuicao_modo: defaultRaioxClientesConfig.atribuicao_modo,
    atribuicao_janela_meses: defaultRaioxClientesConfig.atribuicao_janela_meses,
  };

  const refetch = () => {
    // RPC integration pending
  };

  return { loading, error, data: MOCK_DATA, refetch };
}

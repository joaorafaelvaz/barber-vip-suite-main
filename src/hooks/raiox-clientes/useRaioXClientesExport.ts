import { useState, useCallback } from 'react';
import type { RaioXExportState } from '@/pages/app/raiox-clientes/raioxTypes';

export function useRaioXClientesExport() {
  const [state, setState] = useState<RaioXExportState>({
    exportando: false,
    ultimoExport: null,
  });

  const exportPdfGeral = useCallback(async () => {
    setState(prev => ({ ...prev, exportando: true }));
    setTimeout(() => {
      setState({ exportando: false, ultimoExport: { tipo: 'geral', at: new Date().toISOString() } });
    }, 500);
  }, []);

  const exportPdfBarbeiro = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, exportando: true }));
    setTimeout(() => {
      setState({ exportando: false, ultimoExport: { tipo: 'barbeiro', at: new Date().toISOString() } });
    }, 500);
  }, []);

  const exportCsvLista = useCallback(async (tipo: string) => {
    setState(prev => ({ ...prev, exportando: true }));
    setTimeout(() => {
      setState({ exportando: false, ultimoExport: { tipo: 'lista', at: new Date().toISOString() } });
    }, 500);
  }, []);

  return { ...state, exportPdfGeral, exportPdfBarbeiro, exportCsvLista };
}

import React, { useState, useEffect, useCallback } from 'react';
import { HelpBox } from '@/components/raiox-shared';
import { HowToReadSection } from '@/components/help';
import { Loader2, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ClientesChurnResumo,
  ClientesChurnBarbeirosTable,
  ClientesSaldoBase,
  ClientesAcoesCRM,
  ClientesDrillDialog,
  type DrillDialogState,
} from '@/components/clientes';
import { useClientesChurn } from '@/hooks/useClientesChurn';
import { supabase } from '@/integrations/supabase/client';
import type { RaioXComputedFilters } from '../raioxTypes';
import type { RaioxConfigInstance } from '../RaioXClientesTabs';

interface Props {
  filters: RaioXComputedFilters;
  raioxConfig: RaioxConfigInstance;
}

function fmtD(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

function transformDrillResult(raw: any) {
  if (!raw) return { rows: [] };
  const rows = Array.isArray(raw.rows) ? raw.rows : [];
  return { total: raw.total ?? rows.length, rows };
}

export function TabAcoes({ filters, raioxConfig }: Props) {
  const [janelaDias, setJanelaDias] = useState(filters.janelaDias);
  const [drillDialog, setDrillDialog] = useState<DrillDialogState>({
    open: false, title: '', tipo: '', valor: '',
  });

  const [perdasData, setPerdasData] = useState<{ rows: any[] } | null>(null);
  const [umaVezData, setUmaVezData] = useState<{ rows: any[] } | null>(null);
  const [loadingLanes, setLoadingLanes] = useState(false);

  const churn = useClientesChurn({
    refDate: filters.dataFimISO,
    dataInicio: filters.dataInicioISO,
    dataFim: filters.dataFimISO,
    janelaDias,
    excluirSemCadastro: filters.excluirSemCadastro,
    enabled: true,
  });

  const loadLanesData = useCallback(async () => {
    setLoadingLanes(true);
    try {
      const [perdidosRes, umaVezRes] = await Promise.all([
        supabase.rpc('rpc_clientes_drill_faixa' as any, {
          p_data_inicio: filters.dataInicioISO,
          p_data_fim: filters.dataFimISO,
          p_ref_date: filters.dataFimISO,
          p_tipo: 'STATUS',
          p_valor: 'PERDIDO',
          p_colaborador_id: null,
        }),
        supabase.rpc('rpc_clientes_drill_faixa' as any, {
          p_data_inicio: filters.dataInicioISO,
          p_data_fim: filters.dataFimISO,
          p_ref_date: filters.dataFimISO,
          p_tipo: 'FAIXA_FREQ',
          p_valor: 'uma_vez_novo',
          p_colaborador_id: null,
        }),
      ]);

      if (perdidosRes.data) setPerdasData(transformDrillResult(perdidosRes.data));
      if (umaVezRes.data) setUmaVezData(transformDrillResult(umaVezRes.data));
    } catch (e) {
      console.error('TabAcoes loadLanesData error:', e);
    } finally {
      setLoadingLanes(false);
    }
  }, [filters.dataInicioISO, filters.dataFimISO]);

  useEffect(() => {
    loadLanesData();
  }, [loadLanesData]);

  const periodoLabel = `${fmtD(filters.dataInicioISO)} – ${fmtD(filters.dataFimISO)}`;

  const openDrill = (tipo: string, valor: string, title: string, colaboradorId?: string) => {
    setDrillDialog({ open: true, title, tipo, valor, colaboradorId });
  };

  return (
    <div className="space-y-3 min-w-0 w-full overflow-x-hidden">

      <HowToReadSection
        bullets={[
          'Ações CRM = fila operacional de contato — quem ligar/mandar mensagem hoje.',
          'A janela define ativo: cliente sem visita há mais de N dias = em risco/perdido.',
          'Prioridade 1 (vermelho): em risco urgente. Prioridade 2: perdidos recentes. Prioridade 3: resgatados.',
          'Clique em qualquer número para ver a lista de clientes e exportar.',
        ]}
        expandedText="Esta aba é para ação, não análise. O resumo mostra o estado atual da base. O saldo mostra entradas e saídas. A fila CRM prioriza quem contatar hoje. Altere a janela para diferentes visões de ativo (30d = mais urgente, 90d = mais amplo). Para análise histórica de churn, use a aba Churn."
      />

      <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-border/40 bg-muted/15 text-[10px] text-muted-foreground">
        <Zap className="h-3 w-3 text-primary shrink-0" />
        <span><strong className="text-foreground">Período:</strong> {periodoLabel}</span>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-muted-foreground">Janela ativa:</span>
          <Select value={String(janelaDias)} onValueChange={(v) => setJanelaDias(Number(v))}>
            <SelectTrigger className="w-[90px] h-6 text-[10px] border-border/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[30, 45, 60, 90, 120, 150, 180].map((d) => (
                <SelectItem key={d} value={String(d)} className="text-xs">{d} dias</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-6 px-1.5"
            onClick={() => { churn.reload(); loadLanesData(); }} disabled={churn.loading || loadingLanes}>
            <RefreshCw className={`h-3 w-3 ${churn.loading || loadingLanes ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {churn.error && <HelpBox variant="warning">Erro ao carregar: {churn.error}</HelpBox>}

      {churn.loading && !churn.resumo && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <ClientesChurnResumo
        loading={churn.loading}
        janelaDias={janelaDias}
        resumo={churn.resumo}
        onDrill={(tipo, valor, title) => openDrill(tipo, valor, title)}
      />

      <ClientesSaldoBase
        loading={churn.loading}
        data={churn.saldoBase}
        janelaDias={janelaDias}
      />

      {churn.porBarbeiro && churn.porBarbeiro.length > 0 && (
        <ClientesChurnBarbeirosTable
          loading={churn.loading}
          data={churn.porBarbeiro}
          onOpenBarbeiro={(id, nome) => openDrill('BARBEIRO', id, nome)}
          onDrill={(tipo, valor, title) => openDrill(tipo, valor, title)}
          janelaDias={janelaDias}
        />
      )}

      <ClientesAcoesCRM
        periodoLabel={periodoLabel}
        janelaDias={janelaDias}
        perdasData={perdasData}
        umaVezData={umaVezData}
        churnBarbeiros={churn.porBarbeiro}
      />

      <ClientesDrillDialog
        state={drillDialog}
        onClose={() => setDrillDialog((p) => ({ ...p, open: false }))}
        dataInicio={filters.dataInicioISO}
        dataFim={filters.dataFimISO}
        refDate={filters.dataFimISO}
      />
    </div>
  );
}

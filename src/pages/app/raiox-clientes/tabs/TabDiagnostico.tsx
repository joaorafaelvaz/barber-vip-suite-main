import React from 'react';
import { KpiCard, TableShell } from '@/components/raiox-shared';

export function TabDiagnostico() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Qualidade da base de dados e diagnóstico de problemas.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard label="Sem cliente_id" value="--" status="negative" loading />
        <KpiCard label="Sem telefone" value="--" status="warning" loading />
        <KpiCard label="Sem cadastro" value="--" status="warning" loading />
        <KpiCard label="Dup. por nome" value="--" status="warning" loading />
        <KpiCard label="Dup. por telefone" value="--" status="warning" loading />
        <KpiCard label="Baixa confiança" value="--" loading />
      </div>

      <TableShell
        title="Detalhamento"
        description="Drill de problemas de qualidade na base"
        columns={['Cliente', 'Problema', 'Detalhe', 'Ação sugerida']}
        isEmpty
      />
    </div>
  );
}

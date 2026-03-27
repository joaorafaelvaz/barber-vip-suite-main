import React from 'react';
import { Calendar, Database } from 'lucide-react';
import { BaseBadge } from './BaseBadge';
import type { BaseType } from './BaseBadge';

interface ContextBannerProps {
  ref_date: string;
  inicio: string;
  fim: string;
  baseType: BaseType;
  baseMeses?: number;
  baseDias?: number;
  universoTotal?: number | null;
  regras?: string[];
}

function fmtDate(d: string | null) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

function fmtNum(n: number) {
  return n.toLocaleString('pt-BR');
}

export function ContextBanner({ ref_date, inicio, fim, baseType, baseMeses, baseDias, universoTotal, regras }: ContextBannerProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground bg-muted/30 border border-border rounded-md px-3 py-2">
      <span className="inline-flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        Ref: <span className="text-foreground font-medium">{fmtDate(ref_date)}</span>
      </span>
      <span>
        Período: <span className="text-foreground font-medium">{fmtDate(inicio)} – {fmtDate(fim)}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <Database className="h-3 w-3" />
        Base: <BaseBadge type={baseType} meses={baseMeses} dias={baseDias} />
      </span>
      {universoTotal != null && (
        <span>
          Universo: <span className="text-foreground font-medium">{fmtNum(universoTotal)}</span> clientes
        </span>
      )}
      {regras && regras.length > 0 && regras.map((r, i) => (
        <span key={i} className="text-foreground font-medium">{r}</span>
      ))}
    </div>
  );
}

// ============================================================
// FILE: src/components/faturamento/FaturamentoPrintView.tsx
// PROPÓSITO: Componente dedicado para renderização PDF com tema claro nativo
// ============================================================

import React from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DrillResponse, DrillComparacoes } from '@/hooks/useFaturamentoDrill';

// ---- Formatters ----

function fmt(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(n || 0);
}

function fmtCompact(n: number): string {
  if (n >= 1000) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(n);
  return fmt(n);
}

function fmtPct(n: number): string {
  return `${((n || 0) * 100).toFixed(1)}%`;
}

function fmtDate(s: string): string {
  try { return format(parseISO(s), "dd MMM", { locale: ptBR }); } catch { return s; }
}

function fmtDateFull(s: string): string {
  try { return format(parseISO(s), "dd MMM yyyy", { locale: ptBR }); } catch { return s; }
}

function fmtMonthYear(s: string): string {
  try { return format(parseISO(s), "MMM yyyy", { locale: ptBR }); } catch { return s; }
}

function calcVar(atual: number, ref: number): number | null {
  if (!ref || ref === 0) return null;
  return ((atual - ref) / ref) * 100;
}

function safeDivide(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

function sanitize(v: any): string {
  if (!v || (typeof v === 'string' && v.trim() === '')) return '(Não informado)';
  return String(v);
}

// ---- Styles (inline for html2canvas reliability) ----

const S = {
  root: { width: 1200, padding: 32, background: '#ffffff', color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontSize: 12, lineHeight: 1.5 } as React.CSSProperties,
  title: { fontSize: 20, fontWeight: 700, color: '#222', margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 11, color: '#888', margin: '2px 0 0' } as React.CSSProperties,
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#333', margin: '20px 0 8px', borderBottom: '1px solid #e0e0e0', paddingBottom: 4 } as React.CSSProperties,
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 } as React.CSSProperties,
  kpiCard: { background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 14px' } as React.CSSProperties,
  kpiCardHighlight: { background: '#fef9f0', border: '1px solid #d4a94e', borderRadius: 6, padding: '10px 14px' } as React.CSSProperties,
  kpiLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 2 } as React.CSSProperties,
  kpiValue: { fontSize: 16, fontWeight: 700, color: '#111' } as React.CSSProperties,
  kpiValueHighlight: { fontSize: 16, fontWeight: 700, color: '#9a7422' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 11 } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '6px 10px', background: '#f0f0f0', borderBottom: '1px solid #ddd', fontWeight: 600, color: '#444', fontSize: 10 } as React.CSSProperties,
  thRight: { textAlign: 'right' as const, padding: '6px 10px', background: '#f0f0f0', borderBottom: '1px solid #ddd', fontWeight: 600, color: '#444', fontSize: 10 } as React.CSSProperties,
  td: { padding: '5px 10px', borderBottom: '1px solid #eee', color: '#333' } as React.CSSProperties,
  tdRight: { padding: '5px 10px', borderBottom: '1px solid #eee', color: '#333', textAlign: 'right' as const } as React.CSSProperties,
  tdTotal: { padding: '5px 10px', borderBottom: '1px solid #ddd', fontWeight: 700, color: '#111', background: '#f8f8f8' } as React.CSSProperties,
  tdTotalRight: { padding: '5px 10px', borderBottom: '1px solid #ddd', fontWeight: 700, color: '#111', textAlign: 'right' as const, background: '#f8f8f8' } as React.CSSProperties,
  varPositive: { color: '#16a34a', fontWeight: 600, fontSize: 10 } as React.CSSProperties,
  varNegative: { color: '#dc2626', fontWeight: 600, fontSize: 10 } as React.CSSProperties,
  varNeutral: { color: '#999', fontSize: 10 } as React.CSSProperties,
  insightCard: { padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid #3b82f6', background: '#f0f7ff', marginBottom: 6, fontSize: 11, color: '#333' } as React.CSSProperties,
  rankBadge: { display: 'inline-block', width: 22, textAlign: 'center' as const, fontWeight: 700, fontSize: 10, color: '#888' } as React.CSSProperties,
};

// ---- Sub-components ----

function VarLabel({ valor }: { valor: number | null }) {
  if (valor == null) return <span style={S.varNeutral}>—</span>;
  const style = valor >= 0 ? S.varPositive : S.varNegative;
  return <span style={style}>{valor >= 0 ? '+' : ''}{valor.toFixed(1)}%</span>;
}

function periodLabel(type: string, c: DrillComparacoes): string {
  if (type === 'mom') return `${fmtDate(c.mom_periodo.inicio)} – ${fmtDateFull(c.mom_periodo.fim)}`;
  if (type === 'sply') return `${fmtDate(c.sply_periodo.inicio)} – ${fmtDateFull(c.sply_periodo.fim)}`;
  if (type === 'avg6m') return `${fmtMonthYear(c.avg_6m_periodo.inicio)} – ${fmtMonthYear(c.avg_6m_periodo.fim)}`;
  if (type === 'avg12m') return `${fmtMonthYear(c.avg_12m_periodo.inicio)} – ${fmtMonthYear(c.avg_12m_periodo.fim)}`;
  return '';
}

// ---- Main Props ----

interface FaturamentoPrintViewProps {
  resumo: DrillResponse | null;
  comparacoes: DrillComparacoes | null;
  viewData: DrillResponse | null;
  viewTitle: string;
  filters: { inicio: string; fim: string };
}

export function FaturamentoPrintView({ resumo, comparacoes, viewData, viewTitle, filters }: FaturamentoPrintViewProps) {
  const meta = resumo?.meta as any;
  const total = meta?.total ?? 0;
  const fatBase = meta?.faturamento_base ?? meta?.total ?? 0;
  const extras = meta?.extras_valor ?? 0;
  const produtos = meta?.produtos_valor ?? 0;
  const outros = total - fatBase - extras - produtos;

  return (
    <div style={S.root}>
      {/* Header */}
      <h1 style={S.title}>Faturamento — Detalhamento</h1>
      <p style={S.subtitle}>{fmtDate(filters.inicio)} — {fmtDateFull(filters.fim)}</p>

      {/* KPIs */}
      {resumo && (
        <>
          <h2 style={S.sectionTitle}>Resumo Executivo</h2>
          <div style={S.kpiGrid}>
            <div style={S.kpiCardHighlight}>
              <div style={S.kpiLabel}>Total Geral</div>
              <div style={S.kpiValueHighlight}>{fmt(total)}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Fat. Base</div>
              <div style={S.kpiValue}>{fmt(fatBase)}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Extras</div>
              <div style={S.kpiValue}>{fmt(extras)}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Produtos</div>
              <div style={S.kpiValue}>{fmt(produtos)}</div>
            </div>
            {outros > 0.01 && (
              <div style={S.kpiCard}>
                <div style={S.kpiLabel}>Outros</div>
                <div style={S.kpiValue}>{fmt(outros)}</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Comparações Table */}
      {comparacoes && (
        <>
          <h2 style={S.sectionTitle}>Análise Comparativa</h2>
          <ComparisonTable comparacoes={comparacoes} inicio={filters.inicio} fim={filters.fim} total={total} fatBase={fatBase} extras={extras} produtos={produtos} />
        </>
      )}

      {/* View Data Table */}
      {viewData && viewData.table && (
        <>
          <h2 style={S.sectionTitle}>{viewTitle}</h2>
          <DataTable table={viewData.table} />
        </>
      )}

      {/* Series as table (period data) */}
      {viewData && viewData.series && viewData.series.length > 0 && (
        <>
          <h2 style={S.sectionTitle}>Série — {viewTitle}</h2>
          <SeriesTable series={viewData.series} />
        </>
      )}

      {/* Insights */}
      {viewData && viewData.insights && viewData.insights.length > 0 && (
        <>
          <h2 style={S.sectionTitle}>Insights</h2>
          {viewData.insights.map((s, i) => (
            <div key={i} style={S.insightCard}>{s}</div>
          ))}
        </>
      )}

      {/* Rankings from resumo */}
      {resumo?.table && (
        <>
          {resumo.table.top_colaboradores?.length > 0 && (
            <>
              <h2 style={S.sectionTitle}>Top Barbeiros</h2>
              <RankingTable items={resumo.table.top_colaboradores} />
            </>
          )}
          {resumo.table.mix_grupo_de_produto?.length > 0 && (
            <>
              <h2 style={S.sectionTitle}>Composição por Grupo</h2>
              <RankingTable items={resumo.table.mix_grupo_de_produto} />
            </>
          )}
          {resumo.table.top_itens?.length > 0 && (
            <>
              <h2 style={S.sectionTitle}>Top Itens</h2>
              <RankingTable items={resumo.table.top_itens} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---- Comparison Table ----

function ComparisonTable({ comparacoes: c, inicio, fim, total, fatBase, extras, produtos }: {
  comparacoes: DrillComparacoes; inicio: string; fim: string;
  total: number; fatBase: number; extras: number; produtos: number;
}) {
  const atualDT = c.atual_dias_trabalhados ?? 0;
  const cols = [
    { key: 'atual', label: 'Atual', sub: `${fmtDate(inicio)} – ${fmtDateFull(fim)}`, base: fatBase, ext: extras, prod: produtos, tot: total, dt: atualDT, fatDia: safeDivide(total, atualDT) },
    { key: 'mom', label: 'Per. Anterior', sub: periodLabel('mom', c), base: c.mom_base, ext: c.mom_extras, prod: c.mom_produtos, tot: c.mom_total, dt: c.mom_dias_trabalhados ?? 0, fatDia: safeDivide(c.mom_total, c.mom_dias_trabalhados ?? 0) },
    { key: 'sply', label: 'Ano Anterior', sub: periodLabel('sply', c), base: c.sply_base, ext: c.sply_extras, prod: c.sply_produtos, tot: c.sply_total, dt: c.sply_dias_trabalhados ?? 0, fatDia: safeDivide(c.sply_total, c.sply_dias_trabalhados ?? 0) },
    { key: 'avg6m', label: 'Méd. 6m', sub: periodLabel('avg6m', c), base: c.avg_6m_base, ext: c.avg_6m_extras, prod: c.avg_6m_produtos, tot: c.avg_6m, dt: c.avg_6m_dias_trabalhados ?? 0, fatDia: safeDivide(c.avg_6m, c.avg_6m_dias_trabalhados ?? 0) },
    { key: 'avg12m', label: 'Méd. 12m', sub: periodLabel('avg12m', c), base: c.avg_12m_base, ext: c.avg_12m_extras, prod: c.avg_12m_produtos, tot: c.avg_12m, dt: c.avg_12m_dias_trabalhados ?? 0, fatDia: safeDivide(c.avg_12m, c.avg_12m_dias_trabalhados ?? 0) },
  ];

  const atualCol = cols[0];

  const rows: { label: string; field: 'base' | 'ext' | 'prod' | 'tot' | 'dt' | 'fatDia'; isTotal?: boolean; isDias?: boolean; isCurrency?: boolean }[] = [
    { label: 'Fat. Base', field: 'base', isCurrency: true },
    { label: 'Extras', field: 'ext', isCurrency: true },
    { label: 'Produtos', field: 'prod', isCurrency: true },
    { label: 'Total', field: 'tot', isTotal: true, isCurrency: true },
    { label: 'Dias trab.', field: 'dt', isDias: true },
    { label: 'Fat/dia trab.', field: 'fatDia', isCurrency: true },
  ];

  return (
    <table style={S.table}>
      <thead>
        <tr>
          <th style={S.th}>Categoria</th>
          {cols.map(col => (
            <th key={col.key} style={{ ...S.thRight, ...(col.key === 'atual' ? { color: '#9a7422' } : {}) }} colSpan={col.key !== 'atual' ? 2 : 1}>
              <div>{col.label}</div>
              <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>{col.sub}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const tdStyle = row.isTotal ? S.tdTotal : S.td;
          const tdRStyle = row.isTotal ? S.tdTotalRight : S.tdRight;
          return (
            <tr key={row.label}>
              <td style={tdStyle}>{row.label}</td>
              {cols.map(col => {
                const val = col[row.field];
                const display = row.isDias
                  ? (typeof val === 'number' ? (Number.isInteger(val) ? String(val) : val.toFixed(1)) : String(val))
                  : row.isCurrency ? fmtCompact(val as number) : String(val);

                if (col.key === 'atual') {
                  return <td key={col.key} style={{ ...tdRStyle, ...(row.isTotal ? { color: '#9a7422' } : {}) }}>{display}</td>;
                }
                const atualVal = atualCol[row.field] as number;
                return (
                  <React.Fragment key={col.key}>
                    <td style={tdRStyle}>{display}</td>
                    <td style={{ ...tdRStyle, paddingLeft: 2, paddingRight: 6 }}>
                      <VarLabel valor={calcVar(atualVal, val as number)} />
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---- Series Table ----

function SeriesTable({ series }: { series: Array<{ bucket: string; valor: number; qtd?: number; ticket?: number }> }) {
  return (
    <table style={S.table}>
      <thead>
        <tr>
          <th style={S.th}>Período</th>
          <th style={S.thRight}>Faturamento</th>
          <th style={S.thRight}>Qtd</th>
          <th style={S.thRight}>Ticket Médio</th>
        </tr>
      </thead>
      <tbody>
        {series.map((p, i) => (
          <tr key={i}>
            <td style={S.td}>{p.bucket}</td>
            <td style={S.tdRight}>{fmt(p.valor)}</td>
            <td style={S.tdRight}>{p.qtd ?? '—'}</td>
            <td style={S.tdRight}>{p.ticket ? fmt(p.ticket) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---- Data Table (generic for viewData.table) ----

function DataTable({ table }: { table: any }) {
  const rows = Array.isArray(table) ? table : [];
  if (rows.length === 0) return null;

  const columns = Object.keys(rows[0]);
  const LABEL_MAP: Record<string, string> = {
    rank: '#', bucket: 'Nome', colaborador_nome: 'Colaborador', item: 'Item',
    grupo_de_produto: 'Grupo', produto: 'Produto', forma_pagamento: 'Pagamento',
    dia_semana: 'Dia', faixa_horaria: 'Horário', valor: 'Valor',
    share: 'Part.(%)', total: 'Total', atendimentos: 'Atend.',
    ticket_medio: 'Ticket', qtd: 'Qtd', qtd_registros: 'Qtd Reg.',
  };

  const isNumeric = (k: string) => k.includes('valor') || k === 'total' || k.includes('ticket') || k.includes('share') || k.includes('pct') || k.includes('medio') || k === 'qtd' || k === 'qtd_registros' || k === 'atendimentos';

  function fmtCell(key: string, val: any): string {
    if (val == null) return '—';
    if (typeof val === 'number') {
      if (key.includes('share') || key.includes('pct')) return `${(val * 100).toFixed(1)}%`;
      if (key.includes('valor') || key === 'total' || key.includes('ticket') || key.includes('medio') || key.includes('faturamento')) return fmt(val);
      return new Intl.NumberFormat('pt-BR').format(val);
    }
    if (Array.isArray(val)) return val.join(', ');
    return sanitize(val);
  }

  return (
    <table style={S.table}>
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col} style={isNumeric(col) ? S.thRight : S.th}>
              {LABEL_MAP[col] || col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, ' ')}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row: any, i: number) => (
          <tr key={i}>
            {columns.map(col => (
              <td key={col} style={isNumeric(col) ? S.tdRight : S.td}>
                {fmtCell(col, row[col])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---- Ranking Table (for resumo rankings) ----

function RankingTable({ items }: { items: Array<{ bucket: string; valor: number; share?: number; qtd_registros?: number }> }) {
  return (
    <table style={S.table}>
      <thead>
        <tr>
          <th style={{ ...S.th, width: 30 }}>#</th>
          <th style={S.th}>Nome</th>
          <th style={S.thRight}>Valor</th>
          <th style={S.thRight}>Part.</th>
          <th style={S.thRight}>Qtd</th>
        </tr>
      </thead>
      <tbody>
        {items.slice(0, 10).map((item, i) => (
          <tr key={i}>
            <td style={S.td}><span style={S.rankBadge}>{i + 1}</span></td>
            <td style={S.td}>{sanitize(item.bucket)}</td>
            <td style={S.tdRight}>{fmt(item.valor)}</td>
            <td style={S.tdRight}>{item.share != null ? fmtPct(item.share) : '—'}</td>
            <td style={S.tdRight}>{item.qtd_registros ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

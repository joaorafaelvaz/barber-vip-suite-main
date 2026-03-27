// ============================================================
// FILE: src/components/clientes/ClientesRelatorioView.tsx
// Print view com tema claro para exportação PDF (html2canvas)
// ============================================================

import React from 'react';
import type { PainelCompleto } from '@/hooks/useClientes';
import type { NovosResumo } from '@/hooks/useClientesNovos';
import { fmtInt, fmtMoney, fmtMesAnoFull } from '@/hooks/useClientes';
import {
  gerarAnaliseSaudeBase,
  gerarAnaliseRetencaoNovos,
  gerarAnaliseBarbeiros,
  gerarEvolucaoTendencia,
  gerarDirecionamento,
  gerarAnaliseRecencia,
  gerarAnaliseFrequencia,
  gerarAnaliseCohort,
  gerarAnaliseBarbeiro,
  type BarbeiroDetalheData,
} from './ClientesRelatorioGenerator';

// ---- Inline Styles ----

const S = {
  root: { width: 1200, padding: 32, background: '#ffffff', color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontSize: 12, lineHeight: 1.6 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: '#111', margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 11, color: '#888', margin: '2px 0 0' } as React.CSSProperties,
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#222', margin: '24px 0 10px', borderBottom: '2px solid #e0e0e0', paddingBottom: 4 } as React.CSSProperties,
  subSectionTitle: { fontSize: 12, fontWeight: 600, color: '#333', margin: '16px 0 8px' } as React.CSSProperties,
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 16 } as React.CSSProperties,
  kpiCard: { background: '#f7f7f7', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 14px' } as React.CSSProperties,
  kpiCardHighlight: { background: '#fef9f0', border: '1px solid #d4a94e', borderRadius: 6, padding: '10px 14px' } as React.CSSProperties,
  kpiLabel: { fontSize: 9, color: '#888', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 2 } as React.CSSProperties,
  kpiValue: { fontSize: 16, fontWeight: 700, color: '#111' } as React.CSSProperties,
  kpiValueHighlight: { fontSize: 16, fontWeight: 700, color: '#9a7422' } as React.CSSProperties,
  paragraph: { fontSize: 11, color: '#333', margin: '6px 0', lineHeight: 1.7 } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 11, marginBottom: 12 } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '6px 10px', background: '#f0f0f0', borderBottom: '1px solid #ddd', fontWeight: 600, color: '#444', fontSize: 10 } as React.CSSProperties,
  thRight: { textAlign: 'right' as const, padding: '6px 10px', background: '#f0f0f0', borderBottom: '1px solid #ddd', fontWeight: 600, color: '#444', fontSize: 10 } as React.CSSProperties,
  td: { padding: '5px 10px', borderBottom: '1px solid #eee', color: '#333' } as React.CSSProperties,
  tdRight: { padding: '5px 10px', borderBottom: '1px solid #eee', color: '#333', textAlign: 'right' as const } as React.CSSProperties,
  actionItem: { padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid #3b82f6', background: '#f0f7ff', marginBottom: 6, fontSize: 11, color: '#333', lineHeight: 1.6 } as React.CSSProperties,
  statusBadge: (color: string) => ({ display: 'inline-block', padding: '1px 8px', borderRadius: 4, background: color, color: '#fff', fontSize: 9, fontWeight: 600, marginRight: 4 }) as React.CSSProperties,
  statusBar: { display: 'flex', width: '100%', height: 24, borderRadius: 6, overflow: 'hidden', marginBottom: 8 } as React.CSSProperties,
};

const STATUS_COLORS: Record<string, string> = {
  ATIVO_VIP: '#22c55e', ATIVO_FORTE: '#3b82f6', ATIVO_LEVE: '#eab308',
  EM_RISCO: '#f97316', PERDIDO: '#ef4444',
};
const STATUS_LABELS: Record<string, string> = {
  ATIVO_VIP: 'VIP', ATIVO_FORTE: 'Forte', ATIVO_LEVE: 'Leve',
  EM_RISCO: 'Em Risco', PERDIDO: 'Perdido',
};

// ---- Component ----

interface Props {
  painel: PainelCompleto;
  novos: NovosResumo | null;
  periodoLabel: string;
  filtroBarbeiroId?: string | null;
  filtroBarbeiroNome?: string;
  barbeiroDetalhe?: BarbeiroDetalheData | null;
  carteira?: { unicos_total: number; unicos_exclusivos: number; unicos_compartilhados: number; pct_compartilhados: number | null } | null;
}

export const ClientesRelatorioView = React.forwardRef<HTMLDivElement, Props>(
  ({ painel, novos, periodoLabel, filtroBarbeiroId, filtroBarbeiroNome, barbeiroDetalhe, carteira }, ref) => {
    const { kpis, status_distribuicao, evolucao_mensal, por_barbeiro, faixas_dias, faixas_frequencia } = painel;
    const now = new Date();
    const geradoEm = `Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    const isBarbeiroMode = !!filtroBarbeiroId && !!barbeiroDetalhe;

    // ---- MODO BARBEIRO ----
    if (isBarbeiroMode && barbeiroDetalhe) {
      const det = barbeiroDetalhe;
      const novosBarb = novos?.por_barbeiro_aquisicao?.find(b => b.colaborador_id === filtroBarbeiroId) ?? null;
      const analise = gerarAnaliseBarbeiro({
        nome: filtroBarbeiroNome || 'Barbeiro',
        detalhe: det,
        carteira,
        novosBarb,
      });

      return (
        <div ref={ref} style={S.root}>
          <h1 style={S.title}>Relatório Analítico — {filtroBarbeiroNome}</h1>
          <p style={S.subtitle}>{periodoLabel} • {geradoEm}</p>

          {/* KPIs do barbeiro */}
          <h2 style={S.sectionTitle}>Resumo do Barbeiro</h2>
          <div style={S.kpiGrid}>
            <div style={S.kpiCardHighlight}>
              <div style={S.kpiLabel}>Clientes Únicos</div>
              <div style={S.kpiValueHighlight}>{fmtInt(det.total_clientes)}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Exclusivos</div>
              <div style={S.kpiValue}>{fmtInt(carteira?.unicos_exclusivos ?? 0)}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Compartilhados</div>
              <div style={S.kpiValue}>{fmtInt(carteira?.unicos_compartilhados ?? 0)}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Ticket Médio</div>
              <div style={S.kpiValue}>{fmtMoney(det.valor_medio_cliente)}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Novos Captados</div>
              <div style={S.kpiValue}>{fmtInt(det.novos_no_periodo)}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Retenção 30d</div>
              <div style={S.kpiValue}>{det.retencao_30d.toFixed(1)}%</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Fiéis (3+ excl.)</div>
              <div style={S.kpiValue}>{fmtInt(det.fieis)}</div>
            </div>
          </div>

          {/* Status do barbeiro */}
          {det.status_distribuicao?.length > 0 && (
            <>
              <h2 style={S.sectionTitle}>Composição por Status</h2>
              <div style={S.statusBar}>
                {det.status_distribuicao.map((s: any) => {
                  const pct = det.total_clientes > 0 ? (s.count / det.total_clientes) * 100 : 0;
                  if (pct === 0) return null;
                  return (
                    <div key={s.status} style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[s.status] || '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: pct > 0 ? 2 : 0 }}>
                      {pct >= 8 && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>{pct.toFixed(0)}%</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginBottom: 12 }}>
                {det.status_distribuicao.map((s: any) => (
                  <div key={s.status} style={{ ...S.kpiCard, minWidth: 100, textAlign: 'center' as const }}>
                    <div style={S.statusBadge(STATUS_COLORS[s.status] || '#888')}>{STATUS_LABELS[s.status] || s.status}</div>
                    <div style={{ ...S.kpiValue, marginTop: 4 }}>{fmtInt(s.count)}</div>
                    <div style={{ fontSize: 9, color: '#999' }}>{det.total_clientes > 0 ? ((s.count / det.total_clientes) * 100).toFixed(1) : 0}%</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Frequência do barbeiro */}
          {det.frequencia_dist?.length > 0 && (
            <>
              <h2 style={S.sectionTitle}>Frequência de Visitas</h2>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Faixa</th>
                    <th style={S.thRight}>Clientes</th>
                    <th style={S.thRight}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {det.frequencia_dist.map((f: any) => (
                    <tr key={f.faixa}>
                      <td style={S.td}>{f.faixa}</td>
                      <td style={S.tdRight}>{fmtInt(f.count)}</td>
                      <td style={S.tdRight}>{det.total_clientes > 0 ? ((f.count / det.total_clientes) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Evolução mensal */}
          {det.evolucao_mensal?.length > 0 && (
            <>
              <h2 style={S.sectionTitle}>Evolução Mensal</h2>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Mês</th>
                    <th style={S.thRight}>Clientes</th>
                    <th style={S.thRight}>Novos</th>
                    <th style={S.thRight}>Atendimentos</th>
                    <th style={S.thRight}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {det.evolucao_mensal.map((e: any, i: number) => (
                    <tr key={i}>
                      <td style={S.td}>{fmtMesAnoFull(e.ano_mes)}</td>
                      <td style={S.tdRight}>{fmtInt(e.clientes_unicos)}</td>
                      <td style={S.tdRight}>{fmtInt(e.novos)}</td>
                      <td style={S.tdRight}>{fmtInt(e.atendimentos)}</td>
                      <td style={S.tdRight}>{fmtMoney(e.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Top 10 clientes */}
          {det.top_clientes_valor?.length > 0 && (
            <>
              <h2 style={S.sectionTitle}>Top 10 Clientes por Valor</h2>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>#</th>
                    <th style={S.th}>Cliente</th>
                    <th style={S.th}>Status</th>
                    <th style={S.thRight}>Visitas</th>
                    <th style={S.thRight}>Valor</th>
                    <th style={S.thRight}>Dias s/ vir</th>
                  </tr>
                </thead>
                <tbody>
                  {det.top_clientes_valor.map((c: any, i: number) => (
                    <tr key={c.cliente_id}>
                      <td style={S.td}>{i + 1}</td>
                      <td style={S.td}>{c.cliente_nome}</td>
                      <td style={S.td}><span style={S.statusBadge(STATUS_COLORS[c.status] || '#888')}>{STATUS_LABELS[c.status] || c.status}</span></td>
                      <td style={S.tdRight}>{fmtInt(c.visitas)}</td>
                      <td style={S.tdRight}>{fmtMoney(c.valor)}</td>
                      <td style={S.tdRight}>{c.dias_sem_vir}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Análise completa */}
          <h2 style={S.sectionTitle}>Análise Completa</h2>
          {analise.map((p, i) => <p key={i} style={S.paragraph}>{p}</p>)}
        </div>
      );
    }

    // ---- MODO GERAL ----
    const analiseSaude = gerarAnaliseSaudeBase(painel);
    const analiseRetencao = gerarAnaliseRetencaoNovos(novos);
    const analiseBarbeiros = gerarAnaliseBarbeiros(painel, novos);
    const analiseEvolucao = gerarEvolucaoTendencia(evolucao_mensal);
    const direcionamento = gerarDirecionamento(painel, novos);
    const analiseRecencia = gerarAnaliseRecencia(faixas_dias);
    const analiseFrequencia = gerarAnaliseFrequencia(faixas_frequencia);
    const analiseCohort = novos?.cohort_mensal ? gerarAnaliseCohort(novos.cohort_mensal) : [];

    return (
      <div ref={ref} style={S.root}>
        {/* Header */}
        <h1 style={S.title}>Relatório Analítico — Painel de Clientes</h1>
        <p style={S.subtitle}>{periodoLabel} • {geradoEm}</p>

        {/* Resumo Executivo */}
        <h2 style={S.sectionTitle}>Resumo Executivo</h2>
        <div style={S.kpiGrid}>
          <div style={S.kpiCardHighlight}>
            <div style={S.kpiLabel}>Total de Clientes</div>
            <div style={S.kpiValueHighlight}>{fmtInt(kpis.total_clientes)}</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Clientes Novos</div>
            <div style={S.kpiValue}>{fmtInt(kpis.clientes_novos)}</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Novos que Retornaram</div>
            <div style={S.kpiValue}>{fmtInt(kpis.clientes_novos_retornaram)}</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Total Atendimentos</div>
            <div style={S.kpiValue}>{fmtInt(kpis.total_atendimentos)}</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Ticket Médio</div>
            <div style={S.kpiValue}>{fmtMoney(kpis.ticket_medio)}</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Valor Total</div>
            <div style={S.kpiValue}>{fmtMoney(kpis.valor_total)}</div>
          </div>
          {novos && (
            <>
              <div style={S.kpiCard}>
                <div style={S.kpiLabel}>Retenção 30d</div>
                <div style={S.kpiValue}>{novos.kpis.retencao_30d.toFixed(1)}%</div>
              </div>
              <div style={S.kpiCard}>
                <div style={S.kpiLabel}>Retenção 60d</div>
                <div style={S.kpiValue}>{novos.kpis.retencao_60d.toFixed(1)}%</div>
              </div>
            </>
          )}
        </div>

        {/* Status Distribution with visual bar */}
        <h2 style={S.sectionTitle}>Distribuição por Status</h2>
        <div style={S.statusBar}>
          {status_distribuicao.map(s => {
            const pct = kpis.total_clientes > 0 ? (s.count / kpis.total_clientes) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div key={s.status} style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[s.status] || '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: pct > 0 ? 2 : 0 }}>
                {pct >= 8 && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>{STATUS_LABELS[s.status]} {pct.toFixed(0)}%</span>}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' as const }}>
          {status_distribuicao.map(s => (
            <div key={s.status} style={{ ...S.kpiCard, minWidth: 120, textAlign: 'center' as const }}>
              <div style={S.statusBadge(STATUS_COLORS[s.status] || '#888')}>{STATUS_LABELS[s.status] || s.status}</div>
              <div style={{ ...S.kpiValue, marginTop: 4 }}>{fmtInt(s.count)}</div>
              <div style={{ fontSize: 9, color: '#999' }}>{kpis.total_clientes > 0 ? ((s.count / kpis.total_clientes) * 100).toFixed(1) : 0}%</div>
            </div>
          ))}
        </div>

        {/* Análise de Saúde */}
        <h2 style={S.sectionTitle}>Análise de Saúde da Base</h2>
        {analiseSaude.map((p, i) => <p key={i} style={S.paragraph}>{p}</p>)}

        {/* Faixas de Recência */}
        <h2 style={S.sectionTitle}>Faixas de Recência</h2>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Faixa</th>
              <th style={S.thRight}>Clientes</th>
              <th style={S.thRight}>%</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Até 20 dias', value: faixas_dias.ate_20d },
              { label: '21-30 dias', value: faixas_dias['21_30d'] },
              { label: '31-45 dias', value: faixas_dias['31_45d'] },
              { label: '46-75 dias', value: faixas_dias['46_75d'] },
              { label: '75+ dias', value: faixas_dias.mais_75d },
            ].map(f => {
              const totalFx = faixas_dias.ate_20d + faixas_dias['21_30d'] + faixas_dias['31_45d'] + faixas_dias['46_75d'] + faixas_dias.mais_75d;
              return (
                <tr key={f.label}>
                  <td style={S.td}>{f.label}</td>
                  <td style={S.tdRight}>{fmtInt(f.value)}</td>
                  <td style={S.tdRight}>{totalFx > 0 ? ((f.value / totalFx) * 100).toFixed(1) : 0}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {analiseRecencia.map((p, i) => <p key={i} style={S.paragraph}>{p}</p>)}

        {/* Faixas de Frequência */}
        <h2 style={S.sectionTitle}>Faixas de Frequência</h2>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Faixa</th>
              <th style={S.thRight}>Clientes</th>
              <th style={S.thRight}>%</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: '1 vez', value: faixas_frequencia.uma_vez },
              { label: '2 vezes', value: faixas_frequencia.duas_vezes },
              { label: '3-4 vezes', value: faixas_frequencia.tres_quatro },
              { label: '5-9 vezes', value: faixas_frequencia.cinco_nove },
              { label: '10-12 vezes', value: faixas_frequencia.dez_doze },
              { label: '13-15 vezes', value: faixas_frequencia.treze_quinze },
              { label: '16-20 vezes', value: faixas_frequencia.dezesseis_vinte },
              { label: '21-30 vezes', value: faixas_frequencia.vinte_um_trinta },
              { label: '30+ vezes', value: faixas_frequencia.trinta_mais },
            ].map(f => {
              const totalFq = faixas_frequencia.uma_vez + faixas_frequencia.duas_vezes + faixas_frequencia.tres_quatro + faixas_frequencia.cinco_nove + (faixas_frequencia.dez_doze ?? 0) + (faixas_frequencia.treze_quinze ?? 0) + (faixas_frequencia.dezesseis_vinte ?? 0) + (faixas_frequencia.vinte_um_trinta ?? 0) + (faixas_frequencia.trinta_mais ?? 0);
              return (
                <tr key={f.label}>
                  <td style={S.td}>{f.label}</td>
                  <td style={S.tdRight}>{fmtInt(f.value)}</td>
                  <td style={S.tdRight}>{totalFq > 0 ? ((f.value / totalFq) * 100).toFixed(1) : 0}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {analiseFrequencia.map((p, i) => <p key={i} style={S.paragraph}>{p}</p>)}

        {/* Análise de Retenção */}
        <h2 style={S.sectionTitle}>Análise de Retenção de Novos Clientes</h2>
        {analiseRetencao.map((p, i) => <p key={i} style={S.paragraph}>{p}</p>)}

        {/* Cohort de Retenção */}
        {novos?.cohort_mensal?.length > 0 && (
          <>
            <h2 style={S.sectionTitle}>Cohort de Retenção Mensal</h2>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Mês</th>
                  <th style={S.thRight}>Novos</th>
                  <th style={S.thRight}>Ret. 30d</th>
                  <th style={S.thRight}>Ret. 60d</th>
                  <th style={S.thRight}>Ret. 90d</th>
                </tr>
              </thead>
              <tbody>
                {novos.cohort_mensal.map((c, i) => (
                  <tr key={i}>
                    <td style={S.td}>{c.mes}</td>
                    <td style={S.tdRight}>{fmtInt(c.novos)}</td>
                    <td style={S.tdRight}>{c.pct_ret_30d.toFixed(1)}%</td>
                    <td style={S.tdRight}>{c.pct_ret_60d.toFixed(1)}%</td>
                    <td style={S.tdRight}>{c.pct_ret_90d.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analiseCohort.map((p, i) => <p key={i} style={S.paragraph}>{p}</p>)}
          </>
        )}

        {/* Top 10 Clientes por Valor */}
        <h2 style={S.sectionTitle}>Top 10 Clientes por Valor</h2>
        {(() => {
          // We don't have top_clientes in the painel general mode, so we skip if not available
          // This section uses data from barbearia_detalhe when available
          return <p style={S.paragraph}>Disponível no relatório por barbeiro. Selecione um barbeiro para ver o Top 10 individual.</p>;
        })()}

        {/* Ranking de Barbeiros */}
        <h2 style={S.sectionTitle}>Ranking de Barbeiros</h2>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>#</th>
              <th style={S.th}>Barbeiro</th>
              <th style={S.thRight}>Clientes</th>
              <th style={S.thRight}>Novos</th>
              <th style={S.thRight}>Exclusivos</th>
              <th style={S.thRight}>Valor Total</th>
              {novos && <th style={S.thRight}>Ret. 30d</th>}
            </tr>
          </thead>
          <tbody>
            {[...por_barbeiro].sort((a, b) => b.valor_total - a.valor_total).map((b, i) => {
              const novoBarbeiro = novos?.por_barbeiro_aquisicao?.find(n => n.colaborador_id === b.colaborador_id);
              return (
                <tr key={b.colaborador_id}>
                  <td style={S.td}>{i + 1}</td>
                  <td style={S.td}>{b.colaborador_nome}</td>
                  <td style={S.tdRight}>{fmtInt(b.clientes_unicos)}</td>
                  <td style={S.tdRight}>{fmtInt(b.clientes_novos)}</td>
                  <td style={S.tdRight}>{fmtInt(b.clientes_exclusivos)}</td>
                  <td style={S.tdRight}>{fmtMoney(b.valor_total)}</td>
                  {novos && <td style={S.tdRight}>{novoBarbeiro ? `${novoBarbeiro.retencao_30d.toFixed(1)}%` : '—'}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {analiseBarbeiros.map((p, i) => <p key={i} style={S.paragraph}>{p}</p>)}

        {/* Análise Individual por Barbeiro */}
        <h2 style={S.sectionTitle}>Análise Individual por Barbeiro</h2>
        {por_barbeiro.length > 0 ? (
          por_barbeiro.map(b => {
            const novosBarb = novos?.por_barbeiro_aquisicao?.find(n => n.colaborador_id === b.colaborador_id);
            // Create a minimal detalhe from available data
            const miniDetalhe: BarbeiroDetalheData = {
              status_distribuicao: [],
              perdidos_barbearia: 0,
              perdidos_para_outro: 0,
              fieis: 0,
              novos_no_periodo: b.clientes_novos,
              retencao_30d: novosBarb?.retencao_30d ?? 0,
              valor_medio_cliente: b.clientes_unicos > 0 ? b.valor_total / b.clientes_unicos : 0,
              total_clientes: b.clientes_unicos,
            };
            const pctExcl = b.clientes_unicos > 0 ? ((b.clientes_exclusivos / b.clientes_unicos) * 100).toFixed(0) : '0';
            return (
              <div key={b.colaborador_id} style={{ marginBottom: 16, padding: '10px 14px', background: '#fafafa', borderRadius: 6, border: '1px solid #e8e8e8' }}>
                <p style={{ ...S.subSectionTitle, margin: '0 0 6px' }}>{b.colaborador_nome}</p>
                <p style={S.paragraph}>
                  {fmtInt(b.clientes_unicos)} clientes únicos • {fmtInt(b.clientes_exclusivos)} exclusivos ({pctExcl}%) • {fmtInt(b.clientes_novos)} novos captados • Ticket: {fmtMoney(miniDetalhe.valor_medio_cliente)} • Valor total: {fmtMoney(b.valor_total)}
                  {novosBarb ? ` • Retenção 30d: ${novosBarb.retencao_30d.toFixed(1)}%` : ''}
                  {novosBarb?.pct_fieis ? ` • ${novosBarb.pct_fieis.toFixed(0)}% fiéis` : ''}
                </p>
                {novosBarb && novosBarb.retencao_30d < 25 && novosBarb.novos >= 5 && (
                  <p style={{ ...S.paragraph, color: '#c2410c' }}>⚠️ Retenção abaixo do benchmark — investigar qualidade do primeiro atendimento.</p>
                )}
              </div>
            );
          })
        ) : (
          <p style={S.paragraph}>Sem dados individuais de barbeiros no período.</p>
        )}

        {/* Evolução Mensal */}
        <h2 style={S.sectionTitle}>Evolução Mensal</h2>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Mês</th>
              <th style={S.thRight}>Clientes Únicos</th>
              <th style={S.thRight}>Novos</th>
              <th style={S.thRight}>Atendimentos</th>
              <th style={S.thRight}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {evolucao_mensal.map((e, i) => (
              <tr key={i}>
                <td style={S.td}>{fmtMesAnoFull(e.ano_mes)}</td>
                <td style={S.tdRight}>{fmtInt(e.clientes_unicos)}</td>
                <td style={S.tdRight}>{fmtInt(e.clientes_novos)}</td>
                <td style={S.tdRight}>{fmtInt(e.atendimentos)}</td>
                <td style={S.tdRight}>{fmtMoney(e.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {analiseEvolucao.map((p, i) => <p key={i} style={S.paragraph}>{p}</p>)}

        {/* Direcionamento */}
        <h2 style={S.sectionTitle}>Direcionamento de Ações</h2>
        {direcionamento.map((a, i) => <div key={i} style={S.actionItem}>{a}</div>)}
      </div>
    );
  }
);

ClientesRelatorioView.displayName = 'ClientesRelatorioView';

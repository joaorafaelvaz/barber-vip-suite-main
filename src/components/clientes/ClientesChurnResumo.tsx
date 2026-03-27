import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { InfoPopover } from './InfoPopover';

function fmtPct(v: number | null | undefined) {
  if (v == null) return '—';
  return `${(v * 100).toFixed(1)}%`;
}
function fmtInt(v: number | null | undefined) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR').format(v);
}
function fmtMoney(v: number | null | undefined) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function churnColor(v: number | null | undefined): string {
  if (v == null) return 'bg-muted';
  const pct = v * 100;
  if (pct < 5) return 'bg-emerald-500';
  if (pct < 10) return 'bg-yellow-500';
  if (pct < 15) return 'bg-orange-500';
  return 'bg-red-500';
}

function churnLabel(v: number | null | undefined): { text: string; color: string } {
  if (v == null) return { text: 'Sem dados', color: 'text-muted-foreground' };
  const pct = v * 100;
  if (pct < 5) return { text: '🟢 Saudável', color: 'text-emerald-400' };
  if (pct < 10) return { text: '🟡 Atenção', color: 'text-yellow-400' };
  if (pct < 15) return { text: '🟠 Alerta', color: 'text-orange-400' };
  return { text: '🔴 Crítico', color: 'text-red-400' };
}

interface Props {
  loading: boolean;
  janelaDias: number;
  resumo: {
    base_ativa: number;
    perdidos: number;
    churn_pct: number;
    resgatados: number;
    tempo_medio_resgate: number | null;
    valor_perdido_estimado: number | null;
  } | null;
  onDrill?: (tipo: string, valor: string, title: string) => void;
  janelaDiasValue?: number;
}

function MiniKpi({ label, value, accent, info, onClick }: { label: string; value: string; accent?: string; info: React.ReactNode; onClick?: () => void }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${accent || 'bg-card'} ${onClick ? 'cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all' : ''}`} onClick={onClick}>
      <div className="flex items-center justify-center gap-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        {info}
      </div>
      <p className={`text-lg font-bold text-foreground mt-1 ${onClick ? 'underline decoration-dotted underline-offset-2' : ''}`}>{value}</p>
    </div>
  );
}

export function ClientesChurnResumo({ loading, janelaDias, resumo, onDrill }: Props) {
  const status = churnLabel(resumo?.churn_pct);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Churn & Saúde da Base</CardTitle>
              <InfoPopover
                title="Churn & Saúde da Base"
                description="O churn mede a proporção de clientes que deixaram de frequentar a barbearia (saíram da base ativa). É calculado como: perdidos / (ativos + perdidos). Quanto menor, mais saudável."
                example="Se você tem 200 ativos e 20 perdidos, churn = 20/220 = 9.1%. Para barbearias, abaixo de 10% é saudável."
              />
            </div>
            <Badge variant="secondary" className="text-xs">Janela {janelaDias}d</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : !resumo ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem dados de churn para o período.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MiniKpi
                  label="Base ativa"
                  value={fmtInt(resumo.base_ativa)}
                  accent="bg-blue-500/10 border-blue-500/20"
                  onClick={onDrill ? () => onDrill('CHURN_ATIVO', String(janelaDias), `Clientes Ativos (janela ${janelaDias}d)`) : undefined}
                  info={
                    <InfoPopover
                      title="Base Ativa"
                      description={`Clientes com pelo menos uma visita nos últimos ${janelaDias} dias. Quanto maior, mais saudável o negócio.`}
                      example={`Se a janela é ${janelaDias}d e ${resumo.base_ativa} clientes vieram nesse período, essa é sua base ativa.`}
                    />
                  }
                />
                <MiniKpi
                  label="Perdidos"
                  value={fmtInt(resumo.perdidos)}
                  accent="bg-red-500/10 border-red-500/20"
                  onClick={onDrill ? () => onDrill('CHURN_PERDIDO', String(janelaDias), `Clientes Perdidos (janela ${janelaDias}d)`) : undefined}
                  info={
                    <InfoPopover
                      title="Clientes Perdidos"
                      description={`Clientes cuja última visita foi entre ${janelaDias} e ${janelaDias * 2} dias atrás. Eles ultrapassaram a janela de retorno esperada.`}
                      example="Um cliente que costumava vir a cada 30 dias e agora está há 65 dias sem aparecer é considerado perdido numa janela de 60d."
                    />
                  }
                />
                <div className="rounded-lg border p-3 text-center bg-card">
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Churn %</p>
                    <InfoPopover
                      title="Taxa de Churn"
                      description="Proporção de clientes que saíram da base ativa. Fórmula: perdidos / (ativos + perdidos). Indica a velocidade de perda de clientes."
                      example="200 ativos + 25 perdidos = churn de 11.1%. Meta: manter abaixo de 10%."
                    />
                  </div>
                  <p className="text-lg font-bold text-foreground mt-1">{fmtPct(resumo.churn_pct)}</p>
                  {/* Termômetro */}
                  <div className="w-full h-2 bg-muted/40 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full transition-all ${churnColor(resumo.churn_pct)}`}
                      style={{ width: `${Math.min((resumo.churn_pct ?? 0) * 100 * 3, 100)}%` }}
                    />
                  </div>
                  <p className={`text-[10px] mt-1 font-medium ${status.color}`}>{status.text}</p>
                </div>
                <MiniKpi
                  label="Resgatados"
                  value={fmtInt(resumo.resgatados)}
                  accent="bg-emerald-500/10 border-emerald-500/20"
                  onClick={onDrill ? () => onDrill('CHURN_RESGATADO', String(janelaDias), `Clientes Resgatados (janela ${janelaDias}d)`) : undefined}
                  info={
                    <InfoPopover
                      title="Clientes Resgatados"
                      description="Clientes que estavam perdidos (fora da janela) mas voltaram no período atual. Mostra a efetividade de ações de recuperação."
                      example="Se 5 clientes que estavam sumidos há 90+ dias voltaram este mês, são 5 resgatados."
                    />
                  }
                />
                <MiniKpi
                  label="Tempo médio resgate"
                  value={resumo.tempo_medio_resgate != null ? `${resumo.tempo_medio_resgate}d` : '—'}
                  accent="bg-yellow-500/10 border-yellow-500/20"
                  info={
                    <InfoPopover
                      title="Tempo Médio de Resgate"
                      description="Média de dias que os clientes resgatados ficaram ausentes antes de retornar. Quanto menor, mais rápida a recuperação."
                      example="Se os resgatados ficaram em média 75 dias sem vir antes de voltar, o tempo médio de resgate é 75d."
                    />
                  }
                />
                <MiniKpi
                  label="Valor perdido est."
                  value={fmtMoney(resumo.valor_perdido_estimado)}
                  accent="bg-red-500/10 border-red-500/20"
                  info={
                    <InfoPopover
                      title="Valor Perdido Estimado"
                      description="Estimativa do faturamento mensal perdido com os clientes que saíram. Calculado: ticket médio dos perdidos × quantidade de perdidos."
                      example="Se 20 clientes perdidos tinham ticket médio de R$ 80, o valor perdido estimado é R$ 1.600/mês."
                    />
                  }
                />
              </div>

              {/* Análise automática */}
              <div className="mt-4 rounded-lg border bg-muted/20 p-4 text-xs space-y-2">
                <p className="font-semibold text-foreground text-sm">🔍 Análise Automática</p>
                <p className="text-muted-foreground">
                  {resumo.churn_pct != null && resumo.churn_pct * 100 < 5 && (
                    <>Churn de <strong className="text-emerald-400">{fmtPct(resumo.churn_pct)}</strong> — excelente! Sua base está muito saudável. Continue monitorando para manter esse nível.</>
                  )}
                  {resumo.churn_pct != null && resumo.churn_pct * 100 >= 5 && resumo.churn_pct * 100 < 10 && (
                    <>Churn de <strong className="text-yellow-400">{fmtPct(resumo.churn_pct)}</strong> — aceitável para barbearias. Foco: tentar resgatar os <strong>{resumo.perdidos}</strong> perdidos com contato direto (WhatsApp, promoção de retorno).</>
                  )}
                  {resumo.churn_pct != null && resumo.churn_pct * 100 >= 10 && resumo.churn_pct * 100 < 15 && (
                    <>Churn de <strong className="text-orange-400">{fmtPct(resumo.churn_pct)}</strong> — atenção! Você está perdendo clientes em ritmo preocupante. Investigue se há problemas de atendimento, preço ou concorrência. Os <strong>{resumo.perdidos}</strong> perdidos representam ~<strong>{fmtMoney(resumo.valor_perdido_estimado)}</strong> em faturamento perdido.</>
                  )}
                  {resumo.churn_pct != null && resumo.churn_pct * 100 >= 15 && (
                    <>Churn de <strong className="text-red-400">{fmtPct(resumo.churn_pct)}</strong> — crítico! Prioridade máxima: entender por que <strong>{resumo.perdidos}</strong> clientes saíram. Valor perdido estimado: <strong>{fmtMoney(resumo.valor_perdido_estimado)}</strong>. Ações urgentes: contato com perdidos recentes, revisão de qualidade e precificação.</>
                  )}
                </p>
                {resumo.resgatados > 0 && (
                  <p className="text-muted-foreground">
                    ✅ Ponto positivo: <strong className="text-emerald-400">{resumo.resgatados}</strong> clientes foram resgatados
                    {resumo.tempo_medio_resgate != null && <> (tempo médio de ausência: {resumo.tempo_medio_resgate} dias)</>}.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, Download, AlertTriangle, UserX, Clock } from 'lucide-react';
import { InfoPopover } from './InfoPopover';

interface ClienteRow {
  cliente_id?: string;
  cliente_nome?: string;
  colaborador_nome_ultimo?: string;
  dias_sem_vir?: number;
  valor_total?: number;
  ticket_medio?: number;
  telefone?: string;
}

interface ChurnBarbeiro {
  colaborador_id: string;
  colaborador_nome: string;
  base_ativa: number;
  perdidos: number;
  churn_pct: number;
}

interface Props {
  periodoLabel: string;
  janelaDias: number;
  perdasData?: { rows?: ClienteRow[] } | null;
  umaVezData?: { rows?: ClienteRow[] } | null;
  churnBarbeiros?: ChurnBarbeiro[] | null;
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function exportCsv(rows: ClienteRow[], filename: string) {
  const headers = ['Cliente', 'Barbeiro', 'Dias sem vir', 'Valor total', 'Telefone'];
  const lines = rows.map(r => [
    r.cliente_nome || '',
    r.colaborador_nome_ultimo || '',
    String(r.dias_sem_vir ?? ''),
    String(r.valor_total ?? ''),
    r.telefone || '',
  ].join(';'));
  const csv = [headers.join(';'), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function LaneHeader({ icon, title, count, color, info }: { icon: React.ReactNode; title: string; count: number; color: string; info: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {icon}
      <span className="text-sm font-semibold text-foreground">{title}</span>
      <Badge className={`text-[10px] ${color}`}>{count}</Badge>
      {info}
    </div>
  );
}

function ClienteMobileCard({ r, accentClass }: { r: ClienteRow; accentClass: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground truncate max-w-[60%]">{r.cliente_nome || '—'}</span>
        <span className={`text-xs font-semibold ${accentClass}`}>{r.dias_sem_vir}d</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{r.colaborador_nome_ultimo || '—'}</span>
        <span>{fmtMoney(r.valor_total)}</span>
      </div>
    </div>
  );
}

const ROW_OPTIONS = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: 'all', label: 'Todos' },
];

function ClienteLaneList({ rows, accentClass, csvFilename }: { rows: ClienteRow[]; accentClass: string; csvFilename: string }) {
  const [visibleLimit, setVisibleLimit] = useState('25');

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">Nenhum cliente nesta fila. 🎉</p>;
  }

  const limit = visibleLimit === 'all' ? rows.length : Number(visibleLimit);
  const visible = rows.slice(0, limit);
  const isShowingAll = visibleLimit === 'all' || limit >= rows.length;

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Exibir:</span>
          <Select value={visibleLimit} onValueChange={setVisibleLimit}>
            <SelectTrigger className="w-[80px] h-6 text-[10px] border-border/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROW_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={() => exportCsv(rows, csvFilename)}>
          <Download className="h-3 w-3" /> Exportar CSV ({rows.length})
        </Button>
      </div>

      {/* Mobile cards */}
      <div className={`md:hidden space-y-1.5 overflow-y-auto ${isShowingAll ? 'max-h-[500px]' : 'max-h-80'}`}>
        {visible.map((r, i) => (
          <ClienteMobileCard key={i} r={r} accentClass={accentClass} />
        ))}
      </div>

      {/* Desktop table */}
      <div className={`hidden md:block overflow-auto ${isShowingAll ? 'max-h-[500px]' : 'max-h-80'}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Barbeiro</TableHead>
              <TableHead className="text-xs text-right">Dias sem vir</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-medium">{r.cliente_nome || '—'}</TableCell>
                <TableCell className="text-xs">{r.colaborador_nome_ultimo || '—'}</TableCell>
                <TableCell className={`text-xs text-right font-medium ${accentClass}`}>{r.dias_sem_vir}d</TableCell>
                <TableCell className="text-xs text-right">{fmtMoney(r.valor_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!isShowingAll && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">Mostrando {visible.length} de {rows.length}</p>
      )}
    </>
  );
}

export function ClientesAcoesCRM({ periodoLabel, janelaDias, perdasData, umaVezData, churnBarbeiros }: Props) {
  const [openUmaVez, setOpenUmaVez] = useState(false);
  const [openRisco, setOpenRisco] = useState(false);
  const [openPerdidos, setOpenPerdidos] = useState(false);

  const umaVezRows = useMemo(() => {
    const rows = umaVezData?.rows ?? [];
    return rows.filter((r: any) => (r.dias_sem_vir ?? 0) > 30).sort((a: any, b: any) => (b.dias_sem_vir ?? 0) - (a.dias_sem_vir ?? 0));
  }, [umaVezData]);

  const barbeirosRisco = useMemo(() => {
    return (churnBarbeiros ?? []).filter(b => b.churn_pct * 100 > 10).sort((a, b) => b.churn_pct - a.churn_pct);
  }, [churnBarbeiros]);

  const perdidosRecentes = useMemo(() => {
    const rows = perdasData?.rows ?? [];
    return rows.filter((r: any) => {
      const d = r.dias_sem_vir ?? 0;
      return d >= janelaDias && d <= janelaDias * 2;
    }).sort((a: any, b: any) => (a.dias_sem_vir ?? 0) - (b.dias_sem_vir ?? 0));
  }, [perdasData, janelaDias]);

  const hasData = umaVezRows.length > 0 || barbeirosRisco.length > 0 || perdidosRecentes.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Ações (CRM) — Filas Operacionais</CardTitle>
              <InfoPopover
                title="Filas Operacionais CRM"
                description="Organiza os clientes que precisam de ação em 3 filas de prioridade. Use essas listas para contato direto via WhatsApp, ligação ou promoção de retorno."
                example="A Fila 'Perdidos Recentes' lista clientes que acabaram de sair da base ativa — são os mais fáceis de recuperar com uma mensagem rápida."
              />
            </div>
            <Badge variant="secondary" className="text-xs w-fit">{periodoLabel} • Janela {janelaDias}d</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fila 1: 1x sem retorno */}
          <Collapsible open={openUmaVez} onOpenChange={setOpenUmaVez}>
            <div className="rounded-lg border bg-muted/30 p-3 sm:p-4 space-y-3">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between">
                  <LaneHeader
                    icon={<Clock className="h-4 w-4 text-yellow-400" />}
                    title="1x sem retorno"
                    count={umaVezRows.length}
                    color="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                    info={
                      <InfoPopover
                        title="Fila: 1x sem retorno"
                        description="Clientes que vieram apenas uma vez e estão há mais de 30 dias sem retornar. Ação: contato personalizado perguntando o que achou do atendimento."
                        example="Cliente veio em 15/Jan, cortou com Barbeiro A, e nunca mais voltou (60 dias sem vir)."
                      />
                    }
                  />
                  {openUmaVez ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ClienteLaneList rows={umaVezRows} accentClass="text-yellow-400" csvFilename="clientes_1x_sem_retorno.csv" />
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Fila 2: Barbeiros em risco */}
          <Collapsible open={openRisco} onOpenChange={setOpenRisco}>
            <div className="rounded-lg border bg-muted/30 p-3 sm:p-4 space-y-3">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between">
                  <LaneHeader
                    icon={<AlertTriangle className="h-4 w-4 text-orange-400" />}
                    title="Barbeiros em risco"
                    count={barbeirosRisco.length}
                    color="bg-orange-500/20 text-orange-400 border-orange-500/30"
                    info={
                      <InfoPopover
                        title="Fila: Barbeiros em Risco"
                        description="Barbeiros com taxa de churn acima de 10%. Precisam de atenção da gestão."
                        example="Se Barbeiro A tem churn de 18%, quase 1 em cada 5 clientes dele está saindo."
                      />
                    }
                  />
                  {openRisco ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {barbeirosRisco.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum barbeiro com churn acima de 10%. 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {barbeirosRisco.map((b) => (
                      <div key={b.colaborador_id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border px-3 py-2 bg-card gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{b.colaborador_nome}</span>
                          <Badge variant={b.churn_pct * 100 > 15 ? 'destructive' : 'secondary'} className="text-[10px]">
                            Churn {(b.churn_pct * 100).toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{b.base_ativa} ativos</span>
                          <span className="text-red-400">{b.perdidos} perdidos</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Fila 3: Perdidos recentes */}
          <Collapsible open={openPerdidos} onOpenChange={setOpenPerdidos}>
            <div className="rounded-lg border bg-muted/30 p-3 sm:p-4 space-y-3">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between">
                  <LaneHeader
                    icon={<UserX className="h-4 w-4 text-red-400" />}
                    title="Perdidos recentes"
                    count={perdidosRecentes.length}
                    color="bg-red-500/20 text-red-400 border-red-500/30"
                    info={
                      <InfoPopover
                        title="Fila: Perdidos Recentes"
                        description={`Clientes classificados como perdidos recentemente (última visita entre ${janelaDias} e ${janelaDias * 2} dias atrás). São os mais fáceis de recuperar.`}
                        example={`Um cliente que costumava vir a cada 30 dias e agora está há ${janelaDias + 10} dias sem aparecer.`}
                      />
                    }
                  />
                  {openPerdidos ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ClienteLaneList rows={perdidosRecentes} accentClass="text-red-400" csvFilename="clientes_perdidos_recentes.csv" />
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Sugestões de ação */}
          <div className="rounded-lg border bg-muted/20 p-3 sm:p-4 text-xs space-y-2">
            <p className="font-semibold text-foreground text-sm">💡 Sugestões de Ação</p>
            {hasData ? (
              <>
                {umaVezRows.length > 0 && (
                  <p className="text-muted-foreground">
                    📱 <strong>{umaVezRows.length} clientes</strong> vieram 1 vez e sumiram. Envie uma mensagem perguntando como foi a experiência e oferecendo um incentivo para retorno.
                  </p>
                )}
                {barbeirosRisco.length > 0 && (
                  <p className="text-muted-foreground">
                    ⚠️ <strong>{barbeirosRisco.length} barbeiro(s)</strong> com churn elevado. Agende uma conversa individual para entender o contexto e criar um plano de melhoria.
                  </p>
                )}
                {perdidosRecentes.length > 0 && (
                  <p className="text-muted-foreground">
                    🔄 <strong>{perdidosRecentes.length} clientes perdidos recentes</strong> são os mais fáceis de resgatar. Contato via WhatsApp com mensagem personalizada tem alta taxa de retorno.
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Nenhuma ação pendente no momento. Continue monitorando as filas semanalmente.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

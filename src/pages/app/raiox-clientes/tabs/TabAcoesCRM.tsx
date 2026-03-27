import React, { useState, useMemo } from 'react';
import {
  useAcoesCRM,
  CRM_PRESETS,
  type CrmClient,
  type CrmEnvio,
  type CrmDimension,
} from '@/hooks/useAcoesCRM';
import type { RaioXComputedFilters } from '../raioxTypes';
import type { RaioxConfigInstance } from '../RaioXClientesTabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { HowToReadSection } from '@/components/help';
import {
  Loader2, RefreshCw, Search, MessageCircle, ExternalLink,
  CheckCircle2, ChevronDown, ChevronRight, Phone,
  Users, Send, History, Download, Filter, Trash2, Undo2, CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import { calcDiasSemVir } from '@/lib/diasSemVir';

interface Props {
  filters: RaioXComputedFilters;
  raioxConfig: RaioxConfigInstance;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtD(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}
function fmtN(n: number) { return n.toLocaleString('pt-BR'); }
function fmtVal(v: number) { return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

function diasColor(dias: number) {
  if (dias <= 30) return 'text-emerald-400';
  if (dias <= 60) return 'text-amber-400';
  if (dias <= 120) return 'text-orange-400';
  return 'text-rose-400';
}

function cleanPhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/\D/g, '');
}

function whatsappUrl(phone: string | null, message: string): string | null {
  const digits = cleanPhone(phone);
  if (!digits || digits.length < 10) return null;
  const num = digits.startsWith('55') ? digits : '55' + digits;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

/* ------------------------------------------------------------------ */
/*  MessageDialog                                                      */
/* ------------------------------------------------------------------ */

interface MessageDialogProps {
  open: boolean;
  onClose: () => void;
  client: CrmClient | null;
  suggestedMessage: string;
  onSend: (mensagemFinal: string, observacao: string) => Promise<void>;
}

function MessageDialog({ open, onClose, client, suggestedMessage, onSend }: MessageDialogProps) {
  const [message, setMessage] = useState(suggestedMessage);
  const [observacao, setObservacao] = useState('');
  const [sending, setSending] = useState(false);

  React.useEffect(() => {
    if (open) { setMessage(suggestedMessage); setObservacao(''); }
  }, [open, suggestedMessage]);

  if (!client) return null;
  const waUrl = whatsappUrl(client.telefone, message);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await onSend(message, observacao);
      toast.success(`Mensagem registrada para ${client.cliente_nome?.split(' ')[0] || 'cliente'}`);
      onClose();
    } catch (err: any) {
      toast.error('Erro ao registrar: ' + (err.message || 'erro desconhecido'));
    } finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="h-4 w-4 text-primary" />
            Mensagem para {client.cliente_nome || 'Cliente'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground border border-border/40 rounded-lg px-3 py-2 bg-muted/10">
            <span>📱 {client.telefone || 'Sem telefone'}</span>
            <span>✂️ {client.colaborador_nome || '-'}</span>
            <span className={diasColor(calcDiasSemVir(client.ultima_visita, client.dias_sem_vir))}>
              ⏱ {calcDiasSemVir(client.ultima_visita, client.dias_sem_vir)}d sem vir
              {client.cadencia_dias != null && <span className="text-muted-foreground"> / cad. {Math.round(client.cadencia_dias)}d</span>}
            </span>
            <span>📊 {client.visitas_total} visitas</span>
            {client.ratio != null && <span>Ratio: {client.ratio.toFixed(1)}x</span>}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Mensagem</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="text-sm" maxLength={1000} />
            <div className="text-[10px] text-muted-foreground mt-0.5 text-right">{message.length}/1000</div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Observação / Retorno do cliente (opcional)</label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: cliente pediu para ligar semana que vem" className="text-sm" maxLength={500} />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {waUrl ? (
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={waUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Abrir WhatsApp</a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled className="gap-1.5"><Phone className="h-3.5 w-3.5" />Sem telefone</Button>
          )}
          <Button size="sm" onClick={handleSend} disabled={sending || !message.trim()} className="gap-1.5">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Marcar como enviada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  BarberGroup                                                        */
/* ------------------------------------------------------------------ */

interface BarberGroupProps {
  nome: string;
  clients: CrmClient[];
  contactedIds: Set<string>;
  onOpenMessage: (client: CrmClient) => void;
  defaultOpen: boolean;
  valueMeta: Map<string, { label: string; color: string }>;
  periodoLabel: string;
  visitsNote: string;
  showCadencia?: boolean;
}

const PAGE_SIZE = 25;

function BarberGroup({ nome, clients, contactedIds, onOpenMessage, defaultOpen, valueMeta, periodoLabel, visitsNote, showCadencia }: BarberGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const contacted = clients.filter(c => contactedIds.has(c.cliente_id)).length;
  const visibleClients = clients.slice(0, visibleCount);
  const remaining = clients.length - visibleCount;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border/40 bg-card hover:bg-muted/20 transition-colors cursor-pointer">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className="font-semibold text-sm text-foreground">{nome}</span>
        <Badge variant="secondary" className="text-[10px] h-5">{clients.length}</Badge>
        {contacted > 0 && (
          <Badge variant="outline" className="text-[10px] h-5 gap-0.5 border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" /> {contacted}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">{clients.length - contacted} pendente{clients.length - contacted !== 1 ? 's' : ''}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-[10px]">
                <TableHead className="w-[160px]">Cliente</TableHead>
                <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                <TableHead className="hidden md:table-cell">Última visita</TableHead>
                <TableHead className="text-center">
                  <div>Dias s/ vir</div>
                  {showCadencia && <div className="text-[9px] text-muted-foreground font-normal">/ cadência</div>}
                </TableHead>
                <TableHead className="hidden sm:table-cell text-center">
                  <div>Visitas</div>
                  <div className="text-[9px] text-muted-foreground font-normal">{visitsNote}</div>
                </TableHead>
                <TableHead className="hidden sm:table-cell text-right">
                  <div>Valor</div>
                  <div className="text-[9px] text-muted-foreground font-normal">{visitsNote}</div>
                </TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead className="text-center w-[90px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleClients.map(c => {
                const sent = contactedIds.has(c.cliente_id);
                const vm = valueMeta.get(c._dimension_value);
                return (
                  <TableRow key={c.cliente_id} className={sent ? 'opacity-60' : ''}>
                    <TableCell className="text-xs font-medium max-w-[180px] truncate text-foreground">
                      {c.cliente_nome || 'Sem nome'}
                      {c.ratio != null && <span className="text-[9px] text-muted-foreground ml-1">({c.ratio.toFixed(1)}x)</span>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-[11px] text-muted-foreground">{c.telefone || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground whitespace-nowrap">{fmtD(c.ultima_visita)}</TableCell>
                    <TableCell className={`text-center text-xs font-semibold ${diasColor(calcDiasSemVir(c.ultima_visita, c.dias_sem_vir))}`}>
                      <div>{calcDiasSemVir(c.ultima_visita, c.dias_sem_vir)}d</div>
                      {showCadencia && (
                        c.cadencia_dias != null
                          ? <div className="text-[9px] font-normal text-muted-foreground">cad. {Math.round(c.cadencia_dias)}d</div>
                          : <div className="text-[9px] font-normal text-muted-foreground">{c.visitas_total}v · s/ cad.</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-center text-[11px] text-foreground">{c.visitas_total}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-[11px] text-foreground">{fmtVal(c.valor_total)}</TableCell>
                    <TableCell>
                      {vm && <span className={`text-[9px] font-medium ${vm.color}`}>{vm.label}</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {sent ? (
                        <Badge variant="outline" className="text-[9px] h-5 gap-0.5 border-emerald-500/30 text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5" /> ✓
                        </Badge>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => onOpenMessage(c)} disabled={!c.telefone}>
                          <Send className="h-3 w-3" />Enviar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {remaining > 0 && (
          <button
            className="w-full py-2 text-[10px] text-primary hover:underline text-center"
            onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
          >
            Ver mais {Math.min(remaining, PAGE_SIZE)} de {remaining} restantes →
          </button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ------------------------------------------------------------------ */
/*  HistoryTab                                                         */
/* ------------------------------------------------------------------ */

function HistoryTab({ envios, loading, onDelete }: { envios: CrmEnvio[]; loading: boolean; onDelete: (id: string) => Promise<void> }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, CrmEnvio[]>();
    envios.forEach(e => {
      const day = e.ref_date || 'sem-data';
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [envios]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!envios.length) return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem enviada neste período.</p>;

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">{envios.length} mensagen{envios.length !== 1 ? 's' : ''} enviada{envios.length !== 1 ? 's' : ''}</p>
      {grouped.map(([date, items]) => (
        <div key={date} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-foreground">{fmtD(date)}</span>
            <Badge variant="secondary" className="text-[9px] h-4">{items.length}</Badge>
          </div>
          {items.map(e => {
            const isExpanded = expandedId === e.id;
            return (
              <div
                key={e.id}
                className="rounded-lg border border-border/40 bg-card/50 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : e.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/20 transition-colors cursor-pointer"
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <span className="text-xs font-medium text-foreground truncate max-w-[140px]">{e.cliente_nome || e.cliente_id}</span>
                  <Badge variant="outline" className="text-[8px] h-4 border-emerald-500/30 text-emerald-400 gap-0.5 shrink-0">
                    <CheckCircle2 className="h-2 w-2" /> Enviado
                  </Badge>
                  <Badge variant="secondary" className="text-[8px] h-4 shrink-0">{e.status_cliente}</Badge>
                  {e.colaborador_nome && <span className="text-[10px] text-muted-foreground hidden sm:inline ml-auto">{e.colaborador_nome}</span>}
                  {e.enviado_em && (
                    <span className="text-[9px] text-muted-foreground ml-auto sm:ml-2 shrink-0">
                      {new Date(e.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/20">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                      <span>📱 {e.telefone || 'Sem telefone'}</span>
                      <span>✂️ {e.colaborador_nome || '-'}</span>
                      <span>📋 {e.categoria}</span>
                      {e.enviado_em && <span>🕐 {new Date(e.enviado_em).toLocaleString('pt-BR')}</span>}
                    </div>
                    {e.mensagem_final && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Mensagem enviada</p>
                        <p className="text-xs text-foreground bg-muted/20 rounded-md px-2.5 py-1.5 whitespace-pre-wrap">{e.mensagem_final}</p>
                      </div>
                    )}
                    {e.observacao && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Observação</p>
                        <p className="text-xs text-foreground bg-muted/20 rounded-md px-2.5 py-1.5">{e.observacao}</p>
                      </div>
                    )}
                    <div className="flex justify-end pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingId === e.id}
                        onClick={async () => {
                          setDeletingId(e.id);
                          try {
                            await onDelete(e.id);
                            toast.success(`Envio de ${e.cliente_nome || 'cliente'} removido — voltou para a fila.`);
                          } catch (err: any) {
                            toast.error('Erro ao remover: ' + (err.message || 'erro'));
                          } finally { setDeletingId(null); }
                        }}
                      >
                        {deletingId === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                        Desfazer envio
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function TabAcoesCRM({ filters, raioxConfig }: Props) {
  const crm = useAcoesCRM(filters, raioxConfig);
  const [searchQuery, setSearchQuery] = useState('');
  const [barberFilter, setBarberFilter] = useState<string | null>(null);

  const periodoLabel = `${fmtD(filters.dataInicioISO)} – ${fmtD(filters.dataFimISO)}`;
  const mesesAnalise = raioxConfig.config.cadencia_meses_analise ?? 12;
  const isIndividual = crm.dimension === 'cadencia_individual';

  const DIMENSION_CONTEXT: Record<string, { note: string; warn?: string }> = {
    cadencia_individual: {
      note: `Classificação pelo ratio visitas/cadência — janela de análise: últimos ${mesesAnalise}m. Visitas e valor na tabela = mesma janela (${mesesAnalise}m).`,
      warn: `"1ª Vez" = vieram 1x e têm ≤45 dias sem retorno (aguardando). Clientes com 1 visita e 46-90 dias aparecem em "Em Risco"; com >90 dias em "Perdido". Para ver todos os one-shots agrupados, use o preset "1ª Visita — todos".`,
    },
    cadencia_fixa: {
      note: `Clientes agrupados por dias sem vir, calculado sobre o período: ${periodoLabel}`,
    },
    perfil: {
      note: `Perfil baseado em visitas históricas. Visitas e valor na tabela referem-se ao período: ${periodoLabel}`,
    },
    status_12m: {
      note: `Status (Saudável/Em Risco/Perdido) calculado pela última visita até ${fmtD(filters.dataFimISO)}. Visitas e valor na tabela referem-se ao período: ${periodoLabel}`,
    },
    one_shot: {
      note: `Clientes com exatamente 1 visita (all-time). Visitas e valor na tabela referem-se ao período: ${periodoLabel}`,
    },
    sinais: {
      note: `Sinais da base calculados sobre o período: ${periodoLabel}`,
    },
    atividade: {
      note: `Clientes com atividade registrada no período: ${periodoLabel}`,
    },
  };

  const dimCtx = DIMENSION_CONTEXT[crm.dimension] ?? { note: `Período: ${periodoLabel}` };
  // cadencia_individual uses analysis window; all other dimensions use the filter period
  const visitsNote = isIndividual ? `últimos ${mesesAnalise}m` : `período selecionado`;
  const [onlyPending, setOnlyPending] = useState(true);
  const [onlyWithPhone, setOnlyWithPhone] = useState(false);
  const [activeTab, setActiveTab] = useState<'fila' | 'historico'>('fila');
  const [dialogClient, setDialogClient] = useState<CrmClient | null>(null);
  const [dialogMessage, setDialogMessage] = useState('');

  // Value meta lookup
  const valueMeta = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>();
    crm.currentDimension.values.forEach(v => map.set(v.key, { label: v.label, color: v.color }));
    return map;
  }, [crm.currentDimension]);

  // Barbers from loaded clients
  const barbers = useMemo(() => {
    const set = new Map<string, string>();
    crm.clients.forEach(c => { if (c.colaborador_id && c.colaborador_nome) set.set(c.colaborador_id, c.colaborador_nome); });
    return Array.from(set.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [crm.clients]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    let list = crm.clients;
    if (barberFilter) list = list.filter(c => c.colaborador_id === barberFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => (c.cliente_nome || '').toLowerCase().includes(q) || (c.telefone || '').includes(q));
    }
    if (onlyPending) list = list.filter(c => !crm.contactedIds.has(c.cliente_id));
    if (onlyWithPhone) list = list.filter(c => !!c.telefone);
    return list.sort((a, b) => calcDiasSemVir(b.ultima_visita, b.dias_sem_vir) - calcDiasSemVir(a.ultima_visita, a.dias_sem_vir));
  }, [crm.clients, barberFilter, searchQuery, onlyPending, onlyWithPhone, crm.contactedIds]);

  // Group by barber
  const grouped = useMemo(() => {
    const map = new Map<string, { id: string | null; nome: string; clients: CrmClient[] }>();
    filteredClients.forEach(c => {
      const key = c.colaborador_id || '__none__';
      if (!map.has(key)) map.set(key, { id: c.colaborador_id, nome: c.colaborador_nome || 'Sem barbeiro', clients: [] });
      map.get(key)!.clients.push(c);
    });
    return Array.from(map.values()).sort((a, b) => b.clients.length - a.clients.length);
  }, [filteredClients]);

  // Message dialog
  const openMessageDialog = (client: CrmClient) => {
    const status = client._dimension_value || client.seg_cadencia || '';
    const template = crm.getTemplate(status);
    const body = template ? crm.fillTemplate(template.corpo, client) : `Oi ${client.cliente_nome?.split(' ')[0] || 'Cliente'}! 💈`;
    setDialogMessage(body);
    setDialogClient(client);
  };

  const handleSendMessage = async (mensagemFinal: string, observacao: string) => {
    if (!dialogClient) return;
    const status = dialogClient._dimension_value || dialogClient.seg_cadencia || '';
    const template = crm.getTemplate(status);
    await crm.markAsSent({
      cliente_id: dialogClient.cliente_id,
      cliente_nome: dialogClient.cliente_nome,
      categoria: `${crm.dimension}:${dialogClient._dimension_value}`,
      status_cliente: status,
      colaborador_id: dialogClient.colaborador_id,
      colaborador_nome: dialogClient.colaborador_nome,
      telefone: dialogClient.telefone,
      mensagem_sugerida: template ? crm.fillTemplate(template.corpo, dialogClient) : '',
      mensagem_final: mensagemFinal,
      observacao,
      template_id: template?.id,
    });
  };

  return (
    <div className="space-y-3 min-w-0 w-full overflow-x-hidden">
      <HowToReadSection
        bullets={[
          'Selecione a dimensão analítica e os valores para filtrar clientes.',
          'Os clientes são agrupados por barbeiro. Clique "Enviar" para abrir WhatsApp e registrar contato.',
          'Use o CSV para exportar a lista com informações de contato já realizado.',
          'Dias sem vir = dias desde a última visita na barbearia até a data de referência.',
        ]}
      />

      {/* ── Strategy Presets ── */}
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground px-0.5">Atalhos de estratégia</p>
        <div className="flex flex-wrap gap-1.5">
          {CRM_PRESETS.map(preset => {
            const isActive = crm.dimension === preset.dimension &&
              preset.values.every(v => crm.selectedValues.has(v)) &&
              crm.selectedValues.size === preset.values.length;
            return (
              <button
                key={preset.key}
                title={preset.description}
                onClick={() => crm.applyPreset(preset)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                  isActive
                    ? preset.urgency === 'high'
                      ? 'border-rose-500/60 bg-rose-500/15 text-rose-300'
                      : preset.urgency === 'medium'
                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                      : 'border-sky-500/60 bg-sky-500/15 text-sky-300'
                    : 'border-border/40 bg-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Dimension & Value selectors ── */}
      <div className="space-y-2 p-3 rounded-xl border border-border/40 bg-muted/10">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select value={crm.dimension} onValueChange={(v) => crm.changeDimension(v as CrmDimension)}>
            <SelectTrigger className="h-7 w-auto min-w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {crm.dimensions.map(d => (
                <SelectItem key={d.key} value={d.key} className="text-xs">{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <button onClick={crm.selectAllValues} className="text-[9px] text-primary hover:underline">Todos</button>
            <span className="text-[9px] text-muted-foreground">|</span>
            <button onClick={crm.selectNoneValues} className="text-[9px] text-muted-foreground hover:underline">Nenhum</button>
          </div>
        </div>

        {/* Value toggles */}
        <div className="flex flex-wrap gap-1">
          {crm.currentDimension.values.map(v => {
            const active = crm.selectedValues.has(v.key);
            const count = crm.stats.byValue[v.key] || 0;
            return (
              <button
                key={v.key}
                onClick={() => crm.toggleValue(v.key)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                  active
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-border/30 bg-transparent text-muted-foreground opacity-50'
                }`}
              >
                {v.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        {/* Secondary filters */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/20">
          {barbers.length > 1 && (
            <Select value={barberFilter || '__all__'} onValueChange={v => setBarberFilter(v === '__all__' ? null : v)}>
              <SelectTrigger className="h-6 w-auto min-w-[130px] text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-[10px]">Todos barbeiros</SelectItem>
                {barbers.map(b => <SelectItem key={b.id} value={b.id} className="text-[10px]">{b.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar cliente..." className="h-6 pl-6 pr-2 w-[140px] sm:w-[180px] text-[10px]" maxLength={100} />
          </div>
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
            <Checkbox checked={onlyPending} onCheckedChange={(v) => setOnlyPending(!!v)} className="h-3 w-3" />
            Só pendentes
          </label>
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
            <Checkbox checked={onlyWithPhone} onCheckedChange={(v) => setOnlyWithPhone(!!v)} className="h-3 w-3" />
            Só c/ telefone
          </label>
        </div>
      </div>

      {/* ── Aviso de filtro de barbeiro ativo ── */}
      {filters.filtroColaborador.id && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/5 text-[10px] text-amber-400">
          <Users className="h-3 w-3 shrink-0" />
          <span>Filtro de barbeiro ativo: mostrando apenas clientes de <strong>{filters.filtroColaborador.nome}</strong>. Limpe o filtro no cabeçalho para ver todos.</span>
        </div>
      )}

      {/* ── Contexto do período ── */}
      <div className="space-y-1 px-3 py-2 rounded-xl border border-border/40 bg-muted/10 text-[10px]">
        <div className="flex items-start gap-1.5">
          <CalendarDays className="h-3 w-3 text-primary shrink-0 mt-0.5" />
          <span className="text-muted-foreground">{dimCtx.note}</span>
        </div>
        {dimCtx.warn && (
          <div className="flex items-start gap-1.5">
            <span className="shrink-0">⚠</span>
            <span className="text-amber-400/90">{dimCtx.warn}</span>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
        <div className="flex flex-wrap items-center gap-2">
          <TabsList className="h-8">
            <TabsTrigger value="fila" className="text-xs gap-1 px-3"><Users className="h-3 w-3" /> Fila ({fmtN(filteredClients.length)}) {crm.stats.contacted > 0 && <Badge variant="outline" className="text-[8px] h-4 ml-1 border-emerald-500/30 text-emerald-400">{crm.stats.contacted} ✓</Badge>}</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs gap-1 px-3"><History className="h-3 w-3" /> Histórico {crm.envios.length > 0 && <Badge variant="outline" className="text-[8px] h-4 ml-0.5 border-emerald-500/30 text-emerald-400">{crm.envios.length}</Badge>}</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => crm.exportCsv(filteredClients)} disabled={!filteredClients.length}>
              <Download className="h-3 w-3" /> CSV ({fmtN(filteredClients.length)})
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { crm.reload(); crm.reloadEnvios(); }} disabled={crm.loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${crm.loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <TabsContent value="fila" className="mt-3 space-y-3">
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Card className="bg-card/50"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Total na fila</p>
              <p className="text-lg font-bold">{crm.loading ? '…' : fmtN(crm.stats.total)}</p>
              {crm.stats.grandTotal > crm.stats.total && <p className="text-[9px] text-muted-foreground">{fmtN(crm.stats.grandTotal)} no banco</p>}
            </CardContent></Card>
            <Card className="bg-card/50"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Contactados</p>
              <p className="text-lg font-bold text-emerald-400">{fmtN(crm.stats.contacted)}</p>
            </CardContent></Card>
            <Card className="bg-card/50"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Pendentes</p>
              <p className="text-lg font-bold text-amber-400">{fmtN(crm.stats.pending)}</p>
            </CardContent></Card>
            <Card className="bg-card/50"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Com telefone</p>
              <p className="text-lg font-bold">{fmtN(crm.stats.withPhone)}</p>
            </CardContent></Card>
          </div>

          {/* Loading */}
          {crm.loading && !crm.clients.length && (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}

          {/* Error */}
          {crm.error && (
            <div className="text-sm text-destructive px-3 py-2 rounded border border-destructive/30 bg-destructive/5">
              Erro ao carregar: {crm.error}
            </div>
          )}

          {/* Empty */}
          {!crm.loading && filteredClients.length === 0 && !crm.error && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {crm.selectedValues.size === 0 ? 'Selecione pelo menos um valor acima.' : 'Nenhum cliente encontrado com os filtros atuais.'}
            </p>
          )}

          {/* Barber groups */}
          <div className="space-y-2">
            {grouped.map((g, i) => (
              <BarberGroup
                key={g.id || '__none__'}
                nome={g.nome}
                clients={g.clients}
                contactedIds={crm.contactedIds}
                onOpenMessage={openMessageDialog}
                defaultOpen={i < 3}
                valueMeta={valueMeta}
                periodoLabel={periodoLabel}
                visitsNote={visitsNote}
                showCadencia={isIndividual}
              />
            ))}
          </div>

          {filteredClients.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-center">
              Mostrando {fmtN(filteredClients.length)} clientes em {grouped.length} barbeiro{grouped.length !== 1 ? 's' : ''} · {fmtN(crm.stats.contacted)} já contactados
            </p>
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-3">
          <HistoryTab envios={crm.envios} loading={crm.enviosLoading} onDelete={crm.deleteEnvio} />
        </TabsContent>
      </Tabs>

      {/* Message Dialog */}
      <MessageDialog
        open={!!dialogClient}
        onClose={() => setDialogClient(null)}
        client={dialogClient}
        suggestedMessage={dialogMessage}
        onSend={handleSendMessage}
      />
    </div>
  );
}

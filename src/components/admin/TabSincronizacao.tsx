/**
 * FILE: src/components/admin/TabSincronizacao.tsx
 *
 * TAB: SINCRONIZAÇÃO (ADMIN)
 * ---------------------------------------------------------
 * Fluxo direcionado (Wizard):
 * 1) Selecionar unidade + período
 * 2) Auditar (validar o que será alterado)
 * 3) Sincronizar (executar alterações)
 * 4) Atualizar Dimensões (atualizar tabelas de dimensões)
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgs } from "@/hooks/useOrgs";
import { useUnits } from "@/hooks/useUnits";
import { useSyncDatabase } from "@/hooks/useSyncDatabase";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

import {
  RefreshCw,
  Database,
  Users,
  Package,
  UserCheck,
  CalendarIcon,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingUp,
  Search,
  Clock,
  RotateCcw,
} from "lucide-react";

import { format, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/** Helper: converte para número "seguro" */
function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Tipo para controle do fluxo */
type FlowStep = 'initial' | 'audited' | 'synced' | 'completed';

export function TabSincronizacao() {
  const { t } = useI18n();
  const { profile } = useAuth();

  // Organizações/unidades vêm de hooks separados
  const { organizations: orgs, loading: orgsLoading } = useOrgs();
  const { units, loading: unitsLoading } = useUnits();

  // Hook central para ações de sync/audit/dimensões/stats
  const {
    auditVendas,
    auditLoading,
    lastAuditResult,

    syncVendas,
    syncLoading,
    lastSyncResult,

    updateDimensoes,
    dimensoesLoading,
    lastDimensoesResult,

    fetchStats,
    statsLoading,
    stats,
  } = useSyncDatabase();

  // Regra de UI: master vê seletor de organização
  const isMaster = profile?.role_base === "master";

  // ==========================================================
  // ESTADO: última venda
  // ==========================================================
  const [lastSaleInfo, setLastSaleInfo] = useState<{
    date: Date;
    formattedDate: string;
  } | null>(null);
  const [lastSaleLoading, setLastSaleLoading] = useState(false);
  const [lastSaleRefetch, setLastSaleRefetch] = useState(0);

  // ==========================================================
  // ESTADO: controle do fluxo (wizard)
  // ==========================================================
  const [flowStep, setFlowStep] = useState<FlowStep>('initial');

  // ==========================================================
  // FILTROS (org, unit, período)
  // ==========================================================
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");

  // Período padrão: mês atual até hoje
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  /**
   * Unidades filtradas pela organização escolhida.
   */
  const filteredUnits = useMemo(() => {
    return selectedOrgId ? units.filter((u) => u.org_id === selectedOrgId) : units;
  }, [selectedOrgId, units]);

  /**
   * Ao abrir a tela: carrega stats gerais.
   */
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  /**
   * Se NÃO for master: auto-seleciona org/unit pelo perfil
   */
  useEffect(() => {
    if (!isMaster && profile?.org_id) setSelectedOrgId(profile.org_id);
    if (!isMaster && profile?.unit_id) setSelectedUnitId(profile.unit_id);
  }, [isMaster, profile]);

  /**
   * Se o usuário troca a organização e a unidade atual não pertence à org,
   * limpamos a unidade para evitar inconsistência.
   */
  useEffect(() => {
    if (selectedOrgId && selectedUnitId) {
      const unitBelongsToOrg = filteredUnits.some((u) => u.id === selectedUnitId);
      if (!unitBelongsToOrg) setSelectedUnitId("");
    }
  }, [selectedOrgId, filteredUnits, selectedUnitId]);

  /**
   * Buscar última venda (global - tabela não tem filtro por unidade)
   * Re-executa quando: unidade muda OU após sync bem-sucedido (via lastSaleRefetch)
   */
  useEffect(() => {
    const fetchLastSale = async () => {
      if (!selectedUnitId) {
        setLastSaleInfo(null);
        return;
      }

      setLastSaleLoading(true);
      try {
        // Nota: vendas_api_raw não tem coluna unidade_id, busca MAX global
        const { data, error } = await supabase
          .from('vendas_api_raw')
          .select('venda_data_ts')
          .order('venda_data_ts', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Erro ao buscar última venda:', error);
          setLastSaleInfo(null);
          return;
        }

        if (data?.venda_data_ts) {
          const date = new Date(data.venda_data_ts);
          setLastSaleInfo({
            date,
            formattedDate: format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
          });
        } else {
          setLastSaleInfo(null);
        }
      } catch (err) {
        console.error('Erro ao buscar última venda:', err);
        setLastSaleInfo(null);
      } finally {
        setLastSaleLoading(false);
      }
    };

    fetchLastSale();
  }, [selectedUnitId, lastSaleRefetch]);

  /**
   * Resetar fluxo quando trocar período ou unidade
   */
  useEffect(() => {
    setFlowStep('initial');
  }, [selectedUnitId, dateRange.from, dateRange.to]);

  // Libera botões somente quando tem unidade
  const canRun = Boolean(selectedUnitId);

  // Controle do fluxo: habilita botões conforme o passo
  const canAudit = canRun;
  const canSync = canRun && flowStep === 'audited' && lastAuditResult?.ok;
  const canUpdateDimensoes = canRun && flowStep === 'synced' && lastSyncResult?.ok;

  // Nome da unidade selecionada (pra exibir no badge)
  const selectedUnitName = useMemo(() => {
    if (!selectedUnitId) return null;
    const u = units.find((x) => x.id === selectedUnitId);
    return u?.nome ?? selectedUnitId;
  }, [selectedUnitId, units]);

  // ==========================================================
  // AÇÕES
  // ==========================================================
  const handleAuditVendas = async () => {
    const result = await auditVendas(dateRange.from, dateRange.to);
    if (result.ok) {
      setFlowStep('audited');
    }
  };

  const handleSyncVendas = async () => {
    const result = await syncVendas(dateRange.from, dateRange.to);
    if (result.ok) {
      setFlowStep('synced');
      // Força re-fetch da última venda após sync bem-sucedido
      setLastSaleRefetch(prev => prev + 1);
    }
  };

  const handleUpdateDimensoes = async () => {
    const result = await updateDimensoes(dateRange.from, dateRange.to);
    if (result.ok) {
      setFlowStep('completed');
    }
  };

  const handleResetFlow = useCallback(() => {
    setFlowStep('initial');
  }, []);

  // ==========================================================
  // FORMATADORES PARA UI
  // ==========================================================
  const formatNumber = (num: number) => new Intl.NumberFormat("pt-BR").format(num);

  const renderDelta = (n?: number) => {
    const v = Number(n ?? 0);
    const isNeg = v < 0;
    const cls = isNeg ? "text-destructive" : "text-primary";
    const sign = isNeg ? "" : "+";
    return <span className={cn("font-medium", cls)}>{`${sign}${formatNumber(v)}`}</span>;
  };

  // ==========================================================
  // VIEWMODEL (AUDIT)
  // ==========================================================
  const auditView = useMemo(() => {
    if (!lastAuditResult) return null;
    const r: any = lastAuditResult;

    // Valores do audit (usando estrutura normalizada)
    const rawBefore = toNum(r?.before?.raw_rows_in_period);
    const apiReceived = toNum(r?.incoming?.api_rows_received);
    const willDelete = toNum(r?.expected?.will_delete_raw_rows_in_period);
    const willInsert = toNum(r?.expected?.will_insert_rows_from_api);
    const expectedNet = toNum(r?.expected?.expected_net_change) || (willInsert - willDelete);

    return {
      ok: Boolean(r?.ok),
      error: r?.error,
      rawBefore,
      apiReceived,
      willDelete,
      willInsert,
      expectedNet,
    };
  }, [lastAuditResult]);

  // ==========================================================
  // VIEWMODEL (SYNC) - usando campos diretos do lastSyncResult
  // ==========================================================
  const syncView = useMemo(() => {
    if (!lastSyncResult) return null;
    
    // Usando diretamente os campos normalizados do hook
    return {
      ok: Boolean(lastSyncResult.ok),
      error: lastSyncResult.error,
      fetched: toNum(lastSyncResult.fetched_count),
      inserted: toNum(lastSyncResult.inserted_rows_in_period || lastSyncResult.inserted_count),
      deleted: toNum(lastSyncResult.deleted_rows_in_period),
      net: toNum(lastSyncResult.net_change_in_period),
      before: toNum(lastSyncResult.before_raw_rows_in_period),
      after: toNum(lastSyncResult.after_raw_rows_in_period),
    };
  }, [lastSyncResult]);

  // ==========================================================
  // VIEWMODEL (DIMENSÕES)
  // ==========================================================
  const dimensoesView = useMemo(() => {
    if (!lastDimensoesResult) return null;
    
    return {
      ok: Boolean(lastDimensoesResult.ok),
      error: lastDimensoesResult.error,
      stats: lastDimensoesResult.stats,
    };
  }, [lastDimensoesResult]);

  return (
    <div className="space-y-6">
      {/* ======================================================
          HEADER
          ====================================================== */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("sync.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("sync.subtitle")}</p>
      </div>

      {/* ======================================================
          FILTROS
          ====================================================== */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("sync.selectContext")}</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Organização (somente master) */}
            {isMaster && (
              <div className="w-full sm:w-auto min-w-[200px]">
                <label className="text-sm text-muted-foreground mb-1.5 block">{t("filters.organization")}</label>

                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("users.selectOrganization")} />
                  </SelectTrigger>

                  <SelectContent>
                    {orgsLoading ? (
                      <div className="p-2">
                        <Skeleton className="h-6 w-full" />
                      </div>
                    ) : (
                      orgs.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Unidade */}
            <div className="w-full sm:w-auto min-w-[220px]">
              <label className="text-sm text-muted-foreground mb-1.5 block">{t("filters.unit")}</label>

              <Select value={selectedUnitId} onValueChange={setSelectedUnitId} disabled={isMaster && !selectedOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("users.selectUnit")} />
                </SelectTrigger>

                <SelectContent>
                  {unitsLoading ? (
                    <div className="p-2">
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : (
                    filteredUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {!canRun && (
                <div className="mt-2">
                  <Badge variant="secondary">Selecione uma unidade para liberar os botões</Badge>
                </div>
              )}

              {canRun && (
                <div className="mt-2 space-y-1">
                  <Badge variant="outline">Unidade selecionada: {selectedUnitName}</Badge>
                  
                  {/* Última venda */}
                  {lastSaleLoading ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Buscando última venda...</span>
                    </div>
                  ) : lastSaleInfo ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Última venda no banco: {lastSaleInfo.formattedDate}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Nenhuma venda encontrada</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Período */}
            <div className="w-full sm:w-auto">
              <label className="text-sm text-muted-foreground mb-1.5 block">{t("filters.period")}</label>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[260px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from && dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} {" - "}
                        {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                      </>
                    ) : (
                      <span>{t("filters.custom")}</span>
                    )}
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0" align="start">
                  {/* Atalhos */}
                  <div className="flex gap-2 p-2 border-b">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                    >
                      {t("filters.last7Days")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                    >
                      {t("filters.last30Days")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange({ from: startOfMonth(new Date()), to: new Date() })}
                    >
                      {t("filters.thisMonth")}
                    </Button>
                  </div>

                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) setDateRange({ from: range.from, to: range.to });
                      else if (range?.from) setDateRange({ from: range.from, to: range.from });
                    }}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ======================================================
          CARD ÚNICO: SINCRONIZAÇÃO DE DADOS
          ====================================================== */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Sincronização de Dados</CardTitle>
              <CardDescription className="text-xs">
                Siga o fluxo: Auditar → Sincronizar → Atualizar Dimensões
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ============================================
              BOTÕES DE AÇÃO (em linha)
              ============================================ */}
          <div className="flex flex-wrap gap-2">
            {/* Passo 1: Auditar */}
            <Button
              onClick={handleAuditVendas}
              disabled={auditLoading || !canAudit}
              variant={flowStep === 'initial' ? 'default' : 'outline'}
              className="flex-1 min-w-[130px]"
            >
              {auditLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Auditando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  1. Auditar
                </>
              )}
            </Button>

            {/* Passo 2: Sincronizar */}
            <Button
              onClick={handleSyncVendas}
              disabled={syncLoading || !canSync}
              variant={flowStep === 'audited' ? 'default' : 'outline'}
              className="flex-1 min-w-[130px]"
            >
              {syncLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("sync.syncing")}
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  2. Sincronizar
                </>
              )}
            </Button>

            {/* Passo 3: Dimensões */}
            <Button
              onClick={handleUpdateDimensoes}
              disabled={dimensoesLoading || !canUpdateDimensoes}
              variant={flowStep === 'synced' ? 'default' : 'outline'}
              className="flex-1 min-w-[130px]"
            >
              {dimensoesLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("sync.updating")}
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  3. Dimensões
                </>
              )}
            </Button>

            {/* Reiniciar - sempre visível, destacado */}
            <Button
              onClick={handleResetFlow}
              disabled={flowStep === 'initial'}
              variant="ghost"
              className="min-w-[110px] border border-border/50"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reiniciar
            </Button>
          </div>

          {/* Dica inicial */}
          {canRun && flowStep === 'initial' && !auditView && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Clique em <span className="font-medium">"1. Auditar"</span> para verificar o impacto antes de sincronizar
            </p>
          )}

          {/* ============================================
              RESULTADO DO AUDIT
              ============================================ */}
          {auditView && (
            <div
              className={cn(
                "p-4 rounded-lg border text-sm",
                auditView.ok ? "bg-primary/5 border-primary/30" : "bg-destructive/10 border-destructive/30",
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                {auditView.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className={cn("font-medium", auditView.ok ? "text-primary" : "text-destructive")}>
                  {auditView.ok ? "RESULTADO DA AUDITORIA" : "AUDIT ERRO"}
                </span>
              </div>

              {auditView.ok ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-muted-foreground">Raw atual</p>
                    <p className="font-semibold text-foreground">{formatNumber(auditView.rawBefore)}</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-muted-foreground">API recebidas</p>
                    <p className="font-semibold text-foreground">{formatNumber(auditView.apiReceived)}</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-muted-foreground">Vai deletar</p>
                    <p className="font-semibold text-destructive">-{formatNumber(auditView.willDelete)}</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-muted-foreground">Vai inserir</p>
                    <p className="font-semibold text-primary">+{formatNumber(auditView.willInsert)}</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-muted-foreground">Δ esperado</p>
                    <p className="font-semibold">{renderDelta(auditView.expectedNet)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-destructive">{auditView.error}</p>
              )}

              {auditView.ok && flowStep === 'audited' && (
                <p className="text-xs text-primary mt-3 font-medium text-center">
                  ✓ Agora clique em "2. Sincronizar" para aplicar as alterações
                </p>
              )}
            </div>
          )}

          {/* ============================================
              RESULTADO DO SYNC
              ============================================ */}
          {syncView && (
            <div
              className={cn(
                "p-4 rounded-lg border text-sm",
                syncView.ok ? "bg-primary/5 border-primary/30" : "bg-destructive/10 border-destructive/30",
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                {syncView.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className={cn("font-medium", syncView.ok ? "text-primary" : "text-destructive")}>
                  {syncView.ok ? "RESULTADO DA SINCRONIZAÇÃO" : "SYNC ERRO"}
                </span>
              </div>

              {syncView.ok ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2 bg-muted/50 rounded text-center">
                      <p className="text-muted-foreground">API recebidas</p>
                      <p className="font-semibold text-foreground">{formatNumber(syncView.fetched)}</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded text-center">
                      <p className="text-muted-foreground">Deletou</p>
                      <p className="font-semibold text-destructive">-{formatNumber(syncView.deleted)}</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded text-center">
                      <p className="text-muted-foreground">Inseriu</p>
                      <p className="font-semibold text-primary">+{formatNumber(syncView.inserted)}</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded text-center">
                      <p className="text-muted-foreground">Δ real</p>
                      <p className="font-semibold">{renderDelta(syncView.net)}</p>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-border/50 text-xs text-center text-muted-foreground">
                    Antes: <span className="font-medium text-foreground">{formatNumber(syncView.before)}</span>
                    {" → "}
                    Depois: <span className="font-medium text-foreground">{formatNumber(syncView.after)}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-destructive">{syncView.error}</p>
              )}

              {syncView.ok && flowStep === 'synced' && (
                <p className="text-xs text-primary mt-3 font-medium text-center">
                  ✓ Agora clique em "3. Dimensões" para atualizar as tabelas de dimensões
                </p>
              )}
            </div>
          )}

          {/* ============================================
              RESULTADO DAS DIMENSÕES
              ============================================ */}
          {dimensoesView && (
            <div
              className={cn(
                "p-4 rounded-lg border",
                dimensoesView.ok ? "bg-primary/5 border-primary/30" : "bg-destructive/10 border-destructive/30",
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                {dimensoesView.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className={cn("text-sm font-medium", dimensoesView.ok ? "text-primary" : "text-destructive")}>
                  {dimensoesView.ok ? "RESULTADO DAS DIMENSÕES" : "Erro ao atualizar"}
                </span>
              </div>

              {!dimensoesView.ok && dimensoesView.error && (
                <p className="text-xs text-destructive">{dimensoesView.error}</p>
              )}

              {/* Stats das dimensões atualizadas */}
              {dimensoesView.ok && dimensoesView.stats && (
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-muted/50 rounded text-center">
                    <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-muted-foreground">Clientes</p>
                    <p className="font-semibold text-primary text-lg">
                      {dimensoesView.stats.clientes.added >= 0 ? '+' : ''}
                      {dimensoesView.stats.clientes.added}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {dimensoesView.stats.clientes.before} → {dimensoesView.stats.clientes.after}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded text-center">
                    <UserCheck className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-muted-foreground">Colaboradores</p>
                    <p className="font-semibold text-primary text-lg">
                      {dimensoesView.stats.colaboradores.added >= 0 ? '+' : ''}
                      {dimensoesView.stats.colaboradores.added}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {dimensoesView.stats.colaboradores.before} → {dimensoesView.stats.colaboradores.after}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded text-center">
                    <Package className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-muted-foreground">Produtos</p>
                    <p className="font-semibold text-primary text-lg">
                      {dimensoesView.stats.produtos.added >= 0 ? '+' : ''}
                      {dimensoesView.stats.produtos.added}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {dimensoesView.stats.produtos.before} → {dimensoesView.stats.produtos.after}
                    </p>
                  </div>
                </div>
              )}

              {dimensoesView.ok && flowStep === 'completed' && (
                <p className="text-xs text-primary mt-3 font-medium text-center">
                  ✓ Processo completo! Clique em "Reiniciar" para um novo período.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ======================================================
          STATS
          ====================================================== */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{t("sync.currentStats")}</CardTitle>
              <CardDescription className="text-xs">{t("sync.currentStatsDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">{t("sync.stats.vendas")}</p>
                <p className="text-2xl font-bold text-foreground">{formatNumber(stats.vendas_raw || 0)}</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">{t("sync.stats.clientes")}</p>
                <p className="text-2xl font-bold text-foreground">{formatNumber(stats.clientes || 0)}</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">{t("sync.stats.colaboradores")}</p>
                <p className="text-2xl font-bold text-foreground">{formatNumber(stats.colaboradores || 0)}</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">{t("sync.stats.produtos")}</p>
                <p className="text-2xl font-bold text-foreground">{formatNumber(stats.produtos || 0)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma estatística disponível</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

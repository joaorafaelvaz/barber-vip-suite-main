import React, { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgs } from "@/hooks/useOrgs";
import { useUnits } from "@/hooks/useUnits";
import { useSyncDatabase } from "@/hooks/useSyncDatabase";
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
  ArrowRight,
  Search,
  AlertTriangle,
} from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function AtualizarDados() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const { organizations: orgs, loading: orgsLoading } = useOrgs();
  const { units, loading: unitsLoading } = useUnits();

  const {
    // AUDIT (não grava)
    auditVendas,
    auditLoading,
    lastAuditResult,

    // EXECUTE (grava)
    syncVendas,
    updateDimensoes,
    fetchStats,

    syncLoading,
    dimensoesLoading,
    statsLoading,
    stats,

    lastSyncResult,
    lastDimensoesResult,
  } = useSyncDatabase();

  const isMaster = profile?.role_base === "master";

  // Filters
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  // Filter units by selected org
  const filteredUnits = useMemo(() => {
    return selectedOrgId ? units.filter((u) => u.org_id === selectedOrgId) : units;
  }, [selectedOrgId, units]);

  // Load stats on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-select org/unit based on profile
  useEffect(() => {
    if (!isMaster && profile?.org_id) setSelectedOrgId(profile.org_id);
    if (!isMaster && profile?.unit_id) setSelectedUnitId(profile.unit_id);
  }, [isMaster, profile]);

  // Reset unit when org changes
  useEffect(() => {
    if (selectedOrgId && selectedUnitId) {
      const unitBelongsToOrg = filteredUnits.some((u) => u.id === selectedUnitId);
      if (!unitBelongsToOrg) setSelectedUnitId("");
    }
  }, [selectedOrgId, filteredUnits, selectedUnitId]);

  const canRun = Boolean(selectedUnitId);
  const selectedUnitName = useMemo(() => {
    if (!selectedUnitId) return null;
    const u = units.find((x) => x.id === selectedUnitId);
    return u?.nome ?? selectedUnitId;
  }, [selectedUnitId, units]);

  const handleAuditVendas = async () => {
    await auditVendas(dateRange.from, dateRange.to);
  };

  const handleSyncVendas = async () => {
    await syncVendas(dateRange.from, dateRange.to);
  };

  const handleUpdateDimensoes = async () => {
    await updateDimensoes(dateRange.from, dateRange.to);
  };

  const formatNumber = (num: number) => new Intl.NumberFormat("pt-BR").format(num);

  const renderDelta = (n?: number) => {
    const v = Number(n ?? 0);
    const isNeg = v < 0;
    const cls = isNeg ? "text-destructive" : "text-primary";
    const sign = isNeg ? "" : "+";
    return <span className={cn("font-medium", cls)}>{`${sign}${formatNumber(v)}`}</span>;
  };

  /**
   * ✅ AUDIT: extrator robusto (não “esconde” campo faltante)
   * - Se o backend não retornar um campo: marcamos como "missing"
   * - E ainda mostramos o JSON bruto NA PÁGINA (para ajustar 100%)
   */
  const auditUI = useMemo(() => {
    if (!lastAuditResult) return null;

    const root: any = lastAuditResult;

    const tryGet = (paths: Array<Array<string | number>>) => {
      for (const path of paths) {
        try {
          let cur: any = root;
          for (const p of path) {
            if (cur == null) {
              cur = undefined;
              break;
            }
            cur = cur[p as any];
          }
          if (cur !== undefined && cur !== null) return { value: cur, found: true, path };
        } catch {
          // ignore
        }
      }
      return { value: undefined, found: false, path: null as any };
    };

    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    // Pegadores (coloquei vários caminhos comuns)
    const rawBeforePick = tryGet([
      ["before", "raw_rows_in_period"],
      ["before", "rawInPeriod"],
      ["raw", "before"],
      ["audit", "before_raw"],
    ]);

    const apiReceivedPick = tryGet([
      ["incoming", "api_rows_received"],
      ["incoming", "rows"],
      ["api", "rows"],
      ["audit", "api_rows"],
    ]);

    const willDeletePick = tryGet([
      ["expected", "will_delete_raw_rows_in_period"],
      ["expected", "delete"],
      ["audit", "expected_delete"],
    ]);

    const willInsertPick = tryGet([
      ["expected", "will_insert_rows_from_api"],
      ["expected", "insert"],
      ["audit", "expected_insert"],
    ]);

    const expectedNetPick = tryGet([
      ["expected", "expected_net_change"],
      ["expected", "net_change"],
      ["audit", "expected_net"],
    ]);

    const expectedAfterPick = tryGet([
      ["expected", "raw_rows_in_period_after"],
      ["expected", "after_raw_rows_in_period"],
      ["audit", "expected_after"],
    ]);

    const warningsPick = tryGet([["warnings"], ["warning"], ["audit", "warnings"]]);

    // Valores (com inferência APENAS quando fizer sentido)
    const rawBefore = toNum(rawBeforePick.value);
    const apiReceived = toNum(apiReceivedPick.value);
    const willDelete = toNum(willDeletePick.value);
    const willInsert = toNum(willInsertPick.value);

    const expectedNet = expectedNetPick.found ? toNum(expectedNetPick.value) : willInsert - willDelete;

    const expectedAfter = expectedAfterPick.found
      ? toNum(expectedAfterPick.value)
      : rawBefore - willDelete + willInsert;

    const ok = Boolean(root?.ok);

    const warnList: string[] = Array.isArray(warningsPick.value) ? warningsPick.value.filter(Boolean) : [];

    const missing = {
      rawBefore: !rawBeforePick.found,
      apiReceived: !apiReceivedPick.found,
      willDelete: !willDeletePick.found,
      willInsert: !willInsertPick.found,
      expectedNet: !expectedNetPick.found,
      expectedAfter: !expectedAfterPick.found,
      warnings: !warningsPick.found,
    };

    return {
      ok,
      rawBefore,
      apiReceived,
      willDelete,
      willInsert,
      expectedNet,
      expectedAfter,
      warnList,
      missing,
      raw: root,
    };
  }, [lastAuditResult]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("sync.title")}</h1>
        <p className="text-muted-foreground">{t("sync.subtitle")}</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{t("sync.selectContext")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Organization Selector (Master only) */}
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

            {/* Unit Selector */}
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
                <div className="mt-2">
                  <Badge variant="outline">Unidade selecionada: {selectedUnitName}</Badge>
                </div>
              )}
            </div>

            {/* Date Range */}
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

      {/* Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sync Vendas Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t("sync.syncVendas")}</CardTitle>
                <CardDescription>{t("sync.syncVendasDesc")}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>{t("sync.syncVendasInfo")}</p>
            </div>

            {/* Botões lado a lado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                onClick={handleAuditVendas}
                disabled={auditLoading || !canRun}
                className="w-full"
                variant="outline"
              >
                {auditLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Auditando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Auditar
                  </>
                )}
              </Button>

              <Button onClick={handleSyncVendas} disabled={syncLoading || !canRun} className="w-full">
                {syncLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("sync.syncing")}
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sincronizar
                  </>
                )}
              </Button>
            </div>

            {/* ✅ AUDIT ULTRA VISUAL NA PÁGINA */}
            {auditUI && (
              <div
                className={cn(
                  "p-4 rounded-lg border space-y-3",
                  auditUI.ok ? "bg-primary/10 border-primary/30" : "bg-destructive/10 border-destructive/30",
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {auditUI.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <div className="flex flex-col">
                      <span className={cn("text-sm font-semibold", auditUI.ok ? "text-primary" : "text-destructive")}>
                        {auditUI.ok ? "AUDIT OK (sem gravar)" : "AUDIT ERRO"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        O que vai acontecer no período selecionado (sem mexer na base)
                      </span>
                    </div>
                  </div>

                </div>

                {/* Se erro */}
                {!auditUI.ok && (
                  <div className="rounded-lg border bg-background/60 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                      <p className="text-sm text-destructive whitespace-pre-wrap">
                        {(auditUI.raw as any)?.error || "Erro no AUDIT. Veja Debug."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Cards principais */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-lg border bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5" />
                        RAW antes (no período)
                      </span>
                      {auditUI.missing.rawBefore && <Badge variant="outline">não retornado</Badge>}
                    </div>
                    <div className="text-2xl font-bold">{formatNumber(auditUI.rawBefore)}</div>
                  </div>

                  <div className="rounded-lg border bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5" />
                        API recebidas (linhas)
                      </span>
                      {auditUI.missing.apiReceived && <Badge variant="outline">não retornado</Badge>}
                    </div>
                    <div className="text-2xl font-bold">{formatNumber(auditUI.apiReceived)}</div>
                  </div>

                  <div className="rounded-lg border bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5" />
                        RAW esperado (após sync)
                      </span>
                      {auditUI.missing.expectedAfter && <Badge variant="outline">inferido</Badge>}
                    </div>
                    <div className="text-2xl font-bold">{formatNumber(auditUI.expectedAfter)}</div>
                  </div>
                </div>

                {/* O que vai acontecer */}
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground mb-2 font-medium flex items-center gap-2">
                    <Search className="h-3.5 w-3.5" />
                    Alterações estimadas
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>Vai deletar</span>
                        {auditUI.missing.willDelete && <Badge variant="outline">não retornado</Badge>}
                      </div>
                      <div className="text-lg font-semibold text-destructive">-{formatNumber(auditUI.willDelete)}</div>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>Vai inserir</span>
                        {auditUI.missing.willInsert && <Badge variant="outline">não retornado</Badge>}
                      </div>
                      <div className="text-lg font-semibold text-primary">+{formatNumber(auditUI.willInsert)}</div>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>Δ esperado</span>
                        {auditUI.missing.expectedNet && <Badge variant="outline">inferido</Badge>}
                      </div>
                      <div className="text-lg font-semibold">{renderDelta(auditUI.expectedNet)}</div>
                    </div>
                  </div>

                  <div className="mt-3 text-sm">
                    <span className="text-muted-foreground">Equação:</span>{" "}
                    <span className="font-medium">
                      {formatNumber(auditUI.rawBefore)} <span className="text-muted-foreground"> - </span>
                      <span className="text-destructive font-semibold">{formatNumber(auditUI.willDelete)}</span>{" "}
                      <span className="text-muted-foreground"> + </span>
                      <span className="text-primary font-semibold">{formatNumber(auditUI.willInsert)}</span>{" "}
                      <span className="text-muted-foreground"> = </span>
                      <span className="font-semibold">{formatNumber(auditUI.expectedAfter)}</span>
                    </span>
                  </div>
                </div>

                {/* Warnings */}
                {!!auditUI.warnList.length && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">Avisos do AUDIT</div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {auditUI.warnList.slice(0, 12).map((w, idx) => (
                        <div key={idx}>• {w}</div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ✅ Resultado EXECUTE */}
            {lastSyncResult && (
              <div
                className={cn(
                  "p-3 rounded-lg border",
                  lastSyncResult.ok ? "bg-primary/10 border-primary/30" : "bg-destructive/10 border-destructive/30",
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {lastSyncResult.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span
                      className={cn("text-sm font-medium", lastSyncResult.ok ? "text-primary" : "text-destructive")}
                    >
                      {lastSyncResult.ok ? "SYNC OK (gravou)" : "SYNC ERRO"}
                    </span>
                  </div>

                </div>

                {lastSyncResult.ok ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t("sync.fetched")}:</span>
                      <span className="ml-1 font-medium">
                        {formatNumber((lastSyncResult as any).fetched_count || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("sync.inserted")}:</span>
                      <span className="ml-1 font-medium text-primary">
                        +{formatNumber((lastSyncResult as any).inserted_count || 0)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Deletou (real):</span>
                      <span className="ml-1 font-medium text-destructive">
                        -{formatNumber((lastSyncResult as any).deleted_rows_in_period || 0)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Δ real:</span>
                      <span className="ml-1">{renderDelta((lastSyncResult as any).net_change_in_period)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-destructive whitespace-pre-wrap">{(lastSyncResult as any).error}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Update Dimensoes Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t("sync.updateDimensoes")}</CardTitle>
                <CardDescription>{t("sync.updateDimensoesDesc")}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("sync.updateDimensoesInfo")}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  <Users className="h-3 w-3 mr-1" />
                  {t("sync.dimensoes.clientes")}
                </Badge>
                <Badge variant="secondary">
                  <UserCheck className="h-3 w-3 mr-1" />
                  {t("sync.dimensoes.colaboradores")}
                </Badge>
                <Badge variant="secondary">
                  <Package className="h-3 w-3 mr-1" />
                  {t("sync.dimensoes.produtos")}
                </Badge>
              </div>
            </div>

            <Button
              onClick={handleUpdateDimensoes}
              disabled={dimensoesLoading || !canRun}
              className="w-full"
              variant="secondary"
            >
              {dimensoesLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("sync.updating")}
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  {t("sync.updateNow")}
                </>
              )}
            </Button>

            {lastDimensoesResult && (
              <div
                className={cn(
                  "p-3 rounded-lg border",
                  (lastDimensoesResult as any).ok
                    ? "bg-primary/10 border-primary/30"
                    : "bg-destructive/10 border-destructive/30",
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {(lastDimensoesResult as any).ok ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-medium",
                      (lastDimensoesResult as any).ok ? "text-primary" : "text-destructive",
                    )}
                  >
                    {(lastDimensoesResult as any).ok ? "DIM OK" : "DIM ERRO"}
                  </span>
                </div>

                {(lastDimensoesResult as any).ok && (lastDimensoesResult as any).stats ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span>{t("sync.dimensoes.clientes")}:</span>
                      <span className="font-medium">
                        {formatNumber((lastDimensoesResult as any).stats.clientes.after)}
                      </span>
                      {(lastDimensoesResult as any).stats.clientes.added > 0 && (
                        <Badge variant="outline" className="text-primary border-primary/30">
                          +{(lastDimensoesResult as any).stats.clientes.added}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <UserCheck className="h-3 w-3 text-muted-foreground" />
                      <span>{t("sync.dimensoes.colaboradores")}:</span>
                      <span className="font-medium">
                        {formatNumber((lastDimensoesResult as any).stats.colaboradores.after)}
                      </span>
                      {(lastDimensoesResult as any).stats.colaboradores.added > 0 && (
                        <Badge variant="outline" className="text-primary border-primary/30">
                          +{(lastDimensoesResult as any).stats.colaboradores.added}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <span>{t("sync.dimensoes.produtos")}:</span>
                      <span className="font-medium">
                        {formatNumber((lastDimensoesResult as any).stats.produtos.after)}
                      </span>
                      {(lastDimensoesResult as any).stats.produtos.added > 0 && (
                        <Badge variant="outline" className="text-primary border-primary/30">
                          +{(lastDimensoesResult as any).stats.produtos.added}
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (lastDimensoesResult as any).error ? (
                  <p className="text-sm text-destructive whitespace-pre-wrap">{(lastDimensoesResult as any).error}</p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t("sync.currentStats")}</CardTitle>
                <CardDescription>{t("sync.currentStatsDesc")}</CardDescription>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={fetchStats} disabled={statsLoading}>
              <RefreshCw className={cn("h-4 w-4", statsLoading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold text-foreground">
                {statsLoading ? <Skeleton className="h-8 w-20 mx-auto" /> : formatNumber(stats?.vendas_raw || 0)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{t("sync.stats.vendas")}</div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold text-foreground">
                {statsLoading ? <Skeleton className="h-8 w-20 mx-auto" /> : formatNumber(stats?.clientes || 0)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{t("sync.stats.clientes")}</div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold text-foreground">
                {statsLoading ? <Skeleton className="h-8 w-20 mx-auto" /> : formatNumber(stats?.colaboradores || 0)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{t("sync.stats.colaboradores")}</div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold text-foreground">
                {statsLoading ? <Skeleton className="h-8 w-20 mx-auto" /> : formatNumber(stats?.produtos || 0)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{t("sync.stats.produtos")}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="outline">1</Badge>
              <span>{t("sync.workflow.step1")}</span>
            </div>
            <ArrowRight className="h-4 w-4 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Badge variant="outline">2</Badge>
              <span>{t("sync.workflow.step2")}</span>
            </div>
            <ArrowRight className="h-4 w-4 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Badge variant="outline">3</Badge>
              <span>{t("sync.workflow.step3")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AtualizarDados;

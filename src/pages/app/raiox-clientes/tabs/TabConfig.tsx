import React, { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HelpBox, BaseBadge, BaseSelector } from '@/components/raiox-shared';
import { Save, RotateCcw, Loader2, Zap, Activity, Users, TrendingDown, RefreshCw, Database, BookOpen, AlertTriangle, CheckCircle, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useRaioxClientesConfig } from '@/hooks/raiox-clientes/useRaioxClientesConfig';
import { InfoIconTooltip } from '@/components/help/InfoIconTooltip';
import type { RaioxClientesConfigJson } from '@/pages/app/raiox-clientes/config/defaultConfig';
import type { RaioxConfigInstance } from '@/pages/app/raiox-clientes/RaioXClientesTabs';

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function FieldRow({
  label, sublabel, impact, example, info, children,
}: {
  label: string;
  sublabel?: string;
  impact?: string;
  example?: string;
  info?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="group py-2.5 px-2.5 -mx-2.5 rounded-lg border-b border-border/20 last:border-0 hover:bg-white/[0.03] hover:border-border/40 transition-all duration-150">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
        <div className="sm:w-52 shrink-0 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
            {info}
          </div>
          {sublabel && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{sublabel}</p>}
        </div>
        <div className="flex-1 min-w-0">
          {children}
          {impact && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider shrink-0">efeito:</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium bg-primary/8 border border-primary/20 rounded-md px-2 py-0.5 leading-tight">
                {impact}
              </span>
            </div>
          )}
          {example && (
            <p className="text-[9px] text-muted-foreground/55 mt-1 italic leading-relaxed">{example}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NumInput({
  value, onChange, min, max, step, className,
}: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; className?: string;
}) {
  return (
    <Input
      type="number" min={min} max={max} step={step ?? 1}
      className={className ?? 'w-24 h-8 text-xs'}
      value={value}
      onChange={(e) => {
        const v = (step && step < 1) ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
        if (!isNaN(v)) onChange(v);
      }}
    />
  );
}

function SectionSummary({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[10px] text-muted-foreground space-y-0.5">
      {children}
    </div>
  );
}

function ExampleBox({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground mt-2">
      {title && <p className="font-semibold text-foreground mb-1">{title}</p>}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BASES PANEL — Explicação central das 4 bases usadas
// ─────────────────────────────────────────────────────────────────────────────

function BasesExplicadasPanel({ config }: { config: RaioxClientesConfigJson }) {
  const meses = config.status12m_meses ?? 12;
  const janela = config.janela_dias_padrao ?? 60;

  const bases = [
    {
      type: 'P' as const,
      nome: 'Base Principal',
      cor: 'border-blue-500/30 bg-blue-500/8',
      corTexto: 'text-blue-400',
      descricao: 'O universo principal da análise. Definido na seção 2 pela combinação de período, janela e corte temporal.',
      quando: 'Perfis, cadência, métricas de aquisição e carteira geral.',
      exemplo: config.base_mode === 'TOTAL_COM_CORTE'
        ? `Todos com atividade nos últimos ${config.base_corte_meses}m`
        : config.base_mode === 'JANELA'
        ? `Clientes com visita nos últimos ${janela} dias`
        : config.base_mode === 'PERIODO_FILTRADO'
        ? 'Clientes com visita no período selecionado'
        : 'Toda a base histórica sem filtro de tempo',
    },
    {
      type: 'S' as const,
      nome: `Status ${meses}m`,
      cor: 'border-amber-500/30 bg-amber-500/8',
      corTexto: 'text-amber-400',
      descricao: `Clientes com pelo menos 1 visita nos últimos ${meses} meses. Usada por padrão para distribuições de saúde.`,
      quando: 'Distribuições "Saudável/Em risco/Perdido", classificações de Status.',
      exemplo: `Todos que vieram pelo menos 1x em ${meses} meses a partir da REF.`,
    },
    {
      type: 'T' as const,
      nome: 'Total Histórico',
      cor: 'border-emerald-500/30 bg-emerald-500/8',
      corTexto: 'text-emerald-400',
      descricao: 'Toda a base de clientes sem filtro de tempo. Inclui clientes inativos há anos.',
      quando: 'Análises de base completa, comparações históricas.',
      exemplo: 'Todos os clientes já cadastrados, independente de quando vieram.',
    },
    {
      type: 'J' as const,
      nome: `Janela ${janela}d`,
      cor: 'border-violet-500/30 bg-violet-500/8',
      corTexto: 'text-violet-400',
      descricao: `Apenas clientes com visita nos últimos ${janela} dias a partir da REF. A janela mais restritiva.`,
      quando: 'Análise do fluxo ativo recente.',
      exemplo: `Apenas quem veio nos últimos ${janela} dias — quem está "vivo" agora.`,
    },
  ];

  return (
    <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/50 to-muted/10 backdrop-blur-sm overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-border/30 bg-muted/10">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <Database className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Bases — Universos de Análise</p>
            <p className="text-[9px] text-muted-foreground">Cada métrica pode usar um universo diferente de clientes</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          Escolher a base certa muda drasticamente percentuais e significado. O <strong className="text-foreground">total da barbearia</strong> nunca é a soma das bases por barbeiro.
        </p>
      </div>
      <div className="p-3 sm:p-4 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {bases.map((b) => (
            <div key={b.type} className={`rounded-xl border p-3 relative overflow-hidden ${b.cor}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <BaseBadge type={b.type} meses={meses} dias={janela} />
                <span className={`text-xs font-semibold ${b.corTexto}`}>{b.nome}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{b.descricao}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1 italic">{b.exemplo}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                <span className="font-medium text-foreground/80">Usado em:</span> {b.quando}
              </p>
            </div>
          ))}
        </div>

        {/* Base Período — usada no Routing */}
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/8 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <BaseBadge type="P" />
            <span className="text-xs font-semibold text-blue-300">Base Período / Principal</span>
            <span className="text-[9px] text-muted-foreground ml-1">— usada na aba Routing</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Clientes que tiveram <strong className="text-foreground/80">pelo menos 1 visita no período selecionado no cabeçalho</strong> (início → fim). O universo é exatamente o que aconteceu no filtro — sem lookback extra.
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1 italic">
            Ex: filtro Jan–Fev 2026 → somente quem veio em Jan ou Fev. Clientes ativos só em Dez ficam de fora.
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            <span className="font-medium text-foreground/80">Usado em:</span> Aba Routing — segmentação de carteira por barbeiro dentro do período selecionado.
          </p>
        </div>

        <p className="text-[9px] text-muted-foreground/50 text-center">
          Quanto maior a base, menores os percentuais. Compare sempre dentro da mesma base.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RATIO SIMULATOR
// ─────────────────────────────────────────────────────────────────────────────

function RatioSimulator({ config }: { config: RaioxClientesConfigJson }) {
  const [exemploCadencia, setExemploCadencia] = useState(30);

  const slots = [
    {
      label: config.cadencia_individual_labels?.assiduo ?? 'Assíduo',
      maxRatio: config.ratio_muito_frequente_max,
      prevRatio: 0,
      cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    },
    {
      label: config.cadencia_individual_labels?.regular ?? 'Regular',
      maxRatio: config.ratio_regular_max,
      prevRatio: config.ratio_muito_frequente_max,
      cor: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
    },
    {
      label: config.cadencia_individual_labels?.espacando ?? 'Espaçando',
      maxRatio: config.ratio_espacando_max,
      prevRatio: config.ratio_regular_max,
      cor: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
    },
    {
      label: config.cadencia_individual_labels?.em_risco ?? 'Em Risco',
      maxRatio: config.ratio_risco_max,
      prevRatio: config.ratio_espacando_max,
      cor: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
    },
    {
      label: config.cadencia_individual_labels?.perdido ?? 'Perdido',
      maxRatio: null,
      prevRatio: config.ratio_risco_max,
      cor: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
    },
  ];

  return (
    <div className="rounded-lg border border-border/40 bg-muted/15 p-3 space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Zap className="h-3 w-3 text-primary shrink-0" />
        <span className="text-[10px] text-muted-foreground">Simular: cliente vem a cada</span>
        <NumInput value={exemploCadencia} onChange={setExemploCadencia} min={1} max={365} className="w-16 h-7 text-xs" />
        <span className="text-[10px] text-muted-foreground">dias</span>
        <span className="text-[10px] text-muted-foreground/60 ml-1">— clique num status para ver o intervalo equivalente</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {slots.map((s, i) => {
          const minDias = i === 0 ? 0 : Math.floor(s.prevRatio * exemploCadencia) + 1;
          const maxDias = s.maxRatio != null ? Math.floor(s.maxRatio * exemploCadencia) : null;
          const range = i === 0 ? `≤ ${maxDias}d` : maxDias != null ? `${minDias}–${maxDias}d` : `> ${minDias - 1}d`;
          return (
            <div key={s.label} className={`rounded-md border px-2 py-2 text-center ${s.cor}`}>
              <p className="text-[9px] font-semibold uppercase tracking-wide mb-0.5">{s.label}</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{range}</p>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-muted-foreground leading-relaxed">
        <strong>Como funciona:</strong> Ratio = dias sem vir ÷ cadência habitual do cliente. Se ratio ≤ {config.ratio_muito_frequente_max} → {slots[0].label}. Se {'>'} {config.ratio_risco_max} → {slots[4].label}. Para um cliente com cadência de {exemploCadencia}d, ultrapassar {Math.floor(config.ratio_risco_max * exemploCadencia)} dias sem vir já o classifica como {slots[4].label}.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATIONS
// ─────────────────────────────────────────────────────────────────────────────

// Erros: bloqueiam o salvamento (ordenações invertidas dentro da mesma categoria)
function getValidationErrors(config: RaioxClientesConfigJson): string[] {
  const e: string[] = [];
  if (config.risco_min_dias >= config.risco_max_dias)
    e.push('[Status] "Saudável até" deve ser menor que "Em Risco até".');
  if (config.risco_max_dias > config.churn_dias_sem_voltar)
    e.push('[Status] "Em Risco até" deve ser ≤ "Perdido a partir de".');
  if (config.perfil_fiel_max_dias >= config.perfil_recorrente_max_dias)
    e.push('[Perfil] Recência máx do Fiel deve ser < Recorrente.');
  if (config.perfil_recorrente_max_dias >= config.perfil_regular_max_dias)
    e.push('[Perfil] Recência máx do Recorrente deve ser < Regular.');
  if (config.perfil_fiel_min_visitas <= config.perfil_recorrente_min_visitas)
    e.push('[Perfil] Mín visitas do Fiel deve ser > Recorrente.');
  if (config.one_shot_aguardando_max_dias >= config.one_shot_risco_max_dias)
    e.push('[One-shot] "Aguardando até" deve ser < "Em Risco até".');
  if (config.ratio_muito_frequente_max >= config.ratio_regular_max)
    e.push('[Cadência] Ratio do Assíduo deve ser < ratio do Regular.');
  if (config.ratio_regular_max >= config.ratio_espacando_max)
    e.push('[Cadência] Ratio do Regular deve ser < Espaçando.');
  if (config.ratio_espacando_max >= config.ratio_risco_max)
    e.push('[Cadência] Ratio do Espaçando deve ser < Em Risco.');
  return e;
}

// Avisos: apenas informativos — NÃO bloqueiam o salvamento
function getValidationWarnings(config: RaioxClientesConfigJson): string[] {
  const w: string[] = [];
  if (config.one_shot_aguardando_max_dias >= config.risco_min_dias)
    w.push('One-shot "Aguardando" sobrepõe a faixa saudável do Status. Clientes one-shot podem aparecer como saudáveis em algumas análises. Considere alinhar os valores se quiser consistência total.');
  if (config.perfil_regular_max_dias > config.churn_dias_sem_voltar)
    w.push('Perfil "Regular" permite mais dias de recência do que o limiar de Perdido. Um cliente pode ter perfil Regular mas status Perdido. Considere alinhar os valores.');
  return w;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function TabConfig({ raioxConfig: externalConfig }: { raioxConfig?: RaioxConfigInstance } = {}) {
  const internalConfig = useRaioxClientesConfig();
  const { config, loading, saving, updatedAt, updateField, saveConfig, restoreDefaults } = externalConfig ?? internalConfig;

  const u = <K extends keyof RaioxClientesConfigJson>(key: K) => (v: RaioxClientesConfigJson[K]) => updateField(key, v);

  const [introOpen, setIntroOpen] = useState(true);
  const [basesOpen, setBasesOpen] = useState(false);

  const lastUpdate = updatedAt
    ? new Date(updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
    : 'nunca salvo';

  const meses = config.status12m_meses ?? 12;
  const janela = config.janela_dias_padrao ?? 60;
  const errors = getValidationErrors(config);
  const warnings = getValidationWarnings(config);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando configuração...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 min-w-0 overflow-hidden pb-40 sm:pb-6">

      {/* ── INTRO (colapsável) ── */}
      <Collapsible open={introOpen} onOpenChange={setIntroOpen}>
        <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/60 to-muted/20 backdrop-blur-sm overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent pointer-events-none" />
          <CollapsibleTrigger asChild>
            <button type="button" className="relative w-full flex items-center gap-3 p-3 sm:p-4 hover:bg-white/[0.02] transition-colors text-left">
              <div className="h-8 w-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-foreground">Configuração do RaioX</h2>
                <p className="text-[10px] text-muted-foreground">Regras e universos · clique para {introOpen ? 'recolher' : 'expandir'}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${introOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="relative px-3 sm:px-4 pb-4 space-y-3 border-t border-border/20">
              <p className="text-[10px] text-muted-foreground leading-relaxed pt-3">
                Alterações refletem em <strong className="text-foreground">todas as abas</strong> do RaioX após salvar. Configure na ordem — cada seção depende das anteriores.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {[
                  { num: '1', label: 'REF', sub: 'Data âncora', color: 'bg-indigo-500/15 border-indigo-500/25 text-indigo-400' },
                  { num: '2', label: 'Base', sub: 'Universo principal', color: 'bg-blue-500/15 border-blue-500/25 text-blue-400' },
                  { num: '3', label: 'Perfil', sub: 'Volume + recência', color: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' },
                  { num: '4', label: 'Cadência', sub: 'Ritmo individual', color: 'bg-amber-500/15 border-amber-500/25 text-amber-400' },
                  { num: '5', label: 'Status', sub: 'Saúde simples', color: 'bg-orange-500/15 border-orange-500/25 text-orange-400' },
                  { num: '6', label: 'One-shot', sub: '1ª visita única', color: 'bg-violet-500/15 border-violet-500/25 text-violet-400' },
                  { num: '7', label: 'Resgate', sub: 'Recuperação', color: 'bg-teal-500/15 border-teal-500/25 text-teal-400' },
                  { num: '8', label: 'Churn', sub: 'Perda definitiva', color: 'bg-rose-500/15 border-rose-500/25 text-rose-400' },
                  { num: '9', label: 'Routing', sub: 'Carteira por barb.', color: 'bg-blue-400/15 border-blue-400/25 text-blue-300' },
                ].map((s) => (
                  <div key={s.num} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${s.color}`}>
                    <span className="text-[11px] font-bold shrink-0">{s.num}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-foreground truncate">{s.label}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{s.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* ── BASES EXPLICADAS (colapsável) ── */}
      <Collapsible open={basesOpen} onOpenChange={setBasesOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors text-left">
            <Database className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground flex-1">Bases — Universos de Análise</span>
            <span className="text-[10px] text-muted-foreground">{basesOpen ? 'Recolher' : 'Expandir para entender P / S / T / J'}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${basesOpen ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <BasesExplicadasPanel config={config} />
        </CollapsibleContent>
      </Collapsible>

      {/* ── ERROS DE VALIDAÇÃO (bloqueiam salvamento) ── */}
      {errors.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              <p className="text-xs font-semibold text-rose-400">{errors.length} erro{errors.length > 1 ? 's' : ''} — corrija para salvar</p>
            </div>
            <ul className="space-y-0.5">
              {errors.map((e, i) => (
                <li key={i} className="text-[10px] text-rose-300/90 flex items-start gap-1.5">
                  <span className="shrink-0">✕</span>{e}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── AVISOS DE VALIDAÇÃO (só informativos — não bloqueiam) ── */}
      {warnings.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <p className="text-xs font-semibold text-amber-400">{warnings.length} aviso{warnings.length > 1 ? 's' : ''} — você pode salvar mesmo assim</p>
            </div>
            <ul className="space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i} className="text-[10px] text-amber-300/90 flex items-start gap-1.5">
                  <span className="shrink-0">!</span>{w}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-amber-400/60">Estes avisos indicam inconsistências entre seções. O sistema funciona, mas os valores podem se sobrepor em algumas análises.</p>
          </CardContent>
        </Card>
      )}

      <Accordion type="multiple" defaultValue={['ref', 'base', 'perfil', 'cadencia', 'status12m', 'oneshot']} className="space-y-2">

        {/* ══════════════════════════════════════════════════════════
            1. REF — Data de referência
        ══════════════════════════════════════════════════════════ */}
        <AccordionItem value="ref" className="border border-border/40 border-l-[3px] border-l-indigo-500/60 rounded-xl px-3 sm:px-4 bg-card/30">
          <AccordionTrigger className="text-xs sm:text-sm font-semibold py-3 hover:no-underline">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
              <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
              Referência — REF
              <InfoIconTooltip
                title="REF — Data de Referência"
                short="A data âncora de toda a análise."
                details={
                  <><p>Todos os cálculos de "dias sem vir" são contados a partir desta data. Ela define o <strong>momento da fotografia</strong> — qual era o status de cada cliente naquele instante.</p>
                  <p className="mt-1"><strong>Fim do filtro:</strong> Último dia do período selecionado no cabeçalho. Ideal para analisar como a base estava em um momento passado.</p>
                  <p className="mt-1"><strong>Hoje:</strong> A data atual. Ideal para monitoramento em tempo real.</p></>
                }
              />
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-[10px] text-muted-foreground leading-relaxed space-y-1">
              <p><strong className="text-foreground">O que é a REF?</strong> É a data-âncora que "congela" a análise. "Dias sem vir" = diferença entre a REF e a última visita do cliente. Um cliente com última visita em 01/Jan, sendo a REF 01/Fev, tem 31 dias sem vir — independente de hoje ser 01/Mar.</p>
              <p className="text-amber-400/80"><strong>Recomendação:</strong> Use "Fim do filtro" para análises históricas comparativas. Use "Hoje" só se quiser sempre ver o estado atual.</p>
            </div>

            <FieldRow
              label="Data de referência"
              sublabel="Define o marco zero de tempo para todos os cálculos"
            >
              <RadioGroup value={config.ref_mode} onValueChange={(v) => updateField('ref_mode', v as any)} className="flex flex-col gap-2.5">
                <label className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${config.ref_mode === 'FIM_FILTRO' ? 'border-primary/50 bg-primary/5' : 'border-border/40 hover:bg-muted/20'}`}>
                  <RadioGroupItem value="FIM_FILTRO" className="mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Fim do filtro <span className="text-[10px] text-primary font-normal ml-1">(padrão recomendado)</span></p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">REF = último dia do período selecionado no cabeçalho da página. Permite analisar como a base estava em qualquer momento histórico.</p>
                  </div>
                </label>
                <label className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${config.ref_mode === 'HOJE' ? 'border-primary/50 bg-primary/5' : 'border-border/40 hover:bg-muted/20'}`}>
                  <RadioGroupItem value="HOJE" className="mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Hoje</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">REF = data atual. Os números mudam a cada dia. Útil para monitoramento do estado presente da base, mas não permite comparações históricas precisas.</p>
                  </div>
                </label>
              </RadioGroup>
            </FieldRow>

            <FieldRow
              label="Janela padrão (dias)"
              sublabel="Quantos dias são considerados para definir um cliente como 'ativo'"
              impact={`Ativos na Visão Geral = clientes com visita nos últimos ${janela} dias`}
              example={`Ex: com ${janela}d, quem veio há ${janela + 1} dias NÃO é contado como ativo`}
              info={
                <InfoIconTooltip
                  title="Janela padrão"
                  short="Define o tamanho da 'janela ativa' para KPI de Ativos."
                  details={
                    <><p>Este valor é o <strong>pré-set</strong> da janela no filtro do cabeçalho. O usuário pode mudar a qualquer momento no filtro, mas este valor é o ponto de partida.</p>
                    <p className="mt-1">Regra: use o intervalo médio de visitas da barbearia × 1.5 a 2x. Barbearia com clientes mensais → 45–60d.</p></>
                  }
                />
              }
            >
              <div className="flex items-center gap-2 flex-wrap">
                <NumInput value={janela} onChange={u('janela_dias_padrao')} min={1} max={365} />
                <span className="text-[10px] text-muted-foreground">dias</span>
                <div className="flex gap-1">
                  {[30, 45, 60, 90, 120].map((d) => (
                    <button
                      key={d}
                      onClick={() => updateField('janela_dias_padrao', d)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${janela === d ? 'bg-primary/20 border-primary/50 text-primary font-semibold' : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'}`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            </FieldRow>

            <FieldRow
              label="Atualização automática"
              sublabel="Refaz as consultas automaticamente a cada intervalo de tempo"
              impact="Quando ativo, os dados são atualizados periodicamente sem precisar clicar em Atualizar"
              example="Útil em painéis de monitoramento em tempo real. Desative se preferir controle manual."
              info={
                <InfoIconTooltip
                  title="Auto-atualização"
                  short="Recarrega os dados automaticamente em segundo plano."
                  details={
                    <><p>Quando ativo, o sistema dispara um refetch em todos os hooks do RaioX a cada intervalo configurado (padrão: 5 minutos).</p>
                    <p className="mt-1">Desative se a conexão for lenta ou se preferir controlar manualmente via botão Atualizar no cabeçalho.</p></>
                  }
                />
              }
            >
              <div className="flex items-center gap-2">
                <Switch checked={config.auto_refetch} onCheckedChange={u('auto_refetch')} />
                <span className="text-[10px] text-muted-foreground">{config.auto_refetch ? 'Ativo — atualiza automaticamente' : 'Inativo — apenas manual'}</span>
              </div>
            </FieldRow>
          </AccordionContent>
        </AccordionItem>

        {/* ══════════════════════════════════════════════════════════
            2. BASE PRINCIPAL
        ══════════════════════════════════════════════════════════ */}
        <AccordionItem value="base" className="border border-border/40 border-l-[3px] border-l-blue-500/60 rounded-xl px-3 sm:px-4 bg-card/30">
          <AccordionTrigger className="text-xs sm:text-sm font-semibold py-3 hover:no-underline">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
              <Database className="h-3.5 w-3.5 text-blue-400" />
              Base Principal <BaseBadge type="P" />
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-[10px] text-muted-foreground leading-relaxed space-y-1">
              <p><strong className="text-foreground">O que é a Base Principal?</strong> É o universo de clientes que entra nos cálculos de Perfil, Cadência e nos KPIs principais da Visão Geral. Pense nela como a "população" da sua análise.</p>
              <p>Cada modo define quem entra nesse universo. A escolha impacta diretamente <strong>todos os percentuais e contagens</strong> das análises.</p>
              <p className="text-amber-400/80"><strong>Recomendação:</strong> "Total com corte" de 24m mantém o histórico relevante sem inflar os números com clientes muito antigos.</p>
            </div>

            <FieldRow
              label="Modo da Base Principal"
              sublabel="Define quais clientes compõem o universo de análise"
            >
              <RadioGroup value={config.base_mode} onValueChange={(v) => updateField('base_mode', v as any)} className="flex flex-col gap-2">
                {([
                  {
                    value: 'TOTAL_COM_CORTE' as const,
                    label: 'Total com corte (recomendado)',
                    desc: `Todos com pelo menos 1 visita nos últimos N meses. Equilibra completude com relevância. Atualmente: ${config.base_corte_meses}m.`,
                  },
                  {
                    value: 'JANELA' as const,
                    label: `Janela (${janela} dias)`,
                    desc: `Apenas quem visitou nos últimos ${janela} dias da REF. Universo mais restrito — foco no fluxo ativo recente.`,
                  },
                  {
                    value: 'PERIODO_FILTRADO' as const,
                    label: 'Período filtrado',
                    desc: 'Apenas clientes com visita no período selecionado no cabeçalho. Útil para analisar "quem veio nesse mês".',
                  },
                  {
                    value: 'TOTAL' as const,
                    label: 'Total histórico (sem corte)',
                    desc: 'Toda a base de clientes sem filtro de tempo. Inclui clientes inativos há anos — percentuais ficam menores.',
                  },
                ]).map((m) => (
                  <label key={m.value} className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${config.base_mode === m.value ? 'border-primary/50 bg-primary/5' : 'border-border/40 hover:bg-muted/20'}`}>
                    <RadioGroupItem value={m.value} className="mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-foreground">{m.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </FieldRow>

            {config.base_mode === 'TOTAL_COM_CORTE' && (
              <FieldRow
                label="Corte temporal (meses)"
                sublabel="Clientes sem visita além desse prazo são excluídos da base principal"
                impact={`Base inclui quem veio pelo menos 1x nos últimos ${config.base_corte_meses} meses`}
                example="Ex: 24m exclui clientes que não vieram desde 2 anos atrás"
              >
                <div className="flex items-center gap-2">
                  <NumInput value={config.base_corte_meses} onChange={u('base_corte_meses')} min={1} max={120} />
                  <span className="text-[10px] text-muted-foreground">meses</span>
                </div>
              </FieldRow>
            )}

            <FieldRow
              label="Excluir registros sem nome"
              sublabel="Remove vendas sem cliente identificado pelo nome"
              impact="Reduz ruído nas análises — registros sem nome provavelmente são passantes ou erros de cadastro"
            >
              <Switch checked={config.excluir_sem_cadastro} onCheckedChange={u('excluir_sem_cadastro')} />
            </FieldRow>

            <FieldRow
              label="Excluir sem cliente_id"
              sublabel="Remove vendas sem identificador único de cliente"
              impact="O Diagnóstico ainda contabiliza esses registros como alertas de qualidade de dados"
            >
              <Switch checked={config.excluir_sem_cliente_id} onCheckedChange={u('excluir_sem_cliente_id')} />
            </FieldRow>
          </AccordionContent>
        </AccordionItem>

        {/* ══════════════════════════════════════════════════════════
            3. PERFIL
        ══════════════════════════════════════════════════════════ */}
        <AccordionItem value="perfil" className="border border-border/40 border-l-[3px] border-l-emerald-500/60 rounded-xl px-3 sm:px-4 bg-card/30">
          <AccordionTrigger className="text-xs sm:text-sm font-semibold py-3 hover:no-underline">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              Perfil do Cliente
              <BaseBadge type={(config as any).base_perfil ?? 'S'} meses={meses} />
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-[10px] text-muted-foreground leading-relaxed space-y-1.5">
              <p><strong className="text-foreground">O que é o Perfil?</strong> É o "retrato" do relacionamento do cliente com a barbearia na data REF. Combina <strong>volume total de visitas históricas</strong> (frequência) com <strong>recência</strong> (dias desde a última visita).</p>
              <p><strong className="text-foreground">Lógica de cascata:</strong> O sistema testa da categoria mais alta para a mais baixa. Se o cliente tem 12+ visitas E ≤{config.perfil_fiel_max_dias} dias sem vir → Fiel. Se não, testa Recorrente. E assim por diante.</p>
              <p><strong className="text-foreground">Inativo:</strong> Cliente que atingiu o volume mínimo da categoria mas ultrapassou o limite de recência. Ex: tem 15 visitas (Fiel), mas foi há 60 dias → Inativo (pois Fiel exige ≤{config.perfil_fiel_max_dias}d).</p>
            </div>

            {/* Resumo das faixas atuais */}
            <SectionSummary>
              <p className="font-semibold text-foreground mb-1.5">Com a configuração atual:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                <p><span className="text-emerald-400 font-medium">Fiel:</span> ≥{config.perfil_fiel_min_visitas} visitas E ≤{config.perfil_fiel_max_dias}d</p>
                <p><span className="text-blue-400 font-medium">Recorrente:</span> ≥{config.perfil_recorrente_min_visitas} visitas E ≤{config.perfil_recorrente_max_dias}d</p>
                <p><span className="text-cyan-400 font-medium">Regular:</span> ≥{config.perfil_regular_min_visitas} visitas E ≤{config.perfil_regular_max_dias}d</p>
                <p><span className="text-slate-400 font-medium">Ocasional:</span> ≥{config.perfil_ocasional_min_visitas} visitas (sem limite de dias)</p>
                <p><span className="text-violet-400 font-medium">One-shot:</span> exatamente 1 visita</p>
                <p><span className="text-rose-400 font-medium">Inativo:</span> volume suficiente, mas recência ultrapassada</p>
              </div>
            </SectionSummary>

            <FieldRow label="Base de cálculo do Perfil" sublabel="Sobre qual universo o perfil é calculado">
              <div className="space-y-1">
                <BaseSelector value={(config as any).base_perfil ?? 'S'} onChange={(v) => updateField('base_perfil' as any, v)} meses={meses} dias={janela} />
                <p className="text-[9px] text-muted-foreground">Recomendado: <strong>S</strong> (Status {meses}m) — inclui toda base ativa recente, excluindo clientes muito antigos.</p>
              </div>
            </FieldRow>

            {/* Volume */}
            <div className="pt-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="h-px flex-1 bg-border/40" />Volume total de visitas históricas<span className="h-px flex-1 bg-border/40" />
              </p>
              <p className="text-[10px] text-muted-foreground mb-2">Número mínimo de visitas no histórico completo do cliente (independente do período filtrado).</p>
            </div>

            <FieldRow
              label="Fiel: mínimo de visitas"
              sublabel="Cliente altamente engajado, visita com alta frequência"
              impact={`≥ ${config.perfil_fiel_min_visitas} visitas + ≤${config.perfil_fiel_max_dias}d sem vir → Fiel`}
              example="Ex: 12 visitas ao ano = 1x/mês — cliente fidelizado"
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.perfil_fiel_min_visitas} onChange={u('perfil_fiel_min_visitas')} min={1} />
                <span className="text-[10px] text-muted-foreground">visitas no histórico</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Recorrente: mínimo de visitas"
              sublabel="Cliente que volta com regularidade, mas menos que o Fiel"
              impact={`≥ ${config.perfil_recorrente_min_visitas} visitas + ≤${config.perfil_recorrente_max_dias}d → Recorrente`}
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.perfil_recorrente_min_visitas} onChange={u('perfil_recorrente_min_visitas')} min={1} />
                <span className="text-[10px] text-muted-foreground">visitas no histórico</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Regular: mínimo de visitas"
              sublabel="Cliente com histórico básico, ainda construindo o hábito"
              impact={`≥ ${config.perfil_regular_min_visitas} visitas + ≤${config.perfil_regular_max_dias}d → Regular`}
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.perfil_regular_min_visitas} onChange={u('perfil_regular_min_visitas')} min={1} />
                <span className="text-[10px] text-muted-foreground">visitas no histórico</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Ocasional: mínimo de visitas"
              sublabel="Veio mais de uma vez, mas ainda sem padrão estabelecido"
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.perfil_ocasional_min_visitas} onChange={u('perfil_ocasional_min_visitas')} min={1} />
                <span className="text-[10px] text-muted-foreground">visitas no histórico</span>
              </div>
            </FieldRow>

            {/* Recência */}
            <div className="pt-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="h-px flex-1 bg-border/40" />Recência máxima para manter o perfil<span className="h-px flex-1 bg-border/40" />
              </p>
              <p className="text-[10px] text-muted-foreground mb-2">Se o cliente ultrapassar esse limite de dias sem vir, ele é rebaixado para <strong>Inativo</strong>, independente do volume de visitas.</p>
            </div>

            <FieldRow
              label="Fiel: máximo de dias sem vir"
              sublabel="Fiel que demorou mais que isso → Inativo"
              impact={`Fiel exige última visita ≤ ${config.perfil_fiel_max_dias} dias atrás`}
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.perfil_fiel_max_dias} onChange={u('perfil_fiel_max_dias')} min={1} />
                <span className="text-[10px] text-muted-foreground">dias</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Recorrente: máximo de dias sem vir"
              sublabel="Recorrente que demorou mais que isso → Inativo"
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.perfil_recorrente_max_dias} onChange={u('perfil_recorrente_max_dias')} min={1} />
                <span className="text-[10px] text-muted-foreground">dias</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Regular: máximo de dias sem vir"
              sublabel="Regular que demorou mais que isso → Inativo"
              info={
                <InfoIconTooltip
                  title="Regular máx dias"
                  short="Atenção: se este valor for maior que 'Perdido', Regulares podem aparecer como Perdidos no Status."
                  details={<p>O perfil Regular permite {config.perfil_regular_max_dias} dias de ausência. Se o Status considera Perdido quem passou de {config.churn_dias_sem_voltar} dias, clientes com {config.churn_dias_sem_voltar + 1}–{config.perfil_regular_max_dias} dias seriam regulares no perfil mas perdidos no Status.</p>}
                />
              }
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.perfil_regular_max_dias} onChange={u('perfil_regular_max_dias')} min={1} />
                <span className="text-[10px] text-muted-foreground">dias</span>
                {config.perfil_regular_max_dias > config.churn_dias_sem_voltar && (
                  <span className="text-[10px] text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> acima do limiar de Perdido
                  </span>
                )}
              </div>
            </FieldRow>
          </AccordionContent>
        </AccordionItem>

        {/* ══════════════════════════════════════════════════════════
            4. CADÊNCIA
        ══════════════════════════════════════════════════════════ */}
        <AccordionItem value="cadencia" className="border border-border/40 border-l-[3px] border-l-amber-500/60 rounded-xl px-3 sm:px-4 bg-card/30">
          <AccordionTrigger className="text-xs sm:text-sm font-semibold py-3 hover:no-underline">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0">4</span>
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              Cadência Individual
              <BaseBadge type={(config as any).base_cadencia ?? 'S'} meses={meses} />
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-[10px] text-muted-foreground leading-relaxed space-y-1.5">
              <p><strong className="text-foreground">Como é calculada a cadência?</strong></p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Busca todas as visitas do cliente nos últimos <strong>{config.cadencia_meses_analise} meses</strong></li>
                <li>Calcula o <strong>intervalo médio</strong> entre visitas (em dias)</li>
                <li>Compara com os dias atuais sem vir: <strong>ratio = dias sem vir ÷ intervalo médio</strong></li>
                <li>Classifica pelo ratio: quanto maior, mais "atrasado" em relação ao próprio ritmo</li>
              </ol>
              <p className="mt-1"><strong className="text-foreground">Atualização:</strong> Calculada em tempo real a cada consulta, usando a última visita registrada. Cada nova visita do cliente muda sua cadência automaticamente.</p>
              <p className="text-amber-400/80"><strong>Clientes sem {config.cadencia_min_visitas}+ visitas</strong> não têm cadência calculável → classificados como "Primeira vez" (one-shot).</p>
            </div>

            <FieldRow label="Base de cálculo" sublabel="Universo dos clientes analisados na cadência">
              <div className="space-y-1">
                <BaseSelector value={(config as any).base_cadencia ?? 'S'} onChange={(v) => updateField('base_cadencia' as any, v)} meses={meses} dias={janela} />
                <p className="text-[9px] text-muted-foreground">Recomendado: <strong>S</strong> — mesma base do Perfil para comparações consistentes.</p>
              </div>
            </FieldRow>

            <FieldRow
              label="Período de análise (meses)"
              sublabel="Janela histórica para calcular o intervalo médio de visitas"
              impact={`Cadência calculada com visitas dos últimos ${config.cadencia_meses_analise} meses`}
              example="Meses curtos = mais sensível a mudanças recentes. Meses longos = mais estável"
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.cadencia_meses_analise} onChange={u('cadencia_meses_analise')} min={1} max={60} />
                <span className="text-[10px] text-muted-foreground">meses de histórico</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Mínimo de visitas para calcular"
              sublabel="Abaixo desse número → classificado como 'Primeira vez' (one-shot)"
              impact={`Clientes com < ${config.cadencia_min_visitas} visitas ficam em "Primeira vez" — sem cadência calculável`}
              example="Com 2 visitas, há apenas 1 intervalo — muito instável. 3 visitas = 2 intervalos = média mais confiável"
              info={
                <InfoIconTooltip
                  title="Mínimo de visitas"
                  short="Quantas visitas são necessárias para ter uma cadência confiável."
                  details={<><p>Com poucas visitas, o intervalo médio é muito sensível a outliers. Com 3+ visitas há pelo menos 2 intervalos para calcular a média.</p><p className="mt-1">Recomendado: 3. Valores maiores excluem mais clientes do cálculo individual.</p></>}
                />
              }
            >
              <NumInput value={config.cadencia_min_visitas} onChange={u('cadencia_min_visitas')} min={1} />
            </FieldRow>

            {/* Thresholds */}
            <div className="pt-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="h-px flex-1 bg-border/40" />Thresholds de ratio<span className="h-px flex-1 bg-border/40" />
              </p>
              <p className="text-[10px] text-muted-foreground mb-2">Cada threshold é o limite <strong>máximo</strong> do ratio para aquela categoria. Ex: ratio ≤ {config.ratio_muito_frequente_max} → Assíduo. Ratio {config.ratio_muito_frequente_max}–{config.ratio_regular_max} → Regular.</p>
            </div>

            <FieldRow
              label={`${config.cadencia_individual_labels?.assiduo ?? 'Assíduo'} — max ratio`}
              sublabel="Voltando antes ou no exato momento esperado"
              impact={`Ratio ≤ ${config.ratio_muito_frequente_max} → ${config.cadencia_individual_labels?.assiduo ?? 'Assíduo'}`}
              example={`Cliente que vem a cada 30d: Assíduo se volta em ≤ ${Math.floor(config.ratio_muito_frequente_max * 30)} dias`}
            >
              <NumInput value={config.ratio_muito_frequente_max} onChange={u('ratio_muito_frequente_max')} min={0.1} max={5} step={0.05} />
            </FieldRow>

            <FieldRow
              label={`${config.cadencia_individual_labels?.regular ?? 'Regular'} — max ratio`}
              sublabel="Dentro do ritmo normal, pequena variação aceitável"
              impact={`Ratio ${config.ratio_muito_frequente_max}–${config.ratio_regular_max} → ${config.cadencia_individual_labels?.regular ?? 'Regular'}`}
            >
              <NumInput value={config.ratio_regular_max} onChange={u('ratio_regular_max')} min={0.1} max={5} step={0.05} />
            </FieldRow>

            <FieldRow
              label={`${config.cadencia_individual_labels?.espacando ?? 'Espaçando'} — max ratio`}
              sublabel="Demorando mais que o habitual — atenção leve"
              impact={`Ratio ${config.ratio_regular_max}–${config.ratio_espacando_max} → ${config.cadencia_individual_labels?.espacando ?? 'Espaçando'}`}
            >
              <NumInput value={config.ratio_espacando_max} onChange={u('ratio_espacando_max')} min={0.1} max={10} step={0.05} />
            </FieldRow>

            <FieldRow
              label={`${config.cadencia_individual_labels?.em_risco ?? 'Em Risco'} — max ratio`}
              sublabel="Alto risco de abandono — ação urgente recomendada"
              impact={`Ratio ${config.ratio_espacando_max}–${config.ratio_risco_max} → ${config.cadencia_individual_labels?.em_risco ?? 'Em Risco'}. Acima disso → ${config.cadencia_individual_labels?.perdido ?? 'Perdido'}`}
            >
              <NumInput value={config.ratio_risco_max} onChange={u('ratio_risco_max')} min={0.1} max={10} step={0.05} />
            </FieldRow>

            {/* Simulador */}
            <div className="pt-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="h-px flex-1 bg-border/40" />Simulador — equivalência em dias reais<span className="h-px flex-1 bg-border/40" />
              </p>
            </div>
            <RatioSimulator config={config} />

            {/* Labels personalizáveis */}
            <div className="pt-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span className="h-px flex-1 bg-border/40" />Labels personalizados<span className="h-px flex-1 bg-border/40" />
              </p>
              <p className="text-[10px] text-muted-foreground mb-2">Renomeie as categorias conforme a linguagem da sua barbearia. Só afeta a exibição, não a lógica.</p>
            </div>
            {([
              { key: 'assiduo' as const, ratio: `ratio ≤ ${config.ratio_muito_frequente_max}` },
              { key: 'regular' as const, ratio: `ratio ${config.ratio_muito_frequente_max}–${config.ratio_regular_max}` },
              { key: 'espacando' as const, ratio: `ratio ${config.ratio_regular_max}–${config.ratio_espacando_max}` },
              { key: 'em_risco' as const, ratio: `ratio ${config.ratio_espacando_max}–${config.ratio_risco_max}` },
              { key: 'perdido' as const, ratio: `ratio > ${config.ratio_risco_max}` },
              { key: 'primeira_vez' as const, ratio: '1 visita / sem cadência' },
            ]).map(({ key, ratio }) => {
              const labels = (config as any).cadencia_individual_labels ?? {};
              return (
                <div key={key} className="flex items-center gap-2 py-1.5 border-b border-border/20 last:border-0">
                  <span className="text-[10px] text-muted-foreground w-40 shrink-0">{ratio}</span>
                  <Input
                    className="h-7 text-xs flex-1"
                    value={labels[key] ?? key}
                    onChange={(e) => updateField('cadencia_individual_labels' as any, { ...labels, [key]: e.target.value } as any)}
                  />
                </div>
              );
            })}

            {/* Cadência Fixa */}
            <div className="pt-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span className="h-px flex-1 bg-border/40" />Cadência Fixa — intervalos por dias<span className="h-px flex-1 bg-border/40" />
              </p>
              <p className="text-[10px] text-muted-foreground mb-2">
                Modo alternativo de classificação: separa todos os clientes por faixas fixas de dias, independente do ritmo individual. Os intervalos são fixos; apenas os labels são editáveis aqui. Para mudar os intervalos, ajuste diretamente no banco de dados (Config avançada).
              </p>
            </div>
            {((config as any).cadencia_fixa_faixas ?? []).map((faixa: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 py-1.5 border-b border-border/20 last:border-0">
                <span className="text-[10px] text-muted-foreground w-20 shrink-0 tabular-nums font-mono">{faixa.min}–{faixa.max ?? '∞'}d</span>
                <Input
                  className="h-7 text-xs flex-1"
                  value={faixa.label}
                  onChange={(e) => {
                    const faixas = [...((config as any).cadencia_fixa_faixas ?? [])];
                    faixas[idx] = { ...faixas[idx], label: e.target.value };
                    updateField('cadencia_fixa_faixas' as any, faixas as any);
                  }}
                />
              </div>
            ))}

            {/* Evolução */}
            <div className="pt-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="h-px flex-1 bg-border/40" />Gráfico de evolução<span className="h-px flex-1 bg-border/40" />
              </p>
            </div>
            <FieldRow label="Período do gráfico" sublabel="Quantos meses de histórico mostrar no gráfico de evolução da cadência">
              <Select value={String(config.cadencia_evolution_range_months)} onValueChange={(v) => updateField('cadencia_evolution_range_months', Number(v))}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 6, 12, 24].map((d) => <SelectItem key={d} value={String(d)}>{d} meses</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Granularidade" sublabel="Período de agrupamento das barras no gráfico">
              <Select value={config.cadencia_evolution_grain} onValueChange={(v) => updateField('cadencia_evolution_grain', v as any)}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MENSAL">Mensal</SelectItem>
                  <SelectItem value="SEMANAL">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </AccordionContent>
        </AccordionItem>

        {/* ══════════════════════════════════════════════════════════
            5. STATUS Xm
        ══════════════════════════════════════════════════════════ */}
        <AccordionItem value="status12m" className="border border-border/40 border-l-[3px] border-l-orange-500/60 rounded-xl px-3 sm:px-4 bg-card/30">
          <AccordionTrigger className="text-xs sm:text-sm font-semibold py-3 hover:no-underline">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center shrink-0">5</span>
              <Activity className="h-3.5 w-3.5 text-orange-400" />
              Status {meses}m — Saúde por Recência
              <BaseBadge type={(config as any).base_status12m ?? 'S'} meses={meses} />
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-[10px] text-muted-foreground leading-relaxed space-y-1">
              <p><strong className="text-foreground">O que é o Status?</strong> Classificação simplificada baseada <strong>apenas na recência</strong> (dias desde a última visita), sem considerar histórico ou frequência. É a análise mais rápida para triagem.</p>
              <p><strong className="text-foreground">Diferença do Perfil:</strong> Perfil considera frequência histórica (Fiel, Recorrente...). Status só olha "quando foi a última visita" — mais simples, porém sem contexto do relacionamento.</p>
              <p><strong className="text-foreground">Usado em:</strong> KPIs de "Em risco" e "Perdidos" na Visão Geral, distribuição "Status Xm", e análise de Churn.</p>
            </div>

            {/* Preview faixas */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2.5 text-center">
                <p className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wide">Saudável</p>
                <p className="text-sm font-bold text-foreground tabular-nums">≤ {config.risco_min_dias}d</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Voltou recentemente</p>
              </div>
              <div className="rounded-lg bg-orange-500/10 border border-orange-500/25 px-3 py-2.5 text-center">
                <p className="text-[9px] text-orange-400 font-semibold uppercase tracking-wide">Em Risco</p>
                <p className="text-sm font-bold text-foreground tabular-nums">{config.risco_min_dias + 1}–{config.risco_max_dias}d</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Demorando a voltar</p>
              </div>
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-3 py-2.5 text-center">
                <p className="text-[9px] text-rose-400 font-semibold uppercase tracking-wide">Perdido</p>
                <p className="text-sm font-bold text-foreground tabular-nums">&gt; {config.risco_max_dias}d</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Provavelmente churned</p>
              </div>
            </div>

            <FieldRow label="Base de cálculo" sublabel="Universo de clientes para o Status">
              <div className="space-y-1">
                <BaseSelector value={(config as any).base_status12m ?? 'S'} onChange={(v) => updateField('base_status12m' as any, v)} meses={meses} dias={janela} />
                <p className="text-[9px] text-muted-foreground">Recomendado: <strong>S</strong> (Status {meses}m) para focar na base recentemente ativa.</p>
              </div>
            </FieldRow>

            <FieldRow label="Ativar Status Xm" sublabel="Habilita a análise de status por recência">
              <Switch checked={config.status12m_enabled} onCheckedChange={u('status12m_enabled')} />
            </FieldRow>

            <FieldRow
              label="Janela da base Status (meses)"
              sublabel="Define quem entra na base S: clientes com visita nos últimos N meses"
              impact={`Base S = clientes com pelo menos 1 visita nos últimos ${meses} meses`}
              example="Aumentar inclui clientes mais antigos. Diminuir foca nos mais recentes"
            >
              <div className="flex items-center gap-2">
                <NumInput value={meses} onChange={u('status12m_meses')} min={1} max={60} />
                <span className="text-[10px] text-muted-foreground">meses</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Saudável até (dias)"
              sublabel="Último limiar de saúde: quem veio nesse prazo está 'em dia'"
              impact={`Saudável = última visita ≤ ${config.risco_min_dias} dias atrás`}
              example={`Típico para barbearia mensal: 45d (1 mês + buffer de 15d)`}
              info={<InfoIconTooltip title="Saudável" short="Clientes dentro desse prazo são considerados saudáveis." details={<><p>Este valor define até quando um cliente é considerado "em dia". Acima disso, entra na faixa de Risco.</p><p className="mt-1">Pense: qual é o intervalo máximo normal para seu cliente — e adicione um buffer de tolerância.</p></>} />}
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.risco_min_dias} onChange={u('risco_min_dias')} min={1} />
                <span className="text-[10px] text-emerald-400 font-medium">Saudável ≤ {config.risco_min_dias}d</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Em Risco até (dias)"
              sublabel="Faixa de alerta: entre Saudável e Perdido"
              impact={`Em Risco = ${config.risco_min_dias + 1}–${config.risco_max_dias} dias sem vir`}
              example="Zona de ação proativa: cliente ainda pode ser recuperado com contato"
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.risco_max_dias} onChange={u('risco_max_dias')} min={1} />
                <span className="text-[10px] text-orange-400 font-medium">Risco {config.risco_min_dias + 1}–{config.risco_max_dias}d</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Perdido a partir de (dias)"
              sublabel="Além desse prazo → Perdido (churn). Também usado na análise de Churn"
              impact={`Perdido = última visita há mais de ${config.churn_dias_sem_voltar} dias`}
              example="Clientes 'Perdidos' ainda podem ser resgatados — ver seção 7"
              info={<InfoIconTooltip title="Perdido" short="Este valor é compartilhado com a análise de Churn." details={<><p>Este campo define simultaneamente o limiar de "Perdido" no Status e o critério de "churn" para a aba Churn.</p><p className="mt-1">Para que um cliente seja "resgatável", ele precisa antes ter cruzado este limiar e voltado.</p></>} />}
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.churn_dias_sem_voltar} onChange={u('churn_dias_sem_voltar')} min={1} />
                <span className="text-[10px] text-rose-400 font-medium">Perdido &gt; {config.risco_max_dias}d</span>
              </div>
            </FieldRow>
          </AccordionContent>
        </AccordionItem>

        {/* ══════════════════════════════════════════════════════════
            6. ONE-SHOT
        ══════════════════════════════════════════════════════════ */}
        <AccordionItem value="oneshot" className="border border-border/40 border-l-[3px] border-l-violet-500/60 rounded-xl px-3 sm:px-4 bg-card/30">
          <AccordionTrigger className="text-xs sm:text-sm font-semibold py-3 hover:no-underline">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-bold flex items-center justify-center shrink-0">6</span>
              <span className="h-2 w-2 rounded-full bg-violet-400 shrink-0" />
              One-Shot — Primeira visita única
              <BaseBadge type={(config as any).base_oneshot ?? 'S'} meses={meses} />
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-[10px] text-muted-foreground leading-relaxed space-y-1">
              <p><strong className="text-foreground">O que é one-shot?</strong> Cliente com <strong>exatamente 1 visita</strong> no histórico completo. Não têm cadência calculável (precisam de pelo menos 2 intervalos). São tratados separadamente e aparecem no card dedicado na Visão Geral.</p>
              <p><strong className="text-foreground">Por que separar?</strong> One-shots misturados na distribuição de cadência distorcem os dados — um barbeiro com muitos clientes novos parece ter "má cadência" quando na verdade tem muitos aguardando retorno.</p>
              <p><strong className="text-foreground">Funil do one-shot:</strong> Aguardando → retornou (vira Ocasional/Regular) <strong>ou</strong> Em risco → Perdido.</p>
            </div>

            {/* Preview */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/25 px-3 py-2.5 text-center">
                <p className="text-[9px] text-blue-400 font-semibold uppercase tracking-wide">Aguardando</p>
                <p className="text-sm font-bold text-foreground tabular-nums">≤ {config.one_shot_aguardando_max_dias}d</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Ainda pode retornar</p>
              </div>
              <div className="rounded-lg bg-orange-500/10 border border-orange-500/25 px-3 py-2.5 text-center">
                <p className="text-[9px] text-orange-400 font-semibold uppercase tracking-wide">Em Risco</p>
                <p className="text-sm font-bold text-foreground tabular-nums">{config.one_shot_aguardando_max_dias + 1}–{config.one_shot_risco_max_dias}d</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Contato urgente</p>
              </div>
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-3 py-2.5 text-center">
                <p className="text-[9px] text-rose-400 font-semibold uppercase tracking-wide">Perdido</p>
                <p className="text-sm font-bold text-foreground tabular-nums">&gt; {config.one_shot_risco_max_dias}d</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Dificilmente retorna</p>
              </div>
            </div>

            <FieldRow label="Base de cálculo" sublabel="Universo de clientes one-shot">
              <BaseSelector value={(config as any).base_oneshot ?? 'S'} onChange={(v) => updateField('base_oneshot' as any, v)} meses={meses} dias={janela} />
            </FieldRow>

            <FieldRow
              label="Apenas na Base Principal"
              sublabel="Filtra one-shots que não estão ativos na base principal configurada"
              impact="Quando ativo, one-shots muito antigos (fora do corte da base) não aparecem nas análises"
            >
              <Switch checked={config.one_shot_apenas_base_principal} onCheckedChange={u('one_shot_apenas_base_principal')} />
            </FieldRow>

            <FieldRow
              label="Aguardando até (dias)"
              sublabel="One-shot dentro desse prazo → ainda dentro da janela normal de retorno"
              impact={`≤ ${config.one_shot_aguardando_max_dias} dias após a única visita → Aguardando`}
              example="Alinhado ao ritmo de corte da barbearia — normalmente igual ao limiar saudável"
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.one_shot_aguardando_max_dias} onChange={u('one_shot_aguardando_max_dias')} min={1} />
                <span className="text-[10px] text-muted-foreground">dias</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Em Risco até (dias)"
              sublabel="One-shot nessa faixa → demorando demais para retornar"
              impact={`${config.one_shot_aguardando_max_dias + 1}–${config.one_shot_risco_max_dias} dias → Em Risco. Acima → Perdido`}
              example="Alinhado ao limiar de 'perdido' do Status para consistência"
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.one_shot_risco_max_dias} onChange={u('one_shot_risco_max_dias')} min={1} />
                <span className="text-[10px] text-muted-foreground">dias</span>
              </div>
            </FieldRow>
          </AccordionContent>
        </AccordionItem>

        {/* ══════════════════════════════════════════════════════════
            7. RESGATADOS
        ══════════════════════════════════════════════════════════ */}
        <AccordionItem value="resgate" className="border border-border/40 border-l-[3px] border-l-teal-500/60 rounded-xl px-3 sm:px-4 bg-card/30">
          <AccordionTrigger className="text-xs sm:text-sm font-semibold py-3 hover:no-underline">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold flex items-center justify-center shrink-0">7</span>
              <CheckCircle className="h-3.5 w-3.5 text-teal-400" />
              Resgatados
              <BaseBadge type={(config as any).base_resgatados ?? 'P'} />
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-[10px] text-muted-foreground leading-relaxed space-y-1">
              <p><strong className="text-foreground">O que é um resgate?</strong> Cliente que estava há <strong>{config.resgate_dias_minimos}+ dias</strong> sem visitar (considerado perdido) e <strong>retornou no período filtrado</strong>. Mede a eficácia das ações de recuperação.</p>
              <p><strong className="text-foreground">Como identificar:</strong> Sistema verifica se, imediatamente antes da primeira visita no período, o cliente tinha mais de {config.resgate_dias_minimos} dias de ausência consecutiva.</p>
              <p><strong className="text-foreground">Valor estratégico:</strong> Resgatados indicam que ações de CRM estão funcionando — mas o custo de resgatar um cliente perdido é muito maior que retê-lo.</p>
            </div>

            <FieldRow label="Base de cálculo" sublabel="Universo dos clientes resgatados">
              <div className="space-y-1">
                <BaseSelector value={(config as any).base_resgatados ?? 'P'} onChange={(v) => updateField('base_resgatados' as any, v)} dias={janela} />
                <p className="text-[9px] text-muted-foreground">Recomendado: <strong>P</strong> (Base Principal) — inclui quem veio no período independente de recência anterior.</p>
              </div>
            </FieldRow>

            <FieldRow
              label="Ausência mínima para resgate (dias)"
              sublabel="Quantos dias consecutivos sem vir para qualificar como 'resgate' ao retornar"
              impact={`Clientes que ficaram ≥ ${config.resgate_dias_minimos} dias sem vir antes de retornar → Resgatados`}
              example={`Alinhado com o limiar de Perdido (${config.churn_dias_sem_voltar}d): quem estava perdido e voltou`}
            >
              <div className="flex items-center gap-2">
                <NumInput value={config.resgate_dias_minimos} onChange={u('resgate_dias_minimos')} min={1} />
                <span className="text-[10px] text-muted-foreground">dias de ausência antes de retornar</span>
              </div>
            </FieldRow>

            <FieldRow
              label="Janela máxima de resgate (dias)"
              sublabel="Até quantos dias de ausência ainda considera o retorno como resgate"
              impact={`Resgates contados apenas para ausências entre ${config.resgate_dias_minimos} e ${config.resgate_janela_max_dias} dias`}
              example={`Ex: ${config.resgate_janela_max_dias}d = quem ficou até ${Math.round(config.resgate_janela_max_dias / 30)} meses fora e voltou. Ausência maior → não conta como resgate (cliente novo na prática).`}
              info={
                <InfoIconTooltip
                  title="Janela máxima de resgate"
                  short="Define o teto superior para qualificar um retorno como 'resgate'."
                  details={
                    <><p>Clientes que ficaram muito tempo sem vir (ex: 5+ anos) tecnicamente não são "resgatados" — são praticamente novos clientes. Este valor limita o teto dessa janela.</p>
                    <p className="mt-1">Faixa de resgate: ausência entre <strong>{config.resgate_dias_minimos}d</strong> (mín) e <strong>{config.resgate_janela_max_dias}d</strong> (máx). Fora dessa faixa não é contabilizado.</p></>
                  }
                />
              }
            >
              <div className="flex items-center gap-2 flex-wrap">
                <NumInput value={config.resgate_janela_max_dias} onChange={u('resgate_janela_max_dias')} min={config.resgate_dias_minimos + 1} max={3650} />
                <span className="text-[10px] text-muted-foreground">dias de ausência máxima</span>
                <div className="flex gap-1">
                  {[180, 360, 720].map((d) => (
                    <button
                      key={d}
                      onClick={() => updateField('resgate_janela_max_dias', d)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${config.resgate_janela_max_dias === d ? 'bg-primary/20 border-primary/50 text-primary font-semibold' : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'}`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            </FieldRow>
          </AccordionContent>
        </AccordionItem>

        {/* ══════════════════════════════════════════════════════════
            8. CHURN & ATRIBUIÇÃO
        ══════════════════════════════════════════════════════════ */}
        <AccordionItem value="churn" className="border border-border/40 border-l-[3px] border-l-rose-500/60 rounded-xl px-3 sm:px-4 bg-card/30">
          <AccordionTrigger className="text-xs sm:text-sm font-semibold py-3 hover:no-underline">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold flex items-center justify-center shrink-0">8</span>
              <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
              Churn & Atribuição de Barbeiro
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-[10px] text-muted-foreground leading-relaxed space-y-1">
              <p><strong className="text-foreground">Churn:</strong> Os limiares de churn (Perdido, Em Risco, Resgate) são definidos nas seções 5 e 7. Aqui ficam as configurações da aba de análise de Churn.</p>
              <p><strong className="text-foreground">Atribuição de barbeiro:</strong> Define como um cliente é associado a um colaborador para análises de carteira individual.</p>
            </div>

            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1 mb-1 flex items-center gap-1.5">
              <span className="h-px flex-1 bg-border/40" />Parâmetros de Churn<span className="h-px flex-1 bg-border/40" />
            </p>

            {/* Resumo de churn */}
            <Card className="border-border/30 bg-muted/10">
              <CardContent className="p-2.5 space-y-0.5">
                <p className="text-[10px] font-medium text-foreground mb-1">Parâmetros ativos (configurados nas seções anteriores):</p>
                <p className="text-[10px] text-muted-foreground">Saudável: ≤ {config.risco_min_dias}d · Em Risco: {config.risco_min_dias + 1}–{config.risco_max_dias}d · Perdido: &gt; {config.risco_max_dias}d</p>
                <p className="text-[10px] text-muted-foreground">Resgate: ausência ≥ {config.resgate_dias_minimos}d antes de retornar</p>
              </CardContent>
            </Card>

            <FieldRow
              label="Base de cálculo (Churn)"
              sublabel="Universo para a análise de churn da aba Churn"
            >
              <BaseSelector value={(config as any).base_churn ?? 'P'} onChange={(v) => updateField('base_churn' as any, v)} meses={meses} dias={janela} />
            </FieldRow>

            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-3 mb-1 flex items-center gap-1.5">
              <span className="h-px flex-1 bg-border/40" />Atribuição de Barbeiro<span className="h-px flex-1 bg-border/40" />
            </p>

            <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-[10px] text-muted-foreground space-y-1">
              <p><strong className="text-foreground">O que é atribuição?</strong> Para análises de carteira por barbeiro (aba Barbeiros), o sistema precisa saber qual barbeiro "é responsável" por cada cliente. Este campo define essa regra.</p>
              <p className="text-amber-400/80"><strong>Importante:</strong> O total da barbearia NUNCA é a soma das carteiras por barbeiro, pois clientes atendem com múltiplos barbeiros.</p>
            </div>

            <FieldRow label="Modo de atribuição" sublabel="Critério para associar um cliente a um barbeiro">
              <RadioGroup value={config.atribuicao_modo} onValueChange={(v) => updateField('atribuicao_modo', v as any)} className="flex flex-col gap-2">
                {([
                  {
                    value: 'MAIS_FREQUENTE' as const,
                    label: 'Mais frequente (recomendado)',
                    desc: `Barbeiro que mais atendeu o cliente nos últimos ${config.atribuicao_janela_meses} meses. Mais representativo do relacionamento real.`,
                  },
                  {
                    value: 'ULTIMO' as const,
                    label: 'Último atendimento',
                    desc: 'Barbeiro do atendimento mais recente. Simples, mas pode ser impreciso — um cliente fiel ao barbeiro A pode ter ido ao B uma vez e ser atribuído a B.',
                  },
                  {
                    value: 'MAIOR_FATURAMENTO' as const,
                    label: 'Maior faturamento',
                    desc: 'Barbeiro que gerou mais receita com esse cliente. Útil para análises financeiras de carteira.',
                  },
                  {
                    value: 'MULTI' as const,
                    label: 'Multi-barbeiro',
                    desc: 'Cliente conta para todos os barbeiros que o atenderam. Total de barbeiros > total da barbearia.',
                  },
                ]).map((m) => (
                  <label key={m.value} className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${config.atribuicao_modo === m.value ? 'border-primary/50 bg-primary/5' : 'border-border/40 hover:bg-muted/20'}`}>
                    <RadioGroupItem value={m.value} className="mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-foreground">{m.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </FieldRow>

            {config.atribuicao_modo !== 'MULTI' && (
              <FieldRow
                label="Janela de atribuição (meses)"
                sublabel="Período retroativo para considerar atendimentos no critério de atribuição"
                impact={`Apenas atendimentos dos últimos ${config.atribuicao_janela_meses} meses entram no cálculo de ${config.atribuicao_modo === 'MAIS_FREQUENTE' ? 'frequência' : config.atribuicao_modo === 'MAIOR_FATURAMENTO' ? 'faturamento' : 'último atendimento'}`}
              >
                <div className="flex items-center gap-2">
                  <NumInput value={config.atribuicao_janela_meses} onChange={u('atribuicao_janela_meses')} min={1} max={60} />
                  <span className="text-[10px] text-muted-foreground">meses</span>
                </div>
              </FieldRow>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ══════════════════════════════════════════════════════════
            9. ROUTING — CARTEIRA POR BARBEIRO
        ══════════════════════════════════════════════════════════ */}
        <AccordionItem value="routing" className="border border-border/40 border-l-[3px] border-l-blue-400/60 rounded-xl px-3 sm:px-4 bg-card/30">
          <AccordionTrigger className="text-xs sm:text-sm font-semibold py-3 hover:no-underline">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-blue-400/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">9</span>
              Routing — Carteira por Barbeiro
              <BaseBadge type="P" />
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-[10px] text-muted-foreground leading-relaxed space-y-1.5">
              <p><strong className="text-foreground">O que é o Routing?</strong> A aba Routing mostra como os clientes estão distribuídos entre os barbeiros dentro do período selecionado — quais são exclusivos, rotativos, novos ou perdidos.</p>
              <p><strong className="text-foreground">Base Período <BaseBadge type="P" />:</strong> O Routing usa sempre a <strong>Base Período</strong> — clientes que tiveram pelo menos 1 visita no intervalo selecionado no cabeçalho. Não há lookback além do período; é a fotografia exata do que aconteceu naquele intervalo.</p>
              <p><strong className="text-foreground">Histórico de relacionamento:</strong> Para calcular se um cliente é "exclusivo" ou "rotativo", o sistema analisa o histórico de atendimentos usando o corte da Base Principal (configurado na seção 2).</p>
              <p className="text-amber-400/80"><strong>Atenção:</strong> O total da barbearia no Routing nunca é a soma dos barbeiros — clientes atendidos por mais de um barbeiro aparecem em múltiplas carteiras, mas são contados uma vez no total.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { label: 'Exclusivos', cor: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400', desc: 'Só foram a este barbeiro no período' },
                { label: 'Rotativos', cor: 'bg-blue-500/10 border-blue-500/25 text-blue-400', desc: 'Visitaram 2+ barbeiros no período' },
                { label: 'Novos', cor: 'bg-violet-500/10 border-violet-500/25 text-violet-400', desc: 'Primeira visita no histórico' },
                { label: 'Perdidos', cor: 'bg-rose-500/10 border-rose-500/25 text-rose-400', desc: 'Estavam na carteira e não voltaram' },
              ].map((c) => (
                <div key={c.label} className={`rounded-lg border px-2.5 py-2 ${c.cor}`}>
                  <p className={`text-[10px] font-semibold ${c.cor.split(' ')[2]}`}>{c.label}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{c.desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border/30 bg-muted/8 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-foreground/80">Dois contextos separados no Routing:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-2.5 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BaseBadge type="P" />
                    <span className="text-[10px] font-semibold text-blue-300">Quem entra</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Sempre <strong className="text-foreground/80">Base Período</strong>: clientes com visita no intervalo do filtro (início → fim). Independente do modo da Base Principal.
                  </p>
                </div>
                <div className="rounded-md border border-border/30 bg-muted/10 px-2.5 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold tabular-nums text-foreground/80">{config.base_corte_meses}m</span>
                    <span className="text-[10px] font-semibold text-foreground/70">Histórico de segmentos</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Para classificar exclusivo/rotativo, o sistema analisa os últimos <strong className="text-foreground/80">{config.base_corte_meses} meses</strong> de histórico. Configure em Seção 2 → Corte temporal.
                  </p>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground/50 italic">O modo da Base Principal (Seção 2) afeta outras abas. O Routing ignora esse modo e usa sempre Base Período para os clientes incluídos.</p>
            </div>

            <FieldRow
              label="Atribuição de barbeiro"
              sublabel="Critério de atribuição usado nos cards de carteira do Routing"
              impact="O mesmo modo de atribuição da seção 8 é aplicado no Routing"
              example="Alterando na seção 8 (Churn & Atribuição) o Routing é atualizado automaticamente"
            >
              <div className="flex items-center gap-2">
                <span className="rounded border border-border/50 bg-muted/20 px-2 py-0.5 text-[10px] font-medium text-foreground">
                  {config.atribuicao_modo === 'MAIS_FREQUENTE' ? 'Mais frequente'
                    : config.atribuicao_modo === 'ULTIMO' ? 'Último atendimento'
                    : config.atribuicao_modo === 'MAIOR_FATURAMENTO' ? 'Maior faturamento'
                    : 'Multi-barbeiro'}
                </span>
                <span className="text-[10px] text-muted-foreground/60 italic">(configurado na seção 8)</span>
              </div>
            </FieldRow>
          </AccordionContent>
        </AccordionItem>

      </Accordion>

      {/* ── FOOTER SALVAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:relative sm:bottom-auto sm:left-auto sm:right-auto">
        <Card className="rounded-none sm:rounded-xl border-t sm:border border-border/50 bg-card/95 backdrop-blur-md shadow-lg sm:shadow-none">
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={saveConfig}
              disabled={saving || errors.length > 0}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Salvar configuração
            </Button>
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={restoreDefaults} disabled={saving}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restaurar padrões
            </Button>
            {errors.length > 0 && (
              <span className="text-[10px] text-rose-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Corrija {errors.length} erro{errors.length > 1 ? 's' : ''} para salvar
              </span>
            )}
            {errors.length === 0 && warnings.length > 0 && (
              <span className="text-[10px] text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {warnings.length} aviso{warnings.length > 1 ? 's' : ''} — salvar mesmo assim
              </span>
            )}
            <span className="text-[10px] text-muted-foreground sm:ml-auto text-center">
              Salvo: {lastUpdate} · v4.2
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

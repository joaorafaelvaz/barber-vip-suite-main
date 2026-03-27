import type React from 'react';
import {
  Star, UserCheck, AlertTriangle, Clock, Shuffle, TrendingUp, TrendingDown,
  UserX, UserMinus, CircleMinus, XCircle,
} from 'lucide-react';
import { calcDiasSemVir } from '@/lib/diasSemVir';

/* ------------------------------------------------------------------ */
/*  Core interfaces                                                    */
/* ------------------------------------------------------------------ */

export interface BarberVisit {
  colaborador_id: string;
  colaborador_nome: string;
  visitas: number;
  ultima_visita: string | null;
}

export interface RoutingClient {
  cliente_id: string;
  cliente_nome: string | null;
  telefone: string | null;
  visitas_total: number;
  barbeiros_distintos: number;
  ultima_visita: string | null;
  dias_sem_vir: number;
  ultimo_colaborador_id: string | null;
  ultimo_colaborador_nome: string | null;
  cadencia_media_dias: number | null;
  barbeiros: BarberVisit[] | null;
}

export interface BarberSummary {
  colaborador_id: string;
  colaborador_nome: string;
  total_atendidos: number;
  // Active segments
  fieis: number;
  exclusivos: number;
  oneshot_sem_retorno: number;
  oneshot_aguardando: number;
  oneshot_com_outro: number;
  convertendo: number;
  saindo: number;
  // Perdidos (outside janela window)
  perdido_fiel: number;
  perdido_exclusivo: number;
  perdido_oneshot: number;
  perdido_regular: number;
  // Legacy/computed
  pct_exclusivos: number;
  visitaram_1x_nao_voltaram: number;
}

export type BarberSegment =
  // Active
  | 'fiel'
  | 'exclusivo'
  | 'oneshot_sem_retorno'
  | 'oneshot_aguardando'
  | 'oneshot_com_outro'
  | 'convertendo'
  | 'saindo'
  // Perdidos
  | 'perdido_fiel'
  | 'perdido_exclusivo'
  | 'perdido_oneshot'
  | 'perdido_regular';

/* ------------------------------------------------------------------ */
/*  Segment config                                                     */
/* ------------------------------------------------------------------ */

export const SEGMENT_CONFIG: Record<BarberSegment, {
  label: string;
  icon: React.ElementType;
  color: string;
  badgeClass: string;
  description: string;
  action: string;
  isPerdido?: true;
}> = {
  // --- Active ---
  fiel: {
    label: 'Fiel',
    icon: Star,
    color: 'text-emerald-400',
    badgeClass: 'border-emerald-500/30 text-emerald-400',
    description: 'Veio 3+ vezes consecutivamente com este barbeiro — nunca foi a outro no período. Máxima lealdade.',
    action: 'Reconhecer e manter o relacionamento. São a base mais sólida da carteira.',
  },
  exclusivo: {
    label: 'Exclusivo',
    icon: UserCheck,
    color: 'text-teal-400',
    badgeClass: 'border-teal-500/30 text-teal-400',
    description: 'Só vai com este barbeiro, voltou 2x. Exclusivo mas ainda não fiel.',
    action: 'Incentivar a 3ª visita para consolidar a fidelidade.',
  },
  oneshot_sem_retorno: {
    label: 'One-shot · Não voltou',
    icon: AlertTriangle,
    color: 'text-amber-400',
    badgeClass: 'border-amber-500/30 text-amber-400',
    description: '1ª e única visita na barbearia foi com ele — não retornou há +45 dias (dentro da janela ativa).',
    action: 'Perda da barbearia. Resgatar antes que saia da janela.',
  },
  oneshot_aguardando: {
    label: 'One-shot · Aguardando',
    icon: Clock,
    color: 'text-yellow-400',
    badgeClass: 'border-yellow-500/30 text-yellow-400',
    description: '1ª e única visita na barbearia foi com ele — dentro dos 45 dias. Pode ainda voltar.',
    action: 'Janela aberta. Convite ativo pode converter em recorrente.',
  },
  oneshot_com_outro: {
    label: 'One-shot · Com outro',
    icon: Shuffle,
    color: 'text-orange-400',
    badgeClass: 'border-orange-500/30 text-orange-400',
    description: 'Foi 1x com ele, voltou à barbearia mas foi com outro barbeiro.',
    action: 'A barbearia reteve o cliente mas o barbeiro não. Entender o motivo da troca.',
  },
  convertendo: {
    label: 'Convertendo',
    icon: TrendingUp,
    color: 'text-sky-400',
    badgeClass: 'border-sky-500/30 text-sky-400',
    description: 'Vai com vários barbeiros, mas a última visita foi com ele.',
    action: 'Momento de consolidar. Próxima experiência pode definir uma preferência.',
  },
  saindo: {
    label: 'Saindo',
    icon: TrendingDown,
    color: 'text-rose-400',
    badgeClass: 'border-rose-500/30 text-rose-400',
    description: 'Veio 2+ vezes com ele, mas a última visita foi com outro barbeiro.',
    action: 'Atenção imediata. Cliente que estava fidelizando está migrando.',
  },
  // --- Perdidos (outside janela window) ---
  perdido_fiel: {
    label: 'Perdido · Era fiel',
    icon: UserX,
    color: 'text-rose-500',
    badgeClass: 'border-rose-600/30 text-rose-500',
    description: 'Era fiel (3+ visitas consecutivas, só com este barbeiro) mas não retornou dentro da janela.',
    action: 'Resgate prioritário — era um cliente de alto valor. Contato direto com incentivo.',
    isPerdido: true,
  },
  perdido_exclusivo: {
    label: 'Perdido · Era exclusivo',
    icon: UserMinus,
    color: 'text-rose-400',
    badgeClass: 'border-rose-500/30 text-rose-400',
    description: 'Só vinha com este barbeiro (2x) mas não retornou dentro da janela.',
    action: 'Tinha preferência clara. Contato personalizado pode reativar.',
    isPerdido: true,
  },
  perdido_oneshot: {
    label: 'Perdido · One-shot',
    icon: XCircle,
    color: 'text-slate-400',
    badgeClass: 'border-slate-500/30 text-slate-400',
    description: 'Veio 1x (primeira visita na barbearia) e não retornou dentro da janela.',
    action: 'Mais difícil de resgatar. Ação massiva de reativação pode recuperar parte.',
    isPerdido: true,
  },
  perdido_regular: {
    label: 'Perdido · Regular',
    icon: CircleMinus,
    color: 'text-slate-300',
    badgeClass: 'border-slate-400/30 text-slate-300',
    description: 'Era cliente regular da barbearia (2+ visitas, múltiplos barbeiros) mas saiu da janela. Não tinha barbeiro preferido específico.',
    action: 'Campanha de reativação geral — já conhecia a barbearia. Oferta ou lembrete pode reativar.',
    isPerdido: true,
  },
};

/** Maps BarberSegment key → BarberSummary count field */
export const SEG_COUNT_KEY: Record<BarberSegment, keyof BarberSummary> = {
  fiel:                 'fieis',
  exclusivo:            'exclusivos',
  oneshot_sem_retorno:  'oneshot_sem_retorno',
  oneshot_aguardando:   'oneshot_aguardando',
  oneshot_com_outro:    'oneshot_com_outro',
  convertendo:          'convertendo',
  saindo:               'saindo',
  perdido_fiel:         'perdido_fiel',
  perdido_exclusivo:    'perdido_exclusivo',
  perdido_oneshot:      'perdido_oneshot',
  perdido_regular:      'perdido_regular',
};

/** Active segment display order */
export const ACTIVE_SEG_ORDER: BarberSegment[] = [
  'fiel', 'exclusivo', 'convertendo', 'saindo',
  'oneshot_aguardando', 'oneshot_sem_retorno', 'oneshot_com_outro',
];

/** Perdido segment display order */
export const PERDIDO_SEG_ORDER: BarberSegment[] = [
  'perdido_fiel', 'perdido_exclusivo', 'perdido_regular', 'perdido_oneshot',
];

export const CARD_SEGS: {
  key: keyof BarberSummary;
  label: string;
  desc: string;
  color: string;
  bar: string;
}[] = [
  { key: 'fieis',               label: 'Fiel',                color: 'text-emerald-400', bar: 'bg-emerald-500', desc: '3+ visitas, exclusivamente com ele' },
  { key: 'exclusivos',          label: 'Exclusivo',           color: 'text-teal-400',    bar: 'bg-teal-500',    desc: 'Só com ele, 2x (ainda não fiel)' },
  { key: 'oneshot_sem_retorno', label: '1-shot · Não voltou', color: 'text-amber-400',   bar: 'bg-amber-500',   desc: '1ª visita na barbearia, +45d sem retorno' },
  { key: 'oneshot_aguardando',  label: '1-shot · Aguardando', color: 'text-yellow-400',  bar: 'bg-yellow-500',  desc: '1ª visita na barbearia, ≤45d — pode voltar' },
  { key: 'oneshot_com_outro',   label: '1-shot · Com outro',  color: 'text-orange-400',  bar: 'bg-orange-500',  desc: '1x com ele, voltou com outro barbeiro' },
  { key: 'convertendo',         label: 'Convertendo',         color: 'text-sky-400',     bar: 'bg-sky-500',     desc: 'Última visita foi com ele' },
  { key: 'saindo',              label: 'Saindo',              color: 'text-rose-400',    bar: 'bg-rose-500',    desc: 'Veio 2+ com ele, última foi com outro' },
];

export const PERDIDO_CARD_SEGS: {
  key: keyof BarberSummary;
  label: string;
  desc: string;
  color: string;
  bar: string;
}[] = [
  { key: 'perdido_fiel',      label: 'Era fiel',      color: 'text-rose-500',  bar: 'bg-rose-600',   desc: 'Era fiel (3+ visitas) — saiu da janela' },
  { key: 'perdido_exclusivo', label: 'Era exclusivo', color: 'text-rose-400',  bar: 'bg-rose-500',   desc: 'Era exclusivo (só com ele) — saiu da janela' },
  { key: 'perdido_regular',   label: 'Regular',       color: 'text-slate-400', bar: 'bg-slate-500',  desc: 'Vinha com múltiplos barbeiros — saiu da janela' },
  { key: 'perdido_oneshot',   label: 'One-shot',      color: 'text-slate-300', bar: 'bg-slate-400',  desc: 'Veio 1x na barbearia — saiu da janela' },
];

/* ------------------------------------------------------------------ */
/*  Classification logic                                               */
/* ------------------------------------------------------------------ */

export function getBarberVisits(client: RoutingClient, barberId: string): BarberVisit | null {
  return client.barbeiros?.find(b => b.colaborador_id === barberId) ?? null;
}

/**
 * Classifies a client into one of the 11 routing segments for a specific barber.
 * @param janelaDias  Window in days (period-relative). Clients with dias_sem_vir > janelaDias
 *                    are classified as "perdido". Defaults to 9999 (no perdido classification).
 */
export function classifyForBarber(
  client: RoutingClient,
  barberId: string,
  janelaDias = 9999,
): BarberSegment {
  const bv = getBarberVisits(client, barberId);
  if (!bv) return 'saindo';

  const lastWasWithBarber = client.ultimo_colaborador_id === barberId;

  // Perdidos: use period-relative dias_sem_vir (consistent with DB classification)
  if (client.dias_sem_vir > janelaDias) {
    if (client.visitas_total === 1)                                                        return 'perdido_oneshot';
    if (bv.visitas >= 3 && client.barbeiros_distintos <= 1)                               return 'perdido_fiel';
    if (client.barbeiros_distintos <= 1 && client.visitas_total >= 2)                     return 'perdido_exclusivo';
    return 'perdido_regular';
  }

  // Active: use today-relative dias for the 45-day oneshot threshold
  const diasToday = calcDiasSemVir(client.ultima_visita, client.dias_sem_vir);

  // fiel: 3+ visits AND exclusively with this barber (consecutive = never went to another)
  if (bv.visitas >= 3 && client.barbeiros_distintos <= 1) return 'fiel';
  if (client.barbeiros_distintos <= 1 && client.visitas_total >= 2) return 'exclusivo';
  if (client.visitas_total === 1) {
    return diasToday > 45 ? 'oneshot_sem_retorno' : 'oneshot_aguardando';
  }
  if (bv.visitas === 1 && client.barbeiros_distintos > 1 && !lastWasWithBarber) {
    return 'oneshot_com_outro';
  }
  if (lastWasWithBarber) return 'convertendo';
  return 'saindo';
}

export function getMainBarber(client: RoutingClient): BarberVisit | null {
  if (!client.barbeiros?.length) return null;
  return client.barbeiros.reduce((best, b) => b.visitas > best.visitas ? b : best);
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

export function fmtD(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

export function diasColor(dias: number) {
  if (dias <= 30) return 'text-emerald-400';
  if (dias <= 60) return 'text-amber-400';
  if (dias <= 120) return 'text-orange-400';
  return 'text-rose-400';
}

/** Computed total of perdido sub-segments for a barber */
export function totalPerdidos(b: BarberSummary): number {
  return b.perdido_fiel + b.perdido_exclusivo + b.perdido_oneshot + b.perdido_regular;
}

// ============================================================
// FILE: src/components/clientes/ClientesRelatorioGenerator.ts
// Funções puras para gerar textos analíticos a partir dos dados
// ============================================================

import type { PainelCompleto, PainelKpis, StatusDistItem, EvolucaoMensalItem, PorBarbeiroItem, FaixasDias, FaixasFrequencia } from '@/hooks/useClientes';
import type { NovosResumo, NovosKpis, BarbeiroAquisicaoItem, CohortMensalItem } from '@/hooks/useClientesNovos';
import { fmtInt, fmtMoney, fmtMesAnoFull, fmtMesAno } from '@/hooks/useClientes';

// ---- Helpers ----

function pct(n: number, total: number): string {
  if (!total) return '0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function pctNum(n: number, total: number): number {
  if (!total) return 0;
  return (n / total) * 100;
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    ATIVO_VIP: 'Assíduo', ATIVO_FORTE: 'Regular', ATIVO_LEVE: 'Espaçando',
    AGUARDANDO_RETORNO: '1ª Vez', EM_RISCO: 'Em Risco', PERDIDO: 'Perdido',
  };
  return map[s] || s;
}

function getStatusCount(dist: StatusDistItem[], status: string): number {
  return dist.find(d => d.status === status)?.count ?? 0;
}

// ============================================================
// 1. ANÁLISE DE SAÚDE DA BASE
// ============================================================

export function gerarAnaliseSaudeBase(painel: PainelCompleto): string[] {
  const { kpis, status_distribuicao: dist, faixas_dias, faixas_frequencia } = painel;
  const total = kpis.total_clientes;
  const paragraphs: string[] = [];

  const vip = getStatusCount(dist, 'ATIVO_VIP');
  const forte = getStatusCount(dist, 'ATIVO_FORTE');
  const leve = getStatusCount(dist, 'ATIVO_LEVE');
  const risco = getStatusCount(dist, 'EM_RISCO');
  const perdido = getStatusCount(dist, 'PERDIDO');
  const ativos = vip + forte;
  const pctAtivos = pctNum(ativos, total);
  const pctRiscoPerdido = pctNum(risco + perdido, total);

  let saude = '';
  if (pctAtivos >= 60) {
    saude = `A base de clientes apresenta saúde excelente: ${pct(ativos, total)} dos ${fmtInt(total)} clientes estão classificados como Assíduo (${fmtInt(vip)}) ou Regular (${fmtInt(forte)}), indicando alta fidelização e regularidade de visitas.`;
  } else if (pctAtivos >= 40) {
    saude = `A base de clientes apresenta saúde moderada: ${pct(ativos, total)} dos ${fmtInt(total)} clientes estão classificados como Assíduo (${fmtInt(vip)}) ou Regular (${fmtInt(forte)}). Há espaço significativo para melhorar a retenção.`;
  } else {
    saude = `A base de clientes apresenta saúde preocupante: apenas ${pct(ativos, total)} dos ${fmtInt(total)} clientes estão classificados como Assíduo (${fmtInt(vip)}) ou Regular (${fmtInt(forte)}). Ações urgentes de retenção são necessárias.`;
  }
  paragraphs.push(saude);

  if (pctRiscoPerdido > 30) {
    paragraphs.push(`⚠️ Alerta: ${pct(risco + perdido, total)} da base está Em Risco (${fmtInt(risco)}) ou Perdida (${fmtInt(perdido)}). Isso representa ${fmtInt(risco + perdido)} clientes que precisam de ações de resgate imediatas.`);
  } else if (risco + perdido > 0) {
    paragraphs.push(`${fmtInt(risco)} clientes estão Em Risco e ${fmtInt(perdido)} foram classificados como Perdidos (${pct(risco + perdido, total)} da base).`);
  }

  if (leve > 0) {
    paragraphs.push(`${fmtInt(leve)} clientes (${pct(leve, total)}) estão "Espaçando" — grupo estratégico para ações preventivas.`);
  }

  const totalFaixas = faixas_dias.ate_20d + faixas_dias['21_30d'] + faixas_dias['31_45d'] + faixas_dias['46_75d'] + faixas_dias.mais_75d;
  const recentes = faixas_dias.ate_20d + faixas_dias['21_30d'];
  const pctRecentes = pctNum(recentes, totalFaixas);

  if (pctRecentes >= 50) {
    paragraphs.push(`Na análise de recência, ${pct(recentes, totalFaixas)} dos clientes visitaram nos últimos 30 dias (${fmtInt(recentes)} clientes).`);
  } else {
    paragraphs.push(`Na análise de recência, apenas ${pct(recentes, totalFaixas)} visitaram nos últimos 30 dias. Necessidade de engajamento.`);
  }

  if (faixas_dias.mais_75d > 0) {
    paragraphs.push(`${fmtInt(faixas_dias.mais_75d)} clientes (${pct(faixas_dias.mais_75d, totalFaixas)}) estão há mais de 75 dias sem visita.`);
  }

  const { uma_vez, duas_vezes, tres_quatro, cinco_nove } = faixas_frequencia;
  const dez_mais_total = (faixas_frequencia.dez_doze ?? 0) + (faixas_frequencia.treze_quinze ?? 0) + (faixas_frequencia.dezesseis_vinte ?? 0) + (faixas_frequencia.vinte_um_trinta ?? 0) + (faixas_frequencia.trinta_mais ?? 0);
  const totalFreq = uma_vez + duas_vezes + tres_quatro + cinco_nove + dez_mais_total;
  const frequentes = cinco_nove + dez_mais_total;

  if (pctNum(uma_vez, totalFreq) > 40) {
    paragraphs.push(`Atenção na frequência: ${pct(uma_vez, totalFreq)} dos clientes vieram apenas 1 vez (${fmtInt(uma_vez)} clientes). Baixa conversão de primeira visita em recorrência.`);
  }

  if (frequentes > 0) {
    paragraphs.push(`${fmtInt(frequentes)} clientes (${pct(frequentes, totalFreq)}) vieram 5+ vezes — clientes mais valiosos.`);
  }

  return paragraphs;
}

// ============================================================
// 2. ANÁLISE DE RETENÇÃO DE NOVOS
// ============================================================

export function gerarAnaliseRetencaoNovos(novos: NovosResumo | null): string[] {
  if (!novos) return ['Dados de clientes novos não disponíveis para este período.'];
  const { kpis } = novos;
  const paragraphs: string[] = [];

  paragraphs.push(`No período, ${fmtInt(kpis.novos_total)} clientes novos foram captados (${kpis.pct_novos_sobre_unicos.toFixed(1)}% da base).`);

  const ret30 = kpis.retencao_30d;
  const ret60 = kpis.retencao_60d;
  const ret90 = kpis.retencao_90d;

  let retAnalise = `Retenção: ${ret30.toFixed(1)}% em 30d, ${ret60.toFixed(1)}% em 60d e ${ret90.toFixed(1)}% em 90d.`;
  if (ret30 >= 40) retAnalise += ' Acima do benchmark (30-40%).';
  else if (ret30 >= 25) retAnalise += ' Dentro da média de mercado.';
  else retAnalise += ' ⚠️ Abaixo do benchmark (<25%).';
  paragraphs.push(retAnalise);

  if (kpis.tempo_mediano_2a_visita !== null) {
    paragraphs.push(`Tempo mediano até 2ª visita: ${kpis.tempo_mediano_2a_visita} dias. ${kpis.pct_voltou_ate_21d.toFixed(1)}% retornaram em 21d.`);
  }

  if (kpis.ticket_medio_recorrente !== null && kpis.ticket_primeira_visita > 0) {
    const diff = kpis.ticket_medio_recorrente - kpis.ticket_primeira_visita;
    const pctDiff = ((diff / kpis.ticket_primeira_visita) * 100).toFixed(1);
    if (diff > 0) {
      paragraphs.push(`Ticket recorrente (${fmtMoney(kpis.ticket_medio_recorrente)}) é ${pctDiff}% superior ao da primeira visita (${fmtMoney(kpis.ticket_primeira_visita)}).`);
    }
  }

  if (kpis.novos_total > 0) {
    paragraphs.push(`${fmtInt(kpis.novos_exclusivos)} novos (${kpis.pct_novos_exclusivos.toFixed(1)}%) foram atendidos por um só barbeiro, ${fmtInt(kpis.novos_compartilhados)} compartilhados.`);
  }

  if (novos.cohort_mensal?.length >= 3) {
    const last3 = novos.cohort_mensal.slice(-3);
    const avgRet = last3.reduce((s, c) => s + c.pct_ret_30d, 0) / last3.length;
    paragraphs.push(`Cohort (3 meses): retenção média 30d = ${avgRet.toFixed(1)}%. ${avgRet >= 35 ? 'Positivo.' : 'Há oportunidade de melhoria.'}`);
  }

  return paragraphs;
}

// ============================================================
// 3. ANÁLISE POR BARBEIRO
// ============================================================

export function gerarAnaliseBarbeiros(painel: PainelCompleto, novos: NovosResumo | null): string[] {
  const barbeiros = painel.por_barbeiro;
  if (!barbeiros?.length) return ['Sem dados de barbeiros para o período.'];
  const paragraphs: string[] = [];

  const sorted = [...barbeiros].sort((a, b) => b.valor_total - a.valor_total);
  const top = sorted[0];
  const totalValor = sorted.reduce((s, b) => s + b.valor_total, 0);

  paragraphs.push(`${fmtInt(sorted.length)} barbeiros atenderam no período. Destaque: ${top.colaborador_nome} com ${fmtInt(top.clientes_unicos)} clientes e ${fmtMoney(top.valor_total)} (${pct(top.valor_total, totalValor)}).`);

  if (novos?.por_barbeiro_aquisicao?.length) {
    const barbs = novos.por_barbeiro_aquisicao;
    const topCaptador = [...barbs].sort((a, b) => b.novos - a.novos)[0];
    const topRetentor = [...barbs].sort((a, b) => b.retencao_30d - a.retencao_30d)[0];

    paragraphs.push(`Captação: ${topCaptador.colaborador_nome} lidera com ${fmtInt(topCaptador.novos)} novos.`);

    if (topRetentor.colaborador_nome !== topCaptador.colaborador_nome) {
      paragraphs.push(`Retenção: ${topRetentor.colaborador_nome} lidera com ${topRetentor.retencao_30d.toFixed(1)}% em 30d.`);
    }

    const baixaRet = barbs.filter(b => b.retencao_30d < 20 && b.novos >= 5);
    if (baixaRet.length > 0) {
      const nomes = baixaRet.map(b => `${b.colaborador_nome} (${b.retencao_30d.toFixed(0)}%)`).join(', ');
      paragraphs.push(`⚠️ Retenção baixa (<20%): ${nomes}. Investigar qualidade do atendimento.`);
    }
  }

  const altaExclus = sorted.filter(b => b.clientes_exclusivos > 0 && pctNum(b.clientes_exclusivos, b.clientes_unicos) >= 70);
  if (altaExclus.length > 0) {
    paragraphs.push(`Alta exclusividade (>70%): ${altaExclus.map(b => b.colaborador_nome).join(', ')}.`);
  }

  return paragraphs;
}

// ============================================================
// 4. EVOLUÇÃO E TENDÊNCIA
// ============================================================

export function gerarEvolucaoTendencia(evolucao: EvolucaoMensalItem[]): string[] {
  if (!evolucao?.length) return ['Sem dados de evolução mensal.'];
  const paragraphs: string[] = [];

  const first = evolucao[0];
  const last = evolucao[evolucao.length - 1];
  const deltaClientes = last.clientes_unicos - first.clientes_unicos;
  const pctDelta = first.clientes_unicos > 0 ? ((deltaClientes / first.clientes_unicos) * 100).toFixed(1) : '—';

  paragraphs.push(`De ${fmtMesAnoFull(first.ano_mes)} a ${fmtMesAnoFull(last.ano_mes)}: ${fmtInt(first.clientes_unicos)} → ${fmtInt(last.clientes_unicos)} clientes (${deltaClientes >= 0 ? '+' : ''}${pctDelta}%).`);

  if (evolucao.length >= 3) {
    const ult3 = evolucao.slice(-3);
    const crescendo = ult3[2].clientes_unicos > ult3[0].clientes_unicos;
    const valCrescendo = ult3[2].valor > ult3[0].valor;

    if (crescendo && valCrescendo) {
      paragraphs.push('📈 Tendência positiva nos últimos 3 meses: clientes e faturamento crescendo.');
    } else if (!crescendo && !valCrescendo) {
      paragraphs.push('📉 Tendência de queda nos últimos 3 meses: clientes e faturamento em declínio.');
    } else {
      paragraphs.push(`Últimos 3 meses: ${crescendo ? 'clientes crescendo, faturamento caindo' : 'faturamento crescendo, clientes diminuindo'}.`);
    }
  }

  const totalNovos = evolucao.reduce((s, e) => s + e.clientes_novos, 0);
  paragraphs.push(`Média de captação: ${(totalNovos / evolucao.length).toFixed(0)} novos/mês (total: ${fmtInt(totalNovos)}).`);

  return paragraphs;
}

// ============================================================
// 5. DIRECIONAMENTO DE AÇÕES
// ============================================================

export function gerarDirecionamento(painel: PainelCompleto, novos: NovosResumo | null): string[] {
  const acoes: string[] = [];
  const { kpis, status_distribuicao: dist, faixas_dias, por_barbeiro } = painel;

  const risco = getStatusCount(dist, 'EM_RISCO');
  const perdido = getStatusCount(dist, 'PERDIDO');
  const leve = getStatusCount(dist, 'ATIVO_LEVE');

  if (risco + perdido > 10) {
    acoes.push(`🔴 Resgate: ${fmtInt(risco + perdido)} clientes Em Risco + Perdidos. WhatsApp com oferta exclusiva.`);
  }

  if (leve > 5) {
    acoes.push(`🟡 Prevenção: engajar ${fmtInt(leve)} clientes "Espaçando" antes que evoluam para Em Risco.`);
  }

  if (novos) {
    const { kpis: nk } = novos;
    if (nk.retencao_30d < 30) {
      acoes.push(`🟠 Retenção de novos: apenas ${nk.retencao_30d.toFixed(0)}%. Follow-up em 7d e 21d.`);
    }

    const baixaRet = novos.por_barbeiro_aquisicao?.filter(b => b.retencao_30d < 20 && b.novos >= 5) ?? [];
    if (baixaRet.length > 0) {
      acoes.push(`🟠 Treinamento: ${baixaRet.map(b => b.colaborador_nome).join(', ')} — retenção baixa.`);
    }
  }

  if (faixas_dias.mais_75d > 20) {
    acoes.push(`🔴 ${fmtInt(faixas_dias.mais_75d)} clientes há +75 dias. Campanha de reativação.`);
  }

  if (kpis.total_clientes > 0 && kpis.total_atendimentos / kpis.total_clientes < 2) {
    acoes.push('🟡 Frequência média baixa (<2x). Programa de fidelidade recomendado.');
  }

  if (por_barbeiro.length > 1) {
    const sortedByVal = [...por_barbeiro].sort((a, b) => b.valor_total - a.valor_total);
    const totalVal = sortedByVal.reduce((s, b) => s + b.valor_total, 0);
    if (sortedByVal[0] && pctNum(sortedByVal[0].valor_total, totalVal) > 50) {
      acoes.push(`⚠️ Concentração: ${sortedByVal[0].colaborador_nome} > 50% do faturamento. Risco operacional.`);
    }
  }

  if (acoes.length === 0) {
    acoes.push('✅ Indicadores saudáveis. Manter monitoramento mensal.');
  }

  return acoes;
}

// ============================================================
// 6. ANÁLISE INDIVIDUAL DO BARBEIRO (EXPANDIDA)
// ============================================================

export interface BarbeiroDetalheData {
  status_distribuicao: StatusDistItem[];
  perdidos_barbearia: number;
  perdidos_para_outro: number;
  fieis: number;
  novos_no_periodo: number;
  retencao_30d: number;
  valor_medio_cliente: number;
  total_clientes: number;
  evolucao_mensal?: Array<{ ano_mes: string; clientes_unicos: number; novos: number; atendimentos: number; valor: number }>;
  frequencia_dist?: Array<{ faixa: string; count: number }>;
  top_clientes_valor?: Array<{ cliente_id: string; cliente_nome: string; telefone: string; visitas: number; valor: number; ultima_visita: string; dias_sem_vir: number; status: string }>;
}

export interface BarbeiroAnaliseInput {
  nome: string;
  detalhe: BarbeiroDetalheData;
  carteira?: {
    unicos_total: number;
    unicos_exclusivos: number;
    unicos_compartilhados: number;
    pct_compartilhados: number | null;
  } | null;
  novosBarb?: {
    novos: number;
    retencao_30d: number;
    retencao_60d: number;
    pct_fieis: number;
    ticket_medio_novo: number;
  } | null;
}

export function gerarAnaliseBarbeiro(input: BarbeiroAnaliseInput): string[] {
  const { nome, detalhe, carteira, novosBarb } = input;
  const paragraphs: string[] = [];
  const total = detalhe.total_clientes;

  if (total === 0) return [`${nome} não atendeu clientes no período selecionado.`];

  const exclusivos = carteira?.unicos_exclusivos ?? 0;
  const compartilhados = carteira?.unicos_compartilhados ?? 0;
  const pctExcl = total > 0 ? ((exclusivos / total) * 100).toFixed(0) : '0';
  const dist = detalhe.status_distribuicao ?? [];

  // 1. Resumo geral
  paragraphs.push(`📋 ${nome} atendeu ${fmtInt(total)} clientes únicos. ${fmtInt(exclusivos)} exclusivos (${pctExcl}%), ${fmtInt(compartilhados)} compartilhados. Ticket médio: ${fmtMoney(detalhe.valor_medio_cliente)}.`);

  // 2. Saúde da carteira
  if (dist.length) {
    const vip = getStatusCount(dist, 'ATIVO_VIP');
    const forte = getStatusCount(dist, 'ATIVO_FORTE');
    const risco = getStatusCount(dist, 'EM_RISCO');
    const perdido = getStatusCount(dist, 'PERDIDO');
    const ativos = vip + forte;
    const pctAtivos = total > 0 ? ((ativos / total) * 100).toFixed(0) : '0';

    if (parseInt(pctAtivos) >= 60) {
      paragraphs.push(`✅ Saúde: ${pctAtivos}% Assíduo+Regular (${fmtInt(vip)} Assíduo, ${fmtInt(forte)} Regular) — excelente.`);
    } else if (parseInt(pctAtivos) >= 40) {
      paragraphs.push(`📊 Saúde: ${pctAtivos}% Assíduo+Regular. Espaço para melhorar retenção.`);
    } else {
      paragraphs.push(`⚠️ Saúde: apenas ${pctAtivos}% Assíduo+Regular. ${fmtInt(risco)} em risco, ${fmtInt(perdido)} perdidos.`);
    }
  }

  // 3. Fidelização
  if (detalhe.fieis > 0) {
    const pctFieis = total > 0 ? ((detalhe.fieis / total) * 100).toFixed(0) : '0';
    paragraphs.push(`🌟 ${fmtInt(detalhe.fieis)} fiéis (${pctFieis}%) — 3+ visitas exclusivas. ${parseInt(pctFieis) >= 30 ? 'Excelente!' : 'Oportunidade de crescimento.'}`);
  } else {
    paragraphs.push(`⚠️ Nenhum fiel (3+ exclusivas). Trabalhar vínculo e diferenciação.`);
  }

  // 4. Captação
  if (detalhe.novos_no_periodo > 0) {
    paragraphs.push(`🆕 ${fmtInt(detalhe.novos_no_periodo)} novos captados. Retenção 30d: ${detalhe.retencao_30d.toFixed(1)}%. ${detalhe.retencao_30d >= 35 ? 'Acima do benchmark.' : detalhe.retencao_30d >= 25 ? 'Na média.' : '⚠️ Abaixo do benchmark.'}`);
  }

  if (novosBarb && novosBarb.pct_fieis > 0) {
    paragraphs.push(`Dos novos, ${novosBarb.pct_fieis.toFixed(0)}% se tornaram fiéis (2+ visitas exclusivas em 60d).`);
  }

  // 5. Frequência
  const freqDist = detalhe.frequencia_dist ?? [];
  if (freqDist.length) {
    const soUmaVez = freqDist.find(f => f.faixa === '1 vez')?.count ?? 0;
    const freq5mais = (freqDist.find(f => f.faixa === '5-9x')?.count ?? 0) + (freqDist.find(f => f.faixa === '10+')?.count ?? 0);
    const pctUmaVez = total > 0 ? ((soUmaVez / total) * 100).toFixed(0) : '0';
    const pctFreq = total > 0 ? ((freq5mais / total) * 100).toFixed(0) : '0';

    paragraphs.push(`📊 Frequência: ${fmtInt(soUmaVez)} vieram só 1 vez (${pctUmaVez}%), ${fmtInt(freq5mais)} vieram 5+ vezes (${pctFreq}%). ${parseInt(pctUmaVez) > 40 ? '⚠️ Alta taxa de visita única — follow-up necessário.' : parseInt(pctFreq) >= 20 ? '✅ Boa base recorrente.' : ''}`);
  }

  // 6. Evolução mensal
  const evolucao = detalhe.evolucao_mensal ?? [];
  if (evolucao.length >= 3) {
    const ult3 = evolucao.slice(-3);
    const crescendo = ult3[2].clientes_unicos > ult3[0].clientes_unicos;
    const valCrescendo = ult3[2].valor > ult3[0].valor;

    if (crescendo && valCrescendo) {
      paragraphs.push(`📈 Tendência positiva: clientes e valor crescendo nos últimos 3 meses (${fmtMesAno(ult3[0].ano_mes)} a ${fmtMesAno(ult3[2].ano_mes)}).`);
    } else if (!crescendo && !valCrescendo) {
      paragraphs.push(`📉 Tendência de queda: clientes e valor em declínio nos últimos 3 meses. Requer atenção.`);
    } else {
      paragraphs.push(`Últimos 3 meses: ${crescendo ? 'clientes crescendo mas valor caindo — avaliar ticket' : 'valor crescendo mas clientes diminuindo — boa monetização mas perda de base'}.`);
    }
  }

  // 7. Análise de perdidos
  const perdidosTotal = detalhe.perdidos_barbearia + detalhe.perdidos_para_outro;
  const emRisco = getStatusCount(dist, 'EM_RISCO');
  const ativoLeve = getStatusCount(dist, 'ATIVO_LEVE');

  if (perdidosTotal > 0 || emRisco > 0) {
    paragraphs.push(`📉 Atenção: ${fmtInt(perdidosTotal)} perdidos, ${fmtInt(emRisco)} em risco, ${fmtInt(ativoLeve)} espaçando.`);

    if (detalhe.perdidos_barbearia > 0) {
      paragraphs.push(`• ${fmtInt(detalhe.perdidos_barbearia)} saíram da barbearia — campanha de resgate WhatsApp.`);
    }
    if (detalhe.perdidos_para_outro > 0) {
      paragraphs.push(`• ${fmtInt(detalhe.perdidos_para_outro)} migraram para outro barbeiro. ${detalhe.perdidos_para_outro > detalhe.perdidos_barbearia ? '⚠️ Maioria migrou internamente — avaliar qualidade/disponibilidade.' : ''}`);
    }
  } else {
    paragraphs.push(`✅ Nenhum perdido significativo na carteira.`);
  }

  // 8. Top clientes em risco (se disponíveis)
  const topClientes = detalhe.top_clientes_valor ?? [];
  const clientesEmRisco = topClientes.filter(c => c.status === 'EM_RISCO' || c.status === 'PERDIDO');
  if (clientesEmRisco.length > 0) {
    paragraphs.push('');
    paragraphs.push('📌 CLIENTES PRIORITÁRIOS PARA AÇÃO:');
    clientesEmRisco.slice(0, 5).forEach((c, i) => {
      const cfg = c.status === 'PERDIDO' ? 'PERDIDO' : 'EM RISCO';
      paragraphs.push(`${i + 1}. ${c.cliente_nome} — ${cfg} | ${fmtInt(c.visitas)} visitas | ${fmtMoney(c.valor)} | ${c.dias_sem_vir}d sem vir`);
    });
  }

  // 9. Direcionamentos
  paragraphs.push('');
  paragraphs.push('📌 DIRECIONAMENTOS:');

  const acoes: string[] = [];

  if (detalhe.perdidos_para_outro > 5) {
    acoes.push(`Investigar os ${fmtInt(detalhe.perdidos_para_outro)} que migraram — problemas de agenda ou qualidade?`);
  }

  if (detalhe.perdidos_barbearia > 5) {
    acoes.push(`Campanha de resgate para os ${fmtInt(detalhe.perdidos_barbearia)} que saíram — WhatsApp personalizado.`);
  }

  if (detalhe.retencao_30d < 30 && detalhe.novos_no_periodo >= 5) {
    acoes.push('Follow-up pós-primeiro-atendimento: mensagem em 7d e 21d.');
  }

  if (emRisco > 5) {
    acoes.push(`Lembrete de agendamento para ${fmtInt(emRisco)} em risco — antes que se tornem perdidos.`);
  }

  if (ativoLeve > 10) {
    acoes.push(`Monitorar ${fmtInt(ativoLeve)} "espaçando" — oferecer serviço complementar ou promoção.`);
  }

  const soUmaVez = freqDist.find(f => f.faixa === '1 vez')?.count ?? 0;
  if (soUmaVez > 10 && total > 0 && (soUmaVez / total) > 0.35) {
    acoes.push(`${fmtInt(soUmaVez)} clientes vieram só 1 vez (${((soUmaVez / total) * 100).toFixed(0)}%) — criar protocolo de 2ª visita.`);
  }

  const pctExclNum = total > 0 ? (exclusivos / total) * 100 : 0;
  if (pctExclNum < 50) {
    acoes.push(`Exclusividade em ${pctExclNum.toFixed(0)}%. Trabalhar vínculo pessoal.`);
  }

  if (acoes.length === 0) {
    acoes.push('Manter o bom trabalho! Monitorar mensalmente.');
  }

  acoes.forEach((a, i) => paragraphs.push(`${i + 1}. ${a}`));

  return paragraphs;
}

// ============================================================
// 7. ANÁLISE DE RECÊNCIA (NOVO)
// ============================================================

export function gerarAnaliseRecencia(faixas: FaixasDias): string[] {
  const paragraphs: string[] = [];
  const total = faixas.ate_20d + faixas['21_30d'] + faixas['31_45d'] + faixas['46_75d'] + faixas.mais_75d;
  if (total === 0) return ['Sem dados de recência disponíveis.'];

  const recentes = faixas.ate_20d + faixas['21_30d'];
  const pctRecentes = pctNum(recentes, total);
  const pctDistantes = pctNum(faixas['46_75d'] + faixas.mais_75d, total);

  paragraphs.push(`Distribuição de recência: ${fmtInt(faixas.ate_20d)} clientes (${pct(faixas.ate_20d, total)}) visitaram nos últimos 20 dias, ${fmtInt(faixas['21_30d'])} (${pct(faixas['21_30d'], total)}) entre 21-30 dias.`);

  if (pctRecentes >= 50) {
    paragraphs.push(`✅ ${pctRecentes.toFixed(0)}% da base visitou nos últimos 30 dias — boa atividade recente.`);
  } else if (pctRecentes >= 35) {
    paragraphs.push(`📊 ${pctRecentes.toFixed(0)}% visitou nos últimos 30 dias — nível aceitável, mas há espaço para engajamento.`);
  } else {
    paragraphs.push(`⚠️ Apenas ${pctRecentes.toFixed(0)}% visitou nos últimos 30 dias — base com baixa atividade recente.`);
  }

  if (faixas['31_45d'] > 0) {
    paragraphs.push(`${fmtInt(faixas['31_45d'])} clientes (${pct(faixas['31_45d'], total)}) estão na faixa 31-45 dias — janela ideal para reativação proativa.`);
  }

  if (pctDistantes > 25) {
    paragraphs.push(`⚠️ ${pctDistantes.toFixed(0)}% da base está a mais de 46 dias sem visita (${fmtInt(faixas['46_75d'])} na faixa 46-75d e ${fmtInt(faixas.mais_75d)} acima de 75d). Campanha de reativação recomendada.`);
  }

  return paragraphs;
}

// ============================================================
// 8. ANÁLISE DE FREQUÊNCIA (NOVO)
// ============================================================

export function gerarAnaliseFrequencia(faixas: FaixasFrequencia): string[] {
  const paragraphs: string[] = [];
  const dez_mais_total = (faixas.dez_doze ?? 0) + (faixas.treze_quinze ?? 0) + (faixas.dezesseis_vinte ?? 0) + (faixas.vinte_um_trinta ?? 0) + (faixas.trinta_mais ?? 0);
  const total = faixas.uma_vez + faixas.duas_vezes + faixas.tres_quatro + faixas.cinco_nove + dez_mais_total;
  if (total === 0) return ['Sem dados de frequência disponíveis.'];

  const pctUmaVez = pctNum(faixas.uma_vez, total);
  const frequentes = faixas.cinco_nove + dez_mais_total;
  const pctFrequentes = pctNum(frequentes, total);
  const recorrentes = faixas.duas_vezes + faixas.tres_quatro + faixas.cinco_nove + dez_mais_total;

  paragraphs.push(`Distribuição de frequência: ${fmtInt(faixas.uma_vez)} clientes vieram 1 vez (${pctUmaVez.toFixed(0)}%), ${fmtInt(faixas.duas_vezes)} vieram 2x, ${fmtInt(faixas.tres_quatro)} vieram 3-4x, ${fmtInt(frequentes)} vieram 5+ vezes.`);

  if (pctUmaVez > 40) {
    paragraphs.push(`⚠️ Alta concentração em visita única (${pctUmaVez.toFixed(0)}%). Indica baixa conversão do primeiro atendimento em recorrência. Prioridade: follow-up pós-primeira visita.`);
  } else if (pctUmaVez > 25) {
    paragraphs.push(`${pctUmaVez.toFixed(0)}% vieram só 1 vez — nível dentro da média, mas com oportunidade de melhoria no follow-up.`);
  } else {
    paragraphs.push(`✅ Apenas ${pctUmaVez.toFixed(0)}% vieram só 1 vez — excelente taxa de conversão para recorrência.`);
  }

  if (pctFrequentes >= 25) {
    paragraphs.push(`✅ ${fmtInt(frequentes)} clientes (${pctFrequentes.toFixed(0)}%) são altamente frequentes (5+ visitas) — núcleo fiel e gerador de receita previsível.`);
  } else if (pctFrequentes >= 15) {
    paragraphs.push(`${fmtInt(frequentes)} clientes frequentes (5+). Base recorrente em formação.`);
  }

  paragraphs.push(`Taxa de recorrência geral: ${pct(recorrentes, total)} dos clientes retornaram pelo menos 2 vezes no período.`);

  if (faixas.uma_vez_aguardando > 0 || faixas.uma_vez_30d > 0 || faixas.uma_vez_60d > 0) {
    paragraphs.push(`Dos ${fmtInt(faixas.uma_vez)} que vieram 1 vez: ${fmtInt(faixas.uma_vez_aguardando)} aguardando retorno (≤30d), ${fmtInt(faixas.uma_vez_30d)} há mais de 30d sem voltar, ${fmtInt(faixas.uma_vez_60d)} há mais de 60d (provavelmente perdidos).`);
  }

  return paragraphs;
}

// ============================================================
// 9. ANÁLISE DE COHORT (NOVO)
// ============================================================

export function gerarAnaliseCohort(cohort: CohortMensalItem[]): string[] {
  if (!cohort?.length) return ['Sem dados de cohort disponíveis.'];
  const paragraphs: string[] = [];

  paragraphs.push(`Análise de ${cohort.length} meses de cohort de retenção de novos clientes:`);

  // Average retention
  const avgRet30 = cohort.reduce((s, c) => s + c.pct_ret_30d, 0) / cohort.length;
  const avgRet60 = cohort.reduce((s, c) => s + c.pct_ret_60d, 0) / cohort.length;
  const avgRet90 = cohort.reduce((s, c) => s + c.pct_ret_90d, 0) / cohort.length;

  paragraphs.push(`Retenção média: ${avgRet30.toFixed(1)}% em 30d, ${avgRet60.toFixed(1)}% em 60d, ${avgRet90.toFixed(1)}% em 90d.`);

  // Trend (last 3 vs first 3)
  if (cohort.length >= 6) {
    const first3 = cohort.slice(0, 3);
    const last3 = cohort.slice(-3);
    const avgFirst = first3.reduce((s, c) => s + c.pct_ret_30d, 0) / 3;
    const avgLast = last3.reduce((s, c) => s + c.pct_ret_30d, 0) / 3;
    const delta = avgLast - avgFirst;

    if (delta > 5) {
      paragraphs.push(`📈 Tendência positiva: retenção 30d subiu de ${avgFirst.toFixed(0)}% para ${avgLast.toFixed(0)}% (+${delta.toFixed(0)}pp). Ações de fidelização surtindo efeito.`);
    } else if (delta < -5) {
      paragraphs.push(`📉 Tendência negativa: retenção 30d caiu de ${avgFirst.toFixed(0)}% para ${avgLast.toFixed(0)}% (${delta.toFixed(0)}pp). Investigar qualidade do primeiro atendimento.`);
    } else {
      paragraphs.push(`Retenção 30d estável entre ${avgFirst.toFixed(0)}% e ${avgLast.toFixed(0)}% — sem variação significativa.`);
    }
  }

  // Best/worst months
  const best = [...cohort].sort((a, b) => b.pct_ret_30d - a.pct_ret_30d)[0];
  const worst = [...cohort].sort((a, b) => a.pct_ret_30d - b.pct_ret_30d)[0];
  if (best && worst && best.mes !== worst.mes) {
    paragraphs.push(`Melhor mês: ${best.mes} com ${best.pct_ret_30d.toFixed(0)}% ret.30d (${fmtInt(best.novos)} novos). Pior: ${worst.mes} com ${worst.pct_ret_30d.toFixed(0)}% (${fmtInt(worst.novos)} novos).`);
  }

  // Benchmark
  if (avgRet30 >= 35) {
    paragraphs.push(`✅ Retenção média acima do benchmark do setor (30-35%).`);
  } else if (avgRet30 >= 25) {
    paragraphs.push(`📊 Retenção dentro da média de mercado. Meta: alcançar 35%+.`);
  } else {
    paragraphs.push(`⚠️ Retenção abaixo do benchmark (<25%). Ação urgente: melhorar experiência do primeiro atendimento e follow-up.`);
  }

  return paragraphs;
}

// ============================================================
// 10. INSIGHTS INLINE PARA DASHBOARD (NOVO)
// ============================================================

export function gerarInsightResumoExecutivo(detalhe: any, periodoLabel: string): string {
  if (!detalhe) return '';
  const total = detalhe.total_clientes;
  const dist = detalhe.status_distribuicao ?? [];
  const vip = getStatusCount(dist, 'ATIVO_VIP');
  const forte = getStatusCount(dist, 'ATIVO_FORTE');
  const pctSaudavel = total > 0 ? (((vip + forte) / total) * 100).toFixed(0) : '0';
  const ret30 = (detalhe.retencao_30d ?? 0).toFixed(0);

  return `No período ${periodoLabel}, a barbearia atendeu ${fmtInt(total)} clientes. ${pctSaudavel}% são VIP+Forte (${parseInt(pctSaudavel) >= 60 ? 'carteira saudável' : parseInt(pctSaudavel) >= 40 ? 'nível moderado' : '⚠️ atenção necessária'}). ${fmtInt(detalhe.novos_no_periodo)} novos captados com retenção de ${ret30}% em 30d. Ticket médio: ${fmtMoney(detalhe.valor_medio_cliente)}.`;
}

export function gerarInsightStatus(dist: StatusDistItem[], total: number): string {
  if (!dist?.length || total === 0) return '';
  const vip = getStatusCount(dist, 'ATIVO_VIP');
  const forte = getStatusCount(dist, 'ATIVO_FORTE');
  const risco = getStatusCount(dist, 'EM_RISCO');
  const perdido = getStatusCount(dist, 'PERDIDO');
  const pctSaudavel = pctNum(vip + forte, total);
  const pctRisco = pctNum(risco + perdido, total);

  if (pctSaudavel >= 60) {
    return `✅ Carteira saudável: ${pctSaudavel.toFixed(0)}% VIP+Forte. Benchmark ideal: >60%. ${pctRisco > 15 ? `Atenção: ${pctRisco.toFixed(0)}% em risco/perdido.` : 'Risco controlado.'}`;
  } else if (pctSaudavel >= 40) {
    return `📊 Saúde moderada: ${pctSaudavel.toFixed(0)}% VIP+Forte. ${fmtInt(risco)} em risco e ${fmtInt(perdido)} perdidos representam ${pctRisco.toFixed(0)}% da base. Ações preventivas recomendadas.`;
  }
  return `⚠️ Saúde preocupante: apenas ${pctSaudavel.toFixed(0)}% VIP+Forte. ${fmtInt(risco + perdido)} clientes (${pctRisco.toFixed(0)}%) em risco ou perdidos. Ação urgente de retenção necessária.`;
}

export function gerarInsightFrequencia(freqDist: any[], total: number): string {
  if (!freqDist?.length || total === 0) return '';
  const soUmaVez = freqDist.find((f: any) => f.faixa === '1 vez')?.count ?? 0;
  const freq5mais = (freqDist.find((f: any) => f.faixa === '5-9x')?.count ?? 0) + (freqDist.find((f: any) => f.faixa === '10+')?.count ?? 0);
  const pctUmaVez = ((soUmaVez / total) * 100).toFixed(0);
  const pctFreq = ((freq5mais / total) * 100).toFixed(0);

  if (parseInt(pctUmaVez) > 40) {
    return `⚠️ ${pctUmaVez}% vieram só 1 vez (${fmtInt(soUmaVez)} clientes) — alto risco de não retorno. ${pctFreq}% são frequentes (5+). Priorizar follow-up pós-primeira visita.`;
  }
  return `${pctUmaVez}% vieram só 1 vez, ${pctFreq}% são frequentes (5+ visitas, ${fmtInt(freq5mais)} clientes). ${parseInt(pctFreq) >= 20 ? 'Boa base recorrente.' : 'Oportunidade de aumentar frequência.'}`;
}

export function gerarInsightEvolucao(evolucao: any[]): string {
  if (!evolucao?.length || evolucao.length < 3) return '';
  const ult3 = evolucao.slice(-3);
  const crescendo = ult3[2].clientes_unicos > ult3[0].clientes_unicos;
  const valCrescendo = ult3[2].valor > ult3[0].valor;
  const deltaCl = ult3[2].clientes_unicos - ult3[0].clientes_unicos;
  const pctDelta = ult3[0].clientes_unicos > 0 ? ((deltaCl / ult3[0].clientes_unicos) * 100).toFixed(0) : '0';

  if (crescendo && valCrescendo) {
    return `📈 Tendência positiva nos últimos 3 meses: ${fmtMesAno(ult3[0].ano_mes)} → ${fmtMesAno(ult3[2].ano_mes)} com ${deltaCl >= 0 ? '+' : ''}${pctDelta}% em clientes e faturamento crescendo.`;
  } else if (!crescendo && !valCrescendo) {
    return `📉 Tendência de queda nos últimos 3 meses (${fmtMesAno(ult3[0].ano_mes)} → ${fmtMesAno(ult3[2].ano_mes)}): clientes e faturamento em declínio. Requer ação.`;
  }
  return `Últimos 3 meses (${fmtMesAno(ult3[0].ano_mes)} → ${fmtMesAno(ult3[2].ano_mes)}): ${crescendo ? 'clientes crescendo mas faturamento caindo — avaliar ticket médio' : 'faturamento crescendo mas clientes caindo — boa monetização, atenção à base'}.`;
}

export function gerarInsightTopClientes(topClientes: any[]): string {
  if (!topClientes?.length) return '';
  const emRisco = topClientes.filter(c => c.status === 'EM_RISCO' || c.status === 'PERDIDO');
  if (emRisco.length === 0) return '✅ Todos os top 10 clientes estão ativos — base de alto valor saudável.';
  const valorRisco = emRisco.reduce((s, c) => s + c.valor, 0);
  return `⚠️ ${emRisco.length} dos top 10 clientes estão em risco ou perdidos (${fmtMoney(valorRisco)} em faturamento). Prioridade máxima de resgate: ${emRisco.slice(0, 3).map(c => c.cliente_nome).join(', ')}.`;
}

export function gerarInsightSaude(saudeRows: any[]): string {
  if (!saudeRows?.length || saudeRows.length < 2) return '';
  const best = saudeRows[0];
  const worst = saudeRows[saudeRows.length - 1];
  if (best.pctVipForte === null || worst.pctVipForte === null) return '';
  const gap = best.pctVipForte - worst.pctVipForte;
  return `${best.colaborador_nome} lidera com ${best.pctVipForte}% VIP+Forte vs ${worst.colaborador_nome} com ${worst.pctVipForte}% (gap de ${gap}pp). ${gap > 20 ? '⚠️ Grande disparidade — alinhar práticas de fidelização.' : 'Diferença aceitável entre equipe.'}`;
}

export function gerarInsightRanking(rows: any[], totals: any, novosData?: any[]): string {
  if (!rows?.length) return '';
  const parts: string[] = [];
  const topValor = [...rows].sort((a, b) => b.valor_total - a.valor_total)[0];
  const topNovos = [...rows].sort((a, b) => b.clientes_novos - a.clientes_novos)[0];

  parts.push(`Destaque faturamento: ${topValor.colaborador_nome} (${fmtMoney(topValor.valor_total)})`);
  if (topNovos.colaborador_nome !== topValor.colaborador_nome) {
    parts.push(`captação: ${topNovos.colaborador_nome} (${fmtInt(topNovos.clientes_novos)} novos)`);
  }

  if (novosData?.length) {
    const baixaRet = novosData.filter((b: any) => b.retencao_30d < 20 && b.novos >= 5);
    if (baixaRet.length > 0) {
      parts.push(`⚠️ atenção retenção: ${baixaRet.map((b: any) => b.colaborador_nome).join(', ')}`);
    }
  }

  return parts.join('. ') + '.';
}

// ============================================================
// 11. INSIGHT COMPOSIÇÃO (NOVO)
// ============================================================

export function gerarInsightComposicao(detalhe: any): string {
  if (!detalhe?.status_distribuicao?.length) return '';
  const dist = detalhe.status_distribuicao;
  const total = detalhe.total_clientes;
  if (total === 0) return '';

  const vip = getStatusCount(dist, 'ATIVO_VIP');
  const forte = getStatusCount(dist, 'ATIVO_FORTE');
  const leve = getStatusCount(dist, 'ATIVO_LEVE');
  const risco = getStatusCount(dist, 'EM_RISCO');
  const perdido = getStatusCount(dist, 'PERDIDO');

  const parts: string[] = [];
  parts.push(`VIP (${fmtInt(vip)}, ${pct(vip, total)}): clientes mais valiosos, visitas regulares — manter com atendimento diferenciado`);
  parts.push(`Forte (${fmtInt(forte)}, ${pct(forte, total)}): boa frequência, candidatos a VIP — incentivar serviços adicionais`);
  if (leve > 0) parts.push(`Leve (${fmtInt(leve)}, ${pct(leve, total)}): frequência espaçando — monitorar e engajar antes que virem risco`);
  if (risco > 0) parts.push(`Em Risco (${fmtInt(risco)}, ${pct(risco, total)}): ultrapassaram cadência normal — contato proativo urgente`);
  if (perdido > 0) parts.push(`Perdido (${fmtInt(perdido)}, ${pct(perdido, total)}): sem visita há muito tempo — campanha de resgate com oferta`);

  return parts.join('. ') + '.';
}

// ============================================================
// 12. RESUMO EXECUTIVO COMPLETO (COLLAPSIBLE)
// ============================================================

export function gerarResumoExecutivoCompleto(
  detalhe: any,
  periodoLabel: string,
  saudeRows: any[],
  novosData?: any[]
): string[] {
  if (!detalhe) return [];
  const paragraphs: string[] = [];
  const total = detalhe.total_clientes;
  const dist = detalhe.status_distribuicao ?? [];

  const vip = getStatusCount(dist, 'ATIVO_VIP');
  const forte = getStatusCount(dist, 'ATIVO_FORTE');
  const leve = getStatusCount(dist, 'ATIVO_LEVE');
  const risco = getStatusCount(dist, 'EM_RISCO');
  const perdido = getStatusCount(dist, 'PERDIDO');
  const pctSaudavel = pctNum(vip + forte, total);
  const pctRisco = pctNum(risco + perdido, total);

  // 1. Contexto do período
  paragraphs.push(`📋 CONTEXTO DO PERÍODO: No período ${periodoLabel}, a barbearia atendeu ${fmtInt(total)} clientes únicos, captou ${fmtInt(detalhe.novos_no_periodo)} novos e gerou ticket médio de ${fmtMoney(detalhe.valor_medio_cliente)}. ${fmtInt(detalhe.fieis)} clientes são considerados fiéis (3+ visitas exclusivas com um barbeiro).`);

  // 2. Saúde geral
  let saudeGeral = `📊 SAÚDE DA BASE: ${pctSaudavel.toFixed(0)}% da base é VIP+Forte (${fmtInt(vip)} VIP + ${fmtInt(forte)} Forte).`;
  if (pctSaudavel >= 60) saudeGeral += ' Excelente — a maioria dos clientes é recorrente e fiel.';
  else if (pctSaudavel >= 40) saudeGeral += ' Moderada — há espaço para converter mais clientes em recorrentes.';
  else saudeGeral += ' ⚠️ Preocupante — a maior parte da base não é recorrente. Ações de retenção são urgentes.';
  saudeGeral += ` ${fmtInt(leve)} clientes estão na zona "Leve" (cadência espaçando), ${fmtInt(risco)} em risco de perda e ${fmtInt(perdido)} foram classificados como perdidos (${pctRisco.toFixed(0)}% da base).`;
  paragraphs.push(saudeGeral);

  // 3. Retenção de novos
  const ret30 = detalhe.retencao_30d ?? 0;
  let retTexto = `🆕 CAPTAÇÃO E RETENÇÃO: ${fmtInt(detalhe.novos_no_periodo)} novos clientes no período. Retenção em 30 dias: ${ret30.toFixed(0)}%.`;
  if (ret30 >= 35) retTexto += ' Acima do benchmark do setor (30-35%) — boa qualidade do primeiro atendimento.';
  else if (ret30 >= 25) retTexto += ' Dentro da média de mercado, mas há oportunidade de melhoria no follow-up pós-primeira visita.';
  else retTexto += ' ⚠️ Abaixo do benchmark (<25%). Prioridade: melhorar experiência do primeiro atendimento e implementar follow-up em 7d e 21d.';
  paragraphs.push(retTexto);

  // 4. Destaques por barbeiro
  if (saudeRows?.length > 1) {
    const best = saudeRows[0];
    const worst = saudeRows[saudeRows.length - 1];
    let destaque = `🏆 DESTAQUES POR BARBEIRO: ${best.colaborador_nome} lidera em saúde com ${best.pctVipForte ?? 0}% VIP+Forte (${fmtInt(best.totalClientes)} clientes).`;
    if (worst.pctVipForte !== null) {
      const gap = (best.pctVipForte ?? 0) - (worst.pctVipForte ?? 0);
      destaque += ` ${worst.colaborador_nome} tem a menor saúde com ${worst.pctVipForte}% (gap de ${gap}pp).`;
      if (gap > 20) destaque += ' ⚠️ Grande disparidade na equipe — alinhar práticas de fidelização e atendimento.';
    }

    if (novosData?.length) {
      const topCaptador = [...novosData].sort((a: any, b: any) => b.novos - a.novos)[0];
      const topRetentor = [...novosData].sort((a: any, b: any) => b.retencao_30d - a.retencao_30d)[0];
      if (topCaptador) destaque += ` Maior captador: ${topCaptador.colaborador_nome} (${fmtInt(topCaptador.novos)} novos).`;
      if (topRetentor && topRetentor.colaborador_nome !== topCaptador?.colaborador_nome) {
        destaque += ` Melhor retenção: ${topRetentor.colaborador_nome} (${topRetentor.retencao_30d?.toFixed(0)}% em 30d).`;
      }
    }
    paragraphs.push(destaque);
  }

  // 5. Alertas e recomendações
  const alertas: string[] = [];
  if (pctRisco > 25) alertas.push(`${pctRisco.toFixed(0)}% da base em risco/perdido — campanha de resgate prioritária`);
  if (ret30 < 25 && detalhe.novos_no_periodo >= 5) alertas.push(`retenção de novos muito baixa (${ret30.toFixed(0)}%) — revisar qualidade do 1º atendimento`);

  const freqDist = detalhe.frequencia_dist ?? [];
  const soUmaVez = freqDist.find((f: any) => f.faixa === '1 vez')?.count ?? 0;
  if (soUmaVez > 0 && total > 0 && (soUmaVez / total) > 0.35) {
    alertas.push(`${((soUmaVez / total) * 100).toFixed(0)}% vieram só 1 vez — criar protocolo de conversão para 2ª visita`);
  }

  if (novosData?.length) {
    const baixaRet = novosData.filter((b: any) => b.retencao_30d < 20 && b.novos >= 5);
    if (baixaRet.length > 0) {
      alertas.push(`barbeiros com retenção crítica (<20%): ${baixaRet.map((b: any) => b.colaborador_nome).join(', ')}`);
    }
  }

  if (alertas.length > 0) {
    paragraphs.push(`⚠️ ALERTAS E RECOMENDAÇÕES: ${alertas.map((a, i) => `${i + 1}) ${a}`).join('; ')}.`);
  } else {
    paragraphs.push('✅ SITUAÇÃO GERAL: Indicadores saudáveis. Manter monitoramento mensal e focar em manter a qualidade do atendimento.');
  }

  return paragraphs;
}

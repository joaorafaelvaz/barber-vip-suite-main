// ============================================================
// FILE: src/hooks/useRelatorioSemanalMensagens.ts
// PROPÓSITO: CRUD para templates e envios de mensagens semanais
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ByColaborador } from '@/components/dashboard/types';
import { format } from 'date-fns';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────

export interface SemanalTemplate {
  id: string;
  nome: string;
  corpo: string;
  padrao: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SemanalEnvio {
  id: string;
  colaborador_id: string;
  colaborador_nome: string | null;
  telefone: string | null;
  semana_inicio: string;
  semana_fim: string;
  mensagem_final: string;
  template_id: string | null;
  notas: string | null;
  enviado_em: string;
  criado_em: string;
}

// ── Template variables ───────────────────────────────────────

function fmtMoney(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v);
}
function fmtN(v: number, d = 1) { return v.toFixed(d).replace('.', ','); }

function varStr(atual: number, anterior: number | null): string {
  if (anterior === null || anterior === 0) return '';
  const pct = ((atual - anterior) / anterior) * 100;
  if (Math.abs(pct) < 1) return '';
  const sinal = pct > 0 ? '↗️ +' : '↘️ ';
  return ` (${sinal}${fmtN(Math.abs(pct), 0)}% vs anterior)`;
}

function gerarAnaliseTexto(
  b: ByColaborador,
  bAnterior: ByColaborador | null
): string {
  const linhas: string[] = [];
  const acoes: string[] = [];
  const extrasRate = b.atendimentos > 0 ? b.extras_qtd / b.atendimentos : 0;
  const mediaDia = b.dias_trabalhados > 0 ? b.faturamento / b.dias_trabalhados : 0;

  linhas.push('📊 *Análise da semana:*');

  if (bAnterior && bAnterior.faturamento > 0) {
    const dComissaoPct = bAnterior.comissao > 0
      ? ((b.comissao - bAnterior.comissao) / bAnterior.comissao) * 100
      : null;
    const dFatPct = ((b.faturamento - bAnterior.faturamento) / bAnterior.faturamento) * 100;
    const dAtendPct = bAnterior.atendimentos > 0
      ? ((b.atendimentos - bAnterior.atendimentos) / bAnterior.atendimentos) * 100
      : 0;
    const dTicketPct = bAnterior.ticket_medio > 0
      ? ((b.ticket_medio - bAnterior.ticket_medio) / bAnterior.ticket_medio) * 100
      : 0;

    // Comissão — insight principal
    if (dComissaoPct !== null) {
      if (dComissaoPct >= 15) {
        linhas.push(`✅ Comissão cresceu ${fmtN(dComissaoPct, 0)}% em relação à semana anterior — resultado excelente!`);
      } else if (dComissaoPct >= 5) {
        linhas.push(`✅ Comissão subiu ${fmtN(dComissaoPct, 0)}% vs semana anterior — evolução positiva.`);
      } else if (dComissaoPct < -15) {
        linhas.push(`⚠️ Comissão caiu ${fmtN(Math.abs(dComissaoPct), 0)}% em relação à semana anterior — vamos identificar o que aconteceu.`);
        acoes.push('Revisar os dias com menor movimento e reorganizar a agenda para maximizar horários');
      } else if (dComissaoPct < -5) {
        linhas.push(`📉 Comissão levemente abaixo da semana anterior (${fmtN(Math.abs(dComissaoPct), 1)}%) — ainda há espaço para recuperar.`);
    } else {
      linhas.push('📊 Comissão estável em relação à semana anterior.');
    }

    // Breakdown serviços vs produtos
    const comServ = b.comissao_servicos ?? 0;
    const comProd = b.comissao_produtos ?? 0;
    const fatProd = b.faturamento_produtos ?? 0;
    if (comServ > 0 || comProd > 0) {
      linhas.push(`   → Serviços: ${fmtMoney(comServ)} (${fmtN(b.comissao_pct_servicos ?? 0, 1)}%) · Produtos: ${fmtMoney(comProd)} (${fmtN(b.comissao_pct_produtos ?? 0, 1)}%)`);
    }
    } else if (b.comissao > 0) {
      linhas.push(`💰 Comissão de ${fmtMoney(b.comissao)} gerada esta semana.`);
    }

    // Bônus
    if (b.bonus > 0) {
      linhas.push(`🏆 *Bônus atingido: ${fmtMoney(b.bonus)}* — parabéns pela meta!`);
    }

    // Atendimentos vs ticket
    if (dFatPct < -5 && dAtendPct > 0) {
      linhas.push('💡 Mais atendimentos, mas ticket médio menor — o volume está bom, falta ampliar o valor de cada cliente.');
      acoes.push('Oferecer ao menos 1 serviço ou produto adicional por atendimento (hidratação, sobrancelha, pomada)');
    } else if (dFatPct > 5 && dAtendPct <= 0) {
      linhas.push('🌟 Menos atendimentos, resultado maior — ótimo aproveitamento do valor de cada cliente!');
    } else if (dAtendPct >= 15) {
      linhas.push(`📈 Volume de atendimentos subiu ${fmtN(dAtendPct, 0)}% — excelente ritmo!`);
    } else if (dAtendPct <= -15) {
      linhas.push(`📉 Volume de atendimentos caiu ${fmtN(Math.abs(dAtendPct), 0)}% vs anterior.`);
      acoes.push('Verificar disponibilidade na agenda e ativar lista de espera para preencher horários vagos');
    }

    // Ticket médio
    if (dTicketPct >= 10) {
      linhas.push(`🎯 Ticket médio subiu ${fmtN(dTicketPct, 0)}% — ótimo resultado por atendimento!`);
    } else if (dTicketPct <= -10) {
      linhas.push(`💡 Ticket médio caiu ${fmtN(Math.abs(dTicketPct), 0)}% — cada atendimento tem potencial para mais.`);
      acoes.push('Apresentar combos e serviços premium antes de iniciar o atendimento (ex: corte + barba + hidratação)');
    }

    // Extras
    if (b.extras_qtd > bAnterior.extras_qtd) {
      linhas.push(`⭐ Extras cresceram ${b.extras_qtd - bAnterior.extras_qtd} unidade(s) vs semana passada — continue nessa direção!`);
    } else if (b.extras_qtd === 0 && b.atendimentos >= 5) {
      linhas.push('💡 Nenhum extra esta semana — cada venda adicional impacta diretamente a comissão.');
      acoes.push('Mencionar ao menos 1 produto ou serviço adicional por cliente: hidratação, sobrancelha, pomada ou combo');
    } else if (extrasRate < 0.2 && b.atendimentos >= 5) {
      linhas.push(`📦 Taxa de extras: ${fmtN(extrasRate * 100, 0)}% dos atendimentos. Dá para avançar mais aqui.`);
      acoes.push(`Meta para próxima semana: extras em pelo menos 30% dos atendimentos (hoje em ${fmtN(extrasRate * 100, 0)}%)`);
    }

    // Clientes novos
    if (b.clientes_novos >= 3) {
      linhas.push(`🆕 ${b.clientes_novos} novos clientes captados esta semana — ótima captação!`);
    } else if (b.clientes_novos === 1) {
      linhas.push('🆕 1 novo cliente captado esta semana.');
    } else if (b.clientes_novos === 0 && bAnterior.clientes_novos > 0) {
      linhas.push('🆕 Sem novos clientes esta semana.');
      acoes.push('Pedir 1 indicação por dia aos clientes fiéis ao final do atendimento');
    }

    // Média por dia
    if (mediaDia > 0 && b.dias_trabalhados > 0) {
      linhas.push(`📅 Média de ${fmtMoney(mediaDia)} por dia trabalhado (${b.dias_trabalhados} dias).`);
    }

  } else {
    // Sem comparativo — análise absoluta
    if (b.comissao > 0) {
      const pctComissao = b.faturamento > 0 ? (b.comissao / b.faturamento) * 100 : 0;
      linhas.push(`💰 Comissão de ${fmtMoney(b.comissao)} (${fmtN(pctComissao, 1)}% do faturamento).`);
      // Breakdown
      const comServ = b.comissao_servicos ?? 0;
      const comProd = b.comissao_produtos ?? 0;
      if (comServ > 0 || comProd > 0) {
        linhas.push(`   → Serviços: ${fmtMoney(comServ)} (${fmtN(b.comissao_pct_servicos ?? 0, 1)}%) · Produtos: ${fmtMoney(comProd)} (${fmtN(b.comissao_pct_produtos ?? 0, 1)}%)`);
      }
    }

    if (b.bonus > 0) {
      linhas.push(`🏆 *Bônus atingido: ${fmtMoney(b.bonus)}* — parabéns pela meta!`);
    }

    if (extrasRate >= 0.4) {
      linhas.push(`⭐ Excelente taxa de extras: ${fmtN(extrasRate * 100, 0)}% dos atendimentos — continue assim!`);
    } else if (extrasRate >= 0.2) {
      linhas.push(`⭐ Boa taxa de extras (${fmtN(extrasRate * 100, 0)}%). Ainda há espaço para crescer.`);
      acoes.push('Meta: atingir 40% de extras por atendimento');
    } else if (b.atendimentos >= 5) {
      linhas.push('💡 Oportunidade nos extras — cada produto ou serviço adicional impacta diretamente a comissão.');
      acoes.push('Oferecer ao menos 1 produto ou serviço adicional em cada atendimento');
    }

    if (b.clientes_novos > 0) {
      linhas.push(`🆕 ${b.clientes_novos} novo${b.clientes_novos > 1 ? 's' : ''} cliente${b.clientes_novos > 1 ? 's' : ''} captado${b.clientes_novos > 1 ? 's' : ''} esta semana!`);
    } else if (b.atendimentos >= 5) {
      acoes.push('Pedir 1 indicação por dia aos clientes regulares ao final do atendimento');
    }

    if (mediaDia > 0) {
      linhas.push(`📅 Média de ${fmtMoney(mediaDia)} por dia trabalhado.`);
    }
  }

  // Plano de ação
  if (acoes.length > 0) {
    linhas.push('');
    linhas.push('🎯 *Plano de ação para a próxima semana:*');
    acoes.forEach((a, i) => linhas.push(`${i + 1}. ${a}`));
  }

  linhas.push('');
  linhas.push('💪 Obrigado pelo esforço! Estamos juntos!');

  return '\n\n' + linhas.join('\n');
}

export function fillTemplate(
  corpo: string,
  b: ByColaborador,
  bAnterior: ByColaborador | null,
  semanaInicio: Date,
  semanaFim: Date
): string {
  const semana = `${format(semanaInicio, 'dd/MM')} – ${format(semanaFim, 'dd/MM')}`;
  const nome = b.colaborador_nome?.split(' ')[0] || b.colaborador_nome || 'Barbeiro';
  const dias = b.dias_trabalhados;
  const mediaDia = dias > 0 ? b.faturamento / dias : 0;

  const comissaoServicos = b.comissao_servicos ?? b.comissao;
  const comissaoProdutos = b.comissao_produtos ?? 0;
  const fatProdutos = b.faturamento_produtos ?? 0;
  const fatServicos = b.faturamento - fatProdutos;
  const pctServicos = b.comissao_pct_servicos ?? b.comissao_pct;
  const pctProdutos = b.comissao_pct_produtos ?? 0;

  return corpo
    .replace(/\{\{nome\}\}/g, nome)
    .replace(/\{\{nome_completo\}\}/g, b.colaborador_nome || nome)
    .replace(/\{\{semana\}\}/g, semana)
    .replace(/\{\{comissao\}\}/g, fmtMoney(b.comissao))
    .replace(/\{\{var_comissao\}\}/g, varStr(b.comissao, bAnterior?.comissao ?? null))
    .replace(/\{\{bonus\}\}/g, b.bonus > 0 ? fmtMoney(b.bonus) : '')
    .replace(/\{\{faturamento\}\}/g, fmtMoney(b.faturamento))
    .replace(/\{\{var_faturamento\}\}/g, varStr(b.faturamento, bAnterior?.faturamento ?? null))
    .replace(/\{\{atendimentos\}\}/g, String(b.atendimentos))
    .replace(/\{\{var_atendimentos\}\}/g, varStr(b.atendimentos, bAnterior?.atendimentos ?? null))
    .replace(/\{\{ticket\}\}/g, fmtMoney(b.ticket_medio))
    .replace(/\{\{var_ticket\}\}/g, varStr(b.ticket_medio, bAnterior?.ticket_medio ?? null))
    .replace(/\{\{extras_qtd\}\}/g, String(b.extras_qtd))
    .replace(/\{\{extras_valor\}\}/g, fmtMoney(b.extras_valor))
    .replace(/\{\{clientes\}\}/g, String(b.clientes))
    .replace(/\{\{clientes_novos\}\}/g, String(b.clientes_novos))
    .replace(/\{\{dias\}\}/g, String(dias))
    .replace(/\{\{media_dia\}\}/g, fmtMoney(mediaDia))
    .replace(/\{\{comissao_servicos\}\}/g, fmtMoney(comissaoServicos))
    .replace(/\{\{comissao_produtos\}\}/g, fmtMoney(comissaoProdutos))
    .replace(/\{\{faturamento_servicos\}\}/g, fmtMoney(fatServicos))
    .replace(/\{\{faturamento_produtos\}\}/g, fmtMoney(fatProdutos))
    .replace(/\{\{pct_servicos\}\}/g, fmtN(pctServicos, 1) + '%')
    .replace(/\{\{pct_produtos\}\}/g, fmtN(pctProdutos, 1) + '%')
    .replace(/\{\{analise\}\}/g, gerarAnaliseTexto(b, bAnterior));
}

// ── Hook ─────────────────────────────────────────────────────

export function useRelatorioSemanalMensagens() {
  const [templates, setTemplates] = useState<SemanalTemplate[]>([]);
  const [envios, setEnvios] = useState<SemanalEnvio[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingEnvios, setLoadingEnvios] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Load templates ─────────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    const { data } = await (supabase
      .from('relatorio_semanal_templates' as any)
      .select('*')
      .eq('ativo', true)
      .order('padrao', { ascending: false })
      .order('created_at', { ascending: true }) as any);
    if (data) setTemplates(data as SemanalTemplate[]);
    setLoadingTemplates(false);
  }, []);

  // ── Load envios ────────────────────────────────────────────
  const loadEnvios = useCallback(async (semanaInicio?: string, semanaFim?: string) => {
    setLoadingEnvios(true);
    let query = (supabase
      .from('relatorio_semanal_envios' as any)
      .select('*')
      .order('enviado_em', { ascending: false }) as any);

    if (semanaInicio) query = query.gte('semana_inicio', semanaInicio);
    if (semanaFim) query = query.lte('semana_fim', semanaFim);

    const { data: envData } = await query.limit(200);
    if (envData) setEnvios(envData as SemanalEnvio[]);
    setLoadingEnvios(false);
  }, []);

  // ── Carregar histórico de telefone por colaborador ─────────
  const getUltimoTelefone = useCallback(async (colaboradorId: string): Promise<string | null> => {
    const { data: telData } = await (supabase
      .from('relatorio_semanal_envios' as any)
      .select('telefone')
      .eq('colaborador_id', colaboradorId)
      .not('telefone', 'is', null)
      .order('enviado_em', { ascending: false })
      .limit(1)
      .single() as any);
    return (telData as any)?.telefone ?? null;
  }, []);

  // ── Save envio ─────────────────────────────────────────────
  const saveEnvio = useCallback(async (params: {
    colaborador_id: string;
    colaborador_nome: string | null;
    telefone: string | null;
    semana_inicio: string;
    semana_fim: string;
    mensagem_final: string;
    template_id: string | null;
    notas?: string;
  }) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from('relatorio_semanal_envios' as any) as any).insert({
      ...params,
      notas: params.notas || null,
      enviado_por: user?.id ?? null,
    });
    setSaving(false);
    if (error) throw error;
    // Refresh envios
    await loadEnvios();
  }, [loadEnvios]);

  // ── Delete envio ───────────────────────────────────────────
  const deleteEnvio = useCallback(async (id: string) => {
    const { error } = await (supabase.from('relatorio_semanal_envios' as any) as any).delete().eq('id', id);
    if (error) throw error;
    setEnvios(prev => prev.filter(e => e.id !== id));
  }, []);

  // ── Save template ──────────────────────────────────────────
  const saveTemplate = useCallback(async (params: {
    id?: string;
    nome: string;
    corpo: string;
    padrao?: boolean;
  }) => {
    setSaving(true);
    try {
      // If setting as padrao, unset others first
      if (params.padrao) {
        await (supabase
          .from('relatorio_semanal_templates' as any) as any)
          .update({ padrao: false })
          .eq('padrao', true);
      }

      if (params.id) {
        const { error } = await (supabase
          .from('relatorio_semanal_templates' as any) as any)
          .update({ nome: params.nome, corpo: params.corpo, padrao: params.padrao ?? false, updated_at: new Date().toISOString() })
          .eq('id', params.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from('relatorio_semanal_templates' as any) as any)
          .insert({ nome: params.nome, corpo: params.corpo, padrao: params.padrao ?? false });
        if (error) throw error;
      }

      toast.success('Template salvo!');
      await loadTemplates();
    } finally {
      setSaving(false);
    }
  }, [loadTemplates]);

  // ── Delete template ────────────────────────────────────────
  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await (supabase
      .from('relatorio_semanal_templates' as any) as any)
      .update({ ativo: false })
      .eq('id', id);
    if (error) throw error;
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Template removido.');
  }, []);

  // ── Checks ─────────────────────────────────────────────────
  const isEnviado = useCallback((colaboradorId: string, semanaInicio: string, semanaFim: string) => {
    return envios.some(
      e => e.colaborador_id === colaboradorId &&
           e.semana_inicio === semanaInicio &&
           e.semana_fim === semanaFim
    );
  }, [envios]);

  const getEnviosDaBarbeiro = useCallback((colaboradorId: string) => {
    return envios.filter(e => e.colaborador_id === colaboradorId);
  }, [envios]);

  const templatePadrao = templates.find(t => t.padrao) ?? templates[0] ?? null;

  useEffect(() => {
    loadTemplates();
    loadEnvios();
  }, [loadTemplates, loadEnvios]);

  return {
    templates, templatePadrao,
    envios,
    loadingTemplates, loadingEnvios, saving,
    loadTemplates, loadEnvios,
    saveEnvio, deleteEnvio,
    saveTemplate, deleteTemplate,
    isEnviado, getEnviosDaBarbeiro,
    getUltimoTelefone,
    fillTemplate,
  };
}

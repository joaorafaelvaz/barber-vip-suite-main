// ============================================================
// FILE: src/components/clientes/ClientesGlossario.tsx
// Glossário explicativo de todas as métricas do Painel de Clientes
// ============================================================

import React, { useState } from 'react';
import { X, BookOpen, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface GlossarioEntry {
  nome: string;
  definicao: string;
  formula?: string;
  exemplo?: string;
  criterios?: string;
}

interface GlossarioSection {
  id: string;
  titulo: string;
  icon: string;
  entries: GlossarioEntry[];
}

const SECTIONS: GlossarioSection[] = [
  {
    id: 'kpis',
    titulo: 'KPIs Principais',
    icon: '📊',
    entries: [
      {
        nome: 'Total de Clientes',
        definicao: 'Número total de clientes únicos que foram atendidos pelo menos uma vez no período selecionado.',
        formula: 'COUNT(DISTINCT cliente_id) WHERE venda_data BETWEEN data_inicio AND data_fim',
        exemplo: 'Se 150 clientes diferentes foram atendidos entre Jan e Dez/2025, o total é 150.',
      },
      {
        nome: 'Clientes Novos',
        definicao: 'Clientes cuja primeira visita à barbearia ocorreu dentro do período selecionado. São clientes que nunca haviam sido atendidos antes.',
        formula: 'COUNT(clientes WHERE primeira_visita BETWEEN data_inicio AND data_fim)',
        exemplo: 'Se 30 clientes vieram pela primeira vez em Março/2025, esse mês teve 30 novos.',
      },
      {
        nome: 'Novos que Retornaram',
        definicao: 'Dos clientes novos captados no período, quantos retornaram para pelo menos uma segunda visita.',
        formula: 'COUNT(novos WHERE total_visitas >= 2)',
        exemplo: 'Se 30 novos foram captados e 12 voltaram, o valor é 12 (40% de retenção básica).',
      },
      {
        nome: 'Total de Atendimentos',
        definicao: 'Soma de todos os atendimentos (vendas de serviços) realizados no período, incluindo múltiplas visitas do mesmo cliente.',
        formula: 'COUNT(vendas) WHERE venda_data BETWEEN data_inicio AND data_fim',
      },
      {
        nome: 'Ticket Médio',
        definicao: 'Valor médio gasto por atendimento. Indica o valor médio que cada cliente gasta a cada visita.',
        formula: 'SUM(valor_total) / COUNT(atendimentos)',
        exemplo: 'Faturamento de R$ 15.000 com 300 atendimentos = Ticket médio de R$ 50,00.',
      },
      {
        nome: 'Valor Total',
        definicao: 'Soma de todos os valores faturados no período selecionado.',
        formula: 'SUM(valor_faturamento) WHERE venda_data BETWEEN data_inicio AND data_fim',
      },
    ],
  },
  {
    id: 'status',
    titulo: 'Status do Cliente',
    icon: '🏷️',
    entries: [
      {
        nome: 'Assíduo (Ativo VIP)',
        definicao: 'Cliente fidelizado com 2+ visitas que retorna antes do esperado. Demonstra alta regularidade.',
        criterios: 'Requer 2+ visitas no período. Dias sem vir ≤ 80% da cadência habitual do cliente.',
        exemplo: 'Cliente com cadência de 30 dias que voltou com 20 dias → VIP (20/30 = 67%, menor que 80%).',
      },
      {
        nome: 'Regular (Ativo Forte)',
        definicao: 'Cliente regular com 2+ visitas que mantém seu ritmo habitual de visitas.',
        criterios: 'Requer 2+ visitas. Dias sem vir entre 80% e 120% da cadência habitual.',
        exemplo: 'Cliente com cadência de 30 dias que está com 32 dias → Forte (32/30 = 107%, entre 80-120%).',
      },
      {
        nome: 'Espaçando (Ativo Leve)',
        definicao: 'Cliente com 2+ visitas que está espaçando as visitas além do padrão habitual. Sinal de alerta precoce.',
        criterios: 'Requer 2+ visitas. Dias sem vir entre 120% e 180% da cadência habitual.',
        exemplo: 'Cliente com cadência de 30 dias que está com 45 dias → Leve (45/30 = 150%).',
      },
      {
        nome: '1ª Vez (Aguardando Retorno)',
        definicao: 'Cliente que veio apenas 1 vez no período e está dentro da janela de 30 dias. Ainda é cedo para classificar fidelidade — não tem histórico de intervalos.',
        criterios: 'Exatamente 1 visita no período + última visita há ≤30 dias.',
        exemplo: 'Cliente novo que veio há 10 dias → Aguardando Retorno. Se voltar, será classificado por cadência (VIP, Forte etc). Se não voltar em 30 dias, passa a Em Risco.',
      },
      {
        nome: 'Em Risco',
        definicao: 'Cliente que está sumindo. Com 2+ visitas: já passou muito tempo além do esperado. Com 1 visita: 31-75 dias sem retornar.',
        criterios: 'Com 2+ visitas: dias sem vir entre 180% e 250% da cadência habitual. Com 1 visita: 31-75 dias sem vir.',
        exemplo: 'Cliente com cadência de 30 dias que está com 65 dias → Em Risco. OU cliente que veio 1 vez há 40 dias → Em Risco.',
      },
      {
        nome: 'Perdido',
        definicao: 'Cliente que não retornou há muito tempo. Pode incluir quem veio 1 vez e nunca fidelizou (>75 dias) ou quem tinha cadência e abandonou (>250% da cadência). O detalhamento mostra essa distinção.',
        criterios: 'Com 2+ visitas: dias sem vir > 250% da cadência habitual. Com 1 visita: > 75 dias sem vir.',
        exemplo: 'Cliente com cadência de 30 dias há 80 dias → Perdido (abandonou). Cliente com 1 visita há 90 dias → Perdido (nunca fidelizou).',
      },
      {
        nome: 'Nota sobre classificação',
        definicao: 'Clientes com apenas 1 visita recebem classificação separada (Aguardando → Em Risco → Perdido). Apenas clientes com 2 ou mais visitas têm cadência calculável e podem ser classificados como VIP, Forte ou Leve. Isso evita que um cliente novo sem histórico seja erroneamente classificado como "fidelizado".',
      },
    ],
  },
  {
    id: 'cadencia',
    titulo: 'Cadência e Recência',
    icon: '📅',
    entries: [
      {
        nome: 'Cadência Habitual',
        definicao: 'Intervalo médio (em dias) entre as visitas de um cliente. Calculado com base no histórico de atendimentos, usando mediana para eliminar outliers.',
        formula: 'MEDIANA(intervalos entre visitas consecutivas)',
        exemplo: 'Cliente com visitas em dias 1, 28, 55, 90 → intervalos de 27, 27, 35 → cadência ≈ 27 dias.',
      },
      {
        nome: 'Dias sem Vir',
        definicao: 'Quantidade de dias desde a última visita do cliente até a data de referência.',
        formula: 'data_referencia - data_ultima_visita',
      },
      {
        nome: 'Faixa: Até 20 dias',
        definicao: 'Clientes cuja última visita foi há no máximo 20 dias. Clientes com recência muito alta.',
      },
      {
        nome: 'Faixa: 21-30 dias',
        definicao: 'Clientes com última visita entre 21 e 30 dias atrás. Dentro do ciclo típico de barbearia.',
      },
      {
        nome: 'Faixa: 31-45 dias',
        definicao: 'Clientes com última visita entre 31 e 45 dias. Começando a espaçar.',
      },
      {
        nome: 'Faixa: 46-75 dias',
        definicao: 'Clientes com última visita entre 46 e 75 dias. Alerta de possível perda.',
      },
      {
        nome: 'Faixa: Mais de 75 dias',
        definicao: 'Clientes com mais de 75 dias sem visita. Alta probabilidade de não retorno espontâneo.',
      },
    ],
  },
  {
    id: 'frequencia',
    titulo: 'Faixas de Frequência',
    icon: '🔄',
    entries: [
      {
        nome: '1 vez (subdividida)',
        definicao: 'Clientes que vieram apenas uma vez no período. Subdividida em: Aguardando (≤30 dias desde a visita), >30 dias (31-60d, atenção) e >60 dias (provavelmente perdidos).',
      },
      {
        nome: '2 vezes',
        definicao: 'Clientes com exatamente 2 visitas no período. Início de recorrência.',
      },
      {
        nome: '3-4 vezes',
        definicao: 'Clientes com 3 a 4 visitas. Frequência moderada — cliente está se fidelizando.',
      },
      {
        nome: '5-9 vezes',
        definicao: 'Clientes frequentes com 5 a 9 visitas no período. Alta fidelização.',
      },
      {
        nome: '10-12 vezes',
        definicao: 'Clientes muito frequentes, base sólida da carteira.',
      },
      {
        nome: '13-15 vezes',
        definicao: 'Clientes com frequência quinzenal ou melhor. Altíssima fidelização.',
      },
      {
        nome: '16-20 vezes',
        definicao: 'Clientes super frequentes, vêm quase semanalmente.',
      },
      {
        nome: '21-30 vezes',
        definicao: 'Clientes com frequência semanal. Extremamente fiéis.',
      },
      {
        nome: '30+ vezes',
        definicao: 'Clientes que vêm mais de 1 vez por semana. Os mais valiosos e engajados da carteira.',
      },
    ],
  },
  {
    id: 'barbeiros',
    titulo: 'Métricas por Barbeiro',
    icon: '💈',
    entries: [
      {
        nome: 'Clientes Únicos',
        definicao: 'Número de clientes diferentes atendidos pelo barbeiro no período.',
      },
      {
        nome: 'Clientes Novos',
        definicao: 'Quantidade de clientes cuja primeira visita à barbearia foi com este barbeiro.',
      },
      {
        nome: 'Clientes Exclusivos',
        definicao: 'Clientes que foram atendidos SOMENTE por este barbeiro no período. Não foram a nenhum outro.',
        formula: 'clientes WHERE qtd_barbeiros_visitados = 1 AND barbeiro = X',
      },
      {
        nome: 'Valor Total',
        definicao: 'Soma do faturamento gerado pelo barbeiro com todos os seus atendimentos no período.',
      },
    ],
  },
  {
    id: 'novos',
    titulo: 'Métricas de Clientes Novos',
    icon: '🆕',
    entries: [
      {
        nome: 'Retenção 30 dias',
        definicao: 'Percentual de clientes novos que retornaram dentro de 30 dias após a primeira visita.',
        formula: '(novos que voltaram em ≤30d / total novos) × 100',
        criterios: 'Benchmark barbearias: 30-40% é bom, acima de 40% é excelente.',
      },
      {
        nome: 'Retenção 60 dias',
        definicao: 'Percentual de clientes novos que retornaram dentro de 60 dias após a primeira visita.',
        criterios: 'Espera-se taxa superior à de 30 dias, pois inclui janela maior.',
      },
      {
        nome: 'Retenção 90 dias',
        definicao: 'Percentual de clientes novos que retornaram dentro de 90 dias após a primeira visita. Indica retenção de médio prazo.',
      },
      {
        nome: '% Recorrente 60d',
        definicao: 'Percentual de novos que tiveram 2 ou mais visitas adicionais em 60 dias. Indica fidelização real.',
      },
      {
        nome: 'Tempo Mediano 2ª Visita',
        definicao: 'Mediana do tempo (em dias) entre a primeira e a segunda visita dos clientes novos que retornaram.',
        exemplo: 'Se metade dos novos volta em até 18 dias, a mediana é 18 dias.',
      },
      {
        nome: 'Ticket 1ª Visita',
        definicao: 'Valor médio gasto pelos clientes novos na primeira visita.',
      },
      {
        nome: 'Ticket Recorrente',
        definicao: 'Valor médio gasto pelos novos clientes que se tornaram recorrentes. Comparar com ticket da 1ª visita mostra evolução do consumo.',
      },
      {
        nome: 'Status: 1 visita',
        definicao: 'Cliente novo que veio apenas uma vez e ainda não retornou dentro da janela de conversão.',
        criterios: 'Status temporário — pode evoluir para Recorrente ou Fiel se retornar.',
      },
      {
        nome: 'Status: Recorrente',
        definicao: 'Cliente novo que retornou pelo menos uma vez dentro da janela de conversão.',
      },
      {
        nome: 'Status: Fiel',
        definicao: 'Cliente novo que retornou múltiplas vezes e mantém vínculo exclusivo com o barbeiro que o captou.',
      },
      {
        nome: 'Status: Voltou tarde',
        definicao: 'Cliente novo que retornou, mas após a janela de conversão esperada.',
      },
      {
        nome: 'Status: Compartilhado',
        definicao: 'Cliente novo que retornou mas foi atendido por barbeiro diferente do que fez a primeira captação.',
      },
    ],
  },
  {
    id: 'evolucao',
    titulo: 'Evolução Mensal',
    icon: '📈',
    entries: [
      {
        nome: 'Clientes Únicos (mensal)',
        definicao: 'Quantidade de clientes diferentes atendidos em cada mês. Mostra a tendência de atividade da base.',
      },
      {
        nome: 'Novos (mensal)',
        definicao: 'Quantidade de clientes cuja primeira visita ocorreu naquele mês específico.',
      },
      {
        nome: 'Atendimentos (mensal)',
        definicao: 'Total de atendimentos realizados no mês, incluindo múltiplas visitas do mesmo cliente.',
      },
      {
        nome: 'Valor (mensal)',
        definicao: 'Faturamento total gerado no mês.',
      },
      {
        nome: 'Cohort Mensal',
        definicao: 'Análise que agrupa os clientes novos por mês de captação e acompanha quantos retornaram em 30, 60 e 90 dias. Permite comparar a qualidade da retenção ao longo do tempo.',
        exemplo: 'Cohort Jan/2025: 20 novos → 8 voltaram em 30d (40%), 12 em 60d (60%), 14 em 90d (70%).',
      },
    ],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientesGlossario({ open, onOpenChange }: Props) {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg">Glossário de Métricas — Painel de Clientes</DialogTitle>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Explicação detalhada de todos os indicadores, fórmulas e critérios de classificação.
          </p>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <div className="w-48 border-r border-border bg-muted/30 p-2 overflow-y-auto shrink-0">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-2 mb-0.5 ${
                  activeSection === s.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{s.icon}</span>
                <span className="truncate">{s.titulo}</span>
                {activeSection === s.id && <ChevronRight className="h-3 w-3 ml-auto shrink-0" />}
              </button>
            ))}
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 max-h-[calc(90vh-80px)]">
            <div className="p-4 space-y-4">
              {SECTIONS.filter(s => s.id === activeSection).map(section => (
                <div key={section.id}>
                  <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span>{section.icon}</span> {section.titulo}
                  </h2>
                  <div className="space-y-3">
                    {section.entries.map((entry, i) => (
                      <div key={i} className="rounded-lg border border-border bg-card p-3">
                        <h3 className="text-sm font-semibold text-foreground mb-1">{entry.nome}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{entry.definicao}</p>
                        {entry.formula && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Fórmula</Badge>
                            <code className="block mt-1 text-[10px] bg-muted/50 rounded px-2 py-1 text-foreground font-mono">
                              {entry.formula}
                            </code>
                          </div>
                        )}
                        {entry.criterios && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Critérios</Badge>
                            <p className="mt-1 text-[10px] text-muted-foreground italic">{entry.criterios}</p>
                          </div>
                        )}
                        {entry.exemplo && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Exemplo</Badge>
                            <p className="mt-1 text-[10px] text-muted-foreground">{entry.exemplo}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Aba de histórico de regras de comissão com filtros e ações
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Loader2,
  Calendar,
  Layers,
  Package,
  Globe,
  User,
  Pencil,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  useHistoricoRegrasCompleto,
  useExcluirRegra,
  useCopiarRegrasMes,
} from '@/hooks/useRegrasComissao';
import { HistoricoRegraItem, FaixaComissaoPeriodo } from '@/types/comissao';
import EditarRegraDialog from './EditarRegraDialog';

interface PeriodGroup {
  ano: number;
  mes: number;
  regras: HistoricoRegraItem[];
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Cores das faixas: transparência >50%, sem borda, escrita forte
const FAIXA_STYLES: Record<string, string> = {
  'tier-1': 'bg-amber-900/20 text-amber-500',
  'tier-2': 'bg-slate-400/20 text-slate-300',
  'tier-3': 'bg-yellow-600/20 text-yellow-400',
  'tier-4': 'bg-cyan-400/20 text-cyan-300',
  'tier-5': 'bg-purple-400/20 text-purple-300',
};

interface FiltrosHistorico {
  ano: number | null;
  mes: number | null;
  colaboradorId: string | null;
}

export default function HistoricoRegrasTab() {
  const hoje = new Date();
  const [filtros, setFiltros] = useState<FiltrosHistorico>({
    ano: hoje.getFullYear(),
    mes: null,
    colaboradorId: null,
  });
  const [editando, setEditando] = useState<HistoricoRegraItem | null>(null);
  const [expandirBarbeiros, setExpandirBarbeiros] = useState(false);

  const { data: historico, isLoading, colaboradores } = useHistoricoRegrasCompleto(filtros);
  const { mutate: excluirRegra, isPending: excluindo } = useExcluirRegra();
  const { mutate: copiarRegras } = useCopiarRegrasMes();

  const handleExcluir = (regraId: string) => {
    excluirRegra(regraId);
  };

  const handleDuplicar = (regra: HistoricoRegraItem) => {
    const proximoMes = regra.regra.mes === 12 ? 1 : regra.regra.mes + 1;
    const proximoAno = regra.regra.mes === 12 ? regra.regra.ano + 1 : regra.regra.ano;

    copiarRegras({
      origemAno: regra.regra.ano,
      origemMes: regra.regra.mes,
      destinoAno: proximoAno,
      destinoMes: proximoMes,
      substituirExistente: false,
    });
  };

  const handleEditar = (item: HistoricoRegraItem) => {
    setEditando(item);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Agrupar por ano/mês
  const groupedByPeriod = (historico || []).reduce((acc, item) => {
    const key = `${item.regra.ano}-${item.regra.mes}`;
    if (!acc[key]) {
      acc[key] = { ano: item.regra.ano, mes: item.regra.mes, regras: [] };
    }
    acc[key].regras.push(item);
    return acc;
  }, {} as Record<string, { ano: number; mes: number; regras: HistoricoRegraItem[] }>);

  const periods = Object.values(groupedByPeriod).sort((a, b) => {
    if (a.ano !== b.ano) return b.ano - a.ano;
    return b.mes - a.mes;
  });

  // Encontrar regra efetiva para um colaborador em um período
  const findRegraEfetiva = (colaboradorId: string, ano: number, mes: number, tipo: 'SERVICO' | 'PRODUTO') => {
    const regrasDoMes = historico?.filter(
      (r) => r.regra.ano === ano && r.regra.mes === mes && r.regra.tipo === tipo
    ) || [];
    
    // Primeiro: regra individual
    const regraIndividual = regrasDoMes.find(r => r.regra.colaborador_id === colaboradorId);
    if (regraIndividual) return { regra: regraIndividual, fonte: 'Individual' };
    
    // Segundo: regra global do mês
    const regraGlobal = regrasDoMes.find(r => !r.regra.colaborador_id);
    if (regraGlobal) return { regra: regraGlobal, fonte: 'Global' };
    
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Histórico de Regras</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandirBarbeiros(!expandirBarbeiros)}
          >
            {expandirBarbeiros ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Recolher
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Ver por Barbeiro
              </>
            )}
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <Select
            value={filtros.ano?.toString() || 'todos'}
            onValueChange={(v) =>
              setFiltros({ ...filtros, ano: v === 'todos' ? null : parseInt(v, 10) })
            }
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {[2024, 2025, 2026, 2027].map((ano) => (
                <SelectItem key={ano} value={ano.toString()}>
                  {ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtros.mes?.toString() || 'todos'}
            onValueChange={(v) =>
              setFiltros({ ...filtros, mes: v === 'todos' ? null : parseInt(v, 10) })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {MESES.map((nome, index) => (
                <SelectItem key={index + 1} value={(index + 1).toString()}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtros.colaboradorId || 'todos'}
            onValueChange={(v) =>
              setFiltros({ ...filtros, colaboradorId: v === 'todos' ? null : v })
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Barbeiro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os barbeiros</SelectItem>
              <SelectItem value="global">Apenas regras globais</SelectItem>
              {colaboradores?.map((c) => (
                <SelectItem key={c.colaborador_id} value={c.colaborador_id}>
                  {c.colaborador_nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {periods.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">Nenhum histórico</h3>
          <p className="text-sm text-muted-foreground">
            Configure regras na aba "Regras" para começar.
          </p>
        </div>
      ) : (
        periods.map((period) => (
          <Card key={`${period.ano}-${period.mes}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">
                  {MESES[period.mes - 1]} {period.ano}
                </span>
                <Badge variant="outline" className="text-xs">
                  {period.regras.length} regra(s)
                </Badge>
              </div>

              <div className="space-y-3">
                {period.regras.map((item) => (
                  <RegraCard
                    key={item.regra.id}
                    item={item}
                    onExcluir={() => handleExcluir(item.regra.id)}
                    onDuplicar={() => handleDuplicar(item)}
                    onEditar={() => handleEditar(item)}
                    excluindo={excluindo}
                  />
                ))}

                {/* Visualização expandida por barbeiro */}
                {expandirBarbeiros && colaboradores && colaboradores.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <h4 className="text-sm font-medium text-foreground mb-3">
                      Regras por Profissional
                    </h4>
                    <div className="grid gap-2">
                      {colaboradores.map((colab) => {
                        const regraServicos = findRegraEfetiva(colab.colaborador_id, period.ano, period.mes, 'SERVICO');
                        const regraProdutos = findRegraEfetiva(colab.colaborador_id, period.ano, period.mes, 'PRODUTO');
                        
                        return (
                          <div key={colab.colaborador_id} className="p-2 rounded bg-muted/30 text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium text-foreground">{colab.colaborador_nome}</span>
                              {colab.tipo_colaborador && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {colab.tipo_colaborador}
                                </Badge>
                              )}
                            </div>
                            <div className="ml-5 space-y-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Layers className="h-3 w-3 text-blue-500" />
                                <span>Serviços:</span>
                                {regraServicos ? (
                                  <>
                                    <span className="text-foreground">
                                      {regraServicos.regra.regra.usa_escalonamento
                                        ? `Escalonado (${regraServicos.regra.faixas.length} faixas)`
                                        : `${regraServicos.regra.regra.percentual_fixo}% fixo`
                                      }
                                    </span>
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                                      {regraServicos.fonte}
                                    </Badge>
                                  </>
                                ) : (
                                  <span className="text-yellow-500">Sem regra</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Package className="h-3 w-3 text-amber-500" />
                                <span>Produtos:</span>
                                {regraProdutos ? (
                                  <>
                                    <span className="text-foreground">
                                      {regraProdutos.regra.regra.usa_escalonamento
                                        ? `Escalonado (${regraProdutos.regra.faixas.length} faixas)`
                                        : `${regraProdutos.regra.regra.percentual_fixo}% fixo`
                                      }
                                    </span>
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                                      {regraProdutos.fonte}
                                    </Badge>
                                  </>
                                ) : (
                                  <span className="text-yellow-500">Sem regra</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Dialog de edição */}
      <EditarRegraDialog regra={editando} onClose={() => setEditando(null)} />
    </div>
  );
}

interface RegraCardProps {
  item: HistoricoRegraItem;
  onExcluir: () => void;
  onDuplicar: () => void;
  onEditar: () => void;
  excluindo: boolean;
}

function RegraCard({ item, onExcluir, onDuplicar, onEditar, excluindo }: RegraCardProps) {
  const isGlobal = !item.regra.colaborador_id;

  return (
    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {isGlobal ? (
            <Globe className="h-4 w-4 text-blue-500" />
          ) : (
            <User className="h-4 w-4 text-amber-500" />
          )}
          <span className="font-medium text-sm text-foreground">
            {isGlobal ? 'Regra Global' : item.colaborador_nome || 'Individual'}
          </span>
          {!isGlobal && (
            <Badge variant="outline" className="text-xs">
              Individual
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={onEditar}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onDuplicar}
            title="Duplicar para próximo mês"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. A regra e todas as faixas associadas
                  serão removidas permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onExcluir}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={excluindo}
                >
                  {excluindo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Excluir'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="space-y-2">
        {/* Serviços */}
        {item.regra.tipo === 'SERVICO' && (
          <RegraDetalhes tipo="SERVICO" item={item} />
        )}

        {/* Produtos */}
        {item.regra.tipo === 'PRODUTO' && (
          <RegraDetalhes tipo="PRODUTO" item={item} />
        )}
      </div>
    </div>
  );
}

interface RegraDetalhesProps {
  tipo: 'SERVICO' | 'PRODUTO';
  item: HistoricoRegraItem;
}

function RegraDetalhes({ tipo, item }: RegraDetalhesProps) {
  const icon =
    tipo === 'SERVICO' ? (
      <Layers className="h-3.5 w-3.5 text-blue-500" />
    ) : (
      <Package className="h-3.5 w-3.5 text-amber-500" />
    );

  return (
    <div className="flex items-center gap-2 text-sm">
      {icon}
      <span className="text-muted-foreground">
        {tipo === 'SERVICO' ? 'Serviços:' : 'Produtos:'}
      </span>
      {item.regra.usa_escalonamento ? (
        <div className="flex flex-wrap gap-1">
          <span className="text-muted-foreground text-xs">Escalonado</span>
          {item.faixas.map((faixa) => (
            <FaixaBadge key={faixa.id} faixa={faixa} />
          ))}
        </div>
      ) : (
        <span className="font-medium text-foreground">{item.regra.percentual_fixo}% fixo</span>
      )}
    </div>
  );
}

function FaixaBadge({ faixa }: { faixa: FaixaComissaoPeriodo }) {
  return (
    <Badge
      className={`text-xs border-none ${FAIXA_STYLES[faixa.cor] || 'bg-muted text-foreground'}`}
    >
      {faixa.nome} ({faixa.percentual}%)
    </Badge>
  );
}

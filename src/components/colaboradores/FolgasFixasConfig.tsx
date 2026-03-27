// ============================================================
// FILE: src/components/colaboradores/FolgasFixasConfig.tsx
// PROPÓSITO: Configuração de folgas fixas com resumo e histórico expansível
// ============================================================

import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  Save, 
  AlertCircle, 
  Edit2, 
  X, 
  Plus, 
  Trash2,
  ChevronDown,
  ChevronRight,
  ArrowLeftRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFolgas } from '@/hooks/useFolgas';
import { DIAS_SEMANA, type CalendarioColaboradorMensal } from '@/types/colaborador';

interface FolgasFixasConfigProps {
  colaboradorId: string;
  colaboradorNome: string;
  calendario?: CalendarioColaboradorMensal;
  ano?: number;
  mes?: number;
}

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const currentYear = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

export function FolgasFixasConfig({ 
  colaboradorId, 
  colaboradorNome,
  calendario,
  ano,
  mes
}: FolgasFixasConfigProps) {
  const { 
    folgasAvulsas,
    isLoading,
    gerarFolgasFixasPeriodo,
    deleteFolgasFixasPeriodo,
    deleteFolgaAvulsa,
    trocarFolgaFixa,
  } = useFolgas({ colaboradorId });
  
  const [isEditing, setIsEditing] = useState(false);
  const [mesesExpandidos, setMesesExpandidos] = useState<Set<string>>(new Set());
  const [anosExpandidos, setAnosExpandidos] = useState<Set<number>>(new Set([new Date().getFullYear()]));
  
  // Período de geração
  const [mesInicio, setMesInicio] = useState(new Date().getMonth() + 1);
  const [anoInicio, setAnoInicio] = useState(currentYear);
  const [mesFim, setMesFim] = useState(12);
  const [anoFim, setAnoFim] = useState(currentYear);
  
  // Dias da semana selecionados
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([]);
  
  // Estado para edição de período específico
  const [editandoPeriodo, setEditandoPeriodo] = useState<{
    mes: number;
    ano: number;
    diasAtuais: number[];
  } | null>(null);
  
  // Estado para confirmação de exclusão
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<{
    mes: number;
    ano: number;
    mesNome: string;
    totalDias: number;
  } | null>(null);
  
  // Estado para troca de folga
  const [trocandoFolga, setTrocandoFolga] = useState<{
    id: string;
    colaboradorId: string;
    dataAtual: string;
    dataFormatada: string;
  } | null>(null);
  const [novaDataTroca, setNovaDataTroca] = useState<Date | undefined>();
  const [motivoTroca, setMotivoTroca] = useState('');
  
  // Folgas fixas existentes (tipo = 'folga_fixa')
  const folgasFixasExistentes = useMemo(() => {
    return folgasAvulsas.filter(f => f.tipo === 'folga_fixa');
  }, [folgasAvulsas]);
  
  
  // =============================================
  // HISTÓRICO AGRUPADO POR ANO > MÊS > DIAS
  // =============================================
  const historicoAgrupadoPorAno = useMemo(() => {
    // Primeiro, agrupar por ano-mês
    const grupos: Record<string, { 
      datas: Array<{ id: string; data: string; dataFormatada: string; motivo?: string | null }>;
      diasSemana: Set<number>;
    }> = {};
    
    folgasFixasExistentes.forEach(f => {
      const [fAno, fMes] = f.data.split('-');
      const chave = `${fAno}-${fMes}`;
      if (!grupos[chave]) {
        grupos[chave] = { datas: [], diasSemana: new Set() };
      }
      
      const dataObj = new Date(f.data + 'T00:00:00');
      grupos[chave].datas.push({
        id: f.id,
        data: f.data,
        dataFormatada: format(dataObj, "EEE, dd 'de' MMMM", { locale: ptBR }),
        motivo: f.motivo,
      });
      grupos[chave].diasSemana.add(getDay(dataObj));
    });
    
    // Ordenar datas dentro de cada grupo
    Object.values(grupos).forEach(grupo => {
      grupo.datas.sort((a, b) => a.data.localeCompare(b.data));
    });
    
    // Converter para lista de meses
    const mesesList = Object.entries(grupos)
      .map(([chave, dados]) => {
        const [grupoAno, grupoMes] = chave.split('-');
        return {
          chave,
          ano: parseInt(grupoAno),
          mes: parseInt(grupoMes),
          mesNome: MESES.find(m => m.value === parseInt(grupoMes))?.label || '',
          totalDias: dados.datas.length,
          diasSemana: Array.from(dados.diasSemana).sort((a, b) => a - b),
          datas: dados.datas,
        };
      })
      .sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano;
        return b.mes - a.mes;
      });
    
    // Agrupar por ano
    const porAno: Record<number, typeof mesesList> = {};
    mesesList.forEach(item => {
      if (!porAno[item.ano]) porAno[item.ano] = [];
      porAno[item.ano].push(item);
    });
    
    // Converter para array ordenado
    return Object.entries(porAno)
      .map(([anoStr, meses]) => ({
        ano: parseInt(anoStr),
        meses,
        totalDias: meses.reduce((sum, m) => sum + m.totalDias, 0),
      }))
      .sort((a, b) => b.ano - a.ano);
  }, [folgasFixasExistentes]);
  
  // Calcular quantidade de datas a serem geradas
  const datasPreview = useMemo(() => {
    if (diasSelecionados.length === 0) return [];
    
    const inicioMes = editandoPeriodo ? editandoPeriodo.mes : mesInicio;
    const inicioAno = editandoPeriodo ? editandoPeriodo.ano : anoInicio;
    const fimMes = editandoPeriodo ? editandoPeriodo.mes : mesFim;
    const fimAno = editandoPeriodo ? editandoPeriodo.ano : anoFim;
    
    const inicio = startOfMonth(new Date(inicioAno, inicioMes - 1));
    const fim = endOfMonth(new Date(fimAno, fimMes - 1));
    const todasDatas = eachDayOfInterval({ start: inicio, end: fim });
    
    return todasDatas.filter(data => diasSelecionados.includes(getDay(data)));
  }, [diasSelecionados, mesInicio, anoInicio, mesFim, anoFim, editandoPeriodo]);
  
  const handleToggleDia = (diaSemana: number) => {
    setDiasSelecionados(prev => 
      prev.includes(diaSemana)
        ? prev.filter(d => d !== diaSemana)
        : [...prev, diaSemana]
    );
  };
  
  const handleToggleAno = (ano: number) => {
    setAnosExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(ano)) {
        next.delete(ano);
      } else {
        next.add(ano);
      }
      return next;
    });
  };
  
  const handleToggleMes = (chave: string) => {
    setMesesExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(chave)) {
        next.delete(chave);
      } else {
        next.add(chave);
      }
      return next;
    });
  };
  
  const handleStartEdit = () => {
    setDiasSelecionados([]);
    setMesInicio(new Date().getMonth() + 1);
    setAnoInicio(currentYear);
    setMesFim(12);
    setAnoFim(currentYear);
    setEditandoPeriodo(null);
    setIsEditing(true);
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setDiasSelecionados([]);
    setEditandoPeriodo(null);
  };
  
  const handleEditarPeriodo = (item: { mes: number; ano: number; diasSemana: number[] }) => {
    setEditandoPeriodo({
      mes: item.mes,
      ano: item.ano,
      diasAtuais: item.diasSemana,
    });
    setDiasSelecionados(item.diasSemana);
    setIsEditing(true);
  };
  
  const handleConfirmarExclusao = (item: { mes: number; ano: number; mesNome: string; totalDias: number }) => {
    setConfirmandoExclusao(item);
  };
  
  const handleExcluir = () => {
    if (!confirmandoExclusao) return;
    
    deleteFolgasFixasPeriodo.mutate({
      colaboradorId,
      mes: confirmandoExclusao.mes,
      ano: confirmandoExclusao.ano,
    }, {
      onSuccess: () => {
        setConfirmandoExclusao(null);
      }
    });
  };
  
  const handleExcluirDiaIndividual = (folgaId: string) => {
    deleteFolgaAvulsa.mutate(folgaId);
  };
  
  // Handlers para troca de folga
  const handleIniciarTroca = (data: { id: string; data: string; dataFormatada: string }) => {
    setTrocandoFolga({
      id: data.id,
      colaboradorId,
      dataAtual: data.data,
      dataFormatada: data.dataFormatada,
    });
    setNovaDataTroca(undefined);
    setMotivoTroca('');
  };

  const handleCancelarTroca = () => {
    setTrocandoFolga(null);
    setNovaDataTroca(undefined);
    setMotivoTroca('');
  };

  const handleConfirmarTroca = () => {
    if (!trocandoFolga || !novaDataTroca) return;
    
    trocarFolgaFixa.mutate({
      folgaId: trocandoFolga.id,
      colaboradorId: trocandoFolga.colaboradorId,
      dataAntiga: format(new Date(trocandoFolga.dataAtual + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
      dataNova: format(novaDataTroca, 'yyyy-MM-dd'),
      motivo: motivoTroca || undefined,
    }, {
      onSuccess: () => {
        handleCancelarTroca();
      }
    });
  };
  
  const handleSalvar = () => {
    if (diasSelecionados.length === 0) return;
    
    const inicioMes = editandoPeriodo ? editandoPeriodo.mes : mesInicio;
    const inicioAno = editandoPeriodo ? editandoPeriodo.ano : anoInicio;
    const fimMes = editandoPeriodo ? editandoPeriodo.mes : mesFim;
    const fimAno = editandoPeriodo ? editandoPeriodo.ano : anoFim;
    
    gerarFolgasFixasPeriodo.mutate({
      colaboradorId,
      diasSemana: diasSelecionados,
      mesInicio: inicioMes,
      anoInicio: inicioAno,
      mesFim: fimMes,
      anoFim: fimAno,
    }, {
      onSuccess: () => {
        setIsEditing(false);
        setDiasSelecionados([]);
        setEditandoPeriodo(null);
      }
    });
  };

  const isPending = gerarFolgasFixasPeriodo.isPending || deleteFolgasFixasPeriodo.isPending || deleteFolgaAvulsa.isPending || trocarFolgaFixa.isPending;

  return (
    <>
      {/* HISTÓRICO DE FOLGAS FIXAS - Colapsável */}
      <Collapsible>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity">
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      Folgas Fixas
                      <Badge variant="secondary" className="text-xs font-normal">
                        {folgasFixasExistentes.length} dias
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Histórico completo de folgas fixas de {colaboradorNome.split(' ')[0]}
                    </CardDescription>
                  </div>
                </button>
              </CollapsibleTrigger>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEdit}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Gerar Novas
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
          {/* Modo edição */}
          {isEditing && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              {/* Título do modo edição */}
              {editandoPeriodo && (
                <Alert className="bg-muted/50 border-muted">
                  <Edit2 className="h-4 w-4" />
                  <AlertDescription>
                    Editando folgas de <strong>{MESES.find(m => m.value === editandoPeriodo.mes)?.label} {editandoPeriodo.ano}</strong>
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Passo 1: Selecionar dias da semana */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {editandoPeriodo ? 'Alterar dias da semana:' : 'Passo 1: Dias da semana que são folga'}
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {DIAS_SEMANA.map(dia => {
                    const selecionado = diasSelecionados.includes(dia.value);
                    
                    return (
                      <div 
                        key={dia.value} 
                        className={`
                          flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer
                          ${selecionado ? 'bg-primary/10 border-primary/30' : 'border-border hover:bg-muted/50'}
                        `}
                        onClick={() => handleToggleDia(dia.value)}
                      >
                        <Checkbox
                          id={`folga-fixa-${dia.value}`}
                          checked={selecionado}
                          onCheckedChange={() => handleToggleDia(dia.value)}
                          disabled={isLoading || isPending}
                        />
                        <Label 
                          htmlFor={`folga-fixa-${dia.value}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {dia.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Passo 2: Selecionar período (apenas no modo criar novo) */}
              {!editandoPeriodo && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Passo 2: Período</Label>
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-background rounded-lg border">
                    <span className="text-sm">De:</span>
                    <Select value={String(mesInicio)} onValueChange={v => setMesInicio(parseInt(v))}>
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MESES.map(m => (
                          <SelectItem key={m.value} value={String(m.value)}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(anoInicio)} onValueChange={v => setAnoInicio(parseInt(v))}>
                      <SelectTrigger className="w-[80px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ANOS.map(a => (
                          <SelectItem key={a} value={String(a)}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <span className="text-sm ml-2">Até:</span>
                    <Select value={String(mesFim)} onValueChange={v => setMesFim(parseInt(v))}>
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MESES.map(m => (
                          <SelectItem key={m.value} value={String(m.value)}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(anoFim)} onValueChange={v => setAnoFim(parseInt(v))}>
                      <SelectTrigger className="w-[80px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ANOS.map(a => (
                          <SelectItem key={a} value={String(a)}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              {/* Preview da quantidade */}
              {diasSelecionados.length > 0 && (
                <Alert className="bg-primary/10 border-primary/30">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    Serão geradas <strong>{datasPreview.length}</strong> datas de folga
                    ({diasSelecionados.map(d => DIAS_SEMANA[d]?.label).join(' + ')})
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Botões de ação */}
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="ghost"
                  onClick={handleCancelEdit}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSalvar}
                  disabled={diasSelecionados.length === 0 || isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isPending ? 'Salvando...' : (editandoPeriodo ? 'Salvar Alterações' : 'Gerar Folgas')}
                </Button>
              </div>
            </div>
          )}
          
          {/* Lista de histórico - Agrupado por ANO > MÊS */}
          {!isEditing && (
            <div className="space-y-3">
              {historicoAgrupadoPorAno.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma folga fixa configurada. Clique em "Gerar Novas" para criar.
                </p>
              ) : (
                historicoAgrupadoPorAno.map(anoGrupo => (
                  <Collapsible
                    key={anoGrupo.ano}
                    open={anosExpandidos.has(anoGrupo.ano)}
                    onOpenChange={() => handleToggleAno(anoGrupo.ano)}
                  >
                    <div className="border rounded-lg overflow-hidden">
                      {/* Header do ano */}
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 w-full p-3 bg-muted/50 hover:bg-muted/70 transition-colors text-left">
                          {anosExpandidos.has(anoGrupo.ano) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-semibold text-sm">{anoGrupo.ano}</span>
                          <Badge variant="outline" className="text-xs">
                            {anoGrupo.totalDias} dias
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {anoGrupo.meses.length} {anoGrupo.meses.length === 1 ? 'mês' : 'meses'}
                          </Badge>
                        </button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="border-t">
                          {anoGrupo.meses.map(item => {
                            const isExpanded = mesesExpandidos.has(item.chave);
                            
                            return (
                              <Collapsible
                                key={item.chave}
                                open={isExpanded}
                                onOpenChange={() => handleToggleMes(item.chave)}
                              >
                                <div className="border-b last:border-b-0">
                                  {/* Header do mês */}
                                  <div className="flex items-center justify-between p-2 pl-6 bg-muted/20 hover:bg-muted/30 transition-colors">
                                    <CollapsibleTrigger asChild>
                                      <button className="flex items-center gap-2 flex-1 text-left">
                                        {isExpanded ? (
                                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                        )}
                                        <span className="font-medium text-sm">
                                          {item.mesNome}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          — {item.totalDias} dias
                                        </span>
                                        <div className="flex gap-1 ml-2">
                                          {item.diasSemana.map(d => (
                                            <Badge key={d} variant="secondary" className="text-xs py-0">
                                              {DIAS_SEMANA[d]?.short}
                                            </Badge>
                                          ))}
                                        </div>
                                      </button>
                                    </CollapsibleTrigger>
                                    
                                    {/* Botões de ação do mês */}
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditarPeriodo(item);
                                        }}
                                        title="Editar mês"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleConfirmarExclusao(item);
                                        }}
                                        title="Excluir mês"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                  
                                  {/* Lista de datas individuais */}
                                  <CollapsibleContent>
                                    <div className="divide-y border-t bg-background">
                                      {item.datas.map(data => (
                                        <div 
                                          key={data.id}
                                          className="flex items-center justify-between px-4 py-2 pl-10 text-sm hover:bg-muted/20 transition-colors"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="capitalize">{data.dataFormatada}</span>
                                            {/* Badge "Alterado" para folgas trocadas */}
                                            {data.motivo?.includes('Trocado') && (
                                              <Badge variant="outline" className="text-xs">
                                                Alterado
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {/* Botão Trocar */}
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-2 text-muted-foreground hover:text-primary"
                                              onClick={() => handleIniciarTroca(data)}
                                              disabled={isPending}
                                              title="Trocar esta data"
                                            >
                                              <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                                              <span className="text-xs">Trocar</span>
                                            </Button>
                                            {/* Botão Excluir */}
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                              onClick={() => handleExcluirDiaIndividual(data.id)}
                                              disabled={isPending}
                                              title="Excluir esta data"
                                            >
                                              <X className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))
              )}
            </div>
          )}
          </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      
      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!confirmandoExclusao} onOpenChange={(open) => !open && setConfirmandoExclusao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Folgas Fixas?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover {confirmandoExclusao?.totalDias} folgas fixas de {confirmandoExclusao?.mesNome} {confirmandoExclusao?.ano}.
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFolgasFixasPeriodo.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Dialog de troca de folga */}
      <Dialog open={!!trocandoFolga} onOpenChange={(open) => !open && handleCancelarTroca()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Trocar Folga
            </DialogTitle>
            <DialogDescription>
              Trocar a folga de <strong className="capitalize">{trocandoFolga?.dataFormatada}</strong> para outra data
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nova data</Label>
              <Calendar
                mode="single"
                selected={novaDataTroca}
                onSelect={setNovaDataTroca}
                locale={ptBR}
                disabled={(date) => {
                  const dataStr = format(date, 'yyyy-MM-dd');
                  // Desabilitar data atual e datas que já têm folga
                  return dataStr === trocandoFolga?.dataAtual ||
                         folgasAvulsas.some(f => f.data === dataStr);
                }}
                className="rounded-md border"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input
                placeholder="Ex: Trocou para cobrir evento"
                value={motivoTroca}
                onChange={(e) => setMotivoTroca(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelarTroca}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmarTroca}
              disabled={!novaDataTroca || trocarFolgaFixa.isPending}
            >
              {trocarFolgaFixa.isPending ? 'Trocando...' : 'Confirmar Troca'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

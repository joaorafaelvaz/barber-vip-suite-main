/**
 * Lista de regras de bônus com acompanhamento de status
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Target, Edit, Trash2, Plus, Users, User, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useBonusRegrasPeriodo,
  useDeleteBonusRegra,
  calcularBonus,
} from '@/hooks/useBonus';
import { ColaboradorKpis, KPI_CATALOGO } from '@/types/bonus';

interface BonusRegrasListProps {
  ano: number;
  mes: number;
  onAnoChange: (ano: number) => void;
  onMesChange: (mes: number) => void;
  onEditar: (regraId: string) => void;
  onNova: () => void;
}

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export default function BonusRegrasList({ ano, mes, onAnoChange, onMesChange, onEditar, onNova }: BonusRegrasListProps) {
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 5 }, (_, i) => anoAtual - i);
  const { data: regras, isLoading } = useBonusRegrasPeriodo(ano, mes);
  const deleteMutation = useDeleteBonusRegra();

  // Buscar KPIs dos colaboradores (da RPC do dashboard)
  const { data: kpisColaboradores } = useQuery({
    queryKey: ['kpis-colaboradores-bonus', ano, mes],
    queryFn: async () => {
      const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const fimMes = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

      const { data, error } = await supabase.rpc('rpc_dashboard_period', {
        p_inicio: inicioMes,
        p_fim: fimMes,
        p_colaborador_id: null,
        p_tipo_colaborador: null,
      });

      if (error) throw error;

      const byColaborador = (data as any)?.by_colaborador || [];
      
      return byColaborador.map((c: any): ColaboradorKpis => ({
        colaborador_id: c.colaborador_id,
        colaborador_nome: c.colaborador_nome,
        faturamento: c.faturamento || 0,
        atendimentos: c.atendimentos || 0,
        clientes: c.clientes || 0,
        clientes_novos: c.clientes_novos || 0,
        servicos_totais: c.servicos_totais || 0,
        extras_qtd: c.extras_qtd || 0,
        extras_valor: c.extras_valor || 0,
        dias_trabalhados: c.dias_trabalhados || 0,
        ticket_medio: c.ticket_medio || 0,
        faturamento_por_dia: c.faturamento_por_dia_trabalhado || 0,
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!regras || regras.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">Nenhuma regra de bônus</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Não há regras de bônus configuradas para {MESES_NOMES[mes - 1]} de {ano}
          </p>
          <Button onClick={onNova}>
            <Plus className="h-4 w-4 mr-1" />
            Criar Regra de Bônus
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h3 className="text-lg font-semibold text-foreground">
          Regras Ativas
        </h3>
        
        <div className="flex items-center gap-2">
          <Select value={String(mes)} onValueChange={(v) => onMesChange(Number(v))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((nomeMes, index) => (
                <SelectItem key={index + 1} value={String(index + 1)}>
                  {nomeMes}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={String(ano)} onValueChange={(v) => onAnoChange(Number(v))}>
            <SelectTrigger className="w-[90px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button onClick={onNova} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nova Regra
          </Button>
        </div>
      </div>

      {regras.map((regraCompleta) => {
        const r = regraCompleta.regra;
        const kpiInfo = r.kpi_key ? KPI_CATALOGO[r.kpi_key as keyof typeof KPI_CATALOGO] : null;
        
        // Calcular bônus para cada colaborador
        const resultados = (kpisColaboradores || [])
          .map((kpis) => ({
            kpis,
            resultado: calcularBonus(regraCompleta, kpis),
          }))
          .filter((item) => item.resultado.aplicavel);

        return (
          <Card key={r.id} className="overflow-hidden">
            <CardHeader className="pb-2 bg-muted/30">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base text-foreground">{r.nome_bonus}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEditar(r.id)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. A regra "{r.nome_bonus}" será excluída permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(r.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {r.colaborador_id ? (
                    <><User className="h-3 w-3 mr-1" />Individual</>
                  ) : (
                    <><Users className="h-3 w-3 mr-1" />Global</>
                  )}
                </Badge>
                {r.depende_meta && kpiInfo && (
                  <Badge variant="secondary" className="text-xs">
                    Meta: {formatNumber(r.meta_valor || 0)} {kpiInfo.label}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {r.tipo_bonus === 'valor_fixo' && `R$ ${formatNumber(r.bonus_valor || 0)} fixo`}
                  {r.tipo_bonus === 'percentual_extra' && `+${r.bonus_valor}% sobre comissão`}
                  {r.tipo_bonus === 'percentual_faturamento' && `${r.bonus_valor}% sobre ${r.base_calculo}`}
                  {r.tipo_bonus === 'valor_por_unidade' && `R$ ${formatNumber(r.bonus_valor || 0)} por unidade`}
                </Badge>
              </div>

              {r.descricao_regra && (
                <p className="text-sm text-muted-foreground mt-2">{r.descricao_regra}</p>
              )}
            </CardHeader>

            <CardContent className="pt-3">
              {resultados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum colaborador aplicável</p>
              ) : (
                <div className="space-y-2">
                  {resultados.map(({ kpis, resultado }) => {
                    const statusIcon = resultado.atingiu ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : resultado.progresso_meta >= 80 ? (
                      <Minus className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    );

                    const diferenca = resultado.diferenca_meta || 0;

                    return (
                      <div
                        key={kpis.colaborador_id}
                        className="p-2 rounded bg-muted/20 border border-border/50"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium text-sm">{kpis.colaborador_nome}</span>
                            {r.depende_meta && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <span>
                                  Meta: {formatNumber(r.meta_valor || 0)} | Realizado:{' '}
                                  {formatNumber(resultado.kpi_realizado)}
                                </span>
                                {diferenca !== 0 && (
                                  <span className={diferenca > 0 ? 'text-green-500' : 'text-red-500'}>
                                    ({diferenca > 0 ? '+' : ''}{formatNumber(diferenca)})
                                  </span>
                                )}
                              </div>
                            )}
                            {resultado.meta_por_dia !== undefined && (
                              <div className="text-xs text-muted-foreground">
                                Meta/dia: {resultado.meta_por_dia?.toFixed(1)} | Real/dia:{' '}
                                {resultado.realizado_por_dia?.toFixed(1)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {statusIcon}
                            <div className="text-right">
                              <Badge
                                variant={resultado.atingiu ? 'default' : 'secondary'}
                                className={resultado.atingiu ? 'bg-green-500/20 text-green-400' : ''}
                              >
                                {resultado.atingiu ? 'ATINGIU' : 'NÃO ATINGINDO'}
                              </Badge>
                              <div className="text-sm font-medium text-green-500 mt-1">
                                {resultado.atingiu ? formatBRL(resultado.bonus_calculado) : '-'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

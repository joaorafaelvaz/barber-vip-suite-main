/**
 * Formulário para criar/editar regra de bônus
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useCreateBonusRegra,
  useUpdateBonusRegra,
  useBonusRegrasAll,
} from '@/hooks/useBonus';
import { KPI_CATALOGO, TipoBonus, BaseCalculo, KpiKey } from '@/types/bonus';

interface BonusRegraFormProps {
  regraId?: string | null;
  anoInicial: number;
  mesInicial: number;
  onSalvou: () => void;
  onCancelar: () => void;
}

const MESES_NOMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

interface FaixaLocal {
  faixa_ordem: number;
  valor_minimo: number;
  valor_maximo: number | null;
  bonus_valor: number;
  nome: string;
}

export default function BonusRegraForm({
  regraId,
  anoInicial,
  mesInicial,
  onSalvou,
  onCancelar,
}: BonusRegraFormProps) {
  const createMutation = useCreateBonusRegra();
  const updateMutation = useUpdateBonusRegra();
  const { data: todasRegras } = useBonusRegrasAll();

  // Form state
  const [nomeBonus, setNomeBonus] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipoBonus, setTipoBonus] = useState<TipoBonus>('valor_fixo');
  const [baseCalculo, setBaseCalculo] = useState<BaseCalculo | null>(null);
  const [bonusValor, setBonusValor] = useState<number>(0);
  const [dependeMeta, setDependeMeta] = useState(false);
  const [kpiKey, setKpiKey] = useState<KpiKey | null>(null);
  const [itemAlvo, setItemAlvo] = useState('');
  const [metaValor, setMetaValor] = useState<number>(0);
  const [usaEscalonamento, setUsaEscalonamento] = useState(false);
  const [faixas, setFaixas] = useState<FaixaLocal[]>([]);
  const [escopoGlobal, setEscopoGlobal] = useState(true);
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [anoSelecionado, setAnoSelecionado] = useState(anoInicial);
  const [mesesSelecionados, setMesesSelecionados] = useState<number[]>([mesInicial]);

  // Buscar colaboradores ativos
  const { data: colaboradores } = useQuery({
    queryKey: ['colaboradores-ativos-bonus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dimensao_colaboradores')
        .select('colaborador_id, colaborador_nome, tipo_colaborador')
        .eq('ativo', true)
        .in('tipo_colaborador', ['barbeiro', 'recepcao'])
        .order('colaborador_nome');
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar produtos (para item_alvo)
  const { data: produtos } = useQuery({
    queryKey: ['produtos-lista-bonus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dimensao_produtos')
        .select('produto, servicos_ou_produtos')
        .eq('servicos_ou_produtos', 'servicos')
        .order('produto');
      if (error) throw error;
      return data || [];
    },
  });

  // Carregar regra existente
  useEffect(() => {
    if (regraId && todasRegras) {
      const regraCompleta = todasRegras.find((r) => r.regra.id === regraId);
      if (regraCompleta) {
        const r = regraCompleta.regra;
        setNomeBonus(r.nome_bonus);
        setDescricao(r.descricao_regra || '');
        setTipoBonus(r.tipo_bonus);
        setBaseCalculo(r.base_calculo);
        setBonusValor(r.bonus_valor || 0);
        setDependeMeta(r.depende_meta);
        setKpiKey(r.kpi_key);
        setItemAlvo(r.item_alvo || '');
        setMetaValor(r.meta_valor || 0);
        setUsaEscalonamento(r.usa_escalonamento);
        setEscopoGlobal(!r.colaborador_id);
        setColaboradorId(r.colaborador_id);
        setFaixas(
          regraCompleta.faixas.map((f) => ({
            faixa_ordem: f.faixa_ordem,
            valor_minimo: f.valor_minimo,
            valor_maximo: f.valor_maximo,
            bonus_valor: f.bonus_valor,
            nome: f.nome || '',
          }))
        );
        if (regraCompleta.periodos.length > 0) {
          setAnoSelecionado(regraCompleta.periodos[0].ano);
          setMesesSelecionados(regraCompleta.periodos.map((p) => p.mes));
        }
      }
    }
  }, [regraId, todasRegras]);

  const handleToggleMes = (mes: number) => {
    setMesesSelecionados((prev) =>
      prev.includes(mes) ? prev.filter((m) => m !== mes) : [...prev, mes]
    );
  };

  const handleAddFaixa = () => {
    const ordem = faixas.length + 1;
    const ultimaFaixa = faixas[faixas.length - 1];
    setFaixas([
      ...faixas,
      {
        faixa_ordem: ordem,
        valor_minimo: ultimaFaixa ? (ultimaFaixa.valor_maximo || 0) + 1 : 0,
        valor_maximo: null,
        bonus_valor: 0,
        nome: `Faixa ${ordem}`,
      },
    ]);
  };

  const handleRemoveFaixa = (ordem: number) => {
    setFaixas(faixas.filter((f) => f.faixa_ordem !== ordem));
  };

  const handleUpdateFaixa = (ordem: number, field: keyof FaixaLocal, value: any) => {
    setFaixas(
      faixas.map((f) => (f.faixa_ordem === ordem ? { ...f, [field]: value } : f))
    );
  };

  const handleSubmit = async () => {
    const input = {
      nome_bonus: nomeBonus,
      descricao_regra: descricao || undefined,
      colaborador_id: escopoGlobal ? null : colaboradorId,
      tipo_bonus: tipoBonus,
      base_calculo: tipoBonus === 'percentual_faturamento' ? baseCalculo : undefined,
      bonus_valor: bonusValor,
      depende_meta: dependeMeta,
      kpi_key: dependeMeta ? kpiKey : undefined,
      item_alvo: (kpiKey === 'item_qtd' || kpiKey === 'item_valor') ? itemAlvo : undefined,
      meta_valor: dependeMeta ? metaValor : undefined,
      usa_escalonamento: usaEscalonamento,
      faixas: usaEscalonamento ? faixas : [],
      periodos: mesesSelecionados.map((mes) => ({ ano: anoSelecionado, mes })),
    };

    if (regraId) {
      await updateMutation.mutateAsync({ id: regraId, ...input });
    } else {
      await createMutation.mutateAsync(input);
    }

    onSalvou();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const kpiRequerItem = kpiKey === 'item_qtd' || kpiKey === 'item_valor';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-foreground">
          {regraId ? 'Editar Regra de Bônus' : 'Criar Nova Regra de Bônus'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Nome e Descrição */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Bônus *</Label>
            <Input
              id="nome"
              value={nomeBonus}
              onChange={(e) => setNomeBonus(e.target.value)}
              placeholder="Ex: Bônus Hidratação"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Meta de 30 hidratações no mês"
              rows={2}
            />
          </div>
        </div>

        {/* Período */}
        <div className="space-y-2">
          <Label>Período de Validade</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(anoSelecionado)}
              onValueChange={(v) => setAnoSelecionado(Number(v))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {MESES_NOMES.map((nome, idx) => {
                const mes = idx + 1;
                const selecionado = mesesSelecionados.includes(mes);
                return (
                  <Badge
                    key={mes}
                    variant={selecionado ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => handleToggleMes(mes)}
                  >
                    {nome}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>

        {/* Profissional */}
        <div className="space-y-2">
          <Label>Profissional</Label>
          <RadioGroup
            value={escopoGlobal ? 'global' : 'individual'}
            onValueChange={(v) => setEscopoGlobal(v === 'global')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="global" id="global" />
              <Label htmlFor="global" className="font-normal cursor-pointer">
                GLOBAL (todos)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="individual" id="individual" />
              <Label htmlFor="individual" className="font-normal cursor-pointer">
                Profissional específico
              </Label>
            </div>
          </RadioGroup>
          {!escopoGlobal && (
            <Select
              value={colaboradorId || ''}
              onValueChange={setColaboradorId}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {colaboradores?.map((c) => (
                  <SelectItem key={c.colaborador_id} value={c.colaborador_id}>
                    {c.colaborador_nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tipo de Bônus */}
        <div className="space-y-2">
          <Label>Tipo de Bônus</Label>
          <RadioGroup
            value={tipoBonus}
            onValueChange={(v) => setTipoBonus(v as TipoBonus)}
            className="grid gap-2 sm:grid-cols-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="valor_fixo" id="valor_fixo" />
              <Label htmlFor="valor_fixo" className="font-normal cursor-pointer">
                Valor fixo (R$)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="percentual_extra" id="percentual_extra" />
              <Label htmlFor="percentual_extra" className="font-normal cursor-pointer">
                % extra sobre comissão
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="percentual_faturamento" id="percentual_faturamento" />
              <Label htmlFor="percentual_faturamento" className="font-normal cursor-pointer">
                % sobre faturamento
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="valor_por_unidade" id="valor_por_unidade" />
              <Label htmlFor="valor_por_unidade" className="font-normal cursor-pointer">
                R$ por unidade de KPI
              </Label>
            </div>
          </RadioGroup>

          {tipoBonus === 'percentual_faturamento' && (
            <Select
              value={baseCalculo || ''}
              onValueChange={(v) => setBaseCalculo(v as BaseCalculo)}
            >
              <SelectTrigger className="w-full sm:w-64 mt-2">
                <SelectValue placeholder="Selecione a base..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="faturamento_total">Faturamento Total</SelectItem>
                <SelectItem value="faturamento_extras">Faturamento Extras</SelectItem>
                <SelectItem value="faturamento_base">Faturamento Base</SelectItem>
                <SelectItem value="comissao_total">Comissão Total</SelectItem>
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2 mt-2">
            <Label htmlFor="bonusValor" className="w-32">
              Valor do Bônus:
            </Label>
            <Input
              id="bonusValor"
              type="number"
              value={bonusValor}
              onChange={(e) => setBonusValor(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">
              {tipoBonus.includes('percentual') ? '%' : 'R$'}
            </span>
          </div>
        </div>

        {/* Condição de Meta */}
        <div className="space-y-3 p-4 border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <Label>Depende de meta para ativar?</Label>
            <Switch checked={dependeMeta} onCheckedChange={setDependeMeta} />
          </div>

          {dependeMeta && (
            <div className="space-y-3 pt-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>KPI</Label>
                  <Select
                    value={kpiKey || ''}
                    onValueChange={(v) => setKpiKey(v as KpiKey)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(KPI_CATALOGO).map(([key, info]) => (
                        <SelectItem key={key} value={key}>
                          {info.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {kpiRequerItem && (
                  <div className="space-y-2">
                    <Label>Item Alvo</Label>
                    <Select value={itemAlvo} onValueChange={setItemAlvo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos?.map((p) => (
                          <SelectItem key={p.produto} value={p.produto}>
                            {p.produto}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label className="w-16">Meta:</Label>
                <span className="text-sm text-muted-foreground">≥</span>
                <Input
                  type="number"
                  value={metaValor}
                  onChange={(e) => setMetaValor(Number(e.target.value))}
                  className="w-24"
                />
              </div>
            </div>
          )}
        </div>

        {/* Escalonamento */}
        <div className="space-y-3 p-4 border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <Label>Usar escalonamento por faixas?</Label>
            <Switch checked={usaEscalonamento} onCheckedChange={setUsaEscalonamento} />
          </div>

          {usaEscalonamento && (
            <div className="space-y-3 pt-2">
              {faixas.map((faixa) => (
                <div
                  key={faixa.faixa_ordem}
                  className="flex flex-wrap items-center gap-2 p-2 bg-muted/30 rounded"
                >
                  <Input
                    value={faixa.nome}
                    onChange={(e) =>
                      handleUpdateFaixa(faixa.faixa_ordem, 'nome', e.target.value)
                    }
                    className="w-24"
                    placeholder="Nome"
                  />
                  <span className="text-xs text-muted-foreground">De:</span>
                  <Input
                    type="number"
                    value={faixa.valor_minimo}
                    onChange={(e) =>
                      handleUpdateFaixa(faixa.faixa_ordem, 'valor_minimo', Number(e.target.value))
                    }
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">Até:</span>
                  <Input
                    type="number"
                    value={faixa.valor_maximo ?? ''}
                    onChange={(e) =>
                      handleUpdateFaixa(
                        faixa.faixa_ordem,
                        'valor_maximo',
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="w-20"
                    placeholder="∞"
                  />
                  <span className="text-xs text-muted-foreground">Bônus:</span>
                  <Input
                    type="number"
                    value={faixa.bonus_valor}
                    onChange={(e) =>
                      handleUpdateFaixa(faixa.faixa_ordem, 'bonus_valor', Number(e.target.value))
                    }
                    className="w-20"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveFaixa(faixa.faixa_ordem)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={handleAddFaixa}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Faixa
              </Button>
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={onCancelar} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !nomeBonus}>
            <Save className="h-4 w-4 mr-1" />
            {regraId ? 'Atualizar' : 'Salvar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

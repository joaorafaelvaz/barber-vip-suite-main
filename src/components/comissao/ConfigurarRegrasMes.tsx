/**
 * Container com sub-abas: Configurar Regras / Histórico
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Layers, Package, Calendar, Users, Settings, History } from 'lucide-react';
import FaixasEditor from './FaixasEditor';
import MesesSelector from './MesesSelector';
import BarbeirosSelector from './BarbeirosSelector';
import HistoricoRegrasTab from './HistoricoRegrasTab';
import { useRegrasEfetivasMes, useSalvarConfiguracaoBatch } from '@/hooks/useRegrasComissao';
import { FAIXAS_PADRAO, ConfiguracaoMesData } from '@/types/comissao';

interface ConfigurarRegrasMesProps {
  ano: number;
  mes: number;
}

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const ANOS_DISPONIVEIS = [2024, 2025, 2026, 2027];

export default function ConfigurarRegrasMes({ ano: anoInicial, mes: mesInicial }: ConfigurarRegrasMesProps) {
  const [subTab, setSubTab] = useState<'configurar' | 'historico'>('configurar');

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as 'configurar' | 'historico')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="configurar" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configurar</span>
            <span className="sm:hidden text-xs">Config.</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
            <span className="sm:hidden text-xs">Hist.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configurar" className="mt-4">
          <ConfigurarRegrasForm anoInicial={anoInicial} mesInicial={mesInicial} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoRegrasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ConfigurarRegrasFormProps {
  anoInicial: number;
  mesInicial: number;
}

function ConfigurarRegrasForm({ anoInicial, mesInicial }: ConfigurarRegrasFormProps) {
  // Seletores de período
  const [ano, setAno] = useState(anoInicial);
  const [mesReferencia, setMesReferencia] = useState(mesInicial);
  const [mesesSelecionados, setMesesSelecionados] = useState<number[]>([mesInicial]);
  const [aplicarAteAlterada, setAplicarAteAlterada] = useState(false);

  // Seletores de barbeiros
  const [modoBarbeiros, setModoBarbeiros] = useState<'global' | 'especificos'>('global');
  const [colaboradoresSelecionados, setColaboradoresSelecionados] = useState<string[]>([]);

  // Regras
  const { regraServicos, regraProdutos, isLoading } = useRegrasEfetivasMes(ano, mesReferencia, null);
  const { mutate: salvarBatch, isPending: isSaving } = useSalvarConfiguracaoBatch();

  const [config, setConfig] = useState<ConfiguracaoMesData>({
    servicos: {
      usa_escalonamento: true,
      percentual_fixo: null,
      faixas: [...FAIXAS_PADRAO],
    },
    produtos: {
      usa_escalonamento: false,
      percentual_fixo: 10,
      faixas: [],
    },
  });

  // Carregar dados existentes
  useEffect(() => {
    if (regraServicos || regraProdutos) {
      setConfig({
        servicos: {
          usa_escalonamento: regraServicos?.regra.usa_escalonamento ?? true,
          percentual_fixo: regraServicos?.regra.percentual_fixo ?? null,
          faixas: regraServicos?.faixas.length
            ? regraServicos.faixas.map((f) => ({
                faixa_ordem: f.faixa_ordem,
                nome: f.nome,
                valor_minimo: f.valor_minimo,
                valor_maximo: f.valor_maximo,
                percentual: f.percentual,
                cor: f.cor,
              }))
            : [...FAIXAS_PADRAO],
        },
        produtos: {
          usa_escalonamento: regraProdutos?.regra.usa_escalonamento ?? false,
          percentual_fixo: regraProdutos?.regra.percentual_fixo ?? 10,
          faixas: regraProdutos?.faixas.length
            ? regraProdutos.faixas.map((f) => ({
                faixa_ordem: f.faixa_ordem,
                nome: f.nome,
                valor_minimo: f.valor_minimo,
                valor_maximo: f.valor_maximo,
                percentual: f.percentual,
                cor: f.cor,
              }))
            : [],
        },
      });
    }
  }, [regraServicos, regraProdutos]);

  const handleSave = () => {
    const mesesParaSalvar = aplicarAteAlterada
      ? Array.from({ length: 12 - mesReferencia + 1 }, (_, i) => mesReferencia + i)
      : mesesSelecionados;

    const colaboradoresParaSalvar =
      modoBarbeiros === 'global' ? null : colaboradoresSelecionados;

    salvarBatch({
      ano,
      meses: mesesParaSalvar,
      colaboradoresIds: colaboradoresParaSalvar,
      config,
      aplicarAteAlterada,
    });
  };

  const resumoSelecao = () => {
    const mesesTexto = aplicarAteAlterada
      ? `${MESES_NOMES[mesReferencia - 1]} em diante`
      : mesesSelecionados.length === 1
      ? MESES_NOMES[mesesSelecionados[0] - 1]
      : `${mesesSelecionados.length} meses`;

    const barbeirosTexto =
      modoBarbeiros === 'global'
        ? 'Todos os barbeiros'
        : colaboradoresSelecionados.length === 0
        ? 'Nenhum selecionado'
        : `${colaboradoresSelecionados.length} barbeiro(s)`;

    return `${mesesTexto} ${ano} • ${barbeirosTexto}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Configurar Regras de Comissão</h2>
          <p className="text-sm text-muted-foreground">{resumoSelecao()}</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={
            isSaving ||
            (modoBarbeiros === 'especificos' && colaboradoresSelecionados.length === 0) ||
            (!aplicarAteAlterada && mesesSelecionados.length === 0)
          }
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Regras
        </Button>
      </div>

      {/* Seletor de Período */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            Período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="w-32">
              <Label className="text-xs text-muted-foreground">Mês Referência</Label>
              <Select
                value={mesReferencia.toString()}
                onValueChange={(v) => {
                  const novoMes = parseInt(v, 10);
                  setMesReferencia(novoMes);
                  setMesesSelecionados([novoMes]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES_NOMES.map((nome, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24">
              <Label className="text-xs text-muted-foreground">Ano</Label>
              <Select
                value={ano.toString()}
                onValueChange={(v) => setAno(parseInt(v, 10))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANOS_DISPONIVEIS.map((a) => (
                    <SelectItem key={a} value={a.toString()}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <MesesSelector
            mesesSelecionados={mesesSelecionados}
            onChange={setMesesSelecionados}
            aplicarAteAlterada={aplicarAteAlterada}
            onAplicarAteAlteradaChange={setAplicarAteAlterada}
            mesInicial={mesReferencia}
          />
        </CardContent>
      </Card>

      {/* Seletor de Barbeiros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Barbeiros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BarbeirosSelector
            modo={modoBarbeiros}
            onModoChange={setModoBarbeiros}
            colaboradoresSelecionados={colaboradoresSelecionados}
            onColaboradoresChange={setColaboradoresSelecionados}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* Comissão de Serviços */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-blue-500" />
            Comissão de Serviços
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Usar faixas escalonadas</Label>
              <p className="text-xs text-muted-foreground">
                Diferentes percentuais por faixa de faturamento
              </p>
            </div>
            <Switch
              checked={config.servicos.usa_escalonamento}
              onCheckedChange={(checked) =>
                setConfig({
                  ...config,
                  servicos: { ...config.servicos, usa_escalonamento: checked },
                })
              }
            />
          </div>

          {config.servicos.usa_escalonamento ? (
            <FaixasEditor
              faixas={config.servicos.faixas}
              onChange={(faixas) =>
                setConfig({
                  ...config,
                  servicos: { ...config.servicos, faixas },
                })
              }
            />
          ) : (
            <div className="max-w-xs">
              <Label>Percentual Fixo (%)</Label>
              <Input
                type="number"
                value={config.servicos.percentual_fixo ?? ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    servicos: {
                      ...config.servicos,
                      percentual_fixo: e.target.value ? Number(e.target.value) : null,
                    },
                  })
                }
                min={0}
                max={100}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Comissão de Produtos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-amber-500" />
            Comissão de Produtos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Usar faixas escalonadas</Label>
              <p className="text-xs text-muted-foreground">
                Geralmente produtos têm comissão fixa menor
              </p>
            </div>
            <Switch
              checked={config.produtos.usa_escalonamento}
              onCheckedChange={(checked) =>
                setConfig({
                  ...config,
                  produtos: { ...config.produtos, usa_escalonamento: checked },
                })
              }
            />
          </div>

          {config.produtos.usa_escalonamento ? (
            <FaixasEditor
              faixas={config.produtos.faixas}
              onChange={(faixas) =>
                setConfig({
                  ...config,
                  produtos: { ...config.produtos, faixas },
                })
              }
            />
          ) : (
            <div className="max-w-xs">
              <Label>Percentual Fixo (%)</Label>
              <Input
                type="number"
                value={config.produtos.percentual_fixo ?? ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    produtos: {
                      ...config.produtos,
                      percentual_fixo: e.target.value ? Number(e.target.value) : null,
                    },
                  })
                }
                min={0}
                max={100}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

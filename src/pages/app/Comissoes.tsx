/**
 * Página de Comissões - Visualização e configuração de comissões
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Settings, DollarSign, Gift } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useComissoesMes } from '@/hooks/useComissoes';
import ComissaoFilters from '@/components/comissao/ComissaoFilters';
import ComissaoResumoCards from '@/components/comissao/ComissaoResumoCards';
import ComissaoColaboradorCard from '@/components/comissao/ComissaoColaboradorCard';
import ConfigurarRegrasMes from '@/components/comissao/ConfigurarRegrasMes';
import BonusTab from '@/components/comissao/BonusTab';
import { HowToReadSection } from '@/components/help/HowToReadSection';

export default function Comissoes() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [tipoColaborador, setTipoColaborador] = useState<'barbeiro' | null>(null);

  const { comissoes, resumo, isLoading } = useComissoesMes(ano, mes, tipoColaborador);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">COMISSÕES</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Visualize e configure as comissões dos colaboradores
        </p>
      </div>

      <HowToReadSection
        bullets={[
          'Relatório = comissão calculada de cada colaborador no mês selecionado.',
          'Regras = configuração das faixas de comissão (escalonamento ou % fixo) por mês.',
          'Bônus = premiações extras por metas de KPI (faturamento, atendimentos, etc.).',
          'Faixa = nível de comissão atingido pelo colaborador com base no faturamento.',
          'Total a receber = comissão base + bônus do período.',
        ]}
        expandedText="Configure primeiro as regras na aba Regras, depois acompanhe os resultados na aba Relatório. Bônus são calculados automaticamente com base nas metas configuradas. Use o filtro de tipo para ver apenas barbeiros ou todos."
      />

      {/* Tabs - 3 abas principais */}
      <Tabs defaultValue="relatorio" className="flex-1">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="relatorio" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Relatório</span>
            <span className="sm:hidden text-xs">Rel.</span>
          </TabsTrigger>
          <TabsTrigger value="regras" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Regras</span>
            <span className="sm:hidden text-xs">Reg.</span>
          </TabsTrigger>
          <TabsTrigger value="bonus" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            <span className="hidden sm:inline">Bônus</span>
            <span className="sm:hidden text-xs">Bônus</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Relatório Comissões */}
        <TabsContent value="relatorio" className="mt-4 space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <ComissaoFilters
              ano={ano}
              mes={mes}
              onAnoChange={setAno}
              onMesChange={setMes}
            />
            <Select
              value={tipoColaborador || 'todos'}
              onValueChange={(v) => setTipoColaborador(v === 'todos' ? null : v as 'barbeiro')}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="barbeiro">Barbeiros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resumo */}
          <ComissaoResumoCards resumo={resumo} isLoading={isLoading} />

          {/* Lista de colaboradores */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-[200px]" />
                  </CardContent>
                </Card>
              ))
            ) : comissoes.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground">Nenhum dado de comissão</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Configure as regras na aba "Regras" para calcular comissões
                  </p>
                </CardContent>
              </Card>
            ) : (
              comissoes.map((comissao, index) => (
                <ComissaoColaboradorCard
                  key={comissao.colaborador_id}
                  comissao={comissao}
                  ranking={index + 1}
                  ano={ano}
                  mes={mes}
                />
              ))
            )}
          </div>
        </TabsContent>

        {/* Tab: Regras (com sub-abas Configurar/Histórico) */}
        <TabsContent value="regras" className="mt-4">
          <ConfigurarRegrasMes ano={ano} mes={mes} />
        </TabsContent>

        {/* Tab: Bônus */}
        <TabsContent value="bonus" className="mt-4">
          <BonusTab ano={ano} mes={mes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

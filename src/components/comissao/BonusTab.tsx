/**
 * Aba principal de Regra Bônus
 * Contém: Formulário de criação + Lista de regras + Histórico
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, List, History } from 'lucide-react';
import BonusRegraForm from './BonusRegraForm';
import BonusRegrasList from './BonusRegrasList';
import BonusHistoricoTab from './BonusHistoricoTab';

interface BonusTabProps {
  ano: number;
  mes: number;
}

export default function BonusTab({ ano: anoInicial, mes: mesInicial }: BonusTabProps) {
  const [subTab, setSubTab] = useState<'criar' | 'lista' | 'historico'>('lista');
  const [editandoRegra, setEditandoRegra] = useState<string | null>(null);
  
  // Estado local para filtro da lista de regras ativas
  const [anoLista, setAnoLista] = useState(anoInicial);
  const [mesLista, setMesLista] = useState(mesInicial);

  const handleEditar = (regraId: string) => {
    setEditandoRegra(regraId);
    setSubTab('criar');
  };

  const handleCriarNova = () => {
    setEditandoRegra(null);
    setSubTab('criar');
  };

  const handleSalvou = () => {
    setEditandoRegra(null);
    setSubTab('lista');
  };

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as 'criar' | 'lista' | 'historico')}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="lista" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Regras Ativas</span>
            <span className="sm:hidden">Lista</span>
          </TabsTrigger>
          <TabsTrigger value="criar" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{editandoRegra ? 'Editar' : 'Nova Regra'}</span>
            <span className="sm:hidden">{editandoRegra ? 'Editar' : 'Nova'}</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span>Histórico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4">
          <BonusRegrasList 
            ano={anoLista} 
            mes={mesLista}
            onAnoChange={setAnoLista}
            onMesChange={setMesLista}
            onEditar={handleEditar}
            onNova={handleCriarNova}
          />
        </TabsContent>

        <TabsContent value="criar" className="mt-4">
          <BonusRegraForm
            regraId={editandoRegra}
            anoInicial={anoLista}
            mesInicial={mesLista}
            onSalvou={handleSalvou}
            onCancelar={() => {
              setEditandoRegra(null);
              setSubTab('lista');
            }}
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <BonusHistoricoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

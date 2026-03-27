import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, Calendar, Phone, User, TrendingDown, 
  AlertTriangle, Clock, DollarSign, BarChart3 
} from 'lucide-react';

interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  ultima_visita: string;
  dias_sem_vir: number;
  valor_historico: number;
  visitas_totais: number;
  status: 'perdido_fidelizado' | 'perdido_oneshot' | 'resgatado' | 'em_risco';
  periodo_churn?: string;
  barbeiro_anterior?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barbeiroId?: string;
  barbeiroNome?: string;
  tipo: 'perdidos' | 'resgatados' | 'em_risco';
  periodo?: string;
  // Em uma implementação real, estes dados viriam de uma API
  clientes?: Cliente[];
}

// Mock data para demonstração
const mockClientes: Cliente[] = [
  {
    id: '1',
    nome: 'João Silva',
    telefone: '(11) 99999-9999',
    ultima_visita: '2024-01-15',
    dias_sem_vir: 45,
    valor_historico: 850,
    visitas_totais: 12,
    status: 'perdido_fidelizado',
    periodo_churn: '2024-02',
    barbeiro_anterior: 'Carlos'
  },
  {
    id: '2',
    nome: 'Pedro Santos',
    telefone: '(11) 98888-8888',
    ultima_visita: '2024-02-20',
    dias_sem_vir: 25,
    valor_historico: 120,
    visitas_totais: 2,
    status: 'perdido_oneshot',
    periodo_churn: '2024-03'
  },
  {
    id: '3',
    nome: 'Maria Costa',
    telefone: '(11) 97777-7777',
    ultima_visita: '2024-03-10',
    dias_sem_vir: 15,
    valor_historico: 450,
    visitas_totais: 8,
    status: 'resgatado',
    periodo_churn: '2024-03'
  }
];

export function ChurnDrillModal({ 
  open, 
  onOpenChange, 
  barbeiroId, 
  barbeiroNome = 'Barbeiro', 
  tipo, 
  periodo,
  clientes = mockClientes 
}: Props) {
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [ordenacao, setOrdenacao] = useState<'nome' | 'dias' | 'valor'>('dias');

  const titulo = {
    perdidos: 'Clientes Perdidos',
    resgatados: 'Clientes Resgatados',
    em_risco: 'Clientes em Risco'
  }[tipo];

  const statusFilter = {
    perdidos: ['perdido_fidelizado', 'perdido_oneshot'],
    resgatados: ['resgatado'],
    em_risco: ['em_risco']
  }[tipo];

  const clientesFiltrados = clientes
    .filter(c => statusFilter.includes(c.status))
    .filter(c => !filtroNome || c.nome.toLowerCase().includes(filtroNome.toLowerCase()))
    .filter(c => filtroStatus === 'todos' || c.status === filtroStatus)
    .sort((a, b) => {
      switch (ordenacao) {
        case 'nome': return a.nome.localeCompare(b.nome);
        case 'valor': return b.valor_historico - a.valor_historico;
        default: return b.dias_sem_vir - a.dias_sem_vir;
      }
    });

  const estatisticas = {
    total: clientesFiltrados.length,
    valor_perdido: clientesFiltrados.reduce((sum, c) => sum + c.valor_historico, 0),
    ticket_medio: clientesFiltrados.length > 0 
      ? clientesFiltrados.reduce((sum, c) => sum + c.valor_historico, 0) / clientesFiltrados.length 
      : 0,
    fidelizados: clientesFiltrados.filter(c => c.status === 'perdido_fidelizado').length,
    oneshot: clientesFiltrados.filter(c => c.status === 'perdido_oneshot').length
  };

  const getStatusBadge = (status: Cliente['status']) => {
    const variants = {
      perdido_fidelizado: { variant: 'destructive' as const, label: 'Fidelizado Perdido', icon: TrendingDown },
      perdido_oneshot: { variant: 'secondary' as const, label: 'One-shot Perdido', icon: Clock },
      resgatado: { variant: 'default' as const, label: 'Resgatado', icon: TrendingDown },
      em_risco: { variant: 'outline' as const, label: 'Em Risco', icon: AlertTriangle }
    };
    return variants[status];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {titulo} - {barbeiroNome}
            {periodo && <Badge variant="outline">{periodo}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* Estatísticas Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card className="bg-muted/30">
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold">{estatisticas.total}</div>
              <div className="text-xs text-muted-foreground">Total de Clientes</div>
            </CardContent>
          </Card>
          
          <Card className="bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-red-600">
                R$ {estatisticas.valor_perdido.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Valor Total</div>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-blue-600">
                R$ {Math.round(estatisticas.ticket_medio).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Ticket Médio</div>
            </CardContent>
          </Card>
          
          <Card className="bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-orange-600">
                {estatisticas.fidelizados}/{estatisticas.oneshot}
              </div>
              <div className="text-xs text-muted-foreground">Fideliz./One-shot</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {tipo === 'perdidos' && (
                <>
                  <SelectItem value="perdido_fidelizado">Fidelizados</SelectItem>
                  <SelectItem value="perdido_oneshot">One-shot</SelectItem>
                </>
              )}
              {tipo === 'resgatados' && (
                <SelectItem value="resgatado">Resgatados</SelectItem>
              )}
              {tipo === 'em_risco' && (
                <SelectItem value="em_risco">Em Risco</SelectItem>
              )}
            </SelectContent>
          </Select>
          
          <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as typeof ordenacao)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dias">Por Dias</SelectItem>
              <SelectItem value="valor">Por Valor</SelectItem>
              <SelectItem value="nome">Por Nome</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Clientes */}
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {clientesFiltrados.map((cliente) => {
              const statusInfo = getStatusBadge(cliente.status);
              const StatusIcon = statusInfo.icon;
              
              return (
                <div
                  key={cliente.id}
                  className="p-3 border border-border/30 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{cliente.nome}</span>
                      <Badge {...statusInfo}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </div>
                    
                    <div className="text-right text-xs text-muted-foreground">
                      <div>ID: {cliente.id}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span>{cliente.telefone || 'Sem telefone'}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>{new Date(cliente.ultima_visita).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className={cliente.dias_sem_vir > 60 ? 'text-red-600 font-medium' : ''}>
                        {cliente.dias_sem_vir} dias
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        R$ {cliente.valor_historico.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <BarChart3 className="h-3 w-3" />
                      <span>{cliente.visitas_totais} visitas históricas</span>
                      {cliente.barbeiro_anterior && (
                        <span>• Barbeiro anterior: {cliente.barbeiro_anterior}</span>
                      )}
                    </div>
                    
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-6 text-xs px-2">
                        Contatar
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 text-xs px-2">
                        Histórico
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {clientesFiltrados.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum cliente encontrado com os filtros aplicados</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Ações do Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {clientesFiltrados.length} cliente(s) encontrado(s)
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button variant="outline">
              Exportar Lista
            </Button>
            <Button>
              Ações em Massa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
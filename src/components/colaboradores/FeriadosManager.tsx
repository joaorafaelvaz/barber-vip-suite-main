import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useFeriados } from '@/hooks/useFeriados';
import { useBarbeariaConfig } from '@/hooks/useBarbeariaConfig';
import type { Feriado, DiasFechadosConfig } from '@/types/colaborador';
import { DIAS_SEMANA } from '@/types/colaborador';

interface FeriadosManagerProps {
  ano: number;
}

export function FeriadosManager({ ano }: FeriadosManagerProps) {
  const { feriados, isLoading, createFeriado, updateFeriado, deleteFeriado } = useFeriados(ano);
  const { diasFechados, updateDiasFechados } = useBarbeariaConfig();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Feriado | null>(null);
  const [formData, setFormData] = useState({
    data: new Date(),
    nome: '',
    tipo: 'nacional' as Feriado['tipo'],
    barbearia_fecha: true,
  });

  const handleOpenDialog = (feriado?: Feriado) => {
    if (feriado) {
      setEditando(feriado);
      setFormData({
        data: new Date(feriado.data + 'T00:00:00'),
        nome: feriado.nome,
        tipo: feriado.tipo,
        barbearia_fecha: feriado.barbearia_fecha,
      });
    } else {
      setEditando(null);
      setFormData({
        data: new Date(),
        nome: '',
        tipo: 'nacional',
        barbearia_fecha: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = {
      data: format(formData.data, 'yyyy-MM-dd'),
      nome: formData.nome,
      tipo: formData.tipo,
      barbearia_fecha: formData.barbearia_fecha,
    };

    if (editando) {
      updateFeriado.mutate({ id: editando.id, ...payload });
    } else {
      createFeriado.mutate(payload);
    }
    setDialogOpen(false);
  };

  const handleToggleDiaFechado = (dia: keyof DiasFechadosConfig) => {
    updateDiasFechados.mutate({
      ...diasFechados,
      [dia]: !diasFechados[dia],
    });
  };

  // Agrupa feriados por mês
  const feriadosPorMes = feriados.reduce((acc, f) => {
    const mes = new Date(f.data + 'T00:00:00').getMonth();
    if (!acc[mes]) acc[mes] = [];
    acc[mes].push(f);
    return acc;
  }, {} as Record<number, Feriado[]>);

  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return (
    <div className="space-y-6">
      {/* Dias que a barbearia fecha por padrão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dias Fixos de Fechamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {DIAS_SEMANA.map(dia => {
              const chave = dia.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') as keyof DiasFechadosConfig;
              const isChecked = diasFechados[chave] ?? false;
              
              return (
                <div key={dia.value} className="flex items-center gap-2">
                  <Switch
                    id={`dia-${dia.value}`}
                    checked={isChecked}
                    onCheckedChange={() => handleToggleDiaFechado(chave)}
                  />
                  <Label htmlFor={`dia-${dia.value}`} className="text-sm cursor-pointer">
                    {dia.label}
                  </Label>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Marque os dias da semana em que a barbearia não abre regularmente.
          </p>
        </CardContent>
      </Card>

      {/* Lista de feriados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Feriados {ano}</CardTitle>
          <Button size="sm" onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Carregando...</div>
          ) : feriados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum feriado cadastrado para {ano}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => handleOpenDialog()}>
                Adicionar primeiro feriado
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(feriadosPorMes)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([mesIndex, feriadosMes]) => (
                  <div key={mesIndex}>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      {MESES[Number(mesIndex)]}
                    </h4>
                    <div className="space-y-2">
                      {feriadosMes.map(feriado => (
                        <div 
                          key={feriado.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-medium w-12">
                              {format(new Date(feriado.data + 'T00:00:00'), 'dd/MM')}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{feriado.nome}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span className="capitalize">{feriado.tipo}</span>
                                {!feriado.barbearia_fecha && (
                                  <span className="text-warning">• Abre normalmente</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleOpenDialog(feriado)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover feriado?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja remover "{feriado.nome}"?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => deleteFeriado.mutate(feriado.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Feriado' : 'Novo Feriado'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.data, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.data}
                    onSelect={(date) => date && setFormData({ ...formData, data: date })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Natal, Carnaval..."
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v: Feriado['tipo']) => setFormData({ ...formData, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nacional">Nacional</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="especial">Especial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Barbearia fecha</Label>
                <p className="text-xs text-muted-foreground">
                  Desative se a barbearia abre neste feriado
                </p>
              </div>
              <Switch
                checked={formData.barbearia_fecha}
                onCheckedChange={(checked) => setFormData({ ...formData, barbearia_fecha: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.nome.trim() || createFeriado.isPending || updateFeriado.isPending}
            >
              {editando ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/i18n';
import { useUnits, Unit } from '@/hooks/useUnits';
import { useOrgs } from '@/hooks/useOrgs';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MapPin, Plus, Pencil, Users, Power, PowerOff, Building2, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Unidades() {
  const { t } = useI18n();
  const { isMaster, isFranquiaAdmin } = usePermissions();
  const { organizations } = useOrgs();
  const canManage = isMaster || isFranquiaAdmin;

  // Filter state
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string | null>(null);
  
  // Use units hook with optional org filter
  const { units, loading, createUnit, updateUnit, toggleUnitStatus } = useUnits({
    filterByOrgId: selectedOrgFilter,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitName, setUnitName] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Set default org for new units
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  const handleCreate = () => {
    setEditingUnit(null);
    setUnitName('');
    if (organizations.length > 0) {
      setSelectedOrgId(selectedOrgFilter || organizations[0].id);
    }
    setIsDialogOpen(true);
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setUnitName(unit.nome);
    setSelectedOrgId(unit.org_id);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!unitName.trim() || !selectedOrgId) return;
    setSaving(true);

    let success: boolean;
    if (editingUnit) {
      success = await updateUnit(editingUnit.id, unitName.trim());
    } else {
      success = await createUnit(unitName.trim(), selectedOrgId);
    }

    setSaving(false);
    if (success) {
      setIsDialogOpen(false);
      setUnitName('');
      setEditingUnit(null);
    }
  };

  const handleToggleStatus = async (unit: Unit) => {
    await toggleUnitStatus(unit.id, unit.status);
  };

  const handleOrgFilterChange = (value: string) => {
    setSelectedOrgFilter(value === 'all' ? null : value);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('nav.unidades')}</h1>
          <p className="text-muted-foreground">Gerencie as unidades de todas as organizações</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Organization Filter - Master only */}
          {isMaster && organizations.length > 1 && (
            <Select value={selectedOrgFilter || 'all'} onValueChange={handleOrgFilterChange}>
              <SelectTrigger className="w-[200px] h-9">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filtrar por organização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as organizações</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canManage && (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Unidade
            </Button>
          )}
        </div>
      </div>

      {/* Units Table */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{units.length} Unidades</CardTitle>
              <CardDescription>
                {selectedOrgFilter 
                  ? `Unidades da organização selecionada`
                  : 'Lista de todas as unidades cadastradas'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {units.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma unidade cadastrada</p>
              {canManage && (
                <Button variant="outline" className="mt-4" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeira unidade
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  {isMaster && <TableHead>Organização</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Usuários</TableHead>
                  <TableHead>Criada em</TableHead>
                  {canManage && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.nome}</TableCell>
                    {isMaster && (
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          <span className="text-sm">{unit.org_nome}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={unit.status === 'ativo' ? 'default' : 'secondary'}>
                        {unit.status === 'ativo' ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{unit.user_count || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(unit.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(unit)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(unit)}
                            className="h-8 w-8 p-0"
                          >
                            {unit.status === 'ativo' ? (
                              <PowerOff className="h-4 w-4 text-destructive" />
                            ) : (
                              <Power className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Editar Unidade' : 'Nova Unidade'}</DialogTitle>
            <DialogDescription>
              {editingUnit
                ? 'Atualize as informações da unidade'
                : 'Preencha os dados para criar uma nova unidade'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Organization selector for Master when creating */}
            {isMaster && !editingUnit && organizations.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="unit-org">Organização</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger id="unit-org">
                    <SelectValue placeholder="Selecione a organização" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Show org info when editing */}
            {editingUnit && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Organização</Label>
                <p className="text-sm font-medium text-foreground">{editingUnit.org_nome}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="unit-name">Nome da Unidade</Label>
              <Input
                id="unit-name"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="Ex: Joinville Centro"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !unitName.trim() || (!editingUnit && !selectedOrgId)}>
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

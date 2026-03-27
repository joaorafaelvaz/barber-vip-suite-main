import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import { useOrgs, Organization } from '@/hooks/useOrgs';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Building2, Users, MapPin, Plus, Pencil, Power, PowerOff } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TabOrganizacao() {
  const { t } = useI18n();
  const { organizations, loading, createOrg, updateOrg, toggleOrgStatus } = useOrgs();
  const { isMaster } = usePermissions();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [orgName, setOrgName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = () => {
    setEditingOrg(null);
    setOrgName('');
    setIsDialogOpen(true);
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setOrgName(org.nome);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!orgName.trim()) return;
    setSaving(true);

    let success: boolean;
    if (editingOrg) {
      success = await updateOrg(editingOrg.id, orgName.trim());
    } else {
      success = await createOrg(orgName.trim());
    }

    setSaving(false);
    if (success) {
      setIsDialogOpen(false);
      setOrgName('');
      setEditingOrg(null);
    }
  };

  const handleToggleStatus = async (org: Organization) => {
    await toggleOrgStatus(org.id, org.status);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('nav.organizacao')}</h2>
          <p className="text-sm text-muted-foreground">Gerencie todas as organizações do sistema</p>
        </div>
        {isMaster && (
          <Button onClick={handleCreate} size="sm" className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Nova Organização
          </Button>
        )}
      </div>

      {/* Organizations Table */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{organizations.length} Organizações</CardTitle>
              <CardDescription className="text-xs">Lista de todas as organizações cadastradas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma organização cadastrada</p>
              {isMaster && (
                <Button variant="outline" className="mt-4" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeira organização
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {organizations.map((org) => (
                  <div key={org.id} className="p-4 rounded-lg border border-border/50 bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{org.nome}</span>
                      <Badge variant={org.status === 'ativo' ? 'default' : 'secondary'}>
                        {org.status === 'ativo' ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{org.unit_count || 0} unid.</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>{org.user_count || 0} usr.</span>
                      </div>
                      <span>{format(new Date(org.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                    </div>
                    {isMaster && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(org)} className="h-8 w-8 p-0">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(org)} className="h-8 w-8 p-0">
                          {org.status === 'ativo' ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-green-500" />}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Unidades</TableHead>
                      <TableHead className="text-center">Usuários</TableHead>
                      <TableHead>Criada em</TableHead>
                      {isMaster && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.nome}</TableCell>
                        <TableCell>
                          <Badge variant={org.status === 'ativo' ? 'default' : 'secondary'}>
                            {org.status === 'ativo' ? t('common.active') : t('common.inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{org.unit_count || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>{org.user_count || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(org.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        {isMaster && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(org)} className="h-8 w-8 p-0">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(org)} className="h-8 w-8 p-0">
                                {org.status === 'ativo' ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-green-500" />}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOrg ? 'Editar Organização' : 'Nova Organização'}</DialogTitle>
            <DialogDescription>
              {editingOrg
                ? 'Atualize as informações da organização'
                : 'Preencha os dados para criar uma nova organização'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Nome da Organização</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Ex: Barbearia VIP - São Paulo"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !orgName.trim()}>
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

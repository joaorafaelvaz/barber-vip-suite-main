import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Pencil, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { UserProfile } from '@/hooks/useUsers';

interface UsersTableProps {
  users: UserProfile[];
  loading: boolean;
  onEdit: (user: UserProfile) => void;
  onToggleStatus: (userId: string, isActive: boolean) => void;
  currentUserId?: string;
}

const roleColorMap: Record<string, string> = {
  master: 'bg-primary/20 text-primary border-primary/30',
  franquia_admin: 'bg-info/20 text-info border-info/30',
  unidade_gerente: 'bg-warning/20 text-warning border-warning/30',
  colaborador: 'bg-muted text-muted-foreground border-border'
};

export function UsersTable({ users, loading, onEdit, onToggleStatus, currentUserId }: UsersTableProps) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('users.noUsers')}
      </div>
    );
  }

  return (
    <>
      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {users.map((user) => (
          <div key={user.user_id} className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{user.display_name}</p>
                <p className="text-sm text-muted-foreground">{user.email || '-'}</p>
              </div>
              <Badge variant="outline" className={roleColorMap[user.role_base] || ''}>
                {t(`users.roles.${user.role_base}`)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {user.org_name && <span>{user.org_name}</span>}
              {user.unit_name && <span>• {user.unit_name}</span>}
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={user.is_active}
                  onCheckedChange={(checked) => onToggleStatus(user.user_id, checked)}
                  disabled={user.user_id === currentUserId}
                />
                <span className={`text-sm font-medium ${user.is_active ? 'text-success' : 'text-muted-foreground'}`}>
                  {user.is_active ? t('users.active') : t('users.inactive')}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onEdit(user)} className="text-muted-foreground hover:text-primary hover:bg-primary/10">
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">{t('users.name')}</TableHead>
              <TableHead className="text-muted-foreground font-medium">{t('users.email')}</TableHead>
              <TableHead className="text-muted-foreground font-medium">{t('users.role')}</TableHead>
              <TableHead className="text-muted-foreground font-medium">{t('users.organization')}</TableHead>
              <TableHead className="text-muted-foreground font-medium">{t('users.unit')}</TableHead>
              <TableHead className="text-muted-foreground font-medium">{t('users.status')}</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.user_id} className="border-border hover:bg-muted/30">
                <TableCell className="font-medium text-foreground">{user.display_name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={roleColorMap[user.role_base] || ''}>
                    {t(`users.roles.${user.role_base}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{user.org_name || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{user.unit_name || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={user.is_active}
                      onCheckedChange={(checked) => onToggleStatus(user.user_id, checked)}
                      disabled={user.user_id === currentUserId}
                    />
                    <span className={`text-sm font-medium ${user.is_active ? 'text-success' : 'text-muted-foreground'}`}>
                      {user.is_active ? t('users.active') : t('users.inactive')}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(user)} className="text-muted-foreground hover:text-primary hover:bg-primary/10">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

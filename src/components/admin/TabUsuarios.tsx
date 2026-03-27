import React, { useState, useEffect, useCallback } from 'react';
import { UserCog, Plus, Search, Filter } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers, type UserProfile, type CreateUserData, type UpdateUserData } from '@/hooks/useUsers';
import { UsersTable, CreateUserDialog, EditUserDialog } from '@/components/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface Organization {
  id: string;
  nome: string;
}

interface Unit {
  id: string;
  nome: string;
  org_id: string;
}

export function TabUsuarios() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const { loading, listUsers, createUser, updateUser, toggleUserStatus } = useUsers();

  // State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const callerRole = profile?.role_base || 'colaborador';

  // Load users
  const loadUsers = useCallback(async () => {
    setIsLoadingList(true);
    const result = await listUsers({
      page,
      limit: 20,
      search: searchTerm,
      role: roleFilter,
      status: statusFilter
    });

    if (result) {
      setUsers(result.users);
      setTotalPages(result.pagination.totalPages);
    }
    setIsLoadingList(false);
  }, [listUsers, page, searchTerm, roleFilter, statusFilter]);

  // Load organizations and units for selectors
  const loadOrgsAndUnits = useCallback(async () => {
    try {
      const { data: orgs } = await supabase
        .from('app_orgs')
        .select('id, nome')
        .eq('status', 'active')
        .order('nome');

      const { data: unitsData } = await supabase
        .from('app_units')
        .select('id, nome, org_id')
        .eq('status', 'active')
        .order('nome');

      setOrganizations(orgs || []);
      setUnits(unitsData || []);
    } catch (error) {
      console.error('Error loading orgs/units:', error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadOrgsAndUnits();
  }, [loadOrgsAndUnits]);

  // Handlers
  const handleCreateUser = async (data: CreateUserData): Promise<boolean> => {
    const success = await createUser(data);
    if (success) {
      await loadUsers();
    }
    return success;
  };

  const handleUpdateUser = async (data: UpdateUserData): Promise<boolean> => {
    const success = await updateUser(data);
    if (success) {
      await loadUsers();
    }
    return success;
  };

  const handleToggleStatus = async (userId: string, isActive: boolean) => {
    const success = await toggleUserStatus(userId, isActive);
    if (success) {
      await loadUsers();
    }
  };

  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('users.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('users.createUser')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('placeholders.search')}
            value={searchTerm}
            onChange={handleSearch}
            className="pl-10"
          />
        </div>
        
        <Select value={roleFilter || '__all__'} onValueChange={(value) => { setRoleFilter(value === '__all__' ? '' : value); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t('users.filterByRole')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('users.allRoles')}</SelectItem>
            <SelectItem value="master">{t('roles.master')}</SelectItem>
            <SelectItem value="org_admin">{t('roles.org_admin')}</SelectItem>
            <SelectItem value="unit_manager">{t('roles.unit_manager')}</SelectItem>
            <SelectItem value="team_lead">{t('roles.team_lead')}</SelectItem>
            <SelectItem value="colaborador">{t('roles.colaborador')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter || '__all__'} onValueChange={(value) => { setStatusFilter(value === '__all__' ? '' : value); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder={t('users.filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('users.allStatus')}</SelectItem>
            <SelectItem value="active">{t('users.active')}</SelectItem>
            <SelectItem value="inactive">{t('users.inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <UsersTable
        users={users}
        loading={isLoadingList}
        onEdit={handleEditUser}
        onToggleStatus={handleToggleStatus}
        currentUserId={profile?.user_id}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            {t('common.previous')}
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateUser}
        loading={loading}
        organizations={organizations}
        units={units}
        callerRole={callerRole}
      />

      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleUpdateUser}
        loading={loading}
        user={selectedUser}
        organizations={organizations}
        units={units}
        callerRole={callerRole}
      />
    </div>
  );
}

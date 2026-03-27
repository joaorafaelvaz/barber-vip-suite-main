import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { UserProfile, UpdateUserData } from '@/hooks/useUsers';

const editUserSchema = z.object({
  display_name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  role_base: z.enum(['master', 'franquia_admin', 'unidade_gerente', 'colaborador']),
  org_id: z.string().optional(),
  unit_id: z.string().optional(),
  login_alias: z.string().optional(),
  new_password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional().or(z.literal('')),
});

type FormData = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: UpdateUserData) => Promise<boolean>;
  loading: boolean;
  user: UserProfile | null;
  organizations?: { id: string; nome: string }[];
  units?: { id: string; nome: string; org_id: string }[];
  callerRole: string;
}

export function EditUserDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
  user,
  organizations = [],
  units = [],
  callerRole
}: EditUserDialogProps) {
  const { t } = useI18n();

  const form = useForm<FormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      display_name: user?.display_name || '',
      role_base: user?.role_base || 'colaborador',
      org_id: user?.org_id || '',
      unit_id: user?.unit_id || '',
      login_alias: user?.login_alias || '',
      new_password: '',
    }
  });

  // Reset form when user changes
  React.useEffect(() => {
    if (user) {
      form.reset({
        display_name: user.display_name,
        role_base: user.role_base,
        org_id: user.org_id || '',
        unit_id: user.unit_id || '',
        login_alias: user.login_alias || '',
        new_password: '',
      });
    }
  }, [user, form]);

  const selectedOrgId = form.watch('org_id');
  const filteredUnits = units.filter(u => !selectedOrgId || u.org_id === selectedOrgId);

  const handleSubmit = async (data: FormData) => {
    if (!user) return;

    const payload: UpdateUserData = {
      user_id: user.user_id,
      display_name: data.display_name,
      role_base: data.role_base,
      org_id: data.org_id || null,
      unit_id: data.unit_id || null,
      login_alias: data.login_alias || null,
    };

    if (data.new_password) {
      payload.new_password = data.new_password;
    }

    const success = await onSubmit(payload);
    if (success) {
      onOpenChange(false);
    }
  };

  const availableRoles = React.useMemo(() => {
    const roles = ['colaborador', 'unidade_gerente'];
    if (callerRole === 'master' || callerRole === 'franquia_admin') {
      roles.push('franquia_admin');
    }
    if (callerRole === 'master') {
      roles.push('master');
    }
    return roles;
  }, [callerRole]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('users.editUser')}</DialogTitle>
          <DialogDescription>
            {t('users.editUserDescription')} - {user.email}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.displayName')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do usuário" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role_base"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.role')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('users.selectRole')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableRoles.map(role => (
                        <SelectItem key={role} value={role}>
                          {t(`users.roles.${role}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Show org selector only if master and more than one org */}
            {callerRole === 'master' && organizations.length > 1 && (
              <FormField
                control={form.control}
                name="org_id"
                render={({ field }) => (
              <FormItem>
                  <FormLabel>{t('users.organization')}</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === '__none__' ? '' : val)} value={field.value || '__none__'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('users.selectOrganization')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma</SelectItem>
                        {organizations.map(org => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Show unit selector only if more than one unit */}
            {filteredUnits.length > 1 && (
              <FormField
                control={form.control}
                name="unit_id"
                render={({ field }) => (
              <FormItem>
                  <FormLabel>{t('users.unit')}</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === '__none__' ? '' : val)} value={field.value || '__none__'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('users.selectUnit')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma</SelectItem>
                        {filteredUnits.map(unit => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="login_alias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.loginAlias')} ({t('common.optional')})</FormLabel>
                  <FormControl>
                    <Input placeholder="usuario.login" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.newPassword')} ({t('common.optional')})</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import React from 'react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Building2, MapPin, Shield } from 'lucide-react';

export default function Perfil() {
  const { t } = useI18n();
  const { profile, user } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const roleLabels: Record<string, string> = {
    master: t('roles.master'),
    franquia_admin: t('roles.franquia_admin'),
    unidade_gerente: t('roles.unidade_gerente'),
    colaborador: t('roles.colaborador'),
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('perfil.title')}</h1>
        <p className="text-muted-foreground">{t('perfil.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {profile?.display_name ? getInitials(profile.display_name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{profile?.display_name}</CardTitle>
              <CardDescription>{user?.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">{t('users.name')}</p>
                <p className="font-medium">{profile?.display_name || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">{t('auth.email')}</p>
                <p className="font-medium">{user?.email || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">{t('users.role')}</p>
                <Badge variant="secondary" className="mt-1">
                  {profile?.role_base ? roleLabels[profile.role_base] || profile.role_base : '-'}
                </Badge>
              </div>
            </div>

            {profile?.org_id && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('users.organization')}</p>
                  <p className="font-medium">{profile.org_id}</p>
                </div>
              </div>
            )}

            {profile?.unit_id && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('users.unit')}</p>
                  <p className="font-medium">{profile.unit_id}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

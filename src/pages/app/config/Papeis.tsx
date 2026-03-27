import React from 'react';
import { useI18n } from '@/i18n';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, Lock, Info } from 'lucide-react';

const ROLES = [
  {
    base: 'master',
    name: 'Master',
    description: 'Acesso total ao sistema. Pode gerenciar todas as organizações, unidades e usuários.',
    permissions: ['Todas as permissões', 'Configurações globais', 'Auditoria completa'],
    color: 'bg-purple-500/10 text-purple-500',
    isSystem: true,
  },
  {
    base: 'franquia_admin',
    name: 'Admin Franquia',
    description: 'Gerencia todas as unidades de uma franquia. Não pode acessar outras organizações.',
    permissions: ['Gerenciar unidades', 'Gerenciar usuários', 'Relatórios da franquia'],
    color: 'bg-blue-500/10 text-blue-500',
    isSystem: true,
  },
  {
    base: 'unidade_gerente',
    name: 'Gerente de Unidade',
    description: 'Gerencia uma unidade específica. Pode criar e gerenciar colaboradores da unidade.',
    permissions: ['Gerenciar colaboradores', 'Ver metas', 'Relatórios da unidade'],
    color: 'bg-green-500/10 text-green-500',
    isSystem: true,
  },
  {
    base: 'colaborador',
    name: 'Colaborador',
    description: 'Acesso básico às próprias informações. Pode visualizar vendas e metas pessoais.',
    permissions: ['Visualizar próprias vendas', 'Ver metas pessoais', 'Editar perfil'],
    color: 'bg-orange-500/10 text-orange-500',
    isSystem: true,
  },
];

export function Papeis() {
  const { t } = useI18n();
  const { isMaster } = usePermissions();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('nav.papeis')}</h1>
          <p className="text-muted-foreground">Papéis e permissões do sistema</p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="flex items-start gap-3 pt-4">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-foreground font-medium">Papéis do Sistema</p>
            <p className="text-sm text-muted-foreground">
              Os papéis abaixo são gerenciados pelo sistema e determinam o nível de acesso de cada usuário.
              Cada papel herda permissões específicas que controlam o que o usuário pode ver e fazer.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROLES.map((role) => (
          <Card key={role.base} className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${role.color}`}>
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{role.name}</CardTitle>
                    <CardDescription className="text-xs">
                      role_base: {role.base}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  <Lock className="h-3 w-3 mr-1" />
                  Sistema
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{role.description}</p>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Permissões Principais
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.map((permission) => (
                    <Badge key={permission} variant="secondary" className="text-xs">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hierarchy Diagram */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Hierarquia de Acesso</CardTitle>
          <CardDescription>
            Visualização da hierarquia de permissões entre os papéis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <Shield className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-foreground">Master</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <Shield className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-foreground">Admin Franquia</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
              <Shield className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-foreground">Gerente de Unidade</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <Shield className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-foreground">Colaborador</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

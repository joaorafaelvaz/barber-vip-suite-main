import React from 'react';
import { useI18n } from '@/i18n';
import { useSecuritySettings } from '@/hooks/useSecuritySettings';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Shield, Key, Lock, Info } from 'lucide-react';

export function Seguranca() {
  const { t } = useI18n();
  const { settings, loading, updateSettings } = useSecuritySettings();
  const { isMaster } = usePermissions();

  const handleMfaMasterChange = async (checked: boolean) => {
    await updateSettings({ require_mfa_for_master: checked });
  };

  const handleMfaOthersChange = async (checked: boolean) => {
    await updateSettings({ allow_mfa_for_others: checked });
  };

  const handleSessionPolicyChange = async (value: string) => {
    await updateSettings({ session_policy: value });
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('nav.seguranca')}</h1>
          <p className="text-muted-foreground">Configurações de segurança da organização</p>
        </div>
      </div>

      {/* Permission Warning */}
      {!isMaster && (
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="flex items-start gap-3 pt-4">
            <Info className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm text-foreground font-medium">Acesso Limitado</p>
              <p className="text-sm text-muted-foreground">
                Apenas usuários Master podem alterar as configurações de segurança.
                Você pode visualizar as configurações atuais.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MFA Settings */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Autenticação em Dois Fatores (MFA)</CardTitle>
              <CardDescription>
                Configure as políticas de MFA para a organização
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Exigir MFA para Master</Label>
              <p className="text-sm text-muted-foreground">
                Usuários Master devem configurar MFA para acessar o sistema
              </p>
            </div>
            <Switch
              checked={settings?.require_mfa_for_master || false}
              onCheckedChange={handleMfaMasterChange}
              disabled={!isMaster}
            />
          </div>

          <div className="border-t border-border/50" />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Permitir MFA para outros usuários</Label>
              <p className="text-sm text-muted-foreground">
                Permite que usuários não-master configurem MFA opcionalmente
              </p>
            </div>
            <Switch
              checked={settings?.allow_mfa_for_others || false}
              onCheckedChange={handleMfaOthersChange}
              disabled={!isMaster}
            />
          </div>
        </CardContent>
      </Card>

      {/* Session Policy */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Política de Sessão</CardTitle>
              <CardDescription>
                Configure como as sessões de usuário devem ser gerenciadas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Sessão</Label>
            <Select
              value={settings?.session_policy || 'multiple'}
              onValueChange={handleSessionPolicyChange}
              disabled={!isMaster}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">
                  Sessão Única
                </SelectItem>
                <SelectItem value="multiple">
                  Múltiplas Sessões
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {settings?.session_policy === 'single'
                ? 'Apenas uma sessão ativa por usuário. Login em novo dispositivo encerra sessões anteriores.'
                : 'Permite múltiplas sessões simultâneas em diferentes dispositivos.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Current Status */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Status de Segurança</CardTitle>
              <CardDescription>
                Resumo das configurações de segurança atuais
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
              <Badge variant={settings?.require_mfa_for_master ? 'default' : 'secondary'}>
                {settings?.require_mfa_for_master ? 'Ativo' : 'Inativo'}
              </Badge>
              <span className="text-sm text-muted-foreground">MFA Master</span>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
              <Badge variant={settings?.allow_mfa_for_others ? 'default' : 'secondary'}>
                {settings?.allow_mfa_for_others ? 'Permitido' : 'Bloqueado'}
              </Badge>
              <span className="text-sm text-muted-foreground">MFA Opcional</span>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
              <Badge variant="outline">
                {settings?.session_policy === 'single' ? 'Única' : 'Múltipla'}
              </Badge>
              <span className="text-sm text-muted-foreground">Sessão</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

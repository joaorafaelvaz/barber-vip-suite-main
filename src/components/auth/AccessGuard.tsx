import React, { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useI18n } from '@/i18n';
import { ShieldX } from 'lucide-react';

interface AccessGuardProps {
  children: ReactNode;
  permission: keyof ReturnType<typeof usePermissions>;
  fallback?: ReactNode;
}

export function AccessGuard({ children, permission, fallback }: AccessGuardProps) {
  const permissions = usePermissions();
  const { t } = useI18n();
  
  const hasPermission = permissions[permission];
  
  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <ShieldX className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {t('errors.unauthorized')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('users.noPermission')}
        </p>
      </div>
    );
  }
  
  return <>{children}</>;
}

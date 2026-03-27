import React, { useMemo } from 'react';
import { useI18n } from '@/i18n';
import { usePermissions } from '@/hooks/usePermissions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Building2, MapPin, Users, Shield, ScrollText, Lock, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Tab content components (lazy loaded from existing pages)
import { TabOrganizacao } from './TabOrganizacao';
import { TabUnidades } from './TabUnidades';
import { TabUsuarios } from './TabUsuarios';
import { TabPapeis } from './TabPapeis';
import { TabAuditoria } from './TabAuditoria';
import { TabSeguranca } from './TabSeguranca';
import { TabSincronizacao } from './TabSincronizacao';

interface AdminTab {
  id: string;
  label: string;
  icon: LucideIcon;
  permissionKey: keyof ReturnType<typeof usePermissions>;
  component: React.ComponentType;
}

const ALL_TABS: AdminTab[] = [
  { id: 'organizacao', label: 'admin.tabs.organizacao', icon: Building2, permissionKey: 'canManageOrg', component: TabOrganizacao },
  { id: 'unidades', label: 'admin.tabs.unidades', icon: MapPin, permissionKey: 'canManageUnits', component: TabUnidades },
  { id: 'usuarios', label: 'admin.tabs.usuarios', icon: Users, permissionKey: 'canManageUsers', component: TabUsuarios },
  { id: 'papeis', label: 'admin.tabs.papeis', icon: Shield, permissionKey: 'canManageRoles', component: TabPapeis },
  { id: 'auditoria', label: 'admin.tabs.auditoria', icon: ScrollText, permissionKey: 'canViewAudit', component: TabAuditoria },
  { id: 'seguranca', label: 'admin.tabs.seguranca', icon: Lock, permissionKey: 'canManageSecurity', component: TabSeguranca },
  { id: 'sincronizacao', label: 'admin.tabs.sincronizacao', icon: RefreshCw, permissionKey: 'canManageSecurity', component: TabSincronizacao },
];

interface AdminTabsProps {
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function AdminTabs({ defaultTab, onTabChange }: AdminTabsProps) {
  const { t } = useI18n();
  const permissions = usePermissions();

  // Filter tabs based on user permissions
  const visibleTabs = useMemo(() => {
    return ALL_TABS.filter(tab => permissions[tab.permissionKey]);
  }, [permissions]);

  // Determine initial tab
  const initialTab = useMemo(() => {
    if (defaultTab && visibleTabs.some(tab => tab.id === defaultTab)) {
      return defaultTab;
    }
    return visibleTabs[0]?.id || 'usuarios';
  }, [defaultTab, visibleTabs]);

  if (visibleTabs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('errors.unauthorized')}
      </div>
    );
  }

  return (
    <Tabs defaultValue={initialTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="w-full flex-nowrap h-auto gap-1 bg-muted/50 p-1 overflow-x-auto justify-start">
        {visibleTabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="flex items-center gap-2 data-[state=active]:bg-background"
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t(tab.label)}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {visibleTabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-6">
          <tab.component />
        </TabsContent>
      ))}
    </Tabs>
  );
}

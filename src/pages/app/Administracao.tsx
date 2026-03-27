import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessGuard } from '@/components/auth/AccessGuard';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { Settings } from 'lucide-react';

export default function Administracao() {
  const { t } = useI18n();
  const permissions = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get initial tab from URL or default to first available
  const tabFromUrl = searchParams.get('tab');
  
  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  return (
    <AccessGuard permission="canAccessAdmin">
      <div className="space-y-6 overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('admin.title')}</h1>
            <p className="text-muted-foreground">{t('admin.subtitle')}</p>
          </div>
        </div>

        {/* Tabs Content */}
        <AdminTabs 
          defaultTab={tabFromUrl || undefined} 
          onTabChange={handleTabChange}
        />
      </div>
    </AccessGuard>
  );
}

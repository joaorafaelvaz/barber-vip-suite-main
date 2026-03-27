import React, { ReactNode } from 'react';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface PagePlaceholderProps {
  titleKey: string;
  subtitleKey: string;
  icon?: ReactNode;
  children?: ReactNode;
}

export function PagePlaceholder({ titleKey, subtitleKey, icon, children }: PagePlaceholderProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t(titleKey)}</h1>
        <p className="text-muted-foreground">{t(subtitleKey)}</p>
      </div>

      {children || (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              {icon || <Construction className="h-8 w-8 text-muted-foreground" />}
            </div>
            <CardTitle className="text-lg">Em Desenvolvimento</CardTitle>
            <CardDescription>
              Esta funcionalidade está sendo implementada e estará disponível em breve.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

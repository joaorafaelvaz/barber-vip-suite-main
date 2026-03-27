import React from 'react';
import { PagePlaceholder } from '@/components/common';
import { Target } from 'lucide-react';

export default function Metas() {
  return (
    <PagePlaceholder
      titleKey="metas.title"
      subtitleKey="metas.subtitle"
      icon={<Target className="h-8 w-8 text-muted-foreground" />}
    />
  );
}

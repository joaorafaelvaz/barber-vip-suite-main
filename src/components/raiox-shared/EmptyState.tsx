import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = 'Sem dados (ainda)',
  description = 'Os dados aparecerão aqui quando estiverem disponíveis.',
  className,
  icon,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {icon ?? <Inbox className="h-10 w-10 text-muted-foreground/50 mb-3" />}
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">{description}</p>
    </div>
  );
}

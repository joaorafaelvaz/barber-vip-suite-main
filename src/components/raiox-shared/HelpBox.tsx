import React from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpBoxProps {
  children: React.ReactNode;
  variant?: 'info' | 'warning';
  className?: string;
}

const icons = {
  info: Info,
  warning: AlertTriangle,
};

const styles = {
  info: 'border-primary/30 bg-primary/5 text-foreground',
  warning: 'border-yellow-500/30 bg-yellow-500/5 text-foreground',
};

const iconStyles = {
  info: 'text-primary',
  warning: 'text-yellow-600',
};

export function HelpBox({ children, variant = 'info', className }: HelpBoxProps) {
  const Icon = icons[variant];
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-3 text-sm', styles[variant], className)}>
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', iconStyles[variant])} />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

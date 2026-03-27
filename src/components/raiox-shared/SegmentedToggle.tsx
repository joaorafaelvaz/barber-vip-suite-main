import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export interface SegmentOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SegmentedToggleProps {
  options: SegmentOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  size?: 'sm' | 'default';
}

export function SegmentedToggle({ options, value, onValueChange, className, size = 'sm' }: SegmentedToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      className={cn(
        'rounded-lg border border-border bg-muted/50 p-0.5 backdrop-blur-sm',
        className
      )}
      size={size}
    >
      {options.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          disabled={opt.disabled}
          className={cn(
            'text-xs rounded-md px-3 font-medium transition-all duration-150',
            'text-muted-foreground/80 hover:text-foreground',
            'data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-md data-[state=on]:border data-[state=on]:border-border/80',
          )}
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

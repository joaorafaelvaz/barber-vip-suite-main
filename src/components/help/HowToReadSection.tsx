import React, { useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface HowToReadSectionProps {
  title?: string;
  bullets: React.ReactNode[];
  expandedText?: string;
  defaultOpen?: boolean;
}

export function HowToReadSection({ title = 'Como ler esta aba', bullets, expandedText, defaultOpen = false }: HowToReadSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1 group">
        <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="font-medium">{title}</span>
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2 border-primary/20 bg-primary/5">
          <CardContent className="p-3 sm:p-4">
            <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
              {bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            {expandedText && (
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed border-t border-primary/10 pt-3">
                {expandedText}
              </p>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

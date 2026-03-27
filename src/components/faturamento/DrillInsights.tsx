// ============================================================
// FILE: src/components/faturamento/DrillInsights.tsx
// PROPÓSITO: Insights com ícones contextuais e cards individuais
// ============================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
} from 'lucide-react';

function getInsightStyle(text: string): {
  icon: React.ReactNode;
  borderColor: string;
  bgColor: string;
} {
  const lower = text.toLowerCase();

  if (lower.includes('maior') || lower.includes('cresci') || lower.includes('acima') || lower.includes('top')) {
    return {
      icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
      borderColor: 'border-l-emerald-500',
      bgColor: 'bg-emerald-500/5',
    };
  }
  if (lower.includes('menor') || lower.includes('queda') || lower.includes('abaixo') || lower.includes('reduz')) {
    return {
      icon: <TrendingDown className="h-4 w-4 text-red-500" />,
      borderColor: 'border-l-red-500',
      bgColor: 'bg-red-500/5',
    };
  }
  if (lower.includes('concentr') || lower.includes('atenção') || lower.includes('alert')) {
    return {
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
      borderColor: 'border-l-amber-500',
      bgColor: 'bg-amber-500/5',
    };
  }

  return {
    icon: <Info className="h-4 w-4 text-blue-500" />,
    borderColor: 'border-l-blue-500',
    bgColor: 'bg-blue-500/5',
  };
}

interface DrillInsightsProps {
  insights: string[];
}

export function DrillInsights({ insights }: DrillInsightsProps) {
  if (!insights || insights.length === 0) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((s, i) => {
          const style = getInsightStyle(s);
          return (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${style.borderColor} ${style.bgColor}`}
            >
              <div className="shrink-0 mt-0.5">{style.icon}</div>
              <p className="text-sm text-foreground">{s}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

'use client';

import { Lightbulb, TrendingUp, TrendingDown, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface InsightsMetric {
  label: string;
  value: string;
  emphasis: 'primary' | 'positive' | 'negative' | 'secondary';
}

export interface InsightsData {
  keyAnswer: string;
  metrics: InsightsMetric[];
}

interface KeyInsightsProps {
  insights: InsightsData;
}

function getEmphasisStyles(emphasis: InsightsMetric['emphasis']) {
  switch (emphasis) {
    case 'primary':
      return {
        card: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20',
        text: 'text-primary font-bold',
        icon: Star,
      };
    case 'positive':
      return {
        card: 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20',
        text: 'text-green-600 dark:text-green-400 font-semibold',
        icon: TrendingUp,
      };
    case 'negative':
      return {
        card: 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20',
        text: 'text-red-600 dark:text-red-400 font-semibold',
        icon: TrendingDown,
      };
    case 'secondary':
    default:
      return {
        card: 'bg-muted/50 border-muted-foreground/10',
        text: 'text-muted-foreground font-medium',
        icon: null,
      };
  }
}

export function KeyInsights({ insights }: KeyInsightsProps) {
  const { keyAnswer, metrics } = insights;

  // Separate primary metrics from secondary ones
  const primaryMetrics = metrics.filter(m => m.emphasis === 'primary');
  const otherMetrics = metrics.filter(m => m.emphasis !== 'primary');

  return (
    <Card className="p-4 mb-4 bg-gradient-to-r from-amber-50/50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200/50 dark:border-amber-800/30">
      {/* Key Answer Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
          <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
            Key Insight
          </p>
          <p className="text-lg font-semibold text-foreground">
            {keyAnswer}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics.length > 0 && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* Primary metrics first, larger */}
          {primaryMetrics.map((metric, index) => {
            const styles = getEmphasisStyles(metric.emphasis);
            const Icon = styles.icon;
            return (
              <Card
                key={`primary-${index}`}
                className={cn(
                  'p-4 transition-all duration-200 hover:scale-[1.02]',
                  styles.card,
                  'sm:col-span-2 lg:col-span-1'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {Icon && <Icon className="h-4 w-4 text-primary" />}
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {metric.label}
                  </span>
                </div>
                <p className={cn('text-2xl', styles.text)}>
                  {metric.value}
                </p>
              </Card>
            );
          })}

          {/* Other metrics */}
          {otherMetrics.map((metric, index) => {
            const styles = getEmphasisStyles(metric.emphasis);
            const Icon = styles.icon;
            return (
              <Card
                key={`other-${index}`}
                className={cn(
                  'p-3 transition-all duration-200 hover:scale-[1.02]',
                  styles.card
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {Icon && (
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5',
                        metric.emphasis === 'positive' && 'text-green-500',
                        metric.emphasis === 'negative' && 'text-red-500'
                      )}
                    />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {metric.label}
                  </span>
                </div>
                <p className={cn('text-lg', styles.text)}>
                  {metric.value}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}

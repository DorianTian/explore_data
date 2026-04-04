'use client';

import { Icon } from '@/components/shared/icon';

interface MetricCardProps {
  /** Display title above the value */
  title: string;
  /** The KPI value to render prominently */
  value: string | number;
  /** Optional trend indicator: 'up' | 'down' | 'flat' */
  trend?: 'up' | 'down' | 'flat';
  /** Optional percentage change to display with trend */
  trendValue?: string;
}

/** Format large numbers with locale separators */
function formatMetricValue(value: string | number): string {
  if (typeof value === 'number') {
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  const num = Number(value);
  if (!Number.isNaN(num)) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return value;
}

/**
 * Beautiful KPI metric card — large centered value with gradient background.
 * Used by SmartChart for `metric_card` chart type.
 */
export function MetricCard({ title, value, trend, trendValue }: MetricCardProps) {
  const trendColor =
    trend === 'up'
      ? 'text-emerald-400'
      : trend === 'down'
        ? 'text-red-400'
        : 'text-muted';
  const trendIcon =
    trend === 'up' ? 'arrowUp' : trend === 'down' ? 'arrowUp' : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface via-background to-surface p-6">
      {/* Subtle decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 pointer-events-none" />

      <div className="relative flex flex-col items-center gap-2 text-center">
        <span className="text-sm font-medium text-muted">{title}</span>
        <span className="text-4xl font-bold text-foreground tabular-nums tracking-tight">
          {formatMetricValue(value)}
        </span>
        {(trend || trendValue) && (
          <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
            {trendIcon && (
              <Icon
                name={trendIcon}
                size={14}
                className={trend === 'down' ? 'rotate-180' : ''}
              />
            )}
            {trendValue && <span className="font-medium">{trendValue}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

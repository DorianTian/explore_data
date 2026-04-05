'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Icon } from '@/components/shared/icon';
import { Badge } from '@/components/ui';
import { useDashboardStore, type Widget } from '@/stores/dashboard-store';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface WidgetCardProps {
  widget: Widget;
  onClick?: () => void;
}

/** Chart type label mapping for badge display */
const CHART_TYPE_LABELS: Record<string, string> = {
  bar: '柱状图',
  horizontal_bar: '条形图',
  line: '折线图',
  multi_line: '多线图',
  scatter: '散点图',
  grouped_bar: '分组柱状图',
  pie: '饼图',
  kpi: 'KPI',
  table: '表格',
};

export function WidgetCard({ widget, onClick }: WidgetCardProps) {
  const toggleFavorite = useDashboardStore((s) => s.toggleFavorite);
  const isFavorited = useDashboardStore((s) =>
    s.favorites.some((f) => f.targetType === 'widget' && f.targetId === widget.id),
  );
  const deleteWidget = useDashboardStore((s) => s.deleteWidget);

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleFavorite(widget.projectId, 'widget', widget.id);
    },
    [toggleFavorite, widget.projectId, widget.id],
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await deleteWidget(widget.id);
      } catch {
        /* Delete failed — widget remains in list */
      }
    },
    [deleteWidget, widget.id],
  );

  const isChart = widget.chartType !== 'table';
  const chartLabel = CHART_TYPE_LABELS[widget.chartType] ?? widget.chartType;

  return (
    <div
      onClick={onClick}
      className="group rounded-xl border border-border bg-background hover:border-primary/40 hover:shadow-md transition-all cursor-pointer overflow-hidden"
    >
      {/* Mini preview area */}
      <div className="h-40 bg-surface flex items-center justify-center overflow-hidden relative">
        {isChart && widget.chartConfig ? (
          <MiniChart chartType={widget.chartType} config={widget.chartConfig} />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted">
            <Icon name="table" size={28} />
            <span className="text-xs">表格数据</span>
          </div>
        )}

        {/* Live indicator */}
        {widget.isLive && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium">LIVE</span>
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground line-clamp-1 flex-1">
            {widget.title}
          </h3>
          <Badge variant="info" className="shrink-0">{chartLabel}</Badge>
        </div>

        {widget.description && (
          <p className="text-xs text-muted line-clamp-2">{widget.description}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted">
            {new Date(widget.createdAt).toLocaleDateString('zh-CN')}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleFavorite}
              className={`p-1.5 rounded-[var(--radius-md)] transition-colors cursor-pointer ${
                isFavorited
                  ? 'text-red-400 bg-red-500/10'
                  : 'text-muted hover:text-foreground hover:bg-surface'
              }`}
            >
              <Icon name="heart" size={14} filled={isFavorited} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-[var(--radius-md)] text-muted hover:text-error hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a small, non-interactive ECharts preview for the card thumbnail.
 * Intentionally simplified to keep the card lightweight.
 */
function MiniChart({ chartType, config }: { chartType: string; config: unknown }) {
  const cfg = config as {
    xAxis?: { data?: unknown[] };
    yAxis?: { data?: unknown[] };
    series?: Array<{ name?: string; type?: string; data?: unknown[] }>;
  };

  if (!cfg?.series?.length) {
    return (
      <div className="flex items-center justify-center text-muted">
        <Icon name="chart" size={28} />
      </div>
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const miniOption: any = {
    animation: false,
    grid: { left: 4, right: 4, top: 4, bottom: 4 },
    xAxis: chartType === 'pie'
      ? undefined
      : {
          type: chartType === 'horizontal_bar' ? 'value' : 'category',
          data: cfg.xAxis?.data,
          show: false,
        },
    yAxis: chartType === 'pie'
      ? undefined
      : {
          type: chartType === 'horizontal_bar' ? 'category' : 'value',
          data: cfg.yAxis?.data,
          show: false,
        },
    series: cfg.series.map((s: any) => ({
      ...s,
      type: chartType === 'pie' ? 'pie' : chartType.includes('bar') || chartType === 'grouped_bar' ? 'bar' : chartType.includes('line') || chartType === 'multi_line' ? 'line' : s.type ?? 'bar',
      silent: true,
      label: { show: false },
      ...(chartType === 'pie' ? { radius: ['30%', '60%'] } : {}),
    })),
  };

  return (
    <ReactECharts
      option={miniOption}
      style={{ height: '100%', width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  );
}

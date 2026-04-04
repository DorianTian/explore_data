'use client';

import dynamic from 'next/dynamic';
import { usePanelStore } from '@/stores/panel-store';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface MessageChartPreviewProps {
  messageId: string;
  chartType: string;
  config: Record<string, unknown>;
}

export function MessageChartPreview({
  messageId,
  chartType,
  config,
}: MessageChartPreviewProps) {
  const { openArtifact } = usePanelStore();

  if (chartType === 'kpi') {
    const series = (config.series as Array<{ data: unknown[] }>)?.[0];
    const value = series?.data?.[0];
    return (
      <div
        onClick={() => openArtifact(messageId, 'chart')}
        className="mt-3 p-4 rounded-xl border border-border bg-surface cursor-pointer hover:bg-surface-hover transition-colors"
      >
        <p className="text-xs text-muted mb-1">
          {(config.title as Record<string, string>)?.text ?? 'KPI'}
        </p>
        <p className="text-2xl font-bold text-foreground">{String(value)}</p>
      </div>
    );
  }

  return (
    <div
      onClick={() => openArtifact(messageId, 'chart')}
      className="mt-3 rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
    >
      <ReactECharts
        option={config}
        style={{ height: 200 }}
        opts={{ renderer: 'svg' }}
        notMerge
      />
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { usePanelStore } from '@/stores/panel-store';
import { useChatStore } from '@/stores/chat-store';
import { buildEChartsOption } from '@/components/panel/smart-chart';

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
  const message = useChatStore((s) => s.messages.find((m) => m.id === messageId));
  const rows = message?.executionResult?.rows ?? [];

  const echartsOption = useMemo(() => {
    if (chartType === 'kpi' || chartType === 'metric_card' || chartType === 'table') return null;
    return buildEChartsOption(config as unknown as Parameters<typeof buildEChartsOption>[0], rows);
  }, [config, rows, chartType]);

  if (chartType === 'kpi' || chartType === 'metric_card') {
    const valueField = (config.valueField as string) ?? (config.yField as string[])?.[0];
    const firstRow = rows[0];
    const value = firstRow && valueField ? firstRow[valueField] : undefined;
    return (
      <div
        onClick={() => openArtifact(messageId, 'result')}
        className="mt-3 p-4 rounded-xl border border-border bg-surface cursor-pointer hover:bg-surface-hover transition-colors"
      >
        <p className="text-xs text-muted mb-1">
          {(config.title as string) ?? 'KPI'}
        </p>
        <p className="text-2xl font-bold text-foreground">{String(value ?? '—')}</p>
      </div>
    );
  }

  if (!echartsOption) return null;

  return (
    <div
      onClick={() => openArtifact(messageId, 'result')}
      className="mt-3 rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
    >
      <ReactECharts
        option={echartsOption}
        style={{ height: 200 }}
        opts={{ renderer: 'svg' }}
        notMerge
      />
    </div>
  );
}

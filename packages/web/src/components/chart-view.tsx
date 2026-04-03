'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { EChartsOption } from 'echarts';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

type ChartType =
  | 'kpi'
  | 'bar'
  | 'horizontal_bar'
  | 'line'
  | 'multi_line'
  | 'scatter'
  | 'grouped_bar'
  | 'pie'
  | 'table';

interface ChartConfig {
  title?: { text: string };
  xAxis?: { type: string; data?: unknown[] };
  yAxis?: { type: string; data?: unknown[] };
  series: Array<{
    name?: string;
    type: string;
    data: unknown[];
  }>;
}

interface ChartViewProps {
  chartType: ChartType;
  config: ChartConfig;
  height?: number;
}

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  kpi: 'KPI 卡片',
  bar: '柱状图',
  horizontal_bar: '条形图',
  line: '折线图',
  multi_line: '多线图',
  scatter: '散点图',
  grouped_bar: '分组柱状图',
  pie: '饼图',
  table: '表格',
};

export function ChartView({ chartType, config, height = 350 }: ChartViewProps) {
  if (chartType === 'kpi') {
    return <KpiCard config={config} />;
  }

  if (chartType === 'table') {
    return null; // Table view handled by SqlResultTable component
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border">
        <span className="text-xs font-medium text-muted">
          {CHART_TYPE_LABELS[chartType] ?? chartType}
        </span>
      </div>
      <div className="p-2 bg-background">
        <EChartsRenderer chartType={chartType} config={config} height={height} />
      </div>
    </div>
  );
}

function KpiCard({ config }: { config: ChartConfig }) {
  const value = config.series[0]?.data[0];
  const title = config.title?.text ?? config.series[0]?.name ?? '指标';

  return (
    <div className="rounded-xl border border-border p-6 bg-surface text-center">
      <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
        {title}
      </p>
      <p className="text-4xl font-bold text-foreground tabular-nums">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function EChartsRenderer({
  chartType,
  config,
  height,
}: {
  chartType: ChartType;
  config: ChartConfig;
  height: number;
}) {
  const option = useMemo(
    () => buildEChartsOption(chartType, config),
    [chartType, config],
  );

  return (
    <ReactECharts
      option={option}
      style={{ height: `${height}px`, width: '100%' }}
      opts={{ renderer: 'svg' }}
      theme="light"
    />
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function buildEChartsOption(chartType: ChartType, config: ChartConfig): any {
  const baseOption: EChartsOption = {
    tooltip: { trigger: chartType === 'scatter' ? 'item' : 'axis' },
    grid: { left: 60, right: 20, top: 30, bottom: 40 },
    animation: true,
    animationDuration: 600,
    animationEasing: 'cubicOut',
  };

  switch (chartType) {
    case 'bar':
    case 'grouped_bar':
      return {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: config.xAxis?.data as string[],
          axisLabel: { fontSize: 11, color: '#71717a' },
          axisLine: { lineStyle: { color: '#e4e4e7' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { fontSize: 11, color: '#71717a' },
          splitLine: { lineStyle: { color: '#f4f4f5' } },
        },
        series: config.series.map((s, i) => ({
          name: s.name,
          type: 'bar',
          data: s.data as any,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          color: COLORS[i % COLORS.length],
        })),
        legend:
          config.series.length > 1
            ? { bottom: 0, textStyle: { fontSize: 11, color: '#71717a' } }
            : undefined,
      };

    case 'horizontal_bar':
      return {
        ...baseOption,
        xAxis: {
          type: 'value',
          axisLabel: { fontSize: 11, color: '#71717a' },
          splitLine: { lineStyle: { color: '#f4f4f5' } },
        },
        yAxis: {
          type: 'category',
          data: config.yAxis?.data as string[],
          axisLabel: { fontSize: 11, color: '#71717a' },
          axisLine: { lineStyle: { color: '#e4e4e7' } },
          inverse: true,
        },
        series: config.series.map((s) => ({
          name: s.name,
          type: 'bar',
          data: s.data as any,
          itemStyle: { borderRadius: [0, 4, 4, 0] },
          color: COLORS[0],
        })),
      };

    case 'line':
    case 'multi_line':
      return {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: config.xAxis?.data as string[],
          axisLabel: { fontSize: 11, color: '#71717a' },
          axisLine: { lineStyle: { color: '#e4e4e7' } },
          boundaryGap: false,
        },
        yAxis: {
          type: 'value',
          axisLabel: { fontSize: 11, color: '#71717a' },
          splitLine: { lineStyle: { color: '#f4f4f5' } },
        },
        series: config.series.map((s, i) => ({
          name: s.name,
          type: 'line',
          data: s.data as any,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2 },
          areaStyle: config.series.length === 1 ? { opacity: 0.08 } : undefined,
          color: COLORS[i % COLORS.length],
        })),
        legend:
          config.series.length > 1
            ? { bottom: 0, textStyle: { fontSize: 11, color: '#71717a' } }
            : undefined,
      };

    case 'scatter':
      return {
        ...baseOption,
        xAxis: {
          type: 'value',
          axisLabel: { fontSize: 11, color: '#71717a' },
          splitLine: { lineStyle: { color: '#f4f4f5' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { fontSize: 11, color: '#71717a' },
          splitLine: { lineStyle: { color: '#f4f4f5' } },
        },
        series: config.series.map((s) => ({
          type: 'scatter',
          data: s.data as any,
          symbolSize: 10,
          color: COLORS[0],
          itemStyle: { opacity: 0.7 },
        })),
      };

    case 'pie':
      return {
        ...baseOption,
        grid: undefined,
        series: config.series.map((s) => ({
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          data: (s.data as Array<{ name: unknown; value: unknown }>).map((d, i) => ({
            ...d,
            itemStyle: { color: COLORS[i % COLORS.length] },
          })),
          label: {
            fontSize: 11,
            color: '#71717a',
            formatter: '{b}: {d}%',
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.1)' },
          },
        })),
      };

    default:
      return baseOption;
  }
}

const COLORS = [
  '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#be185d', '#4f46e5', '#16a34a', '#ea580c',
];

function formatNumber(val: unknown): string {
  if (val === null || val === undefined) return '—';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  if (Math.abs(num) >= 1e8) return `${(num / 1e8).toFixed(2)}亿`;
  if (Math.abs(num) >= 1e4) return `${(num / 1e4).toFixed(2)}万`;
  return num.toLocaleString('zh-CN');
}

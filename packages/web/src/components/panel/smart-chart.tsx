'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { MetricCard } from './metric-card';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

/**
 * ChartConfig shape as provided by the backend chart recommendation.
 * Fields are intentionally loose — the backend may send varying subsets.
 */
interface ChartConfig {
  chartType: string;
  title?: string;
  xField?: string;
  yField?: string | string[];
  categoryField?: string;
  colorField?: string;
  /** For metric_card */
  valueField?: string;
  trendField?: string;
  /** ECharts-compatible overrides if backend wants full control */
  echartsOption?: Record<string, unknown>;
}

interface SmartChartProps {
  config: ChartConfig;
  rows: Record<string, unknown>[];
  columns: Array<{ name: string; dataType: string }>;
}

/** Dark theme color palette */
const PALETTE = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
  '#ea7ccc',
];

const DARK_THEME = {
  backgroundColor: 'transparent',
  textStyle: { color: '#a1a1aa' },
  legend: { textStyle: { color: '#a1a1aa' } },
};

/**
 * Build an ECharts option object from a ChartConfig + data rows.
 * Handles: line, bar, horizontal_bar, pie, area, scatter, heatmap, grouped_bar.
 */
function buildEChartsOption(
  config: ChartConfig,
  rows: Record<string, unknown>[],
): Record<string, unknown> {
  if (config.echartsOption) {
    return { ...DARK_THEME, ...config.echartsOption };
  }

  const { chartType, xField, yField, categoryField, title } = config;

  const xValues = xField ? rows.map((r) => String(r[xField] ?? '')) : [];
  const yFields = Array.isArray(yField) ? yField : yField ? [yField] : [];

  const base: Record<string, unknown> = {
    ...DARK_THEME,
    color: PALETTE,
    tooltip: { trigger: chartType === 'pie' ? 'item' : 'axis' },
    grid: { top: 40, right: 20, bottom: 40, left: 60, containLabel: true },
  };

  if (title) {
    base.title = { text: title, textStyle: { color: '#e4e4e7', fontSize: 14 } };
  }

  switch (chartType) {
    case 'line':
    case 'area': {
      base.xAxis = { type: 'category', data: xValues, axisLabel: { color: '#a1a1aa' } };
      base.yAxis = { type: 'value', axisLabel: { color: '#a1a1aa' }, splitLine: { lineStyle: { color: '#27272a' } } };
      base.series = buildLineSeries(yFields, rows, categoryField, chartType === 'area');
      if (yFields.length > 1 || categoryField) {
        base.legend = { ...DARK_THEME.legend, bottom: 0 };
      }
      break;
    }
    case 'bar':
    case 'grouped_bar': {
      base.xAxis = { type: 'category', data: xValues, axisLabel: { color: '#a1a1aa' } };
      base.yAxis = { type: 'value', axisLabel: { color: '#a1a1aa' }, splitLine: { lineStyle: { color: '#27272a' } } };
      base.series = buildBarSeries(yFields, rows, categoryField);
      if (yFields.length > 1 || categoryField) {
        base.legend = { ...DARK_THEME.legend, bottom: 0 };
      }
      break;
    }
    case 'horizontal_bar': {
      base.yAxis = { type: 'category', data: xValues, axisLabel: { color: '#a1a1aa' } };
      base.xAxis = { type: 'value', axisLabel: { color: '#a1a1aa' }, splitLine: { lineStyle: { color: '#27272a' } } };
      base.series = buildBarSeries(yFields, rows, categoryField);
      break;
    }
    case 'pie': {
      const valueF = yFields[0];
      const nameF = xField;
      if (valueF && nameF) {
        base.series = [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            data: rows.map((r) => ({
              name: String(r[nameF] ?? ''),
              value: Number(r[valueF]) || 0,
            })),
            label: { color: '#a1a1aa' },
          },
        ];
      }
      break;
    }
    case 'scatter': {
      const xF = yFields[0] ?? xField;
      const yF = yFields[1] ?? yFields[0];
      if (xF && yF) {
        base.xAxis = { type: 'value', axisLabel: { color: '#a1a1aa' }, splitLine: { lineStyle: { color: '#27272a' } } };
        base.yAxis = { type: 'value', axisLabel: { color: '#a1a1aa' }, splitLine: { lineStyle: { color: '#27272a' } } };
        base.series = [
          {
            type: 'scatter',
            data: rows.map((r) => [Number(r[xF]) || 0, Number(r[yF]) || 0]),
            symbolSize: 8,
          },
        ];
      }
      break;
    }
    case 'heatmap': {
      base.xAxis = { type: 'category', data: xValues, axisLabel: { color: '#a1a1aa' } };
      base.yAxis = { type: 'category', axisLabel: { color: '#a1a1aa' } };
      base.visualMap = { min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: '#a1a1aa' } };
      const valueF = yFields[0];
      if (valueF) {
        base.series = [
          {
            type: 'heatmap',
            data: rows.map((r, i) => [i % 10, Math.floor(i / 10), Number(r[valueF]) || 0]),
            label: { show: true, color: '#a1a1aa' },
          },
        ];
      }
      break;
    }
    default: {
      /* Fallback: try bar chart */
      base.xAxis = { type: 'category', data: xValues, axisLabel: { color: '#a1a1aa' } };
      base.yAxis = { type: 'value', axisLabel: { color: '#a1a1aa' }, splitLine: { lineStyle: { color: '#27272a' } } };
      base.series = buildBarSeries(yFields, rows, categoryField);
      break;
    }
  }

  return base;
}

/** Build line/area series — supports grouped series via categoryField */
function buildLineSeries(
  yFields: string[],
  rows: Record<string, unknown>[],
  categoryField: string | undefined,
  isArea: boolean,
): unknown[] {
  if (categoryField && yFields.length === 1) {
    return buildGroupedSeries(yFields[0], rows, categoryField, isArea ? 'line' : 'line', isArea);
  }
  return yFields.map((f) => ({
    type: 'line',
    name: f,
    data: rows.map((r) => Number(r[f]) || 0),
    smooth: true,
    ...(isArea ? { areaStyle: { opacity: 0.15 } } : {}),
  }));
}

/** Build bar series — supports grouped series */
function buildBarSeries(
  yFields: string[],
  rows: Record<string, unknown>[],
  categoryField: string | undefined,
): unknown[] {
  if (categoryField && yFields.length === 1) {
    return buildGroupedSeries(yFields[0], rows, categoryField, 'bar', false);
  }
  return yFields.map((f) => ({
    type: 'bar',
    name: f,
    data: rows.map((r) => Number(r[f]) || 0),
    barMaxWidth: 40,
  }));
}

/** Build series grouped by a category field */
function buildGroupedSeries(
  yField: string,
  rows: Record<string, unknown>[],
  categoryField: string,
  chartType: string,
  isArea: boolean,
): unknown[] {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = String(row[categoryField] ?? '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(Number(row[yField]) || 0);
  }
  return Array.from(groups.entries()).map(([name, data]) => ({
    type: chartType,
    name,
    data,
    smooth: true,
    ...(isArea ? { areaStyle: { opacity: 0.15 } } : {}),
    ...(chartType === 'bar' ? { barMaxWidth: 40 } : {}),
  }));
}

/**
 * Unified chart renderer — accepts ChartConfig + execution result data.
 * Handles: metric_card, line, bar, horizontal_bar, pie, area, scatter, heatmap, grouped_bar, table.
 */
export function SmartChart({ config, rows, columns }: SmartChartProps) {
  // Hooks must be called unconditionally (React Rules of Hooks)
  const option = useMemo(
    () => buildEChartsOption(config, rows),
    [config, rows],
  );

  /* metric_card: render MetricCard */
  if (config.chartType === 'metric_card' || config.chartType === 'kpi') {
    if (rows.length === 0) {
      return (
        <div className="flex items-center justify-center p-8 text-muted text-sm">暂无数据</div>
      );
    }
    const valueField = config.valueField ?? columns[1]?.name ?? columns[0]?.name;
    const firstRow = rows[0];
    const value = firstRow ? (firstRow[valueField] as string | number) ?? 0 : 0;
    const trend = config.trendField && firstRow
      ? determineTrend(firstRow[config.trendField])
      : undefined;

    return (
      <MetricCard
        title={config.title ?? valueField}
        value={value}
        trend={trend}
      />
    );
  }

  /* table: return null — DataTable in ResultTab handles this */
  if (config.chartType === 'table') {
    return null;
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <ReactECharts
        option={option}
        style={{ height: 320 }}
        opts={{ renderer: 'svg' }}
        notMerge
      />
    </div>
  );
}

/** Determine trend direction from a value */
function determineTrend(value: unknown): 'up' | 'down' | 'flat' {
  const num = Number(value);
  if (Number.isNaN(num) || num === 0) return 'flat';
  return num > 0 ? 'up' : 'down';
}

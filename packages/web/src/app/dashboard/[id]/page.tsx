'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { ChartView } from '@/components/chart-view';
import { useDashboardStore, type WidgetPlacement } from '@/stores/dashboard-store';
import { Button } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

interface DashboardEditorPageProps {
  params: Promise<{ id: string }>;
}

export default function DashboardEditorPage({ params }: DashboardEditorPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const fetchDashboard = useDashboardStore((s) => s.fetchDashboard);
  const detail = useDashboardStore((s) => s.currentDashboard);
  const loading = useDashboardStore((s) => s.loading);

  useEffect(() => {
    useDashboardStore.setState({ currentDashboard: null });
    fetchDashboard(id);
  }, [id, fetchDashboard]);

  const dashboard = detail?.dashboard;
  const placements = detail?.widgets ?? [];
  const columns = dashboard?.layoutConfig?.columns ?? 2;

  return (
    <AppShell>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="border-b border-border px-6 py-3 shrink-0 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
          >
            <Icon name="chevronLeft" size={16} />
          </Button>
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-foreground truncate">
              {dashboard?.title ?? '加载中...'}
            </h2>
            {dashboard?.description && (
              <p className="text-xs text-muted truncate">{dashboard.description}</p>
            )}
          </div>
        </header>

        {/* Grid content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted">
              <p className="text-sm">加载中...</p>
            </div>
          ) : !dashboard ? (
            <div className="flex items-center justify-center py-20 text-muted">
              <p className="text-sm">仪表盘未找到</p>
            </div>
          ) : placements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted">
              <Icon name="layout" size={40} className="mb-3 opacity-30" />
              <p className="text-sm">还没有添加任何组件</p>
              <p className="text-xs mt-1">在对话中保存组件后，可以将其添加到仪表盘</p>
            </div>
          ) : (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
              }}
            >
              {placements
                .sort((a: WidgetPlacement, b: WidgetPlacement) =>
                  a.placement.positionY - b.placement.positionY || a.placement.positionX - b.placement.positionX,
                )
                .map((item: WidgetPlacement) => {
                  const widget = item.widget;
                  if (!widget) return null;

                  const raw = widget.chartConfig as {
                    xAxis?: { type?: string; data?: unknown[] };
                    yAxis?: { type?: string; data?: unknown[] };
                    series?: Array<{ name?: string; type: string; data: unknown[] }>;
                    title?: { text: string };
                  };
                  const chartConfig = {
                    ...raw,
                    xAxis: raw.xAxis ? { type: raw.xAxis.type ?? 'category', data: raw.xAxis.data } : undefined,
                    yAxis: raw.yAxis ? { type: raw.yAxis.type ?? 'value', data: raw.yAxis.data } : undefined,
                    series: raw.series ?? [],
                  };

                  return (
                    <div
                      key={item.placement.id}
                      className="rounded-xl border border-border bg-background overflow-hidden"
                      style={{
                        gridColumn: `span ${Math.min(item.placement.width, columns)}`,
                      }}
                    >
                      <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border">
                        <span className="text-xs font-medium text-foreground truncate">
                          {widget.title}
                        </span>
                        {widget.isLive && (
                          <div className="flex items-center gap-1 ml-2 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[10px] text-emerald-400 font-medium">LIVE</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <ChartView
                          chartType={widget.chartType as 'bar' | 'line' | 'pie' | 'table' | 'kpi' | 'horizontal_bar' | 'multi_line' | 'scatter' | 'grouped_bar'}
                          config={chartConfig}
                          height={280}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

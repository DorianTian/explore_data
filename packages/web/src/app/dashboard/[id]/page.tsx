'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { SmartChart } from '@/components/panel/smart-chart';
import {
  useDashboardStore,
  type Widget,
  type WidgetPlacement,
} from '@/stores/dashboard-store';
import { useProjectStore } from '@/stores/project-store';
import {
  Button,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Input,
} from '@/components/ui';
import { Icon } from '@/components/shared/icon';

interface DashboardEditorPageProps {
  params: Promise<{ id: string }>;
}

export default function DashboardEditorPage({ params }: DashboardEditorPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const fetchDashboard = useDashboardStore((s) => s.fetchDashboard);
  const fetchWidgets = useDashboardStore((s) => s.fetchWidgets);
  const detail = useDashboardStore((s) => s.currentDashboard);
  const allWidgets = useDashboardStore((s) => s.widgets);
  const loading = useDashboardStore((s) => s.loading);
  const addWidgetToDashboard = useDashboardStore((s) => s.addWidgetToDashboard);
  const removeWidgetFromDashboard = useDashboardStore((s) => s.removeWidgetFromDashboard);
  const { currentProjectId } = useProjectStore();

  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    fetchDashboard(id);
  }, [id, fetchDashboard]);

  useEffect(() => {
    if (currentProjectId) fetchWidgets(currentProjectId);
  }, [currentProjectId, fetchWidgets]);

  const dashboard = detail?.dashboard;
  const placements = detail?.widgets ?? [];
  const columns = dashboard?.layoutConfig?.columns ?? 2;

  // Widgets not yet added to this dashboard
  const placedWidgetIds = new Set(placements.map((p) => p.widget.id));
  const availableWidgets = allWidgets.filter((w) => !placedWidgetIds.has(w.id));

  const handleRemoveWidget = useCallback(
    async (dashboardId: string, placementId: string) => {
      await removeWidgetFromDashboard(dashboardId, placementId);
    },
    [removeWidgetFromDashboard],
  );

  return (
    <AppShell>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="border-b border-border px-6 py-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
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
          </div>
          {dashboard && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              <Icon name="plus" size={14} className="mr-1.5" />
              添加组件
            </Button>
          )}
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
              <p className="text-xs mt-1 mb-4">在对话中保存组件后，可以将其添加到仪表盘</p>
              {availableWidgets.length > 0 && (
                <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
                  <Icon name="plus" size={14} className="mr-1.5" />
                  添加组件
                </Button>
              )}
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

                  const chartConfig = widget.chartConfig as {
                    chartType: string;
                    xField?: string;
                    yField?: string | string[];
                    categoryField?: string;
                    valueField?: string;
                    title?: string;
                  } | null;

                  const snapshot = widget.dataSnapshot as {
                    rows: Record<string, unknown>[];
                    columns: Array<{ name: string; dataType: string }>;
                  } | null;

                  return (
                    <div
                      key={item.placement.id}
                      className="group rounded-xl border border-border bg-background overflow-hidden"
                      style={{
                        gridColumn: `span ${Math.min(item.placement.width, columns)}`,
                      }}
                    >
                      <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border">
                        <span className="text-xs font-medium text-foreground truncate">
                          {widget.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {widget.isLive && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="text-[10px] text-emerald-400 font-medium">LIVE</span>
                            </div>
                          )}
                          <button
                            onClick={() => handleRemoveWidget(id, item.placement.id)}
                            className="p-1 rounded text-muted hover:text-error hover:bg-red-500/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                            title="移除组件"
                          >
                            <Icon name="x" size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="p-3">
                        {chartConfig && snapshot ? (
                          <SmartChart
                            config={{ ...chartConfig, chartType: widget.chartType }}
                            rows={snapshot.rows}
                            columns={snapshot.columns}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-[280px] text-muted text-xs">
                            暂无图表数据
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Widget picker modal */}
      <WidgetPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        widgets={allWidgets}
        placedWidgetIds={placedWidgetIds}
        dashboardId={id}
        onAdd={addWidgetToDashboard}
      />
    </AppShell>
  );
}

/** Modal for selecting widgets to add to a dashboard */
function WidgetPickerDialog({
  open,
  onClose,
  widgets,
  placedWidgetIds,
  dashboardId,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  widgets: Widget[];
  placedWidgetIds: Set<string>;
  dashboardId: string;
  onAdd: (dashboardId: string, widgetId: string) => Promise<boolean>;
}) {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  const filtered = search.trim()
    ? widgets.filter(
        (w) =>
          w.title.toLowerCase().includes(search.toLowerCase()) ||
          w.naturalLanguage.toLowerCase().includes(search.toLowerCase()),
      )
    : widgets;

  const handleAdd = useCallback(
    async (widgetId: string) => {
      setAdding(widgetId);
      try {
        const ok = await onAdd(dashboardId, widgetId);
        if (ok) onClose();
      } finally {
        setAdding(null);
      }
    },
    [dashboardId, onAdd, onClose],
  );

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>添加组件到仪表盘</DialogTitle>
      </DialogHeader>

      <DialogBody className="space-y-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索组件..."
          autoFocus
        />

        {filtered.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">
            {widgets.length === 0
              ? '暂无可添加的组件，请先在对话中保存组件'
              : '没有匹配的组件'}
          </p>
        ) : (
          <div className="max-h-[360px] overflow-y-auto space-y-2">
            {filtered.map((w) => {
              const isPlaced = placedWidgetIds.has(w.id);
              return (
                <div
                  key={w.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isPlaced
                      ? 'border-border/50 opacity-60'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{w.title}</p>
                    <p className="text-xs text-muted truncate mt-0.5">{w.naturalLanguage}</p>
                    <p className="text-[11px] text-muted mt-1">
                      {w.chartType} · {new Date(w.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  {isPlaced ? (
                    <span className="ml-3 shrink-0 text-xs text-muted">已添加</span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ml-3 shrink-0"
                      onClick={() => handleAdd(w.id)}
                      disabled={adding === w.id}
                    >
                      {adding === w.id ? '添加中...' : '添加'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

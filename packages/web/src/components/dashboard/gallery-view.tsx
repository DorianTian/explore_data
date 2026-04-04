'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent, Badge } from '@/components/ui';
import { Icon } from '@/components/shared/icon';
import { Input } from '@/components/ui';
import { WidgetCard } from './widget-card';
import { useDashboardStore, type Dashboard } from '@/stores/dashboard-store';

export function GalleryView() {
  const [search, setSearch] = useState('');
  const [favOnly, setFavOnly] = useState(false);

  const widgets = useDashboardStore((s) => s.widgets);
  const dashboards = useDashboardStore((s) => s.dashboards);
  const favorites = useDashboardStore((s) => s.favorites);
  const toggleFavorite = useDashboardStore((s) => s.toggleFavorite);
  const deleteDashboard = useDashboardStore((s) => s.deleteDashboard);
  const router = useRouter();

  const query = search.toLowerCase().trim();

  const filteredWidgets = useMemo(() => {
    let result = widgets;
    if (query) {
      result = result.filter(
        (w) =>
          w.title.toLowerCase().includes(query) ||
          (w.description?.toLowerCase().includes(query) ?? false),
      );
    }
    if (favOnly) {
      const favIds = new Set(
        favorites.filter((f) => f.targetType === 'widget').map((f) => f.targetId),
      );
      result = result.filter((w) => favIds.has(w.id));
    }
    return result;
  }, [widgets, query, favOnly, favorites]);

  const filteredDashboards = useMemo(() => {
    let result = dashboards;
    if (query) {
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(query) ||
          (d.description?.toLowerCase().includes(query) ?? false),
      );
    }
    if (favOnly) {
      const favIds = new Set(
        favorites.filter((f) => f.targetType === 'dashboard').map((f) => f.targetId),
      );
      result = result.filter((d) => favIds.has(d.id));
    }
    return result;
  }, [dashboards, query, favOnly, favorites]);

  return (
    <Tabs defaultValue="widgets" className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar: tabs + search + favorite filter */}
      <div className="flex items-center gap-4 border-b border-border px-6 shrink-0">
        <TabsList className="border-b-0">
          <TabsTrigger value="widgets">
            组件
            {widgets.length > 0 && (
              <Badge variant="default" className="ml-1.5">{widgets.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dashboards">
            仪表盘
            {dashboards.length > 0 && (
              <Badge variant="default" className="ml-1.5">{dashboards.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Icon
              name="search"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索..."
              className="h-7 w-48 pl-8 text-xs"
            />
          </div>
          <button
            onClick={() => setFavOnly((v) => !v)}
            className={`p-1.5 rounded-[var(--radius-md)] transition-colors cursor-pointer ${
              favOnly
                ? 'text-red-400 bg-red-500/10'
                : 'text-muted hover:text-foreground hover:bg-surface'
            }`}
            title={favOnly ? '显示全部' : '只看收藏'}
          >
            <Icon name="heart" size={14} filled={favOnly} />
          </button>
        </div>
      </div>

      {/* Widgets grid */}
      <TabsContent value="widgets" className="flex-1 overflow-y-auto p-6">
        {filteredWidgets.length === 0 ? (
          <EmptyState text={query || favOnly ? '没有匹配的组件' : '还没有保存任何组件'} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredWidgets.map((w) => (
              <WidgetCard key={w.id} widget={w} />
            ))}
          </div>
        )}
      </TabsContent>

      {/* Dashboards grid */}
      <TabsContent value="dashboards" className="flex-1 overflow-y-auto p-6">
        {filteredDashboards.length === 0 ? (
          <EmptyState text={query || favOnly ? '没有匹配的仪表盘' : '还没有创建任何仪表盘'} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDashboards.map((d) => (
              <DashboardCard
                key={d.id}
                dashboard={d}
                isFavorited={favorites.some(
                  (f) => f.targetType === 'dashboard' && f.targetId === d.id,
                )}
                onOpen={() => router.push(`/dashboard/${d.id}`)}
                onToggleFavorite={() => toggleFavorite('dashboard', d.id)}
                onDelete={() => deleteDashboard(d.id)}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

/** Dashboard card for the gallery grid */
function DashboardCard({
  dashboard,
  isFavorited,
  onOpen,
  onToggleFavorite,
  onDelete,
}: {
  dashboard: Dashboard;
  isFavorited: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="group rounded-xl border border-border bg-background hover:border-primary/40 hover:shadow-md transition-all cursor-pointer overflow-hidden"
    >
      {/* Preview placeholder */}
      <div className="h-32 bg-surface flex items-center justify-center">
        <Icon name="layout" size={32} className="text-muted/40" />
      </div>

      <div className="p-3 space-y-2">
        <h3 className="text-sm font-medium text-foreground line-clamp-1">
          {dashboard.name}
        </h3>
        {dashboard.description && (
          <p className="text-xs text-muted line-clamp-2">{dashboard.description}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted">
            {new Date(dashboard.createdAt).toLocaleDateString('zh-CN')}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={`p-1.5 rounded-[var(--radius-md)] transition-colors cursor-pointer ${
                isFavorited
                  ? 'text-red-400 bg-red-500/10'
                  : 'text-muted hover:text-foreground hover:bg-surface'
              }`}
            >
              <Icon name="heart" size={14} filled={isFavorited} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted">
      <Icon name="grid" size={40} className="mb-3 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

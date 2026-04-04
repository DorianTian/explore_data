'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ToastProvider, useToast } from '@/components/toast';
import { GalleryView } from '@/components/dashboard/gallery-view';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useProjectStore } from '@/stores/project-store';
import { Button, Input, Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

function DashboardPageInner() {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const fetchWidgets = useDashboardStore((s) => s.fetchWidgets);
  const fetchDashboards = useDashboardStore((s) => s.fetchDashboards);
  const fetchFavorites = useDashboardStore((s) => s.fetchFavorites);
  const createDashboard = useDashboardStore((s) => s.createDashboard);
  const loading = useDashboardStore((s) => s.loading);
  const { toast } = useToast();

  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!currentProjectId) return;
    fetchWidgets(currentProjectId);
    fetchDashboards(currentProjectId);
    fetchFavorites();
  }, [currentProjectId, fetchWidgets, fetchDashboards, fetchFavorites]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !currentProjectId) return;

    setCreating(true);
    try {
      const dashboard = await createDashboard({
        projectId: currentProjectId,
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      if (dashboard) {
        setShowNewDashboard(false);
        setNewName('');
        setNewDesc('');
        toast('仪表盘已创建', 'success');
      } else {
        toast('创建仪表盘失败', 'error');
      }
    } finally {
      setCreating(false);
    }
  }, [newName, newDesc, currentProjectId, createDashboard, toast]);

  return (
    <AppShell>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="border-b border-border px-6 py-3 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">BI 市场</h2>
            <p className="text-xs text-muted">
              浏览和管理你保存的组件与仪表盘
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowNewDashboard(true)}
            disabled={!currentProjectId}
          >
            <Icon name="plus" size={14} />
            新建仪表盘
          </Button>
        </header>

        {/* Content */}
        {!currentProjectId ? (
          <div className="flex-1 flex items-center justify-center text-muted">
            <p className="text-sm">请先在左侧选择一个项目</p>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center text-muted">
            <p className="text-sm">加载中...</p>
          </div>
        ) : (
          <GalleryView />
        )}
      </div>

      {/* New Dashboard Dialog */}
      <Dialog open={showNewDashboard} onClose={() => setShowNewDashboard(false)}>
        <DialogHeader>
          <DialogTitle>新建仪表盘</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">
              名称
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="仪表盘名称"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">
              描述（可选）
            </label>
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="简要描述这个仪表盘"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setShowNewDashboard(false)} disabled={creating}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </Dialog>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <DashboardPageInner />
    </ToastProvider>
  );
}

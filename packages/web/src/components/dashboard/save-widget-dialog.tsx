'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Input,
  Button,
} from '@/components/ui';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useProjectStore } from '@/stores/project-store';
import type { ChatMessage } from '@/stores/chat-store';

interface SaveWidgetDialogProps {
  open: boolean;
  onClose: () => void;
  message: ChatMessage;
}

export function SaveWidgetDialog({ open, onClose, message }: SaveWidgetDialogProps) {
  const [title, setTitle] = useState(
    () => message.content.slice(0, 80) || 'Untitled Widget',
  );
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const createWidget = useDashboardStore((s) => s.createWidget);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const currentDatasourceId = useProjectStore((s) => s.currentDatasourceId);

  const handleSave = useCallback(async () => {
    if (!title.trim() || !currentProjectId || !currentDatasourceId) return;

    setSaving(true);
    try {
      const widget = await createWidget({
        projectId: currentProjectId,
        datasourceId: currentDatasourceId,
        title: title.trim(),
        description: description.trim() || undefined,
        message,
      });
      if (widget) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }, [title, description, message, currentProjectId, currentDatasourceId, createWidget, onClose]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>保存为组件</DialogTitle>
      </DialogHeader>

      <DialogBody className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">
            标题
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="组件标题"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">
            描述（可选）
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要描述这个组件的用途"
          />
        </div>
        {message.chartRecommendation && (
          <p className="text-xs text-muted">
            图表类型: {message.chartRecommendation.chartType}
          </p>
        )}
      </DialogBody>

      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          取消
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !title.trim() || !currentProjectId || !currentDatasourceId || !message.sql}
        >
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

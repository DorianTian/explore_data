'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { useChatStore, type ChatMessage } from '@/stores/chat-store';

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

  /* Sync title when dialog opens with a different message */
  useEffect(() => {
    setTitle(message.content.slice(0, 80) || 'Untitled Widget');
    setDescription('');
  }, [message.id]); // eslint-disable-line react-hooks/exhaustive-deps — content excluded to preserve user edits during streaming

  const createWidget = useDashboardStore((s) => s.createWidget);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const currentDatasourceId = useProjectStore((s) => s.currentDatasourceId);
  const conversationId = useChatStore((s) => s.conversationId);

  const handleSave = useCallback(async () => {
    if (!title.trim() || !currentProjectId || !currentDatasourceId) return;

    setSaving(true);
    try {
      const widget = await createWidget({
        projectId: currentProjectId,
        datasourceId: currentDatasourceId,
        conversationId: conversationId ?? undefined,
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
  }, [title, description, message, currentProjectId, currentDatasourceId, conversationId, createWidget, onClose]);

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

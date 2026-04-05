'use client';

import { useEffect, useCallback } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
import { useUserStore } from '@/stores/user-store';
import { Icon } from '@/components/shared/icon';

/** Sidebar conversation history list — shown on /chat route */
export function ConversationList({ collapsed }: { collapsed: boolean }) {
  const conversations = useChatStore((s) => s.conversations);
  const conversationsLoading = useChatStore((s) => s.conversationsLoading);
  const currentConversationId = useChatStore((s) => s.conversationId);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const loadConversation = useChatStore((s) => s.loadConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const userId = useUserStore((s) => s.user?.id);

  useEffect(() => {
    if (currentProjectId) {
      fetchConversations(currentProjectId, userId);
    }
  }, [currentProjectId, userId, fetchConversations]);

  const handleSelect = useCallback(
    (id: string) => {
      if (id === currentConversationId) return;
      loadConversation(id);
    },
    [currentConversationId, loadConversation],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      deleteConversation(id);
    },
    [deleteConversation],
  );

  const handleNewChat = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  if (collapsed) return null;

  return (
    <div className="flex flex-col min-h-0">
      {/* Header + new chat */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
          历史对话
        </span>
        <button
          onClick={handleNewChat}
          className="p-1 rounded-[var(--radius-md)] text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
          title="新对话"
        >
          <Icon name="plus" size={14} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-1.5 space-y-0.5">
        {conversationsLoading ? (
          <div className="px-2 py-3 text-xs text-muted text-center">加载中...</div>
        ) : conversations.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted text-center">暂无对话</div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === currentConversationId;
            const displayTitle =
              conv.title || `对话 ${new Date(conv.createdAt).toLocaleDateString('zh-CN')}`;

            return (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv.id)}
                className={`group flex items-center gap-2 w-full px-2.5 py-1.5 rounded-[var(--radius-md)] text-left text-sm transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-surface-hover text-foreground'
                    : 'text-muted hover:bg-surface hover:text-foreground'
                }`}
              >
                <Icon name="message" size={14} className="shrink-0 opacity-50" />
                <span className="flex-1 truncate text-xs">{displayTitle}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleDelete(e, conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDelete(e as unknown as React.MouseEvent, conv.id);
                  }}
                  className="shrink-0 p-0.5 rounded text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Icon name="x" size={12} />
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

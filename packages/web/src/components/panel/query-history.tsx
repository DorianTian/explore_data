'use client';

import { useMemo, useCallback } from 'react';
import { useChatStore, type ChatMessage } from '@/stores/chat-store';
import { usePanelStore } from '@/stores/panel-store';
import { Badge } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

/** Extract query pairs (user question -> assistant response with SQL) */
interface QueryPair {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

function formatTime(id: string): string {
  /* IDs might encode timestamps; fall back to "just now" */
  const ts = parseInt(id, 10);
  if (!isNaN(ts) && ts > 1e12) {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return '';
}

function truncateSql(sql: string, maxLen = 80): string {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen) + '...';
}

function confidenceVariant(
  c: number,
): 'success' | 'warning' | 'error' {
  if (c >= 0.8) return 'success';
  if (c >= 0.6) return 'warning';
  return 'error';
}

export function QueryHistory() {
  const messages = useChatStore((s) => s.messages);
  const selectMessage = usePanelStore((s) => s.selectMessage);

  /* Pair user questions with their assistant SQL responses */
  const queryPairs = useMemo(() => {
    const pairs: QueryPair[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'user') {
        /* Find the next assistant message with SQL */
        const next = messages[i + 1];
        if (next && next.role === 'assistant' && next.sql) {
          pairs.push({ userMessage: msg, assistantMessage: next });
        }
      }
    }
    return pairs.reverse();
  }, [messages]);

  const handleSelect = useCallback(
    (messageId: string) => {
      selectMessage(messageId);
    },
    [selectMessage],
  );

  if (queryPairs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-3 text-muted">
        <Icon name="clock" size={28} className="mb-2 opacity-40" />
        <p className="text-sm">还没有查询记录</p>
        <p className="text-xs mt-1">在对话中提问后，查询历史会出现在这里</p>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
      {queryPairs.map(({ userMessage, assistantMessage }) => (
        <button
          key={assistantMessage.id}
          type="button"
          onClick={() => handleSelect(assistantMessage.id)}
          className="w-full text-left p-3 rounded-[var(--radius-md)] border border-border hover:bg-surface-hover transition-colors cursor-pointer group"
        >
          {/* Question */}
          <p className="text-sm text-foreground line-clamp-2 mb-1.5">
            {userMessage.content}
          </p>

          {/* SQL preview */}
          {assistantMessage.sql && (
            <p className="text-xs font-mono text-muted bg-background rounded-[var(--radius-sm)] px-2 py-1 mb-2 line-clamp-1">
              {truncateSql(assistantMessage.sql)}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2">
            {assistantMessage.confidence !== undefined && (
              <Badge
                variant={confidenceVariant(assistantMessage.confidence)}
                className="text-[10px] px-1.5 py-0"
              >
                {Math.round(assistantMessage.confidence * 100)}%
              </Badge>
            )}
            {assistantMessage.feedback && (
              <Badge
                variant={
                  assistantMessage.feedback === 'accepted'
                    ? 'success'
                    : 'error'
                }
                className="text-[10px] px-1.5 py-0"
              >
                {assistantMessage.feedback === 'accepted' ? '已接受' : '已拒绝'}
              </Badge>
            )}
            {assistantMessage.isGolden && (
              <Icon
                name="star"
                size={12}
                filled
                className="text-golden"
              />
            )}
            <span className="text-[10px] text-muted ml-auto">
              {formatTime(assistantMessage.id)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

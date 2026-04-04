'use client';

import { useRef, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ChatMessage } from '@/components/chat/chat-message';
import { ChatInput } from '@/components/chat-input';
import { ArtifactPanel } from '@/components/panel/artifact-panel';
import { SchemaBrowser } from '@/components/panel/schema-browser';
import { ToastProvider } from '@/components/toast';
import { useChatStore } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
import { usePanelStore } from '@/stores/panel-store';
import { useSSEStream } from '@/hooks/use-sse-stream';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard';
import { Icon } from '@/components/shared/icon';

const EXAMPLE_QUERIES = [
  '上个月各区域的 GMV 是多少？',
  '最近 7 天日活用户趋势如何？',
  '销量 Top 10 的商品有哪些？',
  '复购率最高的用户群体是哪个城市？',
  '本月订单取消率和上月相比有什么变化？',
  '客单价最高的渠道是哪个？',
];

function ChatPageInner() {
  const { messages, loading, clearMessages } = useChatStore();
  const { currentProjectId, currentDatasourceId } = useProjectStore();
  const artifactOpen = usePanelStore((s) => s.artifactOpen);
  const panelIsOpen = usePanelStore((s) => s.isOpen);
  const closePanel = usePanelStore((s) => s.closePanel);
  const { sendQuery } = useSSEStream();
  useKeyboardShortcuts();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    (query: string) => {
      if (!currentProjectId || !currentDatasourceId) return;

      const conversationHistory = messages
        .filter(
          (m) => m.role === 'user' || (m.role === 'assistant' && !m.isStreaming),
        )
        .slice(-10)
        .map((m) => ({
          role: m.role,
          content: m.content,
          sql: m.sql,
        }));

      sendQuery(query, conversationHistory);
    },
    [messages, currentProjectId, currentDatasourceId, sendQuery],
  );

  const hasContext = currentProjectId && currentDatasourceId;

  /* Right panel priority: artifact > schema browser */
  const showSchema = panelIsOpen && !artifactOpen;
  const showRightPanel = artifactOpen || showSchema;

  return (
    <AppShell>
      <ToastProvider>
        <div className="flex h-full overflow-hidden">
          {/* Conversation column — always centered, flex-1 */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">对话</h2>
              {messages.length > 0 && (
                <button
                  onClick={clearMessages}
                  className="text-xs text-muted hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Icon name="plus" size={12} />
                  新对话
                </button>
              )}
            </header>

            {/* Messages area — centered with max-width */}
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <EmptyState
                  hasContext={Boolean(hasContext)}
                  onSelectQuery={handleSend}
                />
              ) : (
                <div className="max-w-3xl mx-auto px-6 py-6">
                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input bar */}
            <div className="shrink-0 px-6 pb-4">
              <div className="max-w-3xl mx-auto">
                <ChatInput onSend={handleSend} disabled={loading || !hasContext} />
              </div>
            </div>
          </div>

          {/* Right panel — artifact (SQL/Result/Chart) or schema browser */}
          {showRightPanel && (
            <div
              className="shrink-0 border-l border-border bg-background-secondary animate-slide-in-right"
              style={{ width: 'min(480px, 45vw)' }}
            >
              {artifactOpen ? (
                <ArtifactPanel />
              ) : (
                <SchemaPanel onClose={closePanel} />
              )}
            </div>
          )}
        </div>
      </ToastProvider>
    </AppShell>
  );
}

/** Schema browser wrapper with header and close button */
function SchemaPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-medium text-foreground">Schema</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pt-3">
        <SchemaBrowser />
      </div>
    </div>
  );
}

/** Centered empty state with example query chips */
function EmptyState({
  hasContext,
  onSelectQuery,
}: {
  hasContext: boolean;
  onSelectQuery: (query: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-6">
      <h1 className="text-2xl font-semibold text-foreground mb-2 tracking-tight">
        有什么数据问题？
      </h1>
      <p className="text-sm text-muted mb-8">
        {hasContext
          ? '用自然语言描述你想查询的内容'
          : '请先在左侧选择项目和数据源'}
      </p>

      {hasContext && (
        <div className="grid grid-cols-2 gap-2.5 w-full max-w-lg">
          {EXAMPLE_QUERIES.map((query) => (
            <button
              key={query}
              onClick={() => onSelectQuery(query)}
              className="text-left text-sm px-4 py-3 rounded-xl border border-border bg-surface text-muted hover:text-foreground hover:bg-surface-hover hover:border-border-strong transition-all cursor-pointer leading-relaxed"
            >
              {query}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return <ChatPageInner />;
}

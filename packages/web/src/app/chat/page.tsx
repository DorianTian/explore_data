'use client';

import { useRef, useEffect, useCallback, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { ChatMessage } from '@/components/chat/chat-message';
import { ChatInput } from '@/components/chat-input';
import { ArtifactPanel } from '@/components/panel/artifact-panel';
import { ToastProvider } from '@/components/toast';
import { useChatStore } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
import { usePanelStore } from '@/stores/panel-store';
import { useSSEStream } from '@/hooks/use-sse-stream';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard';
import { Icon } from '@/components/shared/icon';
import { useUserStore } from '@/stores/user-store';

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
  const userName = useUserStore((s) => s.user?.name);
  const { currentProjectId, currentDatasourceId } = useProjectStore();
  const panelIsOpen = usePanelStore((s) => s.isOpen);
  const { sendQuery } = useSSEStream();
  useKeyboardShortcuts();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const initialQueryHandled = useRef(false);
  const handleSendRef = useRef<(q: string) => void>(() => {});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* Handle ?q= from quick chat navigation */
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !initialQueryHandled.current && currentProjectId && currentDatasourceId) {
      initialQueryHandled.current = true;
      handleSendRef.current(q);
      window.history.replaceState({}, '', '/chat');
    }
  }, [searchParams, currentProjectId, currentDatasourceId]);

  /* Handle quick-chat custom event from other pages — use ref to avoid stale closure */
  useEffect(() => {
    const handler = (e: Event) => {
      const query = (e as CustomEvent<string>).detail;
      if (query) handleSendRef.current(query);
    };
    window.addEventListener('quick-chat', handler);
    return () => window.removeEventListener('quick-chat', handler);
  }, []);

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

  // Keep ref in sync for event handlers that can't have handleSend in deps
  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  const hasContext = currentProjectId && currentDatasourceId;
  const isEmpty = messages.length === 0;

  /* Right panel — unified tabs (schema / sql / result / chart) */

  /* Resizable right panel width */
  const [panelWidth, setPanelWidth] = useState(480);
  const startPanelResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = panelWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = startX - ev.clientX;
        setPanelWidth(Math.max(320, Math.min(800, startW + delta)));
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [panelWidth],
  );

  return (
    <AppShell>
      <ToastProvider>
        <div className="flex h-full overflow-hidden">
          {/* Conversation column */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">对话</h2>
              <div className="flex items-center gap-3">
                {messages.length > 0 && (
                  <button
                    onClick={clearMessages}
                    className="text-xs text-muted hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Icon name="plus" size={12} />
                    新对话
                  </button>
                )}
                {userName && (
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
                      {userName[0]}
                    </div>
                    <span>{userName}</span>
                  </div>
                )}
              </div>
            </header>

            {isEmpty ? (
              /* Empty state — title + chips + input grouped together, vertically centered */
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <h1 className="text-2xl font-semibold text-foreground mb-2 tracking-tight">
                  有什么数据问题？
                </h1>
                <p className="text-sm text-muted mb-6">
                  {hasContext
                    ? '用自然语言描述你想查询的内容'
                    : '请先在左侧选择项目和数据源'}
                </p>

                {hasContext && (
                  <div className="flex flex-wrap gap-2 max-w-2xl mb-6">
                    {EXAMPLE_QUERIES.map((query) => (
                      <button
                        key={query}
                        onClick={() => handleSend(query)}
                        className="text-[13px] px-3.5 py-2 rounded-full border border-border/60 text-muted hover:text-foreground hover:bg-surface-hover hover:border-border-strong transition-all cursor-pointer whitespace-nowrap"
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                )}

                <div className="w-full max-w-2xl">
                  <ChatInput onSend={handleSend} disabled={loading || !hasContext} />
                </div>
              </div>
            ) : (
              /* Conversation mode — messages scroll + input pinned at bottom */
              <>
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-3xl mx-auto px-6 py-6">
                    {messages.map((msg) => (
                      <ChatMessage key={msg.id} message={msg} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                <div className="shrink-0 px-6 pb-4">
                  <div className="max-w-3xl mx-auto">
                    <ChatInput onSend={handleSend} disabled={loading || !hasContext} />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right panel — unified tabs: 表结构 / SQL / 结果 / 图表 */}
          {panelIsOpen && (
            <div
              className="relative shrink-0 border-l border-border bg-background-secondary animate-slide-in-right"
              style={{ width: panelWidth }}
            >
              {/* Drag handle */}
              <div className="resize-handle !left-[-3px] !right-auto" onMouseDown={startPanelResize} />
              <ArtifactPanel />
            </div>
          )}
        </div>
      </ToastProvider>
    </AppShell>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}

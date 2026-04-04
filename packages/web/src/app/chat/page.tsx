'use client';

import { useRef, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Panel } from '@/components/layout/panel';
import { ChatMessage } from '@/components/chat/chat-message';
import { ChatInput } from '@/components/chat-input';
import { ToastProvider } from '@/components/toast';
import { useChatStore } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
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

  return (
    <AppShell panel={<Panel onSelectQuery={handleSend} />}>
      <ToastProvider>
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">对话</h2>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              新对话
            </button>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Icon name="message" size={24} className="text-primary" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                用自然语言查询数据
              </h3>
              <p className="text-sm text-muted text-center mb-6">
                {hasContext
                  ? '输入你的问题，或试试下面的示例：'
                  : '请先在左侧选择项目和数据源'}
              </p>

              {hasContext && (
                <div className="grid grid-cols-2 gap-2 w-full">
                  {EXAMPLE_QUERIES.map((query) => (
                    <button
                      key={query}
                      onClick={() => handleSend(query)}
                      className="text-left text-sm px-3 py-2.5 rounded-[var(--radius-md)] border border-border text-muted hover:text-foreground hover:bg-surface hover:border-primary/30 transition-colors cursor-pointer"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0">
          <ChatInput onSend={handleSend} disabled={loading || !hasContext} />
        </div>
      </ToastProvider>
    </AppShell>
  );
}

export default function ChatPage() {
  return <ChatPageInner />;
}

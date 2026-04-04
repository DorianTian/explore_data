'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ChatInput } from '@/components/chat-input';
import { ChatMessage } from '@/components/chat-message';
import { SqlResultTable } from '@/components/sql-result-table';
import { ChartView } from '@/components/chart-view';
import { ToastProvider, useToast } from '@/components/toast';
import { useChatStore } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
import { apiPost } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100';

const EXAMPLE_QUERIES = [
  { text: '查询最近 7 天的日活用户数', icon: '📊' },
  { text: '按产品分类统计本月 GMV', icon: '💰' },
  { text: '找出下单最多的前 10 个用户', icon: '🏆' },
  { text: '计算各渠道的转化率对比', icon: '📈' },
];

function ChatPageInner() {
  const {
    messages,
    loading,
    addMessage,
    updateMessage,
    setLoading,
    setFeedback,
    conversationId: currentConversationId,
    setConversationId,
  } = useChatStore();
  const { currentProjectId, currentDatasourceId } = useProjectStore();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const abortRef = useRef<AbortController | null>(null);

  /** Clean up in-flight SSE request on unmount */
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      if (!currentProjectId || !currentDatasourceId) {
        toast('请先在左侧选择项目和数据源', 'error');
        return;
      }

      /* abort any previous in-flight stream */
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      /* 1. user message */
      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content,
      });

      /* 2. assistant placeholder */
      const assistantId = crypto.randomUUID();
      addMessage({ id: assistantId, role: 'assistant', content: '', isStreaming: true });
      setLoading(true);

      try {
        const response = await fetch(`${API_BASE}/api/query/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            projectId: currentProjectId,
            datasourceId: currentDatasourceId,
            query: content,
            conversationId: currentConversationId,
            conversationHistory: messages.slice(-8).map((m) => ({
              role: m.role,
              content: m.content,
              sql: m.sql,
            })),
          }),
        });

        if (!response.ok || !response.body) {
          updateMessage(assistantId, {
            content: `请求失败 (${response.status})，请检查后端服务。`,
            isStreaming: false,
          });
          return;
        }

        /* 3. parse SSE stream */
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
              continue;
            }

            if (!line.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(line.slice(6));

              switch (currentEvent) {
                case 'status':
                  updateMessage(assistantId, { content: data.message ?? data.step ?? '' });
                  break;

                case 'result':
                  updateMessage(assistantId, {
                    content: data.explanation ?? '',
                    sql: data.sql,
                    confidence: data.confidence,
                    executionResult: data.executionResult,
                    chartRecommendation: data.chartRecommendation,
                  });
                  break;

                case 'conversation':
                  setConversationId(data.conversationId ?? data.id ?? null);
                  break;

                case 'error':
                  updateMessage(assistantId, {
                    content: data.message ?? '处理请求时出了点问题。',
                    isStreaming: false,
                  });
                  break;

                case 'done':
                  updateMessage(assistantId, { isStreaming: false });
                  break;
              }
            } catch {
              /* skip malformed data lines */
            }
          }
        }

        /* stream ended — ensure streaming flag is off */
        updateMessage(assistantId, { isStreaming: false });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        updateMessage(assistantId, {
          content: '无法连接到 API 服务器，请确认后端服务是否正常运行。',
          isStreaming: false,
        });
      } finally {
        setLoading(false);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [
      messages,
      currentProjectId,
      currentDatasourceId,
      currentConversationId,
      addMessage,
      updateMessage,
      setLoading,
      setConversationId,
      toast,
    ],
  );

  const handleFeedback = useCallback(
    async (id: string, feedback: 'up' | 'down') => {
      setFeedback(id, feedback);
      const msg = messages.find((m) => m.id === id);
      if (msg?.sql && currentProjectId) {
        /* find the user message immediately before this assistant message */
        const msgIndex = messages.findIndex((m) => m.id === id);
        const userMsg = messages
          .slice(0, msgIndex)
          .reverse()
          .find((m) => m.role === 'user');
        await apiPost('/api/query/feedback', {
          projectId: currentProjectId,
          naturalLanguage: userMsg?.content ?? '',
          generatedSql: msg.sql,
          wasAccepted: feedback === 'up' ? 1 : 0,
        });
      }
    },
    [messages, currentProjectId, setFeedback],
  );

  const handleExampleClick = useCallback(
    (query: string) => {
      handleSend(query);
    },
    [handleSend],
  );

  const noContext = !currentProjectId || !currentDatasourceId;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-border px-6 py-3 shrink-0">
          <h2 className="text-sm font-medium text-foreground">对话</h2>
          <p className="text-xs text-muted">
            用自然语言描述你的数据需求，AI 为你生成 SQL
          </p>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-4">
            {messages.length === 0 ? (
              <EmptyState
                onExampleClick={handleExampleClick}
                disabled={noContext}
              />
            ) : (
              <>
                {messages.map((msg) => (
                  <div key={msg.id}>
                    <ChatMessage
                      id={msg.id}
                      role={msg.role}
                      content={msg.content}
                      sql={msg.sql}
                      confidence={msg.confidence}
                      feedback={msg.feedback}
                      isStreaming={msg.isStreaming}
                      onFeedback={handleFeedback}
                    />
                    {msg.chartRecommendation &&
                      msg.chartRecommendation.chartType !== 'table' && (
                        <div className="mb-4 ml-1">
                          <ChartView
                            chartType={msg.chartRecommendation.chartType as any}
                            config={msg.chartRecommendation.config as any}
                          />
                        </div>
                      )}
                    {msg.executionResult && (
                      <div className="mb-4 ml-1">
                        <SqlResultTable
                          columns={msg.executionResult.columns}
                          rows={msg.executionResult.rows}
                          truncated={msg.executionResult.truncated}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {loading && <LoadingIndicator />}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={loading} />
      </main>
    </div>
  );
}

function EmptyState({
  onExampleClick,
  disabled,
}: {
  onExampleClick: (q: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <SparkleIcon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1.5">
        开始数据查询
      </h3>
      <p className="text-sm text-muted mb-8 text-center max-w-md">
        {disabled
          ? '请先在左侧选择项目和数据源，然后开始提问'
          : '描述你想了解的数据，AI 会自动生成对应的 SQL 查询语句'}
      </p>

      {!disabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q.text}
              onClick={() => onExampleClick(q.text)}
              className="
                flex items-center gap-3 text-left px-4 py-3
                rounded-xl border border-border bg-background
                text-sm text-foreground
                hover:bg-surface hover:border-primary/30
                transition-all duration-150
                group
              "
            >
              <span className="text-lg shrink-0">{q.icon}</span>
              <span className="group-hover:text-primary transition-colors">
                {q.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex justify-start py-5 animate-fade-in">
      <div className="bg-surface rounded-2xl px-5 py-3.5">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 bg-muted/60 rounded-full animate-bounce" />
          <span className="w-2 h-2 bg-muted/60 rounded-full animate-bounce [animation-delay:0.15s]" />
          <span className="w-2 h-2 bg-muted/60 rounded-full animate-bounce [animation-delay:0.3s]" />
        </div>
      </div>
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06a.75.75 0 11-1.061 1.06l-1.06-1.06a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zM10 7a3 3 0 100 6 3 3 0 000-6zm-6.25 3a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm11.5 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm-8.14 3.89a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 11-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zm7.88 0a.75.75 0 011.06 0l1.06 1.06a.75.75 0 01-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15z" />
    </svg>
  );
}

export default function ChatPage() {
  return (
    <ToastProvider>
      <ChatPageInner />
    </ToastProvider>
  );
}

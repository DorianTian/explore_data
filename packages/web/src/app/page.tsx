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

interface QueryResponse {
  resolvedVia: 'metric' | 'nl2sql' | 'clarification';
  sql?: string;
  explanation: string;
  confidence: number;
  clarificationQuestion?: string;
}

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

  /** Simulate streaming by revealing text character by character */
  const simulateStreaming = useCallback(
    (messageId: string, fullText: string, sql?: string, confidence?: number) => {
      let index = 0;
      const chunkSize = 3;
      const interval = setInterval(() => {
        index += chunkSize;
        if (index >= fullText.length) {
          clearInterval(interval);
          updateMessage(messageId, {
            content: fullText,
            sql,
            confidence,
            isStreaming: false,
          });
        } else {
          updateMessage(messageId, { content: fullText.slice(0, index) });
        }
      }, 20);
    },
    [updateMessage],
  );

  const handleSend = useCallback(
    async (content: string) => {
      if (!currentProjectId || !currentDatasourceId) {
        toast('请先在左侧选择项目和数据源', 'error');
        return;
      }

      const userMessage = {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content,
      };
      addMessage(userMessage);
      setLoading(true);

      try {
        const conversationHistory = messages.map((m) => ({
          role: m.role,
          content: m.content,
          sql: m.sql,
        }));

        const result = await apiPost<QueryResponse>('/api/query', {
          projectId: currentProjectId,
          datasourceId: currentDatasourceId,
          query: content,
          conversationHistory,
        });

        const assistantId = crypto.randomUUID();
        const explanation =
          result.data?.explanation ?? '抱歉，处理请求时出了点问题。';

        addMessage({
          id: assistantId,
          role: 'assistant',
          content: '',
          isStreaming: true,
        });

        simulateStreaming(
          assistantId,
          explanation,
          result.data?.sql,
          result.data?.confidence,
        );
      } catch {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '无法连接到 API 服务器，请确认后端服务是否正常运行。',
        });
      } finally {
        setLoading(false);
      }
    },
    [
      messages,
      currentProjectId,
      currentDatasourceId,
      addMessage,
      setLoading,
      simulateStreaming,
      toast,
    ],
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
                      onFeedback={setFeedback}
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

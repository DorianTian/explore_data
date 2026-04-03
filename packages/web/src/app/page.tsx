'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ChatInput } from '@/components/chat-input';
import { ChatMessage } from '@/components/chat-message';
import { SqlResultTable } from '@/components/sql-result-table';
import { apiPost } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  confidence?: number;
  executionResult?: {
    rows: Record<string, unknown>[];
    columns: Array<{ name: string; dataType: string }>;
    truncated: boolean;
  };
}

interface QueryResponse {
  resolvedVia: 'metric' | 'nl2sql' | 'clarification';
  sql?: string;
  explanation: string;
  confidence: number;
  clarificationQuestion?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(
    async (content: string) => {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
      };
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      try {
        const conversationHistory = messages.map((m) => ({
          role: m.role,
          content: m.content,
          sql: m.sql,
        }));

        const result = await apiPost<QueryResponse>('/api/query', {
          projectId: '00000000-0000-0000-0000-000000000000',
          datasourceId: '00000000-0000-0000-0000-000000000000',
          query: content,
          conversationHistory,
        });

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.data?.explanation ?? 'Something went wrong.',
          sql: result.data?.sql,
          confidence: result.data?.confidence,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Failed to process your query. Make sure the API server is running.',
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages],
  );

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <header className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Chat
          </h2>
          <p className="text-xs text-zinc-500">
            Ask questions about your data in natural language
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-zinc-400">
                <p className="text-lg font-medium">Start querying</p>
                <p className="text-sm mt-1">
                  Upload your schema first, then ask questions here
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id}>
              <ChatMessage
                role={msg.role}
                content={msg.content}
                sql={msg.sql}
                confidence={msg.confidence}
              />
              {msg.executionResult && (
                <div className="mb-4 ml-4">
                  <SqlResultTable
                    columns={msg.executionResult.columns}
                    rows={msg.executionResult.rows}
                    truncated={msg.executionResult.truncated}
                  />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start mb-4">
              <div className="bg-zinc-100 rounded-lg px-4 py-3 dark:bg-zinc-800">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <ChatInput onSend={handleSend} disabled={loading} />
      </main>
    </div>
  );
}

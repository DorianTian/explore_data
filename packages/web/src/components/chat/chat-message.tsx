'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSqlBlock } from './message-sql-block';
import { MessageResultPreview } from './message-result-preview';
import { MessageChartPreview } from './message-chart-preview';
import { MessageFeedback } from './message-feedback';
import { StreamingIndicator } from './streaming-indicator';
import type { ChatMessage as ChatMessageType } from '@/stores/chat-store';
import { usePanelStore } from '@/stores/panel-store';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const selectedMessageId = usePanelStore((s) => s.selectedMessageId);
  const isSelected = selectedMessageId === message.id;

  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[70%] px-4 py-2.5 rounded-2xl rounded-br-md bg-primary text-white text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mb-4 ${isSelected ? 'ring-2 ring-primary/20 rounded-[var(--radius-lg)]' : ''}`}
    >
      <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md bg-surface border border-border">
        {/* Streaming status */}
        {message.isStreaming && !message.content && (
          <StreamingIndicator
            status={message.pipelineStatus}
            isStreaming={message.isStreaming}
          />
        )}

        {/* Markdown content */}
        {message.content && (
          <div className="text-sm text-foreground leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-4 space-y-1 mb-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-4 space-y-1 mb-2">
                    {children}
                  </ol>
                ),
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code
                        className="bg-surface-hover px-1.5 py-0.5 rounded text-[13px] font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <pre className="bg-zinc-900 dark:bg-zinc-950 p-3 rounded-[var(--radius-md)] overflow-x-auto my-2">
                      <code
                        className="text-[13px] font-mono text-zinc-100"
                        {...props}
                      >
                        {children}
                      </code>
                    </pre>
                  );
                },
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="w-full text-sm border-collapse">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border px-3 py-1.5 bg-surface text-left font-medium">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border px-3 py-1.5">
                    {children}
                  </td>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>

            {/* Streaming cursor */}
            {message.isStreaming && message.content && (
              <span className="inline-block w-2 h-4 bg-primary animate-pulse-subtle ml-0.5" />
            )}
          </div>
        )}

        {/* SQL block */}
        {message.sql && (
          <MessageSqlBlock
            sql={message.sql}
            messageId={message.id}
            confidence={message.confidence}
          />
        )}

        {/* Execution result preview */}
        {message.executionResult && (
          <MessageResultPreview
            messageId={message.id}
            columns={message.executionResult.columns}
            rows={message.executionResult.rows}
            truncated={message.executionResult.truncated}
            executionTimeMs={message.executionResult.executionTimeMs}
          />
        )}

        {/* Chart preview */}
        {message.chartRecommendation &&
          message.chartRecommendation.chartType !== 'table' && (
            <MessageChartPreview
              messageId={message.id}
              chartType={message.chartRecommendation.chartType}
              config={
                message.chartRecommendation.config as Record<string, unknown>
              }
            />
          )}

        {/* Feedback */}
        {!message.isStreaming && message.sql && (
          <MessageFeedback
            messageId={message.id}
            feedback={message.feedback}
            isGolden={message.isGolden}
            sql={message.sql}
          />
        )}
      </div>
    </div>
  );
}

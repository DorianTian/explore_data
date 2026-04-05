'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSqlBlock } from './message-sql-block';
import { MessageFeedback } from './message-feedback';
import { StreamingIndicator } from './streaming-indicator';
import { Icon } from '@/components/shared/icon';
import { usePanelStore } from '@/stores/panel-store';
import type { ChatMessage as ChatMessageType } from '@/stores/chat-store';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === 'user') {
    return <UserBubble content={message.content} />;
  }

  return <AssistantMessage message={message} />;
}

/** Right-aligned user bubble with warm amber tint */
function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end mb-6">
      <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-sm bg-amber-50 text-foreground text-sm leading-relaxed">
        {content}
      </div>
    </div>
  );
}

/** Left-aligned assistant message: plain text, no bubble background */
function AssistantMessage({ message }: { message: ChatMessageType }) {
  const { openArtifact } = usePanelStore();

  return (
    <div className="mb-6">
      {/* Streaming status — subscribes directly to store for real-time updates */}
      {message.isStreaming && (
        <StreamingIndicator messageId={message.id} />
      )}

      {/* Markdown content — brief when SQL exists, full otherwise */}
      {message.content && (
        <div className="text-sm text-foreground leading-relaxed">
          {message.sql ? (
            /* When SQL exists, show brief explanation only — detail in artifact panel */
            <p className="mb-1">{message.content.split('\n')[0]}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-3 last:mb-0">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-4 space-y-1 mb-3">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-4 space-y-1 mb-3">
                    {children}
                  </ol>
                ),
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code
                        className="bg-surface px-1.5 py-0.5 rounded text-[13px] font-mono border border-border"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <pre className="bg-surface border border-border p-3 rounded-lg overflow-x-auto my-3">
                      <code
                        className="text-[13px] font-mono text-foreground"
                        {...props}
                      >
                        {children}
                      </code>
                    </pre>
                  );
                },
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
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
          )}

          {/* Streaming cursor */}
          {message.isStreaming && message.content && (
            <span className="inline-block w-1.5 h-4 bg-primary rounded-full animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      )}

      {/* Compact SQL preview card — links to artifact panel */}
      {message.sql && (
        <MessageSqlBlock
          sql={message.sql}
          messageId={message.id}
          confidence={message.confidence}
        />
      )}

      {/* Result summary — link to right panel instead of inline preview */}
      {message.executionResult && (
        <button
          onClick={() => openArtifact(message.id, 'result')}
          className="mt-2 flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
        >
          <Icon name="barChart" size={12} />
          <span>
            {message.executionResult.rows.length} 行数据
            {message.executionResult.executionTimeMs
              ? ` · ${message.executionResult.executionTimeMs}ms`
              : ''}
            {message.chartRecommendation
              ? ` · ${message.chartRecommendation.chartType}`
              : ''}
          </span>
          <span className="text-muted">在面板中查看</span>
        </button>
      )}

      {/* Feedback actions */}
      {!message.isStreaming && message.sql && (
        <MessageFeedback
          messageId={message.id}
          feedback={message.feedback}
          isGolden={message.isGolden}
          sql={message.sql}
        />
      )}
    </div>
  );
}

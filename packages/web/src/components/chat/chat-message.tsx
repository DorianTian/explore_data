'use client';

import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSqlBlock } from './message-sql-block';
import { MessageResultPreview } from './message-result-preview';
import { MessageChartPreview } from './message-chart-preview';
import { MessageFeedback } from './message-feedback';
import { StreamingIndicator } from './streaming-indicator';
import { Icon } from '@/components/shared/icon';
import { Tooltip } from '@/components/ui';
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
    <div className="group flex flex-col items-end mb-6">
      <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-sm bg-amber-50 text-foreground text-sm leading-relaxed">
        {content}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1">
        <CopyButton text={content} />
      </div>
    </div>
  );
}

/** Left-aligned assistant message: plain text, no bubble background */
function AssistantMessage({ message }: { message: ChatMessageType }) {
  return (
    <div className="mb-6">
      {/* Pipeline steps — live during streaming, collapsible after completion */}
      {(message.isStreaming || (message.pipelineStatus?.steps?.length ?? 0) > 0) && (
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

      {/* Compact result preview */}
      {message.executionResult && (
        <MessageResultPreview
          messageId={message.id}
          columns={message.executionResult.columns}
          rows={message.executionResult.rows}
          truncated={message.executionResult.truncated}
          executionTimeMs={message.executionResult.executionTimeMs}
        />
      )}

      {/* Chart thumbnail */}
      {message.chartRecommendation &&
        message.chartRecommendation.chartType !== 'table' && (
          <MessageChartPreview
            messageId={message.id}
            chartType={message.chartRecommendation.chartType}
            config={message.chartRecommendation as Record<string, unknown>}
          />
        )}

      {/* Action bar: feedback + copy */}
      {!message.isStreaming && message.content && (
        <div className="flex items-center gap-1 mt-3">
          {message.sql && (
            <>
              <MessageFeedback
                messageId={message.id}
                feedback={message.feedback}
                isGolden={message.isGolden}
                sql={message.sql}
                inline
              />
              <div className="w-px h-3.5 bg-border mx-0.5" />
            </>
          )}
          <CopyButton text={message.content} />
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <Tooltip content={copied ? '已复制' : '复制'}>
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
      >
        <Icon name={copied ? 'check' : 'copy'} size={14} />
      </button>
    </Tooltip>
  );
}

'use client';

import { useState, useCallback, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  confidence?: number;
  feedback?: 'up' | 'down';
  isStreaming?: boolean;
  onFeedback?: (id: string, feedback: 'up' | 'down') => void;
}

export function ChatMessage({
  id,
  role,
  content,
  sql,
  confidence,
  feedback,
  isStreaming,
  onFeedback,
}: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={`
        group py-5 animate-fade-in
        ${isUser ? 'flex justify-end' : ''}
      `}
    >
      <div
        className={`
          ${isUser ? 'max-w-[75%]' : 'max-w-[85%]'}
        `}
      >
        {/* Message content */}
        <div
          className={`
            rounded-2xl px-4 py-3
            ${
              isUser
                ? 'bg-primary text-white ml-auto'
                : 'bg-surface text-foreground'
            }
          `}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
          ) : (
            <div className="prose-sm">
              <MarkdownContent content={content} />
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-foreground animate-pulse-subtle ml-0.5 align-text-bottom" />
              )}
            </div>
          )}
        </div>

        {/* SQL block */}
        {sql && (
          <div className="mt-3 rounded-xl overflow-hidden border border-border">
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 dark:bg-zinc-950 border-b border-zinc-800">
              <span className="text-xs font-medium text-zinc-400">SQL</span>
              <CopyButton text={sql} label="复制 SQL" />
            </div>
            <pre className="px-4 py-3 bg-zinc-900 dark:bg-zinc-950 overflow-x-auto">
              <code className="text-[13px] leading-relaxed font-mono text-emerald-400">
                <SqlHighlight sql={sql} />
              </code>
            </pre>
          </div>
        )}

        {/* Meta info + actions */}
        {!isUser && (
          <div className="flex items-center gap-3 mt-2 px-1">
            {confidence !== undefined && confidence !== null && (
              <ConfidenceBadge value={confidence} />
            )}

            {!isStreaming && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onFeedback?.(id, 'up')}
                  className={`
                    p-1 rounded-md transition-colors
                    ${feedback === 'up' ? 'text-success bg-success/10' : 'text-muted hover:text-foreground hover:bg-surface'}
                  `}
                  title="有帮助"
                >
                  <ThumbUpIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onFeedback?.(id, 'down')}
                  className={`
                    p-1 rounded-md transition-colors
                    ${feedback === 'down' ? 'text-error bg-error/10' : 'text-muted hover:text-foreground hover:bg-surface'}
                  `}
                  title="待改进"
                >
                  <ThumbDownIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Renders markdown with custom component styling */
function MarkdownContent({ content }: { content: string }) {
  const components: Components = {
    p: ({ children }) => (
      <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    ul: ({ children }) => (
      <ul className="text-sm list-disc pl-4 mb-2 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="text-sm list-decimal pl-4 mb-2 space-y-1">{children}</ol>
    ),
    li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
    code: ({ className, children }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="px-1.5 py-0.5 rounded-md bg-surface-hover text-sm font-mono">
            {children}
          </code>
        );
      }
      return (
        <code className="block text-sm font-mono">{children}</code>
      );
    },
    pre: ({ children }) => (
      <pre className="rounded-lg bg-zinc-900 dark:bg-zinc-950 p-3 my-2 overflow-x-auto text-zinc-100">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-2">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-border px-3 py-1.5 text-left font-medium bg-surface text-xs">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-border px-3 py-1.5 text-xs">
        {children}
      </td>
    ),
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}

/** CSS-based SQL keyword highlighting */
function SqlHighlight({ sql }: { sql: string }) {
  const keywords = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|ON|AS|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|DISTINCT|BETWEEN|LIKE|IS|NULL|EXISTS|UNION|ALL|CASE|WHEN|THEN|ELSE|END|COUNT|SUM|AVG|MIN|MAX|COALESCE|CAST|ASC|DESC|WITH|RECURSIVE|OVER|PARTITION\s+BY|ROW_NUMBER|RANK|DENSE_RANK)\b/gi;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = keywords.exec(sql)) !== null) {
    if (match.index > lastIndex) {
      parts.push(sql.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="text-blue-400 font-semibold">
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < sql.length) {
    parts.push(sql.slice(lastIndex));
  }

  return <>{parts}</>;
}

/** Copy to clipboard button */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      title={label}
    >
      {copied ? (
        <>
          <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400">已复制</span>
        </>
      ) : (
        <>
          <CopyIcon className="w-3.5 h-3.5" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

/** Confidence badge with color coding */
function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  let color = 'text-success';
  if (pct < 60) color = 'text-error';
  else if (pct < 80) color = 'text-amber-500';

  return (
    <span className={`text-[11px] ${color} font-medium`}>
      置信度 {pct}%
    </span>
  );
}

/* -- Inline SVG icons -- */

function ThumbUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0114 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 01-1.341 5.974 1.637 1.637 0 01-1.555 1.029H6.5a1.5 1.5 0 01-1.5-1.5V7.846a4.5 4.5 0 001.337-3.2L7.75 3.233A2.25 2.25 0 0110 1.5V3h1z" />
    </svg>
  );
}

function ThumbDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M18.905 12.75a1.25 1.25 0 01-2.5 0v-7.5a1.25 1.25 0 112.5 0v7.5zM8.905 17v1.3c0 .268-.14.526-.395.607A2 2 0 015.905 17c0-.995.182-1.948.514-2.826.204-.54-.166-1.174-.744-1.174h-2.52c-1.242 0-2.26-1.01-2.146-2.247.193-2.08.652-4.082 1.341-5.974A1.637 1.637 0 013.905 3.75h8.5a1.5 1.5 0 011.5 1.5v6.904a4.5 4.5 0 01-1.337 3.2l-1.413 1.413a2.25 2.25 0 01-2.25 1.733v-1.5h-1z" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M10.5 3a.5.5 0 00-.5-.5H4.5A1.5 1.5 0 003 4v6.5a.5.5 0 001 0V4a.5.5 0 01.5-.5H10a.5.5 0 00.5-.5z" />
      <path d="M6 5.5A1.5 1.5 0 017.5 4h4A1.5 1.5 0 0113 5.5v7a1.5 1.5 0 01-1.5 1.5h-4A1.5 1.5 0 016 12.5v-7z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" clipRule="evenodd" />
    </svg>
  );
}

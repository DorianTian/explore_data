'use client';

import { useState } from 'react';
import { Icon } from '@/components/shared/icon';
import { usePanelStore } from '@/stores/panel-store';

interface MessageSqlBlockProps {
  sql: string;
  messageId: string;
  confidence?: number;
}

/** SQL keywords to highlight in the preview */
const SQL_KEYWORDS =
  /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|AS|IN|NOT|NULL|IS|BETWEEN|LIKE|EXISTS|UNION|ALL|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|DESC|ASC)\b/gi;

function highlightSql(sql: string): Array<{ text: string; isKeyword: boolean }> {
  const tokens: Array<{ text: string; isKeyword: boolean }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(SQL_KEYWORDS.source, 'gi');
  while ((match = regex.exec(sql)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: sql.slice(lastIndex, match.index), isKeyword: false });
    }
    tokens.push({ text: match[0], isKeyword: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < sql.length) {
    tokens.push({ text: sql.slice(lastIndex), isKeyword: false });
  }
  return tokens;
}

/**
 * Compact SQL preview card shown inline within assistant messages.
 * Shows formatted SQL with syntax highlighting, click to open artifact panel.
 */
export function MessageSqlBlock({
  sql,
  messageId,
  confidence,
}: MessageSqlBlockProps) {
  const [copied, setCopied] = useState(false);
  const { openArtifact } = usePanelStore();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /** Show up to 4 lines of formatted SQL */
  const previewLines = sql.trim().split('\n').slice(0, 4);
  const hasMore = sql.trim().split('\n').length > 4;
  const tokens = highlightSql(previewLines.join('\n'));

  return (
    <div
      onClick={() => openArtifact(messageId, 'result')}
      className="mt-3 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors cursor-pointer group overflow-hidden"
    >
      {/* SQL code area */}
      <div className="relative px-4 py-3">
        <pre className="text-[13px] font-mono text-foreground leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
          {tokens.map((token, i) =>
            token.isKeyword ? (
              <span key={i} className="text-primary font-semibold">
                {token.text.toUpperCase()}
              </span>
            ) : (
              <span key={i}>{token.text}</span>
            ),
          )}
        </pre>
        {hasMore && (
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-surface group-hover:from-surface-hover to-transparent pointer-events-none" />
        )}
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          {confidence !== undefined && (
            <span
              className={`text-[11px] font-medium ${
                confidence >= 0.8
                  ? 'text-emerald-600'
                  : confidence >= 0.6
                    ? 'text-amber-600'
                    : 'text-red-500'
              }`}
            >
              {Math.round(confidence * 100)}% 置信度
            </span>
          )}
          <span className="text-[11px] text-muted group-hover:text-primary transition-colors">
            在面板中查看
          </span>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="shrink-0 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors cursor-pointer"
          title="复制 SQL"
        >
          <Icon name={copied ? 'check' : 'copy'} size={14} />
        </button>
      </div>
    </div>
  );
}

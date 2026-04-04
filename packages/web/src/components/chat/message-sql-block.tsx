'use client';

import { useState } from 'react';
import { Icon } from '@/components/shared/icon';
import { usePanelStore } from '@/stores/panel-store';

interface MessageSqlBlockProps {
  sql: string;
  messageId: string;
  confidence?: number;
}

/**
 * Compact SQL preview card shown inline within assistant messages.
 * Shows a truncated SQL snippet with a link to open the full artifact panel.
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

  /** First meaningful line of SQL, truncated */
  const preview = sql.trim().split('\n').slice(0, 2).join(' ').slice(0, 120);

  return (
    <div
      onClick={() => openArtifact(messageId, 'sql')}
      className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors cursor-pointer group"
    >
      {/* SQL icon */}
      <div className="shrink-0 w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
        <span className="text-xs font-bold text-primary font-mono">SQL</span>
      </div>

      {/* Preview text */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-mono text-foreground truncate leading-relaxed">
          {preview}
          {sql.length > 120 && '...'}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
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
  );
}

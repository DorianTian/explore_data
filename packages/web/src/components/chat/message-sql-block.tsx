'use client';

import { useState } from 'react';
import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui';
import { usePanelStore } from '@/stores/panel-store';

interface MessageSqlBlockProps {
  sql: string;
  messageId: string;
  confidence?: number;
}

const SQL_KEYWORDS =
  /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|GROUP\s+BY|ORDER\s+BY|LIMIT|HAVING|DISTINCT|CASE|WHEN|THEN|ELSE|END|AS|COUNT|SUM|AVG|MIN|MAX|COALESCE|CAST|UNION|ALL|EXISTS|BETWEEN|LIKE|IS|NULL|ASC|DESC|WITH|OVER|PARTITION\s+BY|ROW_NUMBER|RANK|DENSE_RANK|LAG|LEAD|DATE_TRUNC|INTERVAL|CURRENT_DATE|NOW)\b/gi;

function highlightSql(
  sql: string,
): Array<{ text: string; isKeyword: boolean }> {
  const parts: Array<{ text: string; isKeyword: boolean }> = [];
  let lastIndex = 0;

  sql.replace(SQL_KEYWORDS, (match, _group, offset: number) => {
    if (offset > lastIndex) {
      parts.push({ text: sql.slice(lastIndex, offset), isKeyword: false });
    }
    parts.push({ text: match.toUpperCase(), isKeyword: true });
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < sql.length) {
    parts.push({ text: sql.slice(lastIndex), isKeyword: false });
  }

  return parts;
}

export function MessageSqlBlock({
  sql,
  messageId,
  confidence,
}: MessageSqlBlockProps) {
  const [copied, setCopied] = useState(false);
  const { selectMessage } = usePanelStore();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parts = highlightSql(sql);

  return (
    <div className="mt-3 rounded-[var(--radius-lg)] overflow-hidden border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">SQL</span>
          {confidence !== undefined && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                confidence >= 0.8
                  ? 'bg-emerald-900/50 text-emerald-400'
                  : confidence >= 0.6
                    ? 'bg-amber-900/50 text-amber-400'
                    : 'bg-red-900/50 text-red-400'
              }`}
            >
              {Math.round(confidence * 100)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-white h-7 w-7"
            onClick={() => selectMessage(messageId)}
            title="在面板中编辑"
          >
            <Icon name="edit" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-white h-7 w-7"
            onClick={handleCopy}
          >
            <Icon name={copied ? 'check' : 'copy'} size={14} />
          </Button>
        </div>
      </div>

      {/* SQL Code */}
      <pre className="px-4 py-3 bg-zinc-900 dark:bg-zinc-950 overflow-x-auto">
        <code className="text-[13px] font-mono leading-relaxed">
          {parts.map((part, i) => (
            <span
              key={i}
              className={
                part.isKeyword
                  ? 'text-blue-400 font-semibold'
                  : 'text-emerald-400'
              }
            >
              {part.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

'use client';

import { Icon } from '@/components/shared/icon';
import { usePanelStore } from '@/stores/panel-store';

interface MessageResultPreviewProps {
  messageId: string;
  columns: Array<{ name: string; dataType: string }>;
  rows: Record<string, unknown>[];
  truncated: boolean;
  executionTimeMs?: number;
}

export function MessageResultPreview({
  messageId,
  columns,
  rows,
  truncated,
  executionTimeMs,
}: MessageResultPreviewProps) {
  const { selectMessage } = usePanelStore();
  const previewRows = rows.slice(0, 5);
  const previewCols = columns.slice(0, 6);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted flex items-center gap-1">
          <Icon name="table" size={12} />
          {rows.length} 行{truncated ? ' (已截断)' : ''} · {columns.length} 列
          {executionTimeMs !== undefined && ` · ${executionTimeMs}ms`}
        </span>
        <button
          onClick={() => selectMessage(messageId)}
          className="text-xs text-primary hover:underline cursor-pointer"
        >
          查看全部
        </button>
      </div>
      <div className="rounded-[var(--radius-md)] border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface">
              {previewCols.map((col) => (
                <th
                  key={col.name}
                  className="px-2 py-1.5 text-left font-medium text-muted border-b border-border truncate max-w-[120px]"
                >
                  {col.name}
                </th>
              ))}
              {columns.length > 6 && (
                <th className="px-2 py-1.5 text-left font-medium text-muted border-b border-border">
                  ...
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {previewCols.map((col) => (
                  <td
                    key={col.name}
                    className="px-2 py-1 text-foreground truncate max-w-[120px] font-mono"
                  >
                    {row[col.name] == null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      String(row[col.name])
                    )}
                  </td>
                ))}
                {columns.length > 6 && (
                  <td className="px-2 py-1 text-muted">...</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

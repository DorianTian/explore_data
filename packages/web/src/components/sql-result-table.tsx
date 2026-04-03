'use client';

interface SqlResultTableProps {
  columns: Array<{ name: string; dataType: string }>;
  rows: Record<string, unknown>[];
  truncated?: boolean;
}

export function SqlResultTable({ columns, rows, truncated }: SqlResultTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted py-6 text-center border border-border rounded-xl bg-surface">
        查询未返回结果
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              {columns.map((col) => (
                <th
                  key={col.name}
                  className="px-4 py-2.5 text-left font-medium text-muted text-xs"
                >
                  {col.name}
                  <span className="ml-1.5 text-[11px] text-muted/60 font-normal">
                    {col.dataType}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.name}
                    className="px-4 py-2.5 text-foreground font-mono text-xs"
                  >
                    {formatValue(row[col.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {truncated && (
        <div className="px-4 py-2.5 text-xs text-amber-600 bg-amber-50 border-t border-border dark:bg-amber-900/10 dark:text-amber-400">
          结果已截断，可添加 LIMIT 子句查看更少行数
        </div>
      )}
    </div>
  );
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

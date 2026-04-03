'use client';

interface SqlResultTableProps {
  columns: Array<{ name: string; dataType: string }>;
  rows: Record<string, unknown>[];
  truncated?: boolean;
}

export function SqlResultTable({ columns, rows, truncated }: SqlResultTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-zinc-500 py-4 text-center">
        No results returned
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden dark:border-zinc-700">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700">
              {columns.map((col) => (
                <th
                  key={col.name}
                  className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {col.name}
                  <span className="ml-1 text-xs text-zinc-400">({col.dataType})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b last:border-0 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                {columns.map((col) => (
                  <td key={col.name} className="px-3 py-2 text-zinc-900 dark:text-zinc-100">
                    {formatValue(row[col.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {truncated && (
        <div className="px-3 py-2 text-xs text-amber-600 bg-amber-50 border-t dark:bg-amber-900/20 dark:border-zinc-700">
          Results truncated. Add a LIMIT clause for fewer rows.
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

'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar';
import { apiPost, apiFetch } from '@/lib/api';

interface IngestResult {
  tables: Array<{
    table: { id: string; name: string; comment: string | null };
    columns: Array<{
      id: string;
      name: string;
      dataType: string;
      comment: string | null;
      isPrimaryKey: boolean;
    }>;
  }>;
  relationships: Array<{
    id: string;
    relationshipType: string;
  }>;
}

export default function SchemaPage() {
  const [ddl, setDdl] = useState('');
  const [result, setResult] = useState<IngestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIngest = useCallback(async () => {
    if (!ddl.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // TODO: use actual datasourceId from project selection
      const res = await apiPost<IngestResult>('/api/schema/ingest/ddl', {
        datasourceId: '00000000-0000-0000-0000-000000000000',
        ddl,
      });

      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error?.message ?? 'Failed to ingest DDL');
      }
    } catch {
      setError('Failed to connect to API server');
    } finally {
      setLoading(false);
    }
  }, [ddl]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Schema Manager
          </h2>
          <p className="text-xs text-zinc-500">
            Feed your DDL and the platform parses everything
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2 dark:text-zinc-300">
                Paste your CREATE TABLE statements
              </label>
              <textarea
                value={ddl}
                onChange={(e) => setDdl(e.target.value)}
                rows={12}
                className="w-full rounded-lg border border-zinc-300 px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                placeholder={`CREATE TABLE users (\n  id BIGINT PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  email VARCHAR(200)\n);\n\nCREATE TABLE orders (\n  id BIGINT PRIMARY KEY,\n  user_id BIGINT REFERENCES users(id),\n  amount DECIMAL(10,2)\n);`}
              />
            </div>

            <button
              onClick={handleIngest}
              disabled={loading || !ddl.trim()}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Parsing...' : 'Ingest DDL'}
            </button>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Ingested {result.tables.length} table{result.tables.length > 1 ? 's' : ''}
                  {result.relationships.length > 0 &&
                    `, ${result.relationships.length} relationship${result.relationships.length > 1 ? 's' : ''}`}
                </h3>

                {result.tables.map(({ table, columns }) => (
                  <div
                    key={table.id}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700"
                  >
                    <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 dark:bg-zinc-800 dark:border-zinc-700">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {table.name}
                      </span>
                      {table.comment && (
                        <span className="ml-2 text-xs text-zinc-500">
                          {table.comment}
                        </span>
                      )}
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b dark:border-zinc-700">
                          <th className="px-4 py-2 text-left text-zinc-500 font-normal">
                            Column
                          </th>
                          <th className="px-4 py-2 text-left text-zinc-500 font-normal">
                            Type
                          </th>
                          <th className="px-4 py-2 text-left text-zinc-500 font-normal">
                            PK
                          </th>
                          <th className="px-4 py-2 text-left text-zinc-500 font-normal">
                            Comment
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {columns.map((col) => (
                          <tr
                            key={col.id}
                            className="border-b last:border-0 dark:border-zinc-700"
                          >
                            <td className="px-4 py-2 font-mono text-zinc-900 dark:text-zinc-100">
                              {col.name}
                            </td>
                            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                              {col.dataType}
                            </td>
                            <td className="px-4 py-2">
                              {col.isPrimaryKey && (
                                <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded dark:bg-amber-900/30 dark:text-amber-400">
                                  PK
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-zinc-500">
                              {col.comment ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

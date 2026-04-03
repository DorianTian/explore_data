'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar';
import { apiPost, apiFetch } from '@/lib/api';

interface Metric {
  id: string;
  name: string;
  displayName: string;
  expression: string;
  metricType: string;
  format: string;
  dimensions: string[] | null;
}

export default function MetricsPage() {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [expression, setExpression] = useState('');
  const [metricType, setMetricType] = useState<'atomic' | 'derived' | 'composite'>('atomic');
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !expression.trim()) return;
    setError(null);

    const res = await apiPost<Metric>('/api/metrics', {
      projectId: '00000000-0000-0000-0000-000000000000',
      name,
      displayName: displayName || name,
      expression,
      metricType,
      format: 'number',
    });

    if (res.success && res.data) {
      setMetrics((prev) => [...prev, res.data!]);
      setName('');
      setDisplayName('');
      setExpression('');
    } else {
      setError(res.error?.message ?? 'Failed to create metric');
    }
  }, [name, displayName, expression, metricType]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Metrics Manager
          </h2>
          <p className="text-xs text-zinc-500">
            Define business metrics for accurate SQL composition
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Name (ID)</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                    placeholder="gmv"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Display Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                    placeholder="成交总额"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">SQL Expression</label>
                <input
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm font-mono dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  placeholder="SUM(order_amount)"
                />
              </div>
              <div className="flex items-end gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Type</label>
                  <select
                    value={metricType}
                    onChange={(e) => setMetricType(e.target.value as typeof metricType)}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  >
                    <option value="atomic">Atomic</option>
                    <option value="derived">Derived</option>
                    <option value="composite">Composite</option>
                  </select>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || !expression.trim()}
                  className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Add Metric
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            {metrics.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Defined Metrics
                </h3>
                {metrics.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700"
                  >
                    <div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {m.displayName}
                      </span>
                      <span className="ml-2 text-xs text-zinc-400 font-mono">{m.name}</span>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">{m.expression}</p>
                    </div>
                    <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded dark:bg-zinc-800">
                      {m.metricType}
                    </span>
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

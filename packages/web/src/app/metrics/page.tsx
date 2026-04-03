'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ToastProvider, useToast } from '@/components/toast';
import { useProjectStore } from '@/stores/project-store';
import { apiPost } from '@/lib/api';

interface Metric {
  id: string;
  name: string;
  displayName: string;
  expression: string;
  metricType: string;
  format: string;
  dimensions: string[] | null;
}

const METRIC_TYPES = [
  { value: 'atomic', label: '原子指标' },
  { value: 'derived', label: '派生指标' },
  { value: 'composite', label: '复合指标' },
] as const;

function MetricsPageInner() {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [expression, setExpression] = useState('');
  const [metricType, setMetricType] = useState<'atomic' | 'derived' | 'composite'>('atomic');
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const { currentProjectId } = useProjectStore();
  const { toast } = useToast();

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !expression.trim()) return;

    if (!currentProjectId) {
      toast('请先在左侧选择项目', 'error');
      return;
    }

    const res = await apiPost<Metric>('/api/metrics', {
      projectId: currentProjectId,
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
      toast('指标创建成功', 'success');
    } else {
      toast(res.error?.message ?? '创建指标失败', 'error');
    }
  }, [name, displayName, expression, metricType, currentProjectId, toast]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="border-b border-border px-6 py-3 shrink-0">
          <h2 className="text-sm font-medium text-foreground">指标管理</h2>
          <p className="text-xs text-muted">
            定义业务指标，让 AI 生成更准确的 SQL
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl space-y-8">
            {/* Create form */}
            <section className="rounded-xl border border-border p-5 space-y-4">
              <h3 className="text-sm font-medium text-foreground">
                创建新指标
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    指标名 (ID)
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="gmv"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    显示名称
                  </label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="成交总额"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  SQL 表达式
                </label>
                <input
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  placeholder="SUM(order_amount)"
                />
              </div>

              <div className="flex items-end gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    指标类型
                  </label>
                  <select
                    value={metricType}
                    onChange={(e) =>
                      setMetricType(e.target.value as typeof metricType)
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  >
                    {METRIC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || !expression.trim()}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  添加指标
                </button>
              </div>
            </section>

            {/* Metrics list */}
            {metrics.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">
                  已定义的指标 ({metrics.length})
                </h3>
                <div className="space-y-2">
                  {metrics.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-surface/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {m.displayName}
                          </span>
                          <span className="text-xs text-muted font-mono">
                            {m.name}
                          </span>
                        </div>
                        <p className="text-xs text-muted font-mono mt-0.5 truncate">
                          {m.expression}
                        </p>
                      </div>
                      <span className="text-[11px] bg-surface px-2.5 py-1 rounded-md text-muted shrink-0">
                        {METRIC_TYPES.find((t) => t.value === m.metricType)?.label ??
                          m.metricType}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function MetricsPage() {
  return (
    <ToastProvider>
      <MetricsPageInner />
    </ToastProvider>
  );
}

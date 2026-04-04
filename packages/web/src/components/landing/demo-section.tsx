'use client';

import { useState, useCallback } from 'react';
import { Icon } from '@/components/shared/icon';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3100';

const DEMO_QUERIES = [
  { label: 'GMV 分析', query: '上个月各区域 GMV 是多少？' },
  { label: 'Top 商品', query: '销量最高的 10 个商品是什么？' },
  { label: '用户留存', query: '新用户 7 日留存率趋势' },
  { label: '退款分析', query: '各品类退款率排名' },
];

interface DemoResult {
  explanation: string;
  sql: string;
  confidence: number;
}

export function DemoSection() {
  const [selectedQuery, setSelectedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);

  const runDemo = useCallback(async (query: string) => {
    setSelectedQuery(query);
    setLoading(true);
    setResult(null);

    try {
      const projectsRes = await fetch(`${API_BASE}/api/projects`);
      const projects = await projectsRes.json();
      if (!projects.success || !projects.data?.length) return;

      const projectId = projects.data[0].id;
      const dsRes = await fetch(`${API_BASE}/api/datasources?projectId=${projectId}`);
      const datasources = await dsRes.json();
      if (!datasources.success || !datasources.data?.length) return;

      const datasourceId = datasources.data[0].id;

      const queryRes = await fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, datasourceId, query }),
      });
      const queryData = await queryRes.json();

      if (queryData.success) {
        setResult({
          explanation: queryData.data.explanation,
          sql: queryData.data.sql,
          confidence: queryData.data.confidence,
        });
      }
    } catch {
      /* Demo failure is non-critical */
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <section id="demo" className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-foreground mb-3">
            试一试
          </h2>
          <p className="text-muted text-lg">
            点击下方示例，看 AI 如何理解你的问题
          </p>
        </div>

        {/* Query chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {DEMO_QUERIES.map((dq) => (
            <button
              key={dq.label}
              onClick={() => runDemo(dq.query)}
              disabled={loading}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all cursor-pointer ${
                selectedQuery === dq.query
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-surface text-foreground border-border hover:border-primary/50'
              } disabled:opacity-50`}
            >
              {dq.label}
            </button>
          ))}
        </div>

        {/* Result display */}
        <div className="rounded-[var(--radius-xl)] border border-border bg-background shadow-lg overflow-hidden">
          {/* Query bar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-surface/50">
            <Icon name="message" size={18} className="text-primary" />
            <span className="text-sm text-foreground">
              {selectedQuery || '选择一个示例问题...'}
            </span>
          </div>

          {/* Output */}
          <div className="p-5 min-h-[200px]">
            {loading && (
              <div className="flex items-center gap-2 text-muted">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">AI 正在分析...</span>
              </div>
            )}

            {result && (
              <div className="space-y-4 animate-fade-in">
                <p className="text-sm text-foreground leading-relaxed">
                  {result.explanation}
                </p>

                <div className="rounded-[var(--radius-md)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-surface-elevated">
                    <span className="text-xs text-muted">SQL</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      result.confidence >= 0.8
                        ? 'bg-success/10 text-success'
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                  <pre className="px-4 py-3 bg-surface-elevated text-[13px] font-mono text-success overflow-x-auto">
                    {result.sql}
                  </pre>
                </div>
              </div>
            )}

            {!loading && !result && (
              <p className="text-sm text-muted text-center py-8">
                点击上方示例查看 AI 生成结果
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

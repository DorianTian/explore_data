'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ToastProvider, useToast } from '@/components/toast';
import { useProjectStore } from '@/stores/project-store';
import { useSchemaStore } from '@/stores/schema-store';
import type { SchemaColumn, SchemaTable } from '@/stores/schema-store';
import { apiPost, apiPatch } from '@/lib/api';

interface IngestApiResult {
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
    fromTableId?: string;
    fromColumnId?: string;
    toTableId?: string;
    toColumnId?: string;
    fromTableName?: string;
    fromColumnName?: string;
    toTableName?: string;
    toColumnName?: string;
  }>;
}

function SchemaPageInner() {
  const [ddl, setDdl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentDatasourceId } = useProjectStore();
  const { tables, relationships, setTables, setRelationships, updateColumnAnnotation } =
    useSchemaStore();
  const { toast } = useToast();

  const handleIngest = useCallback(async () => {
    if (!ddl.trim()) return;

    if (!currentDatasourceId) {
      toast('请先在左侧选择数据源', 'error');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiPost<IngestApiResult>('/api/schema/ingest/ddl', {
        datasourceId: currentDatasourceId,
        ddl,
      });

      if (res.success && res.data) {
        const mappedTables: SchemaTable[] = res.data.tables.map(({ table, columns }) => ({
          id: table.id,
          name: table.name,
          comment: table.comment,
          columns: columns.map((c) => ({
            id: c.id,
            name: c.name,
            dataType: c.dataType,
            comment: c.comment,
            isPrimaryKey: c.isPrimaryKey,
          })),
        }));

        setTables(mappedTables);
        setRelationships(
          res.data.relationships.map((r) => ({
            id: r.id,
            relationshipType: r.relationshipType,
            fromTableId: r.fromTableId ?? '',
            fromColumnId: r.fromColumnId ?? '',
            toTableId: r.toTableId ?? '',
            toColumnId: r.toColumnId ?? '',
            fromTableName: r.fromTableName,
            fromColumnName: r.fromColumnName,
            toTableName: r.toTableName,
            toColumnName: r.toColumnName,
          })),
        );

        toast(
          `成功解析 ${mappedTables.length} 张表`,
          'success',
        );
        setDdl('');
      } else {
        setError(res.error?.message ?? '解析 DDL 失败');
      }
    } catch {
      setError('无法连接到 API 服务器');
    } finally {
      setLoading(false);
    }
  }, [ddl, currentDatasourceId, setTables, setRelationships, toast]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="border-b border-border px-6 py-3 shrink-0">
          <h2 className="text-sm font-medium text-foreground">数据源管理</h2>
          <p className="text-xs text-muted">导入 DDL 语句，平台自动解析表结构和关系</p>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl space-y-8">
            {/* DDL Input */}
            <section className="space-y-3">
              <label className="block text-sm font-medium text-foreground">
                粘贴 CREATE TABLE 语句
              </label>
              <textarea
                value={ddl}
                onChange={(e) => setDdl(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-y"
                placeholder={`CREATE TABLE users (\n  id BIGINT PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  email VARCHAR(200)\n);\n\nCREATE TABLE orders (\n  id BIGINT PRIMARY KEY,\n  user_id BIGINT REFERENCES users(id),\n  amount DECIMAL(10,2)\n);`}
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={handleIngest}
                  disabled={loading || !ddl.trim()}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? '解析中...' : '导入 DDL'}
                </button>
                {!currentDatasourceId && (
                  <span className="text-xs text-amber-500">
                    请先在左侧选择数据源
                  </span>
                )}
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/10 dark:border-red-800/30 dark:text-red-400">
                  {error}
                </div>
              )}
            </section>

            {/* FK Relationships */}
            {relationships.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">
                  外键关系 ({relationships.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {relationships.map((rel) => (
                    <div
                      key={rel.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                    >
                      <span className="font-mono text-foreground">
                        {rel.fromTableName ?? '?'}.{rel.fromColumnName ?? '?'}
                      </span>
                      <ArrowRightIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-mono text-foreground">
                        {rel.toTableName ?? '?'}.{rel.toColumnName ?? '?'}
                      </span>
                      <span className="text-[10px] text-muted bg-surface-hover px-1.5 py-0.5 rounded">
                        {rel.relationshipType}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Tables */}
            {tables.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">
                  已解析的表 ({tables.length})
                </h3>
                {tables.map((table) => (
                  <SchemaTableCard
                    key={table.id}
                    table={table}
                    onUpdateColumn={updateColumnAnnotation}
                  />
                ))}
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function SchemaTableCard({
  table,
  onUpdateColumn,
}: {
  table: SchemaTable;
  onUpdateColumn: (tableId: string, columnId: string, updates: Partial<SchemaColumn>) => void;
}) {
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [editComment, setEditComment] = useState('');

  const startEdit = useCallback((col: SchemaColumn) => {
    setEditingCol(col.id);
    setEditComment(col.comment ?? '');
  }, []);

  const saveEdit = useCallback(
    (columnId: string) => {
      onUpdateColumn(table.id, columnId, { comment: editComment || null });
      /* fire-and-forget API call */
      apiPatch(`/api/schema/columns/${columnId}`, {
        comment: editComment || null,
      }).catch(() => {
        /* silently fail — annotation is saved locally */
      });
      setEditingCol(null);
    },
    [table.id, editComment, onUpdateColumn],
  );

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Table header */}
      <div className="border-b border-border bg-surface px-4 py-3 flex items-center gap-2">
        <TableIcon className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground font-mono">
          {table.name}
        </span>
        {table.comment && (
          <span className="text-xs text-muted">— {table.comment}</span>
        )}
        <span className="ml-auto text-[11px] text-muted">
          {table.columns.length} 列
        </span>
      </div>

      {/* Columns */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface/50">
            <th className="px-4 py-2 text-left text-[11px] font-medium text-muted uppercase tracking-wider w-[200px]">
              字段名
            </th>
            <th className="px-4 py-2 text-left text-[11px] font-medium text-muted uppercase tracking-wider w-[140px]">
              类型
            </th>
            <th className="px-4 py-2 text-left text-[11px] font-medium text-muted uppercase tracking-wider w-[60px]">
              标记
            </th>
            <th className="px-4 py-2 text-left text-[11px] font-medium text-muted uppercase tracking-wider">
              备注
            </th>
          </tr>
        </thead>
        <tbody>
          {table.columns.map((col) => (
            <tr
              key={col.id}
              className="border-b border-border last:border-0 hover:bg-surface/30 transition-colors group"
            >
              <td className="px-4 py-2.5">
                <span className="font-mono text-foreground text-[13px]">
                  {col.name}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <span className="text-xs text-muted font-mono">
                  {col.dataType}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  {col.isPrimaryKey && (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded dark:bg-amber-900/30 dark:text-amber-400">
                      PK
                    </span>
                  )}
                  {col.isPII && (
                    <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded dark:bg-red-900/30 dark:text-red-400">
                      PII
                    </span>
                  )}
                  <button
                    onClick={() =>
                      onUpdateColumn(table.id, col.id, { isPII: !col.isPII })
                    }
                    className={`
                      text-[10px] px-1.5 py-0.5 rounded border transition-colors
                      opacity-0 group-hover:opacity-100
                      ${col.isPII ? 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20' : 'border-border text-muted hover:bg-surface'}
                    `}
                    title={col.isPII ? '取消 PII 标记' : '标记为 PII'}
                  >
                    {col.isPII ? '- PII' : '+ PII'}
                  </button>
                </div>
              </td>
              <td className="px-4 py-2.5">
                {editingCol === col.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={editComment}
                      onChange={(e) => setEditComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(col.id);
                        if (e.key === 'Escape') setEditingCol(null);
                      }}
                      autoFocus
                      className="flex-1 min-w-0 rounded border border-primary/30 bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="输入备注..."
                    />
                    <button
                      onClick={() => saveEdit(col.id)}
                      className="text-[11px] text-primary hover:text-primary-hover font-medium"
                    >
                      保存
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(col)}
                    className="text-xs text-muted hover:text-foreground transition-colors text-left"
                    title="点击编辑备注"
                  >
                    {col.comment || (
                      <span className="opacity-0 group-hover:opacity-50 transition-opacity">
                        点击添加备注...
                      </span>
                    )}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -- Inline SVG icons -- */

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M2 8a.75.75 0 01.75-.75h8.69L8.22 4.03a.75.75 0 011.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06-1.06l3.22-3.22H2.75A.75.75 0 012 8z" clipRule="evenodd" />
    </svg>
  );
}

function TableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M1 3.5A1.5 1.5 0 012.5 2h11A1.5 1.5 0 0115 3.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9zm1 0a.5.5 0 01.5-.5h11a.5.5 0 01.5.5V5H2V3.5zM2 6.5h4V9H2V6.5zM2 10h4v2.5H2.5a.5.5 0 01-.5-.5V10zm5-3.5h3V9H7V6.5zm3 3.5H7v2.5h3V10zm1-3.5h3V9h-3V6.5zm3 3.5h-3v2h2.5a.5.5 0 00.5-.5V10z" clipRule="evenodd" />
    </svg>
  );
}

export default function SchemaPage() {
  return (
    <ToastProvider>
      <SchemaPageInner />
    </ToastProvider>
  );
}

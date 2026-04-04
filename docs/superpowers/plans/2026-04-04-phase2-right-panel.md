# Phase 2: Right Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3-tab right panel (Detail / Schema / History) for the chat page with Monaco SQL Editor, schema tree browser, and query history.

**Architecture:** Panel state derives from chat store (message-driven). Monaco lazy-loaded. Schema tree renders from existing API. History tab connects to the new query history endpoint from Phase 1.

**Tech Stack:** Monaco Editor (lazy), Zustand derived state, Tree view component, existing API endpoints

**Prerequisite:** Phase 1 complete (AppShell, Panel framework, chat store upgrade, SSE streaming)

---

## Task 1: Install Monaco Editor

**Files:**
- Modify: `packages/web/package.json`

- [ ] **Step 1: Add Monaco Editor dependency**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql/packages/web && pnpm add @monaco-editor/react`

- [ ] **Step 2: Commit**

```bash
git add packages/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add @monaco-editor/react dependency"
```

---

## Task 2: Monaco SQL Editor Component

**Files:**
- Create: `packages/web/src/components/panel/sql-editor.tsx`

- [ ] **Step 1: Create lazy-loaded Monaco wrapper**

```typescript
// packages/web/src/components/panel/sql-editor.tsx
'use client';

import { useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] bg-zinc-900 rounded-[var(--radius-md)] animate-pulse" />
  ),
});

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  onSave?: () => void;
  readOnly?: boolean;
  height?: number;
  dialect?: string;
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  onSave,
  readOnly = false,
  height = 200,
  dialect = 'sql',
}: SqlEditorProps) {
  const editorRef = useRef<unknown>(null);

  const handleMount = useCallback((editor: unknown) => {
    editorRef.current = editor;
  }, []);

  return (
    <div className="rounded-[var(--radius-lg)] overflow-hidden border border-border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-400 font-mono">{dialect.toUpperCase()}</span>
        <div className="flex items-center gap-1">
          {onRun && (
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-300 hover:text-white h-6 px-2 text-xs"
              onClick={onRun}
            >
              <Icon name="play" size={12} />
              执行
            </Button>
          )}
          {onSave && (
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-300 hover:text-white h-6 px-2 text-xs"
              onClick={onSave}
            >
              <Icon name="save" size={12} />
              保存修正
            </Button>
          )}
        </div>
      </div>

      {/* Editor */}
      <MonacoEditor
        height={height}
        language="sql"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', monospace",
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 8, bottom: 8 },
          renderLineHighlight: 'none',
          overviewRulerBorder: false,
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/panel/sql-editor.tsx
git commit -m "feat(web): add Monaco SQL editor component with lazy loading"
```

---

## Task 3: Schema Tree Component

**Files:**
- Create: `packages/web/src/components/shared/tree-view.tsx`
- Create: `packages/web/src/components/panel/schema-tree.tsx`

- [ ] **Step 1: Create generic tree view component**

```typescript
// packages/web/src/components/shared/tree-view.tsx
'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/shared/icon';

interface TreeNodeData {
  id: string;
  label: string;
  icon?: ReactNode;
  children?: TreeNodeData[];
  isHighlighted?: boolean;
  metadata?: Record<string, string>;
}

interface TreeViewProps {
  nodes: TreeNodeData[];
  defaultExpandedIds?: Set<string>;
  onNodeClick?: (node: TreeNodeData) => void;
}

function TreeNode({
  node,
  depth,
  expandedIds,
  toggleExpand,
  onNodeClick,
}: {
  node: TreeNodeData;
  depth: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onNodeClick?: (node: TreeNodeData) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 rounded-[var(--radius-sm)] cursor-pointer transition-colors text-sm ${
          node.isHighlighted
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-foreground hover:bg-surface'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (hasChildren) toggleExpand(node.id);
          onNodeClick?.(node);
        }}
      >
        {/* Expand/collapse indicator */}
        {hasChildren ? (
          <Icon
            name={isExpanded ? 'chevronDown' : 'chevronRight'}
            size={12}
            className="text-muted flex-shrink-0"
          />
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        {/* Icon */}
        {node.icon && <span className="flex-shrink-0">{node.icon}</span>}

        {/* Label */}
        <span className="truncate">{node.label}</span>

        {/* Metadata badges */}
        {node.metadata &&
          Object.entries(node.metadata).map(([key, val]) => (
            <span
              key={key}
              className="ml-auto text-xs text-muted flex-shrink-0"
            >
              {val}
            </span>
          ))}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView({ nodes, defaultExpandedIds, onNodeClick }: TreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    defaultExpandedIds ?? new Set(),
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          onNodeClick={onNodeClick}
        />
      ))}
    </div>
  );
}

export type { TreeNodeData };
```

- [ ] **Step 2: Create schema-specific tree component**

```typescript
// packages/web/src/components/panel/schema-tree.tsx
'use client';

import { useEffect, useMemo } from 'react';
import { useSchemaStore } from '@/stores/schema-store';
import { useProjectStore } from '@/stores/project-store';
import { useChatStore } from '@/stores/chat-store';
import { TreeView, type TreeNodeData } from '@/components/shared/tree-view';
import { Icon } from '@/components/shared/icon';
import { Badge } from '@/components/ui';

export function SchemaTree() {
  const { tables, relationships } = useSchemaStore();
  const { currentDatasourceId } = useProjectStore();
  const messages = useChatStore((s) => s.messages);

  // Collect table names used in current conversation
  const usedTableNames = useMemo(() => {
    const names = new Set<string>();
    for (const msg of messages) {
      if (msg.tablesUsed) {
        for (const t of msg.tablesUsed) names.add(t.toLowerCase());
      }
    }
    return names;
  }, [messages]);

  // Build tree from schema
  const treeNodes: TreeNodeData[] = useMemo(() => {
    if (!tables.length) return [];

    return tables.map((table) => {
      const isUsed = usedTableNames.has(table.name.toLowerCase());

      return {
        id: table.id,
        label: table.name,
        icon: <Icon name="table" size={14} className={isUsed ? 'text-primary' : 'text-muted'} />,
        isHighlighted: isUsed,
        metadata: table.comment ? { comment: table.comment } : undefined,
        children: table.columns.map((col) => ({
          id: col.id,
          label: col.name,
          icon: col.isPrimaryKey ? (
            <span className="text-amber-500 text-xs font-bold">PK</span>
          ) : (
            <span className="text-xs text-muted font-mono">{col.dataType.slice(0, 3)}</span>
          ),
          metadata: {
            type: col.dataType,
            ...(col.isPii ? { pii: '🔒' } : {}),
          },
        })),
      };
    });
  }, [tables, usedTableNames]);

  // Auto-expand tables that are used in current conversation
  const defaultExpandedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const table of tables) {
      if (usedTableNames.has(table.name.toLowerCase())) {
        ids.add(table.id);
      }
    }
    return ids;
  }, [tables, usedTableNames]);

  if (!currentDatasourceId) {
    return (
      <div className="text-sm text-muted text-center py-8">
        选择数据源查看 Schema
      </div>
    );
  }

  if (!tables.length) {
    return (
      <div className="text-sm text-muted text-center py-8">
        当前数据源暂无 Schema
        <br />
        <span className="text-xs">前往数据源页面导入 DDL</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted">{tables.length} 张表</span>
        {usedTableNames.size > 0 && (
          <Badge variant="info">{usedTableNames.size} 张引用中</Badge>
        )}
      </div>
      <TreeView
        nodes={treeNodes}
        defaultExpandedIds={defaultExpandedIds}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/shared/tree-view.tsx packages/web/src/components/panel/schema-tree.tsx
git commit -m "feat(web): add tree view component and schema tree browser with contextual highlighting"
```

---

## Task 4: Detail Tab — Full Implementation

**Files:**
- Create: `packages/web/src/components/panel/detail-tab.tsx`

- [ ] **Step 1: Implement Detail tab with Monaco editor, full result table, and chart**

```typescript
// packages/web/src/components/panel/detail-tab.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { usePanelStore } from '@/stores/panel-store';
import { SqlEditor } from './sql-editor';
import { SqlResultTable } from '@/components/shared/sql-result-table';
import { ChartView } from '@/components/shared/chart-view';
import { Button, Badge } from '@/components/ui';
import { Icon } from '@/components/shared/icon';
import { useToast } from '@/components/toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100';

export function DetailTab() {
  const { selectedMessageId } = usePanelStore();
  const message = useChatStore((s) =>
    s.messages.find((m) => m.id === selectedMessageId),
  );
  const updateMessage = useChatStore((s) => s.updateMessage);

  const [editedSql, setEditedSql] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Sync editedSql when message changes
  useMemo(() => {
    if (message?.sql) {
      setEditedSql(message.sql);
      setIsEditing(false);
    }
  }, [message?.id, message?.sql]);

  const hasSqlChanged = message?.sql !== editedSql;

  const handleRun = useCallback(async () => {
    if (!editedSql) return;
    setExecuting(true);

    try {
      const res = await fetch(`${API_BASE}/api/query/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: editedSql }),
      });
      const data = await res.json();

      if (data.success && selectedMessageId) {
        updateMessage(selectedMessageId, {
          executionResult: data.data,
        });
      }
    } catch {
      // execution error handled by UI
    } finally {
      setExecuting(false);
    }
  }, [editedSql, selectedMessageId, updateMessage]);

  const handleSaveCorrection = useCallback(async () => {
    if (!message || !hasSqlChanged) return;

    try {
      await fetch(`${API_BASE}/api/query/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: '', // TODO: get from project store
          naturalLanguage: '', // TODO: get from user message
          generatedSql: message.sql,
          correctedSql: editedSql,
          status: 'accepted',
        }),
      });

      if (selectedMessageId) {
        updateMessage(selectedMessageId, { sql: editedSql, feedback: 'accepted' });
      }
      setIsEditing(false);
    } catch {
      // save error
    }
  }, [message, editedSql, hasSqlChanged, selectedMessageId, updateMessage]);

  if (!message) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        <Icon name="table" size={32} className="mb-2 opacity-50" />
        <p className="text-sm">点击消息查看详情</p>
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-medium text-muted mb-2">用户问题</h4>
          <p className="text-sm text-foreground">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* SQL Editor */}
      {message.sql && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted">SQL</h4>
            <div className="flex items-center gap-2">
              {message.confidence !== undefined && (
                <Badge
                  variant={
                    message.confidence >= 0.8
                      ? 'success'
                      : message.confidence >= 0.6
                        ? 'warning'
                        : 'error'
                  }
                >
                  置信度 {Math.round(message.confidence * 100)}%
                </Badge>
              )}
              {message.feedback && (
                <Badge variant={message.feedback === 'accepted' ? 'success' : 'error'}>
                  {message.feedback === 'accepted' ? '已接受' : '已拒绝'}
                </Badge>
              )}
              {message.isGolden && (
                <Badge variant="golden">Golden SQL</Badge>
              )}
            </div>
          </div>
          <SqlEditor
            value={editedSql}
            onChange={(v) => {
              setEditedSql(v);
              setIsEditing(true);
            }}
            onRun={handleRun}
            onSave={hasSqlChanged ? handleSaveCorrection : undefined}
          />
          {hasSqlChanged && (
            <p className="text-xs text-warning mt-1">SQL 已修改，点击"保存修正"记录纠正</p>
          )}
        </div>
      )}

      {/* Execution Result */}
      {message.executionResult && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted">
              查询结果 ({message.executionResult.rows.length} 行)
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const rows = message.executionResult!.rows;
                const cols = message.executionResult!.columns;
                const header = cols.map((c) => c.name).join(',');
                const body = rows.map((r) => cols.map((c) => r[c.name] ?? '').join(',')).join('\n');
                const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'result.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Icon name="download" size={14} />
              CSV
            </Button>
          </div>
          <div className="max-h-[400px] overflow-auto rounded-[var(--radius-md)] border border-border">
            <SqlResultTable
              columns={message.executionResult.columns}
              rows={message.executionResult.rows}
              truncated={message.executionResult.truncated}
            />
          </div>
        </div>
      )}

      {/* Chart */}
      {message.chartRecommendation && message.chartRecommendation.chartType !== 'table' && (
        <div>
          <h4 className="text-xs font-medium text-muted mb-2">可视化</h4>
          <div className="rounded-[var(--radius-lg)] border border-border overflow-hidden">
            <ChartView
              chartType={message.chartRecommendation.chartType as string}
              config={message.chartRecommendation.config as Record<string, unknown>}
              height={300}
            />
          </div>
        </div>
      )}

      {/* Explanation */}
      {message.content && (
        <div>
          <h4 className="text-xs font-medium text-muted mb-2">解释</h4>
          <p className="text-sm text-foreground leading-relaxed">{message.content}</p>
        </div>
      )}

      {/* Tables used */}
      {message.tablesUsed && message.tablesUsed.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted mb-2">引用表</h4>
          <div className="flex flex-wrap gap-1.5">
            {message.tablesUsed.map((t) => (
              <Badge key={t} variant="default">{t}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/panel/detail-tab.tsx
git commit -m "feat(web): implement detail tab — Monaco SQL editor, results table, chart, CSV export"
```

---

## Task 5: History Tab

**Files:**
- Create: `packages/web/src/components/panel/history-tab.tsx`
- Modify: `packages/web/src/lib/api.ts`

- [ ] **Step 1: Add query history API client function**

In `packages/web/src/lib/api.ts`, add:

```typescript
export async function fetchQueryHistory(projectId: string) {
  return apiFetch<Array<{
    id: string;
    naturalLanguage: string;
    generatedSql: string;
    correctedSql: string | null;
    status: string;
    isGolden: boolean;
    tablesUsed: string[] | null;
    createdAt: string;
  }>>(`/api/query/history?projectId=${projectId}`);
}
```

- [ ] **Step 2: Implement History tab**

```typescript
// packages/web/src/components/panel/history-tab.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/project-store';
import { fetchQueryHistory } from '@/lib/api';
import { Badge, Input } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

interface QueryRecord {
  id: string;
  naturalLanguage: string;
  generatedSql: string;
  correctedSql: string | null;
  status: string;
  isGolden: boolean;
  tablesUsed: string[] | null;
  createdAt: string;
}

interface HistoryTabProps {
  onSelectQuery?: (query: string) => void;
}

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'error' | 'golden' | 'default'; label: string }> = {
  accepted: { variant: 'success', label: '已接受' },
  pending: { variant: 'warning', label: '待验证' },
  rejected: { variant: 'error', label: '已拒绝' },
};

export function HistoryTab({ onSelectQuery }: HistoryTabProps) {
  const { currentProjectId } = useProjectStore();
  const [records, setRecords] = useState<QueryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadHistory = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    const result = await fetchQueryHistory(currentProjectId);
    if (result.success && result.data) {
      setRecords(result.data);
    }
    setLoading(false);
  }, [currentProjectId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filtered = records.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search && !r.naturalLanguage.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!currentProjectId) {
    return (
      <div className="text-sm text-muted text-center py-8">
        选择项目查看查询历史
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search & Filter */}
      <div className="space-y-2">
        <Input
          placeholder="搜索查询..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {['all', 'accepted', 'pending', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-2 py-1 text-xs rounded-[var(--radius-full)] transition-colors cursor-pointer ${
                filterStatus === status
                  ? 'bg-primary text-white'
                  : 'bg-surface text-muted hover:text-foreground'
              }`}
            >
              {status === 'all' ? '全部' : STATUS_BADGE[status]?.label ?? status}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-sm text-muted text-center py-4">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted text-center py-4">暂无记录</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((record) => (
            <div
              key={record.id}
              className="p-3 rounded-[var(--radius-md)] border border-border hover:bg-surface transition-colors cursor-pointer group"
              onClick={() => onSelectQuery?.(record.naturalLanguage)}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm text-foreground line-clamp-2 flex-1">
                  {record.naturalLanguage}
                </p>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {record.isGolden && (
                    <Icon name="starFilled" size={12} className="text-[var(--golden)]" />
                  )}
                  <Badge variant={STATUS_BADGE[record.status]?.variant ?? 'default'}>
                    {STATUS_BADGE[record.status]?.label ?? record.status}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>{new Date(record.createdAt).toLocaleDateString()}</span>
                {record.tablesUsed && record.tablesUsed.length > 0 && (
                  <span>· {record.tablesUsed.join(', ')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refresh */}
      <button
        onClick={loadHistory}
        className="flex items-center gap-1 text-xs text-muted hover:text-foreground mx-auto cursor-pointer"
      >
        <Icon name="refresh" size={12} />
        刷新
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/panel/history-tab.tsx packages/web/src/lib/api.ts
git commit -m "feat(web): implement history tab with search, filter, and query selection"
```

---

## Task 6: Schema Tab

**Files:**
- Create: `packages/web/src/components/panel/schema-tab.tsx`

- [ ] **Step 1: Implement Schema tab wrapping SchemaTree with fetch logic**

```typescript
// packages/web/src/components/panel/schema-tab.tsx
'use client';

import { useEffect, useCallback } from 'react';
import { useSchemaStore } from '@/stores/schema-store';
import { useProjectStore } from '@/stores/project-store';
import { SchemaTree } from './schema-tree';
import { Icon } from '@/components/shared/icon';
import { apiFetch } from '@/lib/api';

interface SchemaTableResponse {
  id: string;
  name: string;
  comment: string | null;
}

interface SchemaColumnResponse {
  id: string;
  name: string;
  dataType: string;
  comment: string | null;
  isPrimaryKey: boolean;
  isPii: boolean;
}

export function SchemaTab() {
  const { currentDatasourceId } = useProjectStore();
  const { tables, setTables, setRelationships } = useSchemaStore();

  const loadSchema = useCallback(async () => {
    if (!currentDatasourceId) return;

    const tablesResult = await apiFetch<SchemaTableResponse[]>(
      `/api/schema/tables?datasourceId=${currentDatasourceId}`,
    );

    if (!tablesResult.success || !tablesResult.data) return;

    // Load columns for each table
    const fullTables = await Promise.all(
      tablesResult.data.map(async (t) => {
        const detail = await apiFetch<{
          table: SchemaTableResponse;
          columns: SchemaColumnResponse[];
        }>(`/api/schema/tables/${t.id}`);

        return {
          id: t.id,
          name: t.name,
          comment: t.comment,
          columns: detail.data?.columns ?? [],
        };
      }),
    );

    setTables(fullTables);

    // Load relationships
    const relResult = await apiFetch<Array<{
      id: string;
      relationshipType: string;
      fromTableId: string;
      fromColumnId: string;
      toTableId: string;
      toColumnId: string;
    }>>(`/api/schema/relationships?datasourceId=${currentDatasourceId}`);

    if (relResult.success && relResult.data) {
      setRelationships(relResult.data);
    }
  }, [currentDatasourceId, setTables, setRelationships]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-muted">Schema 浏览器</h4>
        <button
          onClick={loadSchema}
          className="text-muted hover:text-foreground cursor-pointer"
        >
          <Icon name="refresh" size={14} />
        </button>
      </div>
      <SchemaTree />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/panel/schema-tab.tsx
git commit -m "feat(web): implement schema tab with auto-loading and refresh"
```

---

## Task 7: Wire Panel Tabs Together

**Files:**
- Modify: `packages/web/src/components/layout/panel.tsx`

- [ ] **Step 1: Replace placeholder panel with real tab implementations**

```typescript
// packages/web/src/components/layout/panel.tsx
'use client';

import { usePanelStore } from '@/stores/panel-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Icon } from '@/components/shared/icon';
import { DetailTab } from '@/components/panel/detail-tab';
import { SchemaTab } from '@/components/panel/schema-tab';
import { HistoryTab } from '@/components/panel/history-tab';

interface PanelProps {
  onSelectQuery?: (query: string) => void;
}

export function Panel({ onSelectQuery }: PanelProps) {
  const { activeTab, setActiveTab } = usePanelStore();

  return (
    <div className="flex flex-col h-full">
      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v as 'detail' | 'schema' | 'history')}
        className="flex flex-col h-full"
      >
        <TabsList className="px-2 flex-shrink-0">
          <TabsTrigger value="detail">
            <span className="flex items-center gap-1.5">
              <Icon name="table" size={14} />
              详情
            </span>
          </TabsTrigger>
          <TabsTrigger value="schema">
            <span className="flex items-center gap-1.5">
              <Icon name="database" size={14} />
              Schema
            </span>
          </TabsTrigger>
          <TabsTrigger value="history">
            <span className="flex items-center gap-1.5">
              <Icon name="clock" size={14} />
              历史
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detail" className="flex-1 overflow-y-auto p-4">
          <DetailTab />
        </TabsContent>

        <TabsContent value="schema" className="flex-1 overflow-y-auto p-4">
          <SchemaTab />
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-y-auto p-4">
          <HistoryTab onSelectQuery={onSelectQuery} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Update chat page to pass onSelectQuery to Panel**

In `packages/web/src/app/page.tsx`, update the `<Panel />` usage:

```typescript
// Replace <Panel /> with:
<Panel onSelectQuery={handleSend} />
```

This allows clicking a history item to re-submit it as a new query.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/layout/panel.tsx packages/web/src/app/page.tsx
git commit -m "feat(web): wire panel tabs — detail, schema, and history fully functional"
```

---

## Task 8: Keyboard Shortcuts

**Files:**
- Create: `packages/web/src/hooks/use-keyboard.ts`

- [ ] **Step 1: Add keyboard shortcuts for panel and focus**

```typescript
// packages/web/src/hooks/use-keyboard.ts
'use client';

import { useEffect } from 'react';
import { usePanelStore } from '@/stores/panel-store';

export function useKeyboardShortcuts() {
  const { togglePanel, setActiveTab } = usePanelStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl + B: Toggle panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        togglePanel();
      }

      // Cmd/Ctrl + 1/2/3: Switch panel tabs
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        setActiveTab('detail');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault();
        setActiveTab('schema');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '3') {
        e.preventDefault();
        setActiveTab('history');
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [togglePanel, setActiveTab]);
}
```

- [ ] **Step 2: Add hook to chat page**

In `packages/web/src/app/page.tsx`, inside `ChatPageInner`:

```typescript
import { useKeyboardShortcuts } from '@/hooks/use-keyboard';

function ChatPageInner() {
  useKeyboardShortcuts();
  // ... rest of component
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/hooks/use-keyboard.ts packages/web/src/app/page.tsx
git commit -m "feat(web): add keyboard shortcuts — Cmd+B toggle panel, Cmd+1/2/3 switch tabs"
```

---

## Task 9: Panel Responsive Behavior

**Files:**
- Modify: `packages/web/src/components/layout/app-shell.tsx`

- [ ] **Step 1: Add responsive breakpoint — overlay panel on small screens**

```typescript
// Update app-shell.tsx to handle responsive panel
'use client';

import { type ReactNode, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { usePanelStore } from '@/stores/panel-store';

interface AppShellProps {
  children: ReactNode;
  panel?: ReactNode;
}

export function AppShell({ children, panel }: AppShellProps) {
  const isOpen = usePanelStore((s) => s.isOpen);
  const closePanel = usePanelStore((s) => s.closePanel);

  // Auto-close panel on small screens
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches && isOpen) closePanel();
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [isOpen, closePanel]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>

      {/* Right panel — slide-over on tablet, inline on desktop */}
      {panel && isOpen && (
        <>
          {/* Overlay for tablet */}
          <div
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={closePanel}
          />

          <aside
            className={`
              fixed right-0 top-0 h-full z-50
              lg:relative lg:z-auto
              border-l border-border bg-background
              w-[var(--panel-width)] overflow-hidden
              transition-transform duration-200 ease-in-out
              ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            `}
          >
            <div className="w-[var(--panel-width)] h-full overflow-hidden">
              {panel}
            </div>
          </aside>
        </>
      )}

      {/* Desktop panel when closed — no width */}
      {panel && !isOpen && (
        <aside className="hidden lg:block w-0 overflow-hidden transition-[width] duration-200" />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/layout/app-shell.tsx
git commit -m "feat(web): add responsive panel behavior — overlay on tablet, inline on desktop"
```

---

## Task 10: Verify Phase 2

- [ ] **Step 1: Full build**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm build`
Expected: All packages build.

- [ ] **Step 2: Manual verification checklist**

Start dev: `pnpm dev:web` and `pnpm dev:api`

Verify:
- [ ] Panel opens/closes with sidebar button
- [ ] Cmd+B toggles panel
- [ ] Cmd+1/2/3 switches tabs
- [ ] Detail tab: clicking a message shows SQL in Monaco editor
- [ ] Detail tab: SQL editing shows "modified" indicator
- [ ] Detail tab: result table renders with CSV download
- [ ] Detail tab: chart renders at 300px height
- [ ] Schema tab: tree view shows tables and columns
- [ ] Schema tab: tables used in current query are highlighted
- [ ] Schema tab: expand/collapse works
- [ ] History tab: shows query history from API
- [ ] History tab: search filters results
- [ ] History tab: status filter works
- [ ] History tab: clicking a query fills it into chat input
- [ ] Responsive: panel overlays on tablet-width screens
- [ ] Responsive: panel closes on resize to small screen

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(web): complete Phase 2 — right panel with detail/schema/history tabs"
```

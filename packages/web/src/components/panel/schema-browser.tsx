'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSchemaStore } from '@/stores/schema-store';
import { useProjectStore } from '@/stores/project-store';
import { useChatStore } from '@/stores/chat-store';
import { apiFetch } from '@/lib/api';
import { Input } from '@/components/ui';
import { Icon } from '@/components/shared/icon';
import dynamic from 'next/dynamic';

const ERDiagram = dynamic(
  () => import('./er-diagram').then((m) => m.ERDiagram),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] flex items-center justify-center text-muted text-sm">
        ER 图加载中...
      </div>
    ),
  },
);

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

type ViewMode = 'tree' | 'er';

export function SchemaBrowser() {
  const { currentDatasourceId } = useProjectStore();
  const { tables, relationships, setTables, setRelationships } =
    useSchemaStore();
  const messages = useChatStore((s) => s.messages);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  /* FK column lookup — columnId -> true */
  const fkColumnIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rel of relationships) {
      ids.add(rel.fromColumnId);
      ids.add(rel.toColumnId);
    }
    return ids;
  }, [relationships]);

  /* Tables referenced in the current conversation */
  const usedTableNames = useMemo(() => {
    const names = new Set<string>();
    for (const msg of messages) {
      if (msg.tablesUsed) {
        for (const t of msg.tablesUsed) names.add(t.toLowerCase());
      }
    }
    return names;
  }, [messages]);

  /* Filtered tables */
  const filteredTables = useMemo(() => {
    if (!search.trim()) return tables;
    const q = search.toLowerCase();
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.comment?.toLowerCase().includes(q) ||
        t.columns.some(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.comment?.toLowerCase().includes(q),
        ),
    );
  }, [tables, search]);

  /* Load schema on mount */
  const loadSchema = useCallback(async () => {
    if (!currentDatasourceId) return;

    const tablesResult = await apiFetch<SchemaTableResponse[]>(
      `/api/schema/tables?datasourceId=${currentDatasourceId}`,
    );
    if (!tablesResult.success || !tablesResult.data) return;

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

    const relResult = await apiFetch<
      Array<{
        id: string;
        relationshipType: string;
        fromTableId: string;
        fromColumnId: string;
        toTableId: string;
        toColumnId: string;
      }>
    >(`/api/schema/relationships?datasourceId=${currentDatasourceId}`);
    if (relResult.success && relResult.data) {
      setRelationships(relResult.data);
    }
  }, [currentDatasourceId, setTables, setRelationships]);

  useEffect(() => {
    if (currentDatasourceId && !tables.length) {
      loadSchema();
    }
  }, [currentDatasourceId, tables.length, loadSchema]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    <div className="px-3 pb-3">
      {/* Header with view toggle + refresh */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex bg-surface rounded-md p-0.5 border border-border/50">
          <button
            type="button"
            onClick={() => setViewMode('tree')}
            className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
              viewMode === 'tree'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
          >
            树形
          </button>
          <button
            type="button"
            onClick={() => setViewMode('er')}
            className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
              viewMode === 'er'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
          >
            ER 图
          </button>
        </div>

        <span className="text-[11px] text-muted ml-auto">{tables.length} 表</span>

        <button
          type="button"
          onClick={loadSchema}
          className="text-muted hover:text-foreground cursor-pointer p-0.5"
          title="刷新 Schema"
        >
          <Icon name="refresh" size={13} />
        </button>
      </div>

      {viewMode === 'tree' ? (
        <>
          {/* Search */}
          <div className="mb-2">
            <Input
              placeholder="搜索表名 / 列名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Table list — compact IDE-style tree */}
          <div className="space-y-px max-h-[calc(100vh-280px)] overflow-y-auto">
            {filteredTables.map((table) => {
              const isExpanded = expandedIds.has(table.id);
              const isUsed = usedTableNames.has(table.name.toLowerCase());

              return (
                <div key={table.id}>
                  {/* Table row */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(table.id)}
                    className={`flex items-center gap-1.5 w-full px-1.5 py-[5px] rounded-md text-[13px] transition-colors cursor-pointer group ${
                      isUsed
                        ? 'text-primary font-medium'
                        : 'text-foreground hover:bg-surface-hover'
                    }`}
                  >
                    <Icon
                      name={isExpanded ? 'chevronDown' : 'chevronRight'}
                      size={10}
                      className="text-muted/60 shrink-0"
                    />
                    <span className={`truncate font-mono text-[13px] ${isUsed ? 'text-primary' : ''}`}>
                      {table.name}
                    </span>
                    {table.comment && (
                      <span className="text-[11px] text-muted truncate ml-1 hidden group-hover:inline">
                        {table.comment}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-muted/50 tabular-nums shrink-0">
                      {table.columns.length}
                    </span>
                  </button>

                  {/* Columns — compact with indent guide */}
                  {isExpanded && (
                    <div className="relative ml-[11px] border-l border-border/40">
                      {table.columns.map((col, idx) => {
                        const isFK = fkColumnIds.has(col.id);
                        const isLast = idx === table.columns.length - 1;
                        return (
                          <div
                            key={col.id}
                            className="flex items-center gap-1.5 pl-3 pr-1.5 py-[3px] text-[12px] hover:bg-surface-hover/50 transition-colors relative"
                          >
                            {/* Branch connector */}
                            <span className={`absolute left-0 top-0 w-2.5 border-b border-border/40 ${isLast ? 'h-1/2' : 'h-full'}`} />
                            {isLast && <span className="absolute left-0 top-1/2 bottom-0 w-px bg-background-secondary" />}

                            {/* Column indicator */}
                            {col.isPrimaryKey ? (
                              <span className="text-[10px] text-amber-500 font-bold shrink-0 w-3 text-center font-mono">K</span>
                            ) : isFK ? (
                              <span className="text-[10px] text-blue-500 font-bold shrink-0 w-3 text-center font-mono">F</span>
                            ) : (
                              <span className="w-3 shrink-0" />
                            )}

                            <span className="text-foreground/80 font-mono truncate">
                              {col.name}
                            </span>
                            <span className="text-[10px] text-muted/50 font-mono ml-auto shrink-0 tabular-nums">
                              {col.dataType}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="h-[400px] rounded-lg border border-border overflow-hidden">
          <ERDiagram />
        </div>
      )}
    </div>
  );
}

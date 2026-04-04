'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSchemaStore } from '@/stores/schema-store';
import { useProjectStore } from '@/stores/project-store';
import { useChatStore } from '@/stores/chat-store';
import { apiFetch } from '@/lib/api';
import { Input, Badge } from '@/components/ui';
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
      <div className="flex items-center gap-2 mb-3">
        <div className="flex bg-background rounded-[var(--radius-md)] p-0.5 border border-border">
          <button
            type="button"
            onClick={() => setViewMode('tree')}
            className={`px-2 py-1 text-xs rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
              viewMode === 'tree'
                ? 'bg-surface-elevated text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            树形
          </button>
          <button
            type="button"
            onClick={() => setViewMode('er')}
            className={`px-2 py-1 text-xs rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
              viewMode === 'er'
                ? 'bg-surface-elevated text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            ER 图
          </button>
        </div>

        <span className="text-xs text-muted ml-auto">{tables.length} 张表</span>

        <button
          type="button"
          onClick={loadSchema}
          className="text-muted hover:text-foreground cursor-pointer"
          title="刷新 Schema"
        >
          <Icon name="refresh" size={14} />
        </button>
      </div>

      {viewMode === 'tree' ? (
        <>
          {/* Search */}
          <div className="mb-3">
            <Input
              placeholder="搜索表名 / 列名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Table list */}
          <div className="space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto">
            {filteredTables.map((table) => {
              const isExpanded = expandedIds.has(table.id);
              const isUsed = usedTableNames.has(table.name.toLowerCase());

              return (
                <div key={table.id}>
                  {/* Table row */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(table.id)}
                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-[var(--radius-sm)] text-sm transition-colors cursor-pointer ${
                      isUsed
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-surface-hover'
                    }`}
                  >
                    <Icon
                      name={isExpanded ? 'chevronDown' : 'chevronRight'}
                      size={12}
                      className="text-muted shrink-0"
                    />
                    <Icon
                      name="table"
                      size={14}
                      className={isUsed ? 'text-primary' : 'text-muted'}
                    />
                    <span className="truncate">{table.name}</span>
                    <span className="ml-auto text-xs text-muted shrink-0">
                      {table.columns.length}
                    </span>
                  </button>

                  {/* Columns */}
                  {isExpanded && (
                    <div className="ml-6 mt-0.5 mb-1 space-y-0.5">
                      {table.columns.map((col) => {
                        const isFK = fkColumnIds.has(col.id);
                        return (
                          <div
                            key={col.id}
                            className="flex items-center gap-2 px-2 py-1 text-xs rounded-[var(--radius-sm)] hover:bg-surface-hover transition-colors"
                          >
                            {isFK ? (
                              <Icon
                                name="link"
                                size={12}
                                className="text-secondary shrink-0"
                              />
                            ) : (
                              <span className="w-3 shrink-0" />
                            )}
                            <span className="text-foreground truncate">
                              {col.name}
                            </span>
                            <span className="text-muted font-mono ml-auto shrink-0">
                              {col.dataType}
                            </span>
                            {col.isPrimaryKey && (
                              <Badge variant="golden" className="text-[10px] px-1.5 py-0">
                                PK
                              </Badge>
                            )}
                            {isFK && (
                              <Badge variant="info" className="text-[10px] px-1.5 py-0">
                                FK
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                      {table.comment && (
                        <p className="text-xs text-muted px-2 pt-1 border-t border-border/50">
                          {table.comment}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="h-[400px] rounded-[var(--radius-md)] border border-border overflow-hidden">
          <ERDiagram />
        </div>
      )}
    </div>
  );
}

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

/** Map raw DB type to a semantic type icon + color */
function getTypeIcon(dataType: string): { icon: string; color: string } {
  const t = dataType.toUpperCase();
  if (t.includes('INT') || t.includes('DECIMAL') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('NUMERIC'))
    return { icon: '#', color: 'text-violet-500' };
  if (t.includes('DATE') || t.includes('TIME') || t.includes('TIMESTAMP'))
    return { icon: '◷', color: 'text-sky-500' };
  if (t.includes('BOOL'))
    return { icon: '◉', color: 'text-emerald-500' };
  if (t.includes('TEXT') || t.includes('CHAR') || t.includes('VARCHAR') || t.includes('STRING'))
    return { icon: 'T', color: 'text-muted' };
  if (t.includes('JSON') || t.includes('JSONB'))
    return { icon: '{ }', color: 'text-orange-500' };
  if (t.includes('BLOB') || t.includes('BINARY') || t.includes('BYTEA'))
    return { icon: '◫', color: 'text-muted' };
  return { icon: '·', color: 'text-muted' };
}

interface SchemaBrowserProps {
  /** When set, only show tables matching these names (query context mode) */
  filterTables?: string[];
}

export function SchemaBrowser({ filterTables }: SchemaBrowserProps = {}) {
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

  /* Filtered tables — apply filterTables first, then search */
  const filteredTables = useMemo(() => {
    let base = tables;
    if (filterTables && filterTables.length > 0) {
      const filterSet = new Set(filterTables.map((n) => n.toLowerCase()));
      base = tables.filter((t) => filterSet.has(t.name.toLowerCase()));
    }
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.comment?.toLowerCase().includes(q) ||
        t.columns.some(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.comment?.toLowerCase().includes(q),
        ),
    );
  }, [tables, search, filterTables]);

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

        <span className="text-[11px] text-muted ml-auto">
          {filterTables ? `${filteredTables.length} 张涉及表` : `${tables.length} 张表`}
        </span>

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
          <div className="mb-2.5">
            <Input
              placeholder="搜索表名 / 列名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Table list — DataGrip-inspired with Supabase density */}
          <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto">
            {filteredTables.map((table) => {
              const isExpanded = expandedIds.has(table.id);
              const isUsed = usedTableNames.has(table.name.toLowerCase());

              return (
                <div key={table.id} className="group/table">
                  {/* Table row */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(table.id)}
                    className={`flex items-center gap-2 w-full px-2 py-[7px] rounded-lg text-[13px] transition-colors cursor-pointer ${
                      isExpanded
                        ? 'bg-surface'
                        : isUsed
                          ? 'bg-primary/5 hover:bg-primary/8'
                          : 'hover:bg-surface-hover'
                    }`}
                  >
                    <Icon
                      name={isExpanded ? 'chevronDown' : 'chevronRight'}
                      size={11}
                      className="text-muted/60 shrink-0"
                    />
                    {/* Table icon — green tint like DataGrip */}
                    <span className={`shrink-0 w-[18px] h-[18px] rounded flex items-center justify-center text-[10px] font-bold ${
                      isUsed
                        ? 'bg-primary/10 text-primary'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      T
                    </span>
                    <span className={`truncate font-medium ${isUsed ? 'text-primary' : 'text-foreground'}`}>
                      {table.name}
                    </span>
                    {table.comment && (
                      <span className="text-[11px] text-muted truncate ml-0.5 opacity-0 group-hover/table:opacity-100 transition-opacity max-w-[120px]">
                        {table.comment}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-muted/50 tabular-nums shrink-0">
                      {table.columns.length}
                    </span>
                  </button>

                  {/* Columns — card with DataGrip composite icons */}
                  {isExpanded && (
                    <div className="ml-3 mr-0.5 mt-1 mb-0.5">
                      {table.columns.map((col) => {
                        const isFK = fkColumnIds.has(col.id);
                        const isPK = col.isPrimaryKey;
                        const typeInfo = getTypeIcon(col.dataType);

                        return (
                          <div
                            key={col.id}
                            className="flex items-center gap-1.5 px-2 py-[5px] rounded-md hover:bg-surface-hover/60 transition-colors group/col"
                          >
                            {/* Composite icon: type icon base + PK/FK overlay */}
                            <span className="relative shrink-0 w-5 h-5 flex items-center justify-center">
                              <span className={`text-[11px] font-bold font-mono ${typeInfo.color}`}>
                                {typeInfo.icon}
                              </span>
                              {/* PK gold key overlay — top-right corner */}
                              {isPK && (
                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border border-background flex items-center justify-center">
                                  <span className="text-[6px] text-white font-bold">K</span>
                                </span>
                              )}
                              {/* FK blue link overlay — top-right corner */}
                              {isFK && !isPK && (
                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 border border-background flex items-center justify-center">
                                  <span className="text-[6px] text-white font-bold">F</span>
                                </span>
                              )}
                            </span>

                            {/* Column name */}
                            <span className={`text-[12.5px] truncate flex-1 ${isPK ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                              {col.name}
                            </span>

                            {/* Type + constraint tags */}
                            <span className="flex items-center gap-1 shrink-0">
                              <span className="text-[10.5px] text-muted/60 font-mono">
                                {col.dataType}
                              </span>
                              {isPK && (
                                <span className="text-[9px] font-bold tracking-wider text-amber-700 bg-amber-100 px-1 py-px rounded-sm">
                                  PK
                                </span>
                              )}
                              {isFK && (
                                <span className="text-[9px] font-bold tracking-wider text-blue-700 bg-blue-100 px-1 py-px rounded-sm">
                                  FK
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                      {/* Table comment footer */}
                      {table.comment && (
                        <div className="px-2 pt-1 pb-1.5 ml-5">
                          <span className="text-[11px] text-muted/60 leading-tight">{table.comment}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="h-[400px] rounded-lg border border-border overflow-hidden relative">
          <ERDiagram filterTables={filterTables} />
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSchemaStore, type SchemaTable, type SchemaColumn } from '@/stores/schema-store';
import { useProjectStore } from '@/stores/project-store';
import { useChatStore } from '@/stores/chat-store';
import { apiFetch } from '@/lib/api';
import { Input } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

/** Warehouse layer definitions — order matters for display */
const LAYER_ORDER = ['ODS', 'DWD', 'DWS', 'DIM', 'ADS'] as const;

const LAYER_COLORS: Record<string, string> = {
  ODS: 'bg-gray-100 text-gray-700',
  DWD: 'bg-blue-100 text-blue-700',
  DWS: 'bg-violet-100 text-violet-700',
  DIM: 'bg-amber-100 text-amber-700',
  ADS: 'bg-emerald-100 text-emerald-700',
  OTHER: 'bg-surface text-muted',
};

/** Infer warehouse layer from table name prefix */
function inferLayer(tableName: string): string {
  const upper = tableName.toUpperCase();
  for (const layer of LAYER_ORDER) {
    if (upper.startsWith(`${layer}_`) || upper.startsWith(`${layer}.`)) {
      return layer;
    }
  }
  return 'OTHER';
}

/** Map raw DB type to a semantic type icon + color */
function getTypeIcon(dataType: string): { icon: string; color: string } {
  const t = dataType.toUpperCase();
  if (t.includes('INT') || t.includes('DECIMAL') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('NUMERIC'))
    return { icon: '#', color: 'text-violet-500' };
  if (t.includes('DATE') || t.includes('TIME') || t.includes('TIMESTAMP'))
    return { icon: '\u25F7', color: 'text-sky-500' };
  if (t.includes('BOOL'))
    return { icon: '\u25C9', color: 'text-emerald-500' };
  if (t.includes('TEXT') || t.includes('CHAR') || t.includes('VARCHAR') || t.includes('STRING'))
    return { icon: 'T', color: 'text-muted' };
  if (t.includes('JSON') || t.includes('JSONB'))
    return { icon: '{ }', color: 'text-orange-500' };
  if (t.includes('BLOB') || t.includes('BINARY') || t.includes('BYTEA'))
    return { icon: '\u25EB', color: 'text-muted' };
  return { icon: '\u00B7', color: 'text-muted' };
}

interface SchemaTableResponse {
  id: string;
  name: string;
  comment: string | null;
  layer?: string | null;
  domain?: string | null;
}

interface SchemaColumnResponse {
  id: string;
  name: string;
  dataType: string;
  comment: string | null;
  isPrimaryKey: boolean;
  isPii: boolean;
}

/** Debounce hook */
function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** A single virtualizer row can be: group header, table row, or column row */
type VirtualRow =
  | { type: 'group'; layer: string; count: number; isExpanded: boolean }
  | { type: 'table'; table: SchemaTable; isExpanded: boolean; isUsed: boolean }
  | { type: 'column'; column: SchemaColumn; isPK: boolean; isFK: boolean; tableComment?: string | null; isLast: boolean };

interface SchemaBrowserProps {
  /** When set, only show tables matching these names (query context mode) */
  filterTables?: string[];
}

export function SchemaBrowser({ filterTables }: SchemaBrowserProps = {}) {
  const { currentDatasourceId } = useProjectStore();
  const { tables, relationships, setTables, setRelationships, loadColumns } =
    useSchemaStore();
  const messages = useChatStore((s) => s.messages);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(LAYER_ORDER as unknown as string[]),
  );
  const [expandedTableIds, setExpandedTableIds] = useState<Set<string>>(new Set());
  const [loadingTableIds, setLoadingTableIds] = useState<Set<string>>(new Set());

  const parentRef = useRef<HTMLDivElement>(null);

  /* FK column lookup */
  const fkColumnIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rel of relationships) {
      ids.add(rel.fromColumnId);
      ids.add(rel.toColumnId);
    }
    return ids;
  }, [relationships]);

  /* Tables used in conversation */
  const usedTableNames = useMemo(() => {
    const names = new Set<string>();
    for (const msg of messages) {
      if (msg.tablesUsed) {
        for (const t of msg.tablesUsed) names.add(t.toLowerCase());
      }
    }
    return names;
  }, [messages]);

  /* Filter + search tables */
  const filteredTables = useMemo(() => {
    let base = tables;
    if (filterTables && filterTables.length > 0) {
      const filterSet = new Set(filterTables.map((n) => n.toLowerCase()));
      base = tables.filter((t) => filterSet.has(t.name.toLowerCase()));
    }
    if (!debouncedSearch.trim()) return base;
    const q = debouncedSearch.toLowerCase();
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
  }, [tables, debouncedSearch, filterTables]);

  /* Group tables by layer */
  const groupedTables = useMemo(() => {
    const groups = new Map<string, SchemaTable[]>();
    for (const table of filteredTables) {
      const layer = table.layer ?? inferLayer(table.name);
      if (!groups.has(layer)) groups.set(layer, []);
      groups.get(layer)!.push(table);
    }
    /* Sort groups by LAYER_ORDER, "OTHER" last */
    const ordered: Array<[string, SchemaTable[]]> = [];
    for (const layer of LAYER_ORDER) {
      const g = groups.get(layer);
      if (g) ordered.push([layer, g]);
    }
    const other = groups.get('OTHER');
    if (other) ordered.push(['OTHER', other]);
    return ordered;
  }, [filteredTables]);

  /* Build flat virtual rows */
  const virtualRows: VirtualRow[] = useMemo(() => {
    const rows: VirtualRow[] = [];
    for (const [layer, layerTables] of groupedTables) {
      const isGroupExpanded = expandedGroups.has(layer);
      rows.push({ type: 'group', layer, count: layerTables.length, isExpanded: isGroupExpanded });

      if (!isGroupExpanded) continue;

      for (const table of layerTables) {
        const isTableExpanded = expandedTableIds.has(table.id);
        const isUsed = usedTableNames.has(table.name.toLowerCase());
        rows.push({ type: 'table', table, isExpanded: isTableExpanded, isUsed });

        if (isTableExpanded && table.columns.length > 0) {
          table.columns.forEach((col, colIdx) => {
            rows.push({
              type: 'column',
              column: col,
              isPK: col.isPrimaryKey,
              isFK: fkColumnIds.has(col.id),
              tableComment: colIdx === table.columns.length - 1 ? table.comment : null,
              isLast: colIdx === table.columns.length - 1,
            });
          });
        }
      }
    }
    return rows;
  }, [groupedTables, expandedGroups, expandedTableIds, fkColumnIds, usedTableNames]);

  /* Virtualizer */
  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index];
      if (row.type === 'group') return 36;
      if (row.type === 'table') return 34;
      return row.isLast && row.tableComment ? 42 : 28;
    },
    overscan: 10,
  });

  /* Load schema on mount */
  const loadSchema = useCallback(async () => {
    if (!currentDatasourceId) return;

    const tablesResult = await apiFetch<SchemaTableResponse[]>(
      `/api/schema/tables?datasourceId=${currentDatasourceId}`,
    );
    if (!tablesResult.success || !tablesResult.data) return;

    // Load table list only (no columns) — columns loaded lazily on expand
    const tables = tablesResult.data.map((t) => ({
      id: t.id,
      name: t.name,
      comment: t.comment,
      columns: [] as SchemaColumn[],
      layer: t.layer?.toUpperCase() ?? inferLayer(t.name),
      domain: t.domain ?? undefined,
      columnsLoaded: false,
    }));
    setTables(tables);

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

  /* Lazy load columns for a table */
  const loadTableColumns = useCallback(
    async (tableId: string) => {
      if (loadingTableIds.has(tableId)) return;
      setLoadingTableIds((prev) => new Set(prev).add(tableId));

      try {
        const detail = await apiFetch<{
          table: SchemaTableResponse;
          columns: SchemaColumnResponse[];
        }>(`/api/schema/tables/${tableId}`);
        if (detail.data?.columns) {
          loadColumns(tableId, detail.data.columns);
        }
      } finally {
        setLoadingTableIds((prev) => {
          const next = new Set(prev);
          next.delete(tableId);
          return next;
        });
      }
    },
    [loadColumns, loadingTableIds],
  );

  useEffect(() => {
    if (currentDatasourceId && !tables.length) {
      loadSchema();
    }
  }, [currentDatasourceId, tables.length, loadSchema]);

  const toggleGroup = useCallback((layer: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }, []);

  const toggleTable = useCallback(
    (table: SchemaTable) => {
      setExpandedTableIds((prev) => {
        const next = new Set(prev);
        if (next.has(table.id)) {
          next.delete(table.id);
        } else {
          next.add(table.id);
          /* Lazy load columns if not loaded yet */
          if (!table.columnsLoaded && table.columns.length === 0) {
            loadTableColumns(table.id);
          }
        }
        return next;
      });
    },
    [loadTableColumns],
  );

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
    <div className="px-3 pb-3 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5 shrink-0">
        <span className="text-[11px] text-muted">
          {filterTables
            ? `${filteredTables.length} 张涉及表`
            : `${tables.length} 张表`}
        </span>
        <button
          type="button"
          onClick={loadSchema}
          className="text-muted hover:text-foreground cursor-pointer p-0.5 ml-auto"
          title="刷新 Schema"
        >
          <Icon name="refresh" size={13} />
        </button>
      </div>

      {/* Search — debounced */}
      <div className="mb-2.5 shrink-0">
        <Input
          placeholder="搜索表名 / 列名..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Virtualized list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = virtualRows[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {row.type === 'group' && (
                  <GroupHeader
                    layer={row.layer}
                    count={row.count}
                    isExpanded={row.isExpanded}
                    onToggle={() => toggleGroup(row.layer)}
                  />
                )}
                {row.type === 'table' && (
                  <TableRow
                    table={row.table}
                    isExpanded={row.isExpanded}
                    isUsed={row.isUsed}
                    isLoading={loadingTableIds.has(row.table.id)}
                    onToggle={() => toggleTable(row.table)}
                  />
                )}
                {row.type === 'column' && (
                  <ColumnRow
                    column={row.column}
                    isPK={row.isPK}
                    isFK={row.isFK}
                    tableComment={row.isLast ? row.tableComment : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Layer group header with badge + count */
function GroupHeader({
  layer,
  count,
  isExpanded,
  onToggle,
}: {
  layer: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const colors = LAYER_COLORS[layer] ?? LAYER_COLORS.OTHER;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-1 py-1.5 text-xs cursor-pointer hover:bg-surface-hover rounded-md transition-colors"
    >
      <Icon
        name={isExpanded ? 'chevronDown' : 'chevronRight'}
        size={11}
        className="text-muted/60 shrink-0"
      />
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${colors}`}
      >
        {layer}
      </span>
      <span className="text-[11px] text-muted tabular-nums">{count} 张</span>
    </button>
  );
}

/** Table row — click to expand columns */
function TableRow({
  table,
  isExpanded,
  isUsed,
  isLoading,
  onToggle,
}: {
  table: SchemaTable;
  isExpanded: boolean;
  isUsed: boolean;
  isLoading: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-2 w-full px-2 py-[7px] rounded-lg text-[13px] transition-colors cursor-pointer group/table ${
        isExpanded
          ? 'bg-surface'
          : isUsed
            ? 'bg-primary/5 hover:bg-primary/8'
            : 'hover:bg-surface-hover'
      }`}
    >
      {isLoading ? (
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
        </span>
      ) : (
        <Icon
          name={isExpanded ? 'chevronDown' : 'chevronRight'}
          size={11}
          className="text-muted/60 shrink-0"
        />
      )}
      <span
        className={`shrink-0 w-[18px] h-[18px] rounded flex items-center justify-center text-[10px] font-bold ${
          isUsed
            ? 'bg-primary/10 text-primary'
            : 'bg-emerald-50 text-emerald-600'
        }`}
      >
        T
      </span>
      <span
        className={`truncate font-medium ${isUsed ? 'text-primary' : 'text-foreground'}`}
      >
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
  );
}

/** Column row with DataGrip-style icons */
function ColumnRow({
  column,
  isPK,
  isFK,
  tableComment,
}: {
  column: SchemaColumn;
  isPK: boolean;
  isFK: boolean;
  tableComment?: string | null;
}) {
  const typeInfo = getTypeIcon(column.dataType);

  return (
    <div className="ml-3 mr-0.5">
      <div className="flex items-center gap-1.5 px-2 py-[5px] rounded-md hover:bg-surface-hover/60 transition-colors">
        {/* Composite icon */}
        <span className="relative shrink-0 w-5 h-5 flex items-center justify-center">
          <span className={`text-[11px] font-bold font-mono ${typeInfo.color}`}>
            {typeInfo.icon}
          </span>
          {isPK && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border border-background flex items-center justify-center">
              <span className="text-[6px] text-white font-bold">K</span>
            </span>
          )}
          {isFK && !isPK && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 border border-background flex items-center justify-center">
              <span className="text-[6px] text-white font-bold">F</span>
            </span>
          )}
        </span>

        <span
          className={`text-[12.5px] truncate flex-1 ${isPK ? 'font-semibold text-foreground' : 'text-foreground/80'}`}
        >
          {column.name}
        </span>

        <span className="flex items-center gap-1 shrink-0">
          <span className="text-[10.5px] text-muted/60 font-mono">{column.dataType}</span>
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
      {tableComment && (
        <div className="px-2 pt-0.5 pb-1 ml-5">
          <span className="text-[11px] text-muted/60 leading-tight">{tableComment}</span>
        </div>
      )}
    </div>
  );
}

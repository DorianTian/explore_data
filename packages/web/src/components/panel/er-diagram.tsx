'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Position,
  Handle,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSchemaStore, type SchemaTable } from '@/stores/schema-store';

/** Max columns shown per table node before collapsing */
const MAX_VISIBLE_COLUMNS = 8;

/** Node data shape for custom table nodes */
interface TableNodeData {
  label: string;
  columns: Array<{
    name: string;
    type: string;
    isPK: boolean;
    isFK: boolean;
  }>;
  overflowCount: number;
  [key: string]: unknown;
}

/** Custom node rendering a table with columns */
function TableNode({ data }: NodeProps<Node<TableNodeData>>) {
  const { label, columns, overflowCount } = data;

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface-elevated shadow-md min-w-[180px] max-w-[240px]">
      {/* Handles for edges */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-secondary !border-border"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-primary !border-border"
      />

      {/* Table name header */}
      <div className="px-3 py-2 border-b border-border bg-surface rounded-t-[var(--radius-md)]">
        <span className="text-xs font-semibold text-primary truncate block">
          {label}
        </span>
      </div>

      {/* Columns */}
      <div className="px-2 py-1">
        {columns.map((col) => (
          <div
            key={col.name}
            className="flex items-center gap-1.5 py-0.5 text-[11px]"
          >
            {col.isPK && (
              <span className="text-golden font-bold shrink-0 w-3 text-center">
                K
              </span>
            )}
            {col.isFK && !col.isPK && (
              <span className="text-secondary font-bold shrink-0 w-3 text-center">
                F
              </span>
            )}
            {!col.isPK && !col.isFK && <span className="w-3 shrink-0" />}
            <span className="text-foreground truncate">{col.name}</span>
            <span className="text-muted font-mono ml-auto shrink-0 text-[10px]">
              {col.type}
            </span>
          </div>
        ))}
        {overflowCount > 0 && (
          <div className="text-[10px] text-muted text-center py-0.5">
            +{overflowCount} more
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  tableNode: TableNode,
};

/**
 * Simple grid auto-layout: arrange tables in rows.
 * Tables with FK relationships are placed left-to-right.
 */
function autoLayout(
  tables: SchemaTable[],
  relationships: { fromTableId: string; toTableId: string }[],
): { x: number; y: number; tableId: string }[] {
  /* Build adjacency for a basic topological sort */
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const t of tables) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }
  for (const rel of relationships) {
    adj.get(rel.fromTableId)?.push(rel.toTableId);
    inDegree.set(
      rel.toTableId,
      (inDegree.get(rel.toTableId) ?? 0) + 1,
    );
  }

  /* BFS topo sort */
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  const sorted: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    for (const next of adj.get(id) ?? []) {
      const d = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  /* Append any remaining (cycles) */
  for (const t of tables) {
    if (!sorted.includes(t.id)) sorted.push(t.id);
  }

  /* Grid placement: 3 columns */
  const cols = 3;
  const xGap = 280;
  const yGap = 260;

  return sorted.map((tableId, i) => ({
    tableId,
    x: (i % cols) * xGap + 40,
    y: Math.floor(i / cols) * yGap + 40,
  }));
}

export function ERDiagram({ filterTables }: { filterTables?: string[] } = {}) {
  const { tables: allTables, relationships: allRelationships } = useSchemaStore();

  /* Apply table filter if provided */
  const tables = useMemo(() => {
    if (!filterTables || filterTables.length === 0) return allTables;
    const filterSet = new Set(filterTables.map((n) => n.toLowerCase()));
    return allTables.filter((t) => filterSet.has(t.name.toLowerCase()));
  }, [allTables, filterTables]);

  /* Only show relationships between visible tables */
  const relationships = useMemo(() => {
    const tableIds = new Set(tables.map((t) => t.id));
    return allRelationships.filter((r) => tableIds.has(r.fromTableId) && tableIds.has(r.toTableId));
  }, [allRelationships, tables]);

  /* FK column lookup */
  const fkColumnIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rel of relationships) {
      ids.add(rel.fromColumnId);
      ids.add(rel.toColumnId);
    }
    return ids;
  }, [relationships]);

  /* Build nodes */
  const nodes: Node<TableNodeData>[] = useMemo(() => {
    const positions = autoLayout(tables, relationships);
    const posMap = new Map(positions.map((p) => [p.tableId, p]));

    return tables.map((table) => {
      const pos = posMap.get(table.id) ?? { x: 0, y: 0 };
      const allCols = table.columns.map((c) => ({
        name: c.name,
        type: c.dataType,
        isPK: c.isPrimaryKey,
        isFK: fkColumnIds.has(c.id),
      }));
      const visibleCols = allCols.slice(0, MAX_VISIBLE_COLUMNS);
      const overflow = allCols.length - visibleCols.length;

      return {
        id: table.id,
        type: 'tableNode',
        position: { x: pos.x, y: pos.y },
        data: {
          label: table.name,
          columns: visibleCols,
          overflowCount: overflow,
        },
      };
    });
  }, [tables, relationships, fkColumnIds]);

  /* Build edges */
  const edges: Edge[] = useMemo(() => {
    return relationships.map((rel) => ({
      id: rel.id,
      source: rel.fromTableId,
      target: rel.toTableId,
      label: rel.relationshipType,
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'var(--border-strong)', strokeWidth: 1.5 },
      labelStyle: {
        fill: 'var(--muted-foreground)',
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
      },
      labelBgStyle: {
        fill: 'var(--surface)',
        fillOpacity: 0.9,
      },
    }));
  }, [relationships]);

  if (!tables.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        暂无表数据
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="var(--border)" gap={20} size={1} />
      <Controls
        className="!bg-surface !border-border !rounded-[var(--radius-md)] !shadow-md [&>button]:!bg-surface [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-surface-hover"
      />
    </ReactFlow>
  );
}

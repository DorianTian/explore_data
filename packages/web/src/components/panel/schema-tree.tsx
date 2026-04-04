'use client';

import { useMemo } from 'react';
import { useSchemaStore } from '@/stores/schema-store';
import { useProjectStore } from '@/stores/project-store';
import { useChatStore } from '@/stores/chat-store';
import { TreeView, type TreeNodeData } from '@/components/shared/tree-view';
import { Icon } from '@/components/shared/icon';
import { Badge } from '@/components/ui';

export function SchemaTree() {
  const { tables } = useSchemaStore();
  const { currentDatasourceId } = useProjectStore();
  const messages = useChatStore((s) => s.messages);

  const usedTableNames = useMemo(() => {
    const names = new Set<string>();
    for (const msg of messages) {
      if (msg.tablesUsed) {
        for (const t of msg.tablesUsed) names.add(t.toLowerCase());
      }
    }
    return names;
  }, [messages]);

  const treeNodes: TreeNodeData[] = useMemo(() => {
    if (!tables.length) return [];

    return tables.map((table) => {
      const isUsed = usedTableNames.has(table.name.toLowerCase());

      return {
        id: table.id,
        label: table.name,
        icon: (
          <Icon
            name="table"
            size={14}
            className={isUsed ? 'text-primary' : 'text-muted'}
          />
        ),
        isHighlighted: isUsed,
        metadata: table.comment ? { comment: table.comment } : undefined,
        children: table.columns.map((col) => ({
          id: col.id,
          label: col.name,
          icon: col.isPrimaryKey ? (
            <span className="text-amber-500 text-xs font-bold">PK</span>
          ) : (
            <span className="text-xs text-muted font-mono">
              {col.dataType.slice(0, 4)}
            </span>
          ),
          metadata: {
            type: col.dataType,
            ...(col.isPII ? { pii: '🔒' } : {}),
          },
        })),
      };
    });
  }, [tables, usedTableNames]);

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
      <TreeView nodes={treeNodes} defaultExpandedIds={defaultExpandedIds} />
    </div>
  );
}

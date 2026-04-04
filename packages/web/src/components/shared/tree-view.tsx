'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/shared/icon';

export interface TreeNodeData {
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
        {hasChildren ? (
          <Icon
            name={isExpanded ? 'chevronDown' : 'chevronRight'}
            size={12}
            className="text-muted shrink-0"
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {node.icon && <span className="shrink-0">{node.icon}</span>}

        <span className="truncate">{node.label}</span>

        {node.metadata &&
          Object.entries(node.metadata).map(([key, val]) => (
            <span key={key} className="ml-auto text-xs text-muted shrink-0">
              {val}
            </span>
          ))}
      </div>

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

export function TreeView({
  nodes,
  defaultExpandedIds,
  onNodeClick,
}: TreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    defaultExpandedIds ?? new Set(),
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

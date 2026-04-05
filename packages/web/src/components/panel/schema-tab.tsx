'use client';

import { useEffect, useState } from 'react';
import { SchemaBrowser } from './schema-browser';
import dynamic from 'next/dynamic';

const ERDiagram = dynamic(
  () => import('./er-diagram').then((m) => m.ERDiagram),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] flex items-center justify-center text-muted text-sm">
        ER 图加载中...
      </div>
    ),
  },
);

type SchemaViewMode = 'tree' | 'er';

interface SchemaTabProps {
  /** When set, only show tables matching these names */
  filterTables?: string[];
}

/**
 * Schema tab content — toggle between tree browser and ER diagram.
 */
export function SchemaTab({ filterTables }: SchemaTabProps) {
  const hasFilteredTables = filterTables && filterTables.length > 0;
  const [viewMode, setViewMode] = useState<SchemaViewMode>('tree');

  // Fall back to tree when filtered tables disappear (e.g. switching messages)
  useEffect(() => {
    if (!hasFilteredTables && viewMode === 'er') {
      setViewMode('tree');
    }
  }, [hasFilteredTables, viewMode]);

  return (
    <div className="h-full flex flex-col">
      {/* View mode toggle — only show ER option when query results provide specific tables */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 shrink-0">
        <div className="flex bg-surface rounded-md p-0.5 border border-border/50">
          <button
            type="button"
            onClick={() => setViewMode('tree')}
            className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
              viewMode === 'tree' || !hasFilteredTables
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
          >
            树形
          </button>
          {hasFilteredTables && (
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
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'tree' ? (
          <SchemaBrowser filterTables={filterTables} />
        ) : (
          <div className="h-full px-3 pb-3">
            <div className="h-full rounded-lg border border-border overflow-hidden relative">
              <ERDiagram filterTables={filterTables} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

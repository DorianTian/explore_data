'use client';

import { useMemo } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { usePanelStore, type ArtifactTab } from '@/stores/panel-store';
import { Icon } from '@/components/shared/icon';
import { ResultTab } from './result-tab';
import { SchemaTab } from './schema-tab';

const TAB_CONFIG: Array<{ key: ArtifactTab; label: string }> = [
  { key: 'result', label: '结果' },
  { key: 'schema', label: '表结构' },
];

/**
 * Two-tab artifact panel: Result (SQL + Chart + Table) and Schema (tree/ER).
 */
export function ArtifactPanel() {
  const selectedMessageId = usePanelStore((s) => s.selectedMessageId);
  const artifactTab = usePanelStore((s) => s.artifactTab);
  const setArtifactTab = usePanelStore((s) => s.setArtifactTab);
  const closePanel = usePanelStore((s) => s.closePanel);

  const messages = useChatStore((s) => s.messages);

  const message = useMemo(
    () => messages.find((m) => m.id === selectedMessageId),
    [messages, selectedMessageId],
  );

  /** Derive tables from SQL when tablesUsed is empty */
  const filterTables = useMemo(() => {
    if (message?.tablesUsed && message.tablesUsed.length > 0) {
      return message.tablesUsed;
    }
    if (!message?.sql) return undefined;
    /* Match FROM/JOIN followed by optional "schema"."table" or just table */
    const regex = /(?:FROM|JOIN)\s+"?(\w+)"?(?:\."?(\w+)"?)?/gi;
    const tables: string[] = [];
    let m;
    while ((m = regex.exec(message.sql)) !== null) {
      /* group 2 = table when schema.table, group 1 = table when no schema */
      tables.push(m[2] ?? m[1]);
    }
    const unique = [...new Set(tables)];
    return unique.length > 0 ? unique : undefined;
  }, [message?.tablesUsed, message?.sql]);

  return (
    <div className="flex flex-col h-full bg-background-secondary">
      {/* Header — minimal tab bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {TAB_CONFIG.map((tab) => {
            const active = artifactTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setArtifactTab(tab.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer
                  ${active ? 'bg-surface text-foreground' : 'text-muted hover:text-foreground'}
                `}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={closePanel}
          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {artifactTab === 'result' && message && (
          <ResultTab message={message} />
        )}
        {artifactTab === 'result' && !message && (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            选择一条消息查看结果
          </div>
        )}
        {artifactTab === 'schema' && (
          <div className="h-full">
            <SchemaTab filterTables={filterTables} />
          </div>
        )}
      </div>
    </div>
  );
}

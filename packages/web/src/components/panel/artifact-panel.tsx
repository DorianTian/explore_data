'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useChatStore, type ChatMessage } from '@/stores/chat-store';
import { usePanelStore, type ArtifactTab } from '@/stores/panel-store';
import { useProjectStore } from '@/stores/project-store';
import { Icon } from '@/components/shared/icon';
import { Badge } from '@/components/ui';
import { useSchemaStore } from '@/stores/schema-store';
import { SqlEditor } from './sql-editor';
import { apiPost } from '@/lib/api';
import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const TAB_CONFIG: Array<{ key: ArtifactTab; label: string }> = [
  { key: 'schema', label: '表结构' },
  { key: 'sql', label: 'SQL' },
  { key: 'result', label: '结果' },
  { key: 'chart', label: '图表' },
];

export function ArtifactPanel() {
  const selectedMessageId = usePanelStore((s) => s.selectedMessageId);
  const artifactTab = usePanelStore((s) => s.artifactTab);
  const setArtifactTab = usePanelStore((s) => s.setArtifactTab);
  const closeArtifact = usePanelStore((s) => s.closeArtifact);

  const messages = useChatStore((s) => s.messages);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const { currentProjectId } = useProjectStore();

  const message = useMemo(
    () => messages.find((m) => m.id === selectedMessageId),
    [messages, selectedMessageId],
  );

  const [editedSql, setEditedSql] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (message?.sql) {
      setEditedSql(message.sql);
    }
  }, [message?.id]); // eslint-disable-line react-hooks/exhaustive-deps — intentionally skip message.sql to preserve in-progress edits

  const hasSqlChanged = Boolean(message?.sql) && message?.sql !== editedSql;

  const handleCopySql = useCallback(async () => {
    if (!editedSql) return;
    await navigator.clipboard.writeText(editedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [editedSql]);

  const handleSaveCorrection = useCallback(async () => {
    if (!message || !hasSqlChanged || !currentProjectId) return;

    const msgIndex = messages.findIndex((m) => m.id === message.id);
    const userMsg = messages
      .slice(0, msgIndex)
      .reverse()
      .find((m) => m.role === 'user');

    try {
      await apiPost('/api/query/feedback', {
        projectId: currentProjectId,
        naturalLanguage: userMsg?.content ?? '',
        generatedSql: message.sql,
        correctedSql: editedSql,
        status: 'accepted',
      });

      if (selectedMessageId) {
        updateMessage(selectedMessageId, {
          sql: editedSql,
          feedback: 'accepted',
        });
      }
    } catch {
      /* Feedback save failed — non-critical */
    }
  }, [message, editedSql, hasSqlChanged, selectedMessageId, currentProjectId, messages, updateMessage]);

  const handleExportCsv = useCallback(() => {
    if (!message?.executionResult) return;
    const { rows, columns } = message.executionResult;
    const esc = (v: string) =>
      v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
    const header = columns.map((c) => esc(c.name)).join(',');
    const body = rows
      .map((r) => columns.map((c) => esc(String(r[c.name] ?? ''))).join(','))
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'result.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [message?.executionResult]);

  if (!message) return null;

  const hasResult = Boolean(message.executionResult);
  const hasChart = Boolean(
    message.chartRecommendation && message.chartRecommendation.chartType !== 'table',
  );
  const hasSchema = Boolean(message.tablesUsed && message.tablesUsed.length > 0);

  return (
    <div className="flex flex-col h-full bg-background-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {TAB_CONFIG.map((tab) => {
            const disabled =
              (tab.key === 'result' && !hasResult) ||
              (tab.key === 'chart' && !hasChart) ||
              (tab.key === 'schema' && !hasSchema);
            const active = artifactTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => !disabled && setArtifactTab(tab.key)}
                disabled={disabled}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer
                  ${active ? 'bg-surface text-foreground' : 'text-muted hover:text-foreground'}
                  ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
                `}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={closeArtifact}
          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {artifactTab === 'sql' && <SqlTabContent
          message={message}
          editedSql={editedSql}
          setEditedSql={setEditedSql}
          hasSqlChanged={hasSqlChanged}
          handleCopySql={handleCopySql}
          handleSaveCorrection={handleSaveCorrection}
          copied={copied}
        />}

        {artifactTab === 'result' && message.executionResult && (
          <ResultTabContent
            executionResult={message.executionResult}
            onExportCsv={handleExportCsv}
          />
        )}

        {artifactTab === 'chart' && hasChart && (
          <ChartTabContent chartRecommendation={message.chartRecommendation!} />
        )}

        {artifactTab === 'schema' && hasSchema && (
          <SchemaTabContent tablesUsed={message.tablesUsed!} />
        )}
      </div>
    </div>
  );
}

/** SQL tab: editable SQL with confidence badge */
function SqlTabContent({
  message,
  editedSql,
  setEditedSql,
  hasSqlChanged,
  handleCopySql,
  handleSaveCorrection,
  copied,
}: {
  message: ChatMessage;
  editedSql: string;
  setEditedSql: (v: string) => void;
  hasSqlChanged: boolean;
  handleCopySql: () => void;
  handleSaveCorrection: () => void;
  copied: boolean;
}) {
  if (!message.sql) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        该消息没有生成 SQL
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Meta row */}
      <div className="flex items-center justify-between">
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
          {message.tablesUsed && message.tablesUsed.length > 0 && (
            <div className="flex items-center gap-1">
              {message.tablesUsed.map((t) => (
                <Badge key={t} variant="default">{t}</Badge>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleCopySql}
          className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <Icon name={copied ? 'check' : 'copy'} size={12} />
          {copied ? '已复制' : '复制'}
        </button>
      </div>

      {/* Editor */}
      <SqlEditor
        value={editedSql}
        onChange={setEditedSql}
        onSave={hasSqlChanged ? handleSaveCorrection : undefined}
        height={280}
      />

      {hasSqlChanged && (
        <p className="text-xs text-amber-600">
          SQL 已修改，点击 &quot;保存修正&quot; 记录纠正
        </p>
      )}

      {/* Explanation */}
      {message.content && (
        <div className="pt-3 border-t border-border">
          <h4 className="text-xs font-medium text-muted mb-2">解释</h4>
          <p className="text-sm text-foreground leading-relaxed">{message.content}</p>
        </div>
      )}
    </div>
  );
}

/** Result tab: full data table */
function ResultTabContent({
  executionResult,
  onExportCsv,
}: {
  executionResult: NonNullable<ChatMessage['executionResult']>;
  onExportCsv: () => void;
}) {
  const { rows, columns, truncated, executionTimeMs } = executionResult;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          {rows.length} 行{truncated ? ' (已截断)' : ''} · {columns.length} 列
          {executionTimeMs !== undefined && ` · ${executionTimeMs}ms`}
        </span>
        <button
          onClick={onExportCsv}
          className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <Icon name="download" size={12} />
          导出 CSV
        </button>
      </div>

      <div className="max-h-[calc(100vh-200px)] overflow-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface sticky top-0">
              {columns.map((col) => (
                <th
                  key={col.name}
                  className="px-3 py-2 text-left font-medium text-muted border-b border-border whitespace-nowrap"
                >
                  {col.name}
                  <span className="ml-1 text-[10px] opacity-50">{col.dataType}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.name}
                    className="px-3 py-1.5 text-foreground font-mono whitespace-nowrap"
                  >
                    {row[col.name] == null ? (
                      <span className="text-muted italic">NULL</span>
                    ) : (
                      String(row[col.name])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {truncated && (
        <p className="text-xs text-muted">结果已截断，仅显示前 {rows.length} 行</p>
      )}
    </div>
  );
}

/** Chart tab: full-size visualization */
function ChartTabContent({
  chartRecommendation,
}: {
  chartRecommendation: NonNullable<ChatMessage['chartRecommendation']>;
}) {
  const { chartType, config } = chartRecommendation;
  const typedConfig = config as Record<string, unknown>;

  if (chartType === 'kpi') {
    const series = (typedConfig.series as Array<{ data: unknown[] }>)?.[0];
    const value = series?.data?.[0];
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <p className="text-sm text-muted mb-2">
          {(typedConfig.title as Record<string, string>)?.text ?? 'KPI'}
        </p>
        <p className="text-5xl font-bold text-foreground">{String(value)}</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="rounded-lg border border-border overflow-hidden bg-background">
        <ReactECharts
          option={typedConfig}
          style={{ height: 400 }}
          opts={{ renderer: 'svg' }}
          notMerge
        />
      </div>
    </div>
  );
}

/** Schema tab: show columns of tables used in the query */
function SchemaTabContent({ tablesUsed }: { tablesUsed: string[] }) {
  const allTables = useSchemaStore((s) => s.tables);
  const relationships = useSchemaStore((s) => s.relationships);

  const relevantTables = useMemo(
    () => allTables.filter((t) => tablesUsed.some((name) => name.toLowerCase() === t.name.toLowerCase())),
    [allTables, tablesUsed],
  );

  const relevantRels = useMemo(() => {
    const tableIds = new Set(relevantTables.map((t) => t.id));
    return relationships.filter((r) => tableIds.has(r.fromTableId) || tableIds.has(r.toTableId));
  }, [relevantTables, relationships]);

  if (relevantTables.length === 0) {
    return (
      <div className="p-4 text-sm text-muted text-center py-8">
        Schema 数据未加载，请在左侧面板刷新 Schema
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Relationships summary */}
      {relevantRels.length > 0 && (
        <div className="rounded-lg border border-border p-3 bg-surface">
          <h4 className="text-xs font-medium text-muted mb-2">关联关系</h4>
          <div className="space-y-1">
            {relevantRels.map((rel) => {
              const fromTable = allTables.find((t) => t.id === rel.fromTableId);
              const toTable = allTables.find((t) => t.id === rel.toTableId);
              const fromCol = fromTable?.columns.find((c) => c.id === rel.fromColumnId);
              const toCol = toTable?.columns.find((c) => c.id === rel.toColumnId);
              return (
                <div key={rel.id} className="text-xs text-foreground font-mono">
                  {fromTable?.name}.{fromCol?.name} → {toTable?.name}.{toCol?.name}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table columns */}
      {relevantTables.map((table) => (
        <div key={table.id} className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 bg-surface flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="table" size={14} className="text-primary" />
              <span className="text-sm font-medium text-foreground">{table.name}</span>
            </div>
            <span className="text-xs text-muted">{table.columns.length} 列</span>
          </div>
          {table.comment && (
            <div className="px-3 py-1.5 border-t border-border bg-surface/50">
              <span className="text-xs text-muted">{table.comment}</span>
            </div>
          )}
          <div className="divide-y divide-border">
            {table.columns.map((col) => (
              <div key={col.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <span className="text-foreground flex-1 truncate">{col.name}</span>
                <span className="text-muted font-mono shrink-0">{col.dataType}</span>
                {col.isPrimaryKey && (
                  <Badge variant="golden" className="text-[10px] px-1.5 py-0">PK</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

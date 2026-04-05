'use client';

import { useState, useCallback, useEffect } from 'react';
import { type ChatMessage } from '@/stores/chat-store';
import { useChatStore } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
import { apiPost } from '@/lib/api';
import { Icon } from '@/components/shared/icon';
import { Badge } from '@/components/ui';
import { SqlEditor } from './sql-editor';
import { SmartChart } from './smart-chart';
import { ChartErrorBoundary } from './chart-error-boundary';

interface ResultTabProps {
  message: ChatMessage;
}

/**
 * Unified result view: SQL (collapsible) -> Chart -> Data Table.
 * All sections in one scrollable column.
 */
export function ResultTab({ message }: ResultTabProps) {
  const [sqlExpanded, setSqlExpanded] = useState(false);
  const [editedSql, setEditedSql] = useState('');
  const [copied, setCopied] = useState(false);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const messages = useChatStore((s) => s.messages);
  const { currentProjectId } = useProjectStore();

  useEffect(() => {
    if (message.sql) setEditedSql(message.sql);
  }, [message.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasSqlChanged = Boolean(message.sql) && message.sql !== editedSql;

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
      updateMessage(message.id, { sql: editedSql, feedback: 'accepted' });
    } catch {
      /* Feedback save failed — non-critical */
    }
  }, [message, editedSql, hasSqlChanged, currentProjectId, messages, updateMessage]);

  const handleExportCsv = useCallback(() => {
    if (!message.executionResult) return;
    const { rows, columns } = message.executionResult;
    const esc = (v: string) =>
      v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v;
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
    setTimeout(() => URL.revokeObjectURL(url), 200);
  }, [message.executionResult]);

  const hasChart = Boolean(
    message.chartRecommendation &&
      message.chartRecommendation.chartType !== 'table',
  );

  const chartConfig = message.chartRecommendation ?? null;

  const noContent = !message.sql && !message.executionResult;

  if (noContent) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        暂无结果数据
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {/* ── SQL Section (collapsible) ── */}
      {message.sql && (
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Collapsible header */}
          <button
            type="button"
            onClick={() => setSqlExpanded(!sqlExpanded)}
            className="flex items-center gap-2 w-full px-3 py-2 bg-surface text-sm hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <Icon
              name="chevronRight"
              size={12}
              className={`text-muted shrink-0 transition-transform duration-200 ${
                sqlExpanded ? 'rotate-90' : ''
              }`}
            />
            <span className="font-medium text-foreground">SQL</span>
            {message.confidence !== undefined && (
              <Badge
                variant={
                  message.confidence >= 0.8
                    ? 'success'
                    : message.confidence >= 0.6
                      ? 'warning'
                      : 'error'
                }
                className="ml-1"
              >
                {Math.round(message.confidence * 100)}%
              </Badge>
            )}
            {message.tablesUsed && message.tablesUsed.length > 0 && (
              <div className="flex items-center gap-1 ml-1">
                {message.tablesUsed.slice(0, 3).map((t) => (
                  <Badge key={t} variant="default">{t}</Badge>
                ))}
                {message.tablesUsed.length > 3 && (
                  <span className="text-xs text-muted">+{message.tablesUsed.length - 3}</span>
                )}
              </div>
            )}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleCopySql();
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleCopySql(); } }}
              className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <Icon name={copied ? 'check' : 'copy'} size={12} />
              {copied ? '已复制' : '复制'}
            </span>
          </button>

          {/* Collapsed preview */}
          {!sqlExpanded && (
            <div className="px-3 py-2 bg-background border-t border-border">
              <pre className="text-xs font-mono text-muted truncate leading-relaxed">
                {message.sql.split('\n').slice(0, 2).join('\n')}
              </pre>
            </div>
          )}

          {/* Expanded: full Monaco editor */}
          {sqlExpanded && (
            <div>
              <SqlEditor
                value={editedSql}
                onChange={setEditedSql}
                onSave={hasSqlChanged ? handleSaveCorrection : undefined}
                height={220}
              />
              {hasSqlChanged && (
                <div className="px-3 py-1.5 bg-surface border-t border-border">
                  <p className="text-xs text-amber-600">
                    SQL 已修改，点击 &quot;保存修正&quot; 记录纠正
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Data Insight ── */}
      {message.insight && (
        <div className="rounded-lg border border-border bg-surface/50 p-3">
          <h4 className="text-xs font-medium text-muted mb-1.5">数据分析</h4>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {message.insight}
          </p>
        </div>
      )}

      {/* ── Loading skeleton while waiting for execution result ── */}
      {message.sql && !message.executionResult && (
        <div className="space-y-3 animate-pulse">
          <div className="h-[200px] rounded-lg bg-muted/30 flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              正在执行查询并分析数据...
            </div>
          </div>
          <div className="h-[120px] rounded-lg bg-muted/20" />
        </div>
      )}

      {/* ── Chart Section ── */}
      {hasChart && chartConfig && message.executionResult && (
        <ChartErrorBoundary>
          <SmartChart
            config={chartConfig}
            rows={message.executionResult.rows}
            columns={message.executionResult.columns}
          />
        </ChartErrorBoundary>
      )}

      {/* ── Data Table Section ── */}
      {message.executionResult && (
        <DataTableSection
          executionResult={message.executionResult}
          onExportCsv={handleExportCsv}
        />
      )}
    </div>
  );
}

/** Scrollable data table with sticky header */
function DataTableSection({
  executionResult,
  onExportCsv,
}: {
  executionResult: NonNullable<ChatMessage['executionResult']>;
  onExportCsv: () => void;
}) {
  const { rows, columns, truncated, executionTimeMs } = executionResult;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          {rows.length} 行{truncated ? ' (已截断)' : ''} · {columns.length} 列
          {executionTimeMs !== undefined && ` · ${executionTimeMs}ms`}
        </span>
        <button
          type="button"
          onClick={onExportCsv}
          className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <Icon name="download" size={12} />
          导出 CSV
        </button>
      </div>

      <div className="max-h-[400px] overflow-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface sticky top-0 z-10">
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
              <tr
                key={i}
                className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors"
              >
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

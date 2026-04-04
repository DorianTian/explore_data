'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { usePanelStore } from '@/stores/panel-store';
import { useProjectStore } from '@/stores/project-store';
import { Badge } from '@/components/ui';
import { Icon } from '@/components/shared/icon';
import { SqlEditor } from './sql-editor';
import { apiPost } from '@/lib/api';
import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

export function ExecutionDetail() {
  const selectedMessageId = usePanelStore((s) => s.selectedMessageId);
  const messages = useChatStore((s) => s.messages);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const { currentProjectId } = useProjectStore();

  const message = useMemo(
    () => messages.find((m) => m.id === selectedMessageId),
    [messages, selectedMessageId],
  );

  const [editedSql, setEditedSql] = useState('');
  const [copied, setCopied] = useState(false);

  /* Sync SQL when selection changes (skip sql dep to preserve in-progress edits) */
  useEffect(() => {
    if (message?.sql) {
      setEditedSql(message.sql);
    }
  }, [message?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasSqlChanged = message?.sql !== editedSql;

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
      /* Feedback save failed — non-critical, message state unchanged */
    }
  }, [
    message,
    editedSql,
    hasSqlChanged,
    selectedMessageId,
    currentProjectId,
    messages,
    updateMessage,
  ]);

  const handleExportCsv = useCallback(() => {
    if (!message?.executionResult) return;
    const { rows, columns } = message.executionResult;
    const header = columns.map((c) => c.name).join(',');
    const body = rows
      .map((r) => columns.map((c) => String(r[c.name] ?? '')).join(','))
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'result.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [message?.executionResult]);

  if (!message) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-3 text-muted">
        <Icon name="table" size={28} className="mb-2 opacity-40" />
        <p className="text-sm">点击对话中的消息查看执行详情</p>
        <p className="text-xs mt-1">或从查询历史中选择一条记录</p>
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <div className="px-3 pb-3">
        <div className="p-3 rounded-[var(--radius-md)] bg-surface border border-border">
          <h4 className="text-xs font-medium text-muted mb-2">用户问题</h4>
          <p className="text-sm text-foreground">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 space-y-4">
      {/* SQL Section */}
      {message.sql && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted">SQL</h4>
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
              <button
                type="button"
                onClick={handleCopySql}
                className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <Icon name={copied ? 'check' : 'copy'} size={12} />
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>
          <SqlEditor
            value={editedSql}
            onChange={setEditedSql}
            onSave={hasSqlChanged ? handleSaveCorrection : undefined}
          />
          {hasSqlChanged && (
            <p className="text-xs text-warning mt-1">
              SQL 已修改，点击 &quot;保存修正&quot; 记录纠正
            </p>
          )}
        </div>
      )}

      {/* Execution Result */}
      {message.executionResult && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted">
              查询结果 ({message.executionResult.rows.length} 行)
              {message.executionResult.executionTimeMs !== undefined &&
                ` \u00b7 ${message.executionResult.executionTimeMs}ms`}
            </h4>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground cursor-pointer"
            >
              <Icon name="download" size={12} />
              CSV
            </button>
          </div>
          <div className="max-h-[300px] overflow-auto rounded-[var(--radius-md)] border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface sticky top-0">
                  {message.executionResult.columns.map((col) => (
                    <th
                      key={col.name}
                      className="px-3 py-2 text-left font-medium text-muted border-b border-border whitespace-nowrap"
                    >
                      {col.name}
                      <span className="ml-1 text-[10px] opacity-60">
                        {col.dataType}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {message.executionResult.rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0 hover:bg-surface/50"
                  >
                    {message.executionResult!.columns.map((col) => (
                      <td
                        key={col.name}
                        className="px-3 py-1.5 text-foreground font-mono whitespace-nowrap"
                      >
                        {row[col.name] == null ? (
                          <span className="text-muted">NULL</span>
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
          {message.executionResult.truncated && (
            <p className="text-xs text-muted mt-1">
              结果已截断，仅显示前 {message.executionResult.rows.length} 行
            </p>
          )}
        </div>
      )}

      {/* Chart */}
      {message.chartRecommendation &&
        message.chartRecommendation.chartType !== 'table' && (
          <div>
            <h4 className="text-xs font-medium text-muted mb-2">可视化</h4>
            <div className="rounded-[var(--radius-lg)] border border-border overflow-hidden">
              {message.chartRecommendation.chartType === 'kpi' ? (
                <div className="p-6 text-center">
                  <p className="text-xs text-muted mb-1">
                    {
                      (
                        message.chartRecommendation.config as Record<
                          string,
                          Record<string, string>
                        >
                      )?.title?.text
                    }
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {String(
                      (
                        (
                          message.chartRecommendation.config as Record<
                            string,
                            Array<{ data: unknown[] }>
                          >
                        )?.series
                      )?.[0]?.data?.[0] ?? '\u2014',
                    )}
                  </p>
                </div>
              ) : (
                <ReactECharts
                  option={
                    message.chartRecommendation.config as Record<
                      string,
                      unknown
                    >
                  }
                  style={{ height: 260 }}
                  opts={{ renderer: 'svg' }}
                  notMerge
                />
              )}
            </div>
          </div>
        )}

      {/* Explanation */}
      {message.content && (
        <div>
          <h4 className="text-xs font-medium text-muted mb-2">解释</h4>
          <p className="text-sm text-foreground leading-relaxed">
            {message.content}
          </p>
        </div>
      )}

      {/* Tables used */}
      {message.tablesUsed && message.tablesUsed.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted mb-2">引用表</h4>
          <div className="flex flex-wrap gap-1.5">
            {message.tablesUsed.map((t) => (
              <Badge key={t} variant="default">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

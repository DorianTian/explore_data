'use client';

import { useState, useCallback, useEffect } from 'react';
import { useChatStore, type PipelineStepEntry } from '@/stores/chat-store';
import { Icon } from '@/components/shared/icon';

const STEP_LABELS: Record<string, string> = {
  intent_classification: '分析查询意图',
  metric_resolution: '匹配业务指标',
  query_decomposition: '拆解查询逻辑',
  schema_linking: '匹配数据模型',
  schema_rerank: '精选相关表结构',
  schema_search: '搜索数据库结构',
  knowledge_retrieval: '检索知识文档',
  few_shot_retrieval: '检索相似案例',
  metric_lookup: '匹配业务指标',
  knowledge_search: '检索知识库',
  sql_generation: '生成 SQL',
  sql_generate: '生成 SQL',
  sql_review: '审查 SQL',
  sql_verification: '审查 SQL 正确性',
  sql_validation: '校验 SQL',
  sql_validate: '校验 SQL 安全性',
  error_recovery: '修复问题',
  executing: '执行查询',
  execution_error: '执行失败',
  data_insight: '分析数据',
};

interface StreamingIndicatorProps {
  messageId: string;
}

/**
 * Cumulative pipeline log with collapsible thinking content per step.
 * Current step is expanded by default, completed steps are collapsed.
 */
export function StreamingIndicator({ messageId }: StreamingIndicatorProps) {
  const message = useChatStore((s) => s.messages.find((m) => m.id === messageId));

  if (!message?.isStreaming) return null;

  const status = message.pipelineStatus;
  const steps = status?.steps ?? [];

  if (steps.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2">
        <PulsingDot />
        <span className="text-sm text-muted">正在处理...</span>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 py-2">
      {steps.map((entry, i) => (
        <StepRow
          key={`${entry.step}-${i}`}
          entry={entry}
          isCurrent={i === steps.length - 1}
          defaultExpanded={i === steps.length - 1}
        />
      ))}
    </div>
  );
}

/** Single step row — collapsible if it has thinking content */
function StepRow({
  entry,
  isCurrent,
  defaultExpanded,
}: {
  entry: PipelineStepEntry;
  isCurrent: boolean;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasThinking = Boolean(entry.thinking);

  /* Auto-expand when this becomes the current step */
  useEffect(() => {
    if (isCurrent) setExpanded(true);
  }, [isCurrent]);

  const toggle = useCallback(() => {
    if (hasThinking) setExpanded((prev) => !prev);
  }, [hasThinking]);

  const label = entry.message || STEP_LABELS[entry.step] || entry.step;

  return (
    <div>
      {/* Step header */}
      <button
        type="button"
        onClick={toggle}
        className={`flex items-center gap-2 w-full py-1 text-left transition-colors ${
          hasThinking ? 'cursor-pointer hover:bg-surface-hover rounded-md px-1' : 'cursor-default px-1'
        }`}
      >
        {isCurrent ? (
          <PulsingDot />
        ) : (
          <Icon name="check" size={10} className="text-emerald-500 shrink-0" />
        )}
        <span className={`text-sm ${isCurrent ? 'text-foreground' : 'text-muted'}`}>
          {label}
        </span>
        {hasThinking && (
          <Icon
            name="chevronRight"
            size={10}
            className={`text-muted/60 ml-auto shrink-0 transition-transform duration-200 ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        )}
      </button>

      {/* Thinking content block */}
      {expanded && hasThinking && (
        <div className="ml-5 mt-1 mb-1.5 px-3 py-2 rounded-md bg-surface/80 border border-border/50">
          <pre className="text-xs font-mono text-muted leading-relaxed whitespace-pre-wrap break-words">
            {entry.thinking}
          </pre>
        </div>
      )}
    </div>
  );
}

/** Animated pulsing dot for current step */
function PulsingDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
    </span>
  );
}

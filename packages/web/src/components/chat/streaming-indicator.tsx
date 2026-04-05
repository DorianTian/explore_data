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
  verification_1: 'SQL 验证 Round 1',
  verification_2: 'SQL 验证 Round 2',
  verification_3: 'SQL 验证 Round 3',
  chart_selection: '推荐图表类型',
  error_recovery: '修复问题',
  executing: '执行查询',
  execution_error: '执行失败',
  data_insight: '分析数据',
};

interface StreamingIndicatorProps {
  messageId: string;
}

/**
 * Pipeline reasoning display — ChatGPT-style thinking visibility.
 * - During streaming: thinking auto-expanded for all steps (no click needed)
 * - After completion: collapses into compact header, click to review
 */
export function StreamingIndicator({ messageId }: StreamingIndicatorProps) {
  const message = useChatStore((s) => s.messages.find((m) => m.id === messageId));
  const [sectionExpanded, setSectionExpanded] = useState(true);

  const isStreaming = message?.isStreaming ?? false;
  const steps = message?.pipelineStatus?.steps ?? [];

  /* Auto-collapse section when streaming finishes */
  useEffect(() => {
    if (!isStreaming && steps.length > 0) {
      setSectionExpanded(false);
    }
  }, [isStreaming, steps.length]);

  if (steps.length === 0) {
    if (!isStreaming) return null;
    return (
      <div className="flex items-center gap-2 py-2">
        <PulsingDot />
        <span className="text-sm text-muted">正在处理...</span>
      </div>
    );
  }

  /* Completed state: compact header with toggle */
  if (!isStreaming) {
    const thinkingCount = steps.filter((s) => s.thinking).length;
    return (
      <div className="py-1">
        <button
          type="button"
          onClick={() => setSectionExpanded((prev) => !prev)}
          className="flex items-center gap-2 py-1 px-1.5 rounded-md text-xs text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <Icon
            name="chevronRight"
            size={10}
            className={`shrink-0 transition-transform duration-200 ${sectionExpanded ? 'rotate-90' : ''}`}
          />
          <span>
            Pipeline · {steps.length} steps
            {thinkingCount > 0 && ` · ${thinkingCount} with reasoning`}
          </span>
        </button>
        {sectionExpanded && (
          <div className="space-y-0.5 mt-1 ml-1 pl-3 border-l-2 border-border/40">
            {steps.map((entry, i) => (
              <StepRow
                key={`${entry.step}-${i}`}
                entry={entry}
                isCurrent={false}
                isStreaming={false}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  /* Streaming state: live step list, thinking auto-expanded */
  return (
    <div className="space-y-0.5 py-2">
      {steps.map((entry, i) => (
        <StepRow
          key={`${entry.step}-${i}`}
          entry={entry}
          isCurrent={i === steps.length - 1}
          isStreaming
        />
      ))}
    </div>
  );
}

/** Single step row — during streaming thinking is always visible, after streaming it's togglable */
function StepRow({
  entry,
  isCurrent,
  isStreaming,
}: {
  entry: PipelineStepEntry;
  isCurrent: boolean;
  isStreaming: boolean;
}) {
  const [manualToggle, setManualToggle] = useState<boolean | null>(null);
  const hasThinking = Boolean(entry.thinking);

  // During streaming: always show thinking. After: default collapsed, user can toggle.
  const expanded = isStreaming
    ? hasThinking
    : manualToggle ?? false;

  const toggle = useCallback(() => {
    if (hasThinking) setManualToggle((prev) => !(prev ?? false));
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

      {/* Thinking content — auto-visible during streaming */}
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

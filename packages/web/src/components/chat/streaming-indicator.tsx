'use client';

import type { PipelineStatus, PipelineStep } from '@/stores/chat-store';

const STEP_LABELS: Record<PipelineStep, string> = {
  intent_classification: '分析查询意图',
  schema_linking: '匹配数据模型',
  sql_generation: '生成 SQL',
  sql_validation: '校验 SQL',
  error_recovery: '修复问题',
  executing: '执行查询',
};

interface StreamingIndicatorProps {
  status?: PipelineStatus;
  isStreaming: boolean;
}

/**
 * Minimal streaming indicator: pulsing dot with optional pipeline step text.
 */
export function StreamingIndicator({
  status,
  isStreaming,
}: StreamingIndicatorProps) {
  if (!isStreaming) return null;

  return (
    <div className="flex items-center gap-2 py-2">
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>

      {/* Step label */}
      {status && (
        <span className="text-sm text-muted">
          {status.message || STEP_LABELS[status.currentStep]}
        </span>
      )}
    </div>
  );
}

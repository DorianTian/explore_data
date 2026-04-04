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

export function StreamingIndicator({
  status,
  isStreaming,
}: StreamingIndicatorProps) {
  if (!isStreaming) return null;

  if (status) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted animate-pulse-subtle">
        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span>{status.message || STEP_LABELS[status.currentStep]}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

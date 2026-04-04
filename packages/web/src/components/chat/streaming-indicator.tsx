'use client';

import { useChatStore } from '@/stores/chat-store';
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
 * Cumulative pipeline log — shows all steps like ChatGPT's thinking process.
 * Each completed step shows with a checkmark, the current step pulses.
 */
export function StreamingIndicator({ messageId }: StreamingIndicatorProps) {
  const message = useChatStore((s) => s.messages.find((m) => m.id === messageId));

  if (!message?.isStreaming) return null;

  const status = message.pipelineStatus;
  const steps = status?.steps ?? [];

  if (steps.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="text-sm text-muted">正在处理...</span>
      </div>
    );
  }

  return (
    <div className="space-y-1 py-2">
      {steps.map((entry, i) => {
        const isLast = i === steps.length - 1;
        const label = entry.message || STEP_LABELS[entry.step] || entry.step;

        return (
          <div key={`${entry.step}-${i}`} className="flex items-center gap-2">
            {isLast ? (
              /* Current step — pulsing dot */
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            ) : (
              /* Completed step — checkmark */
              <Icon name="check" size={10} className="text-emerald-500 shrink-0" />
            )}
            <span className={`text-sm ${isLast ? 'text-foreground' : 'text-muted'}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

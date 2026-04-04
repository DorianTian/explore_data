'use client';

import { Icon } from '@/components/shared/icon';
import { Tooltip } from '@/components/ui';
import { useChatStore } from '@/stores/chat-store';

interface MessageFeedbackProps {
  messageId: string;
  feedback?: 'accepted' | 'rejected';
  isGolden?: boolean;
  sql?: string;
}

export function MessageFeedback({
  messageId,
  feedback,
  isGolden,
  sql,
}: MessageFeedbackProps) {
  const setFeedback = useChatStore((s) => s.setFeedback);
  const setGolden = useChatStore((s) => s.setGolden);

  if (!sql) return null;

  return (
    <div className="flex items-center gap-1 mt-2">
      <Tooltip content="标记正确">
        <button
          onClick={() => setFeedback(messageId, 'accepted')}
          className={`p-1.5 rounded-[var(--radius-md)] transition-colors cursor-pointer ${
            feedback === 'accepted'
              ? 'text-success bg-emerald-50 dark:bg-emerald-950'
              : 'text-muted hover:text-foreground hover:bg-surface'
          }`}
        >
          <Icon name="thumbUp" size={14} />
        </button>
      </Tooltip>

      <Tooltip content="标记错误">
        <button
          onClick={() => setFeedback(messageId, 'rejected')}
          className={`p-1.5 rounded-[var(--radius-md)] transition-colors cursor-pointer ${
            feedback === 'rejected'
              ? 'text-error bg-red-50 dark:bg-red-950'
              : 'text-muted hover:text-foreground hover:bg-surface'
          }`}
        >
          <Icon name="thumbDown" size={14} />
        </button>
      </Tooltip>

      {feedback === 'accepted' && (
        <Tooltip
          content={
            isGolden ? '移出 Golden SQL' : '标为 Golden SQL（训练样本）'
          }
        >
          <button
            onClick={() => setGolden(messageId, !isGolden)}
            className={`p-1.5 rounded-[var(--radius-md)] transition-colors cursor-pointer ${
              isGolden
                ? 'text-golden bg-golden-bg'
                : 'text-muted hover:text-foreground hover:bg-surface'
            }`}
          >
            <Icon name="star" size={14} filled={isGolden} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

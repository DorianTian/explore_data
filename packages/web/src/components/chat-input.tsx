'use client';

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-resize textarea height */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-surface px-4 py-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的数据问题..."
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none disabled:opacity-50 leading-relaxed max-h-[200px]"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className={`
              shrink-0 flex items-center justify-center
              w-8 h-8 rounded-lg transition-all duration-150
              ${
                value.trim() && !disabled
                  ? 'bg-primary text-white hover:bg-primary-hover shadow-sm'
                  : 'bg-surface-hover text-muted cursor-not-allowed'
              }
            `}
            title="发送"
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-muted mt-1.5 text-center">
          Enter 发送，Shift + Enter 换行
        </p>
      </div>
    </div>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M.989 2.524a.75.75 0 01.87-.264l12 5a.75.75 0 010 1.38l-12 5.5a.75.75 0 01-1.037-.876L2.776 8.5H7.25a.75.75 0 000-1.5H2.776L.822 2.637A.75.75 0 01.989 2.524z" />
    </svg>
  );
}

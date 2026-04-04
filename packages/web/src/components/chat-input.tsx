'use client';

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { Icon } from '@/components/shared/icon';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = '描述你想查询的数据...',
  autoFocus = false,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  /* Auto-resize textarea height */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
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

  const canSend = value.trim() && !disabled;

  return (
    <div
      className="relative flex items-end rounded-xl border border-border bg-background shadow-sm
        focus-within:border-border-strong focus-within:shadow-md transition-all"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground
          focus:outline-none disabled:opacity-50 leading-relaxed max-h-[160px] px-4 py-3"
      />
      <div className="flex items-center gap-1 pr-2 pb-2">
        <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline select-none">
          {value.trim() ? '⏎ 发送' : '⇧⏎ 换行'}
        </span>
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 ${
            canSend
              ? 'bg-foreground text-background hover:opacity-80'
              : 'bg-surface text-muted-foreground cursor-not-allowed'
          }`}
          title="发送"
        >
          <Icon name="arrowUp" size={14} />
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Icon } from '@/components/shared/icon';

/**
 * Global Cmd+K quick chat dialog.
 * Opens an overlay input from any page; submits navigate to /chat with the query.
 */
export function QuickChatDialog() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  /* Cmd+K to toggle */
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  /* Focus input when opened */
  useEffect(() => {
    if (open) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setOpen(false);

    if (pathname === '/chat') {
      /* Already on chat page — dispatch custom event for ChatPageInner to pick up */
      window.dispatchEvent(new CustomEvent('quick-chat', { detail: trimmed }));
    } else {
      /* Navigate to chat with query param */
      router.push(`/chat?q=${encodeURIComponent(trimmed)}`);
    }
  }, [value, pathname, router]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="fixed inset-x-0 top-[20%] z-50 flex justify-center px-4 animate-scale-in">
        <div className="w-full max-w-xl rounded-xl border border-border bg-background shadow-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <Icon name="search" size={18} className="text-muted shrink-0" />
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入数据查询问题..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] text-muted-foreground bg-surface border border-border font-mono select-none">
              ESC
            </kbd>
          </div>
          {value.trim() && (
            <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs text-muted">
                ⏎ 前往对话页查询
              </span>
              <button
                onClick={handleSubmit}
                className="text-xs text-primary hover:text-primary-hover font-medium cursor-pointer"
              >
                发送查询
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

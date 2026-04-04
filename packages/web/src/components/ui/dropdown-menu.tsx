'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
}

export function DropdownMenu({
  trigger,
  children,
  align = 'left',
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={`absolute z-50 top-full mt-1 min-w-[180px] rounded-[var(--radius-md)] border border-border bg-background shadow-lg py-1 animate-fade-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  variant = 'default',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
        variant === 'danger'
          ? 'text-error hover:bg-red-50 dark:hover:bg-red-950'
          : 'text-foreground hover:bg-surface'
      }`}
    >
      {children}
    </button>
  );
}

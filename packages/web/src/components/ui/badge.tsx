'use client';

import type { ReactNode } from 'react';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'golden';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface text-muted border border-border',
  success:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  warning:
    'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  error: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  golden: 'bg-golden-bg text-yellow-700 dark:text-yellow-300',
};

export function Badge({
  variant = 'default',
  children,
  className = '',
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-full)] px-2 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

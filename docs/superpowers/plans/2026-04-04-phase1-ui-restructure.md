# Phase 1: UI Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the NL2SQL frontend from prototype layout to enterprise-grade two-column interface with real SSE streaming, rich messages, and tri-state feedback.

**Architecture:** Refactor the monolithic page.tsx into composable components. Introduce a proper design system with UI primitives. Replace simulated streaming with real SSE. Extend the feedback model from binary to tri-state with golden query support.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, Zustand 5, ECharts 6

---

## Task 1: Design System Primitives

**Files:**
- Create: `packages/web/src/components/ui/button.tsx`
- Create: `packages/web/src/components/ui/input.tsx`
- Create: `packages/web/src/components/ui/select.tsx`
- Create: `packages/web/src/components/ui/tabs.tsx`
- Create: `packages/web/src/components/ui/dialog.tsx`
- Create: `packages/web/src/components/ui/badge.tsx`
- Create: `packages/web/src/components/ui/tooltip.tsx`
- Create: `packages/web/src/components/ui/dropdown-menu.tsx`
- Create: `packages/web/src/components/ui/index.ts`
- Modify: `packages/web/src/app/globals.css`

- [ ] **Step 1: Upgrade design tokens in globals.css**

Add expanded token set to the existing `:root` and `.dark` blocks. Keep existing tokens, add new ones for the expanded system:

```css
/* Add to existing :root block */
:root {
  /* ... existing tokens stay ... */

  /* Expanded spacing scale */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Typography scale */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;

  /* Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

  /* Panel */
  --panel-width: 420px;
  --panel-collapsed-width: 0px;
  --sidebar-width: 280px;

  /* New semantic colors */
  --warning: #d97706;
  --info: #2563eb;
  --golden: #eab308;
  --golden-bg: #fefce8;
}

[data-theme="dark"] {
  /* ... existing dark tokens stay ... */
  --warning: #fbbf24;
  --info: #60a5fa;
  --golden: #facc15;
  --golden-bg: #422006;
}
```

- [ ] **Step 2: Create Button primitive**

```typescript
// packages/web/src/components/ui/button.tsx
'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover active:scale-[0.98] shadow-sm',
  secondary:
    'bg-surface text-foreground border border-border hover:bg-surface-hover',
  ghost: 'text-muted hover:text-foreground hover:bg-surface',
  danger: 'bg-error text-white hover:opacity-90',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
  icon: 'h-9 w-9 justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex items-center rounded-[var(--radius-md)] font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
```

- [ ] **Step 3: Create Input primitive**

```typescript
// packages/web/src/components/ui/input.tsx
'use client';

import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`h-9 w-full rounded-[var(--radius-md)] border px-3 text-sm bg-background text-foreground placeholder:text-muted outline-none transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary ${
          error ? 'border-error' : 'border-border'
        } ${className}`}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
```

- [ ] **Step 4: Create Tabs primitive**

```typescript
// packages/web/src/components/ui/tabs.tsx
'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface TabsContextValue {
  active: string;
  setActive: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useTabs must be within <Tabs>');
  return ctx;
}

export function Tabs({
  defaultValue,
  value,
  onChange,
  children,
  className = '',
}: {
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? '');
  const active = value ?? internal;
  const setActive = (v: string) => {
    setInternal(v);
    onChange?.(v);
  };

  return (
    <TabsContext value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsContext>
  );
}

export function TabsList({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex border-b border-border ${className}`}
      role="tablist"
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className = '',
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { active, setActive } = useTabs();
  const isActive = active === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActive(value)}
      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer ${
        isActive
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted hover:text-foreground'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className = '',
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { active } = useTabs();
  if (active !== value) return null;
  return <div className={className}>{children}</div>;
}
```

- [ ] **Step 5: Create Dialog primitive**

```typescript
// packages/web/src/components/ui/dialog.tsx
'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ open, onClose, children }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-background rounded-[var(--radius-lg)] shadow-lg border border-border w-full max-w-lg mx-4 animate-slide-up">
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-6 pt-6 pb-2 ${className}`}>{children}</div>;
}

export function DialogTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold text-foreground">{children}</h2>;
}

export function DialogBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

export function DialogFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-6 pb-6 pt-2 flex justify-end gap-3 ${className}`}>{children}</div>;
}
```

- [ ] **Step 6: Create Badge, Tooltip, Select, DropdownMenu primitives**

```typescript
// packages/web/src/components/ui/badge.tsx
'use client';

import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'golden';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface text-muted border border-border',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  error: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  golden: 'bg-[var(--golden-bg)] text-yellow-700 dark:text-yellow-300',
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
```

```typescript
// packages/web/src/components/ui/tooltip.tsx
'use client';

import { useState, useRef, type ReactNode } from 'react';

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const positionClass: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setShow(true), 300);
      }}
      onMouseLeave={() => {
        clearTimeout(timeoutRef.current);
        setShow(false);
      }}
    >
      {children}
      {show && (
        <div
          className={`absolute z-50 px-2.5 py-1.5 text-xs rounded-[var(--radius-md)] bg-zinc-900 text-white shadow-md whitespace-nowrap animate-fade-in pointer-events-none ${positionClass[side]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
```

```typescript
// packages/web/src/components/ui/select.tsx
'use client';

import { type SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, placeholder, className = '', ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`h-9 w-full rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  },
);
Select.displayName = 'Select';
```

```typescript
// packages/web/src/components/ui/dropdown-menu.tsx
'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
}

export function DropdownMenu({ trigger, children, align = 'left' }: DropdownMenuProps) {
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
```

- [ ] **Step 7: Create barrel export**

```typescript
// packages/web/src/components/ui/index.ts
export { Button } from './button';
export { Input } from './input';
export { Select } from './select';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
export { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from './dialog';
export { Badge } from './badge';
export { Tooltip } from './tooltip';
export { DropdownMenu, DropdownMenuItem } from './dropdown-menu';
```

- [ ] **Step 8: Verify build**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm --filter web build`
Expected: Build passes with no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/components/ui/ packages/web/src/app/globals.css
git commit -m "feat(web): add design system primitives — button, input, tabs, dialog, badge, tooltip, select, dropdown"
```

---

## Task 2: Icon System

**Files:**
- Create: `packages/web/src/components/shared/icon.tsx`

- [ ] **Step 1: Create icon component**

Replace scattered inline SVGs with a centralized icon system. Use a map of SVG paths keyed by name.

```typescript
// packages/web/src/components/shared/icon.tsx
'use client';

const icons = {
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  database: 'M12 2C6.48 2 2 4.24 2 7v10c0 2.76 4.48 5 10 5s10-2.24 10-5V7c0-2.76-4.48-5-10-5z M2 12c0 2.76 4.48 5 10 5s10-2.24 10-5',
  chart: 'M18 20V10 M12 20V4 M6 20v-6',
  book: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
  plus: 'M12 5v14 M5 12h14',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  chevronLeft: 'M15 18l-6-6 6-6',
  copy: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M8 2h8v4H8z',
  check: 'M20 6L9 17l-5-5',
  thumbUp: 'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z M4 15h0a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h0',
  thumbDown: 'M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z M20 2h0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h0',
  send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4z',
  x: 'M18 6L6 18 M6 6l12 12',
  search: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  starFilled: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  panelRight: 'M3 3h18v18H3z M15 3v18',
  panelRightClose: 'M3 3h18v18H3z M15 3v18 M10 15l-3-3 3-3',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  play: 'M5 3l14 9-14 9V3z',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8',
  table: 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18',
  layout: 'M3 3h18v18H3z M3 9h18 M9 9v12',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  refresh: 'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  heart: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  golden: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  ellipsis: 'M12 12h.01 M19 12h.01 M5 12h.01',
} as const;

export type IconName = keyof typeof icons;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 16, className = '', strokeWidth = 2 }: IconProps) {
  const d = icons[name];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === 'starFilled' || name === 'golden' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {d.split(' M').map((segment, i) => (
        <path key={i} d={i === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/shared/icon.tsx
git commit -m "feat(web): add centralized icon system"
```

---

## Task 3: App Shell Layout

**Files:**
- Create: `packages/web/src/components/layout/app-shell.tsx`
- Modify: `packages/web/src/components/sidebar.tsx` → move to `packages/web/src/components/layout/sidebar.tsx`
- Create: `packages/web/src/components/layout/panel.tsx`
- Modify: `packages/web/src/app/layout.tsx`
- Create: `packages/web/src/stores/panel-store.ts`

- [ ] **Step 1: Create panel store**

```typescript
// packages/web/src/stores/panel-store.ts
import { create } from 'zustand';

export type PanelTab = 'detail' | 'schema' | 'history';

interface PanelState {
  isOpen: boolean;
  activeTab: PanelTab;
  selectedMessageId: string | null;
}

interface PanelActions {
  togglePanel: () => void;
  openPanel: (tab?: PanelTab) => void;
  closePanel: () => void;
  setActiveTab: (tab: PanelTab) => void;
  selectMessage: (messageId: string) => void;
  clearSelection: () => void;
}

export const usePanelStore = create<PanelState & PanelActions>((set) => ({
  isOpen: false,
  activeTab: 'detail',
  selectedMessageId: null,

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  openPanel: (tab) =>
    set((s) => ({ isOpen: true, activeTab: tab ?? s.activeTab })),
  closePanel: () => set({ isOpen: false }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectMessage: (messageId) =>
    set({ selectedMessageId: messageId, isOpen: true, activeTab: 'detail' }),
  clearSelection: () => set({ selectedMessageId: null }),
}));
```

- [ ] **Step 2: Create AppShell layout component**

```typescript
// packages/web/src/components/layout/app-shell.tsx
'use client';

import { type ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { usePanelStore } from '@/stores/panel-store';

interface AppShellProps {
  children: ReactNode;
  panel?: ReactNode;
}

export function AppShell({ children, panel }: AppShellProps) {
  const isOpen = usePanelStore((s) => s.isOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>

      {/* Right panel */}
      {panel && (
        <aside
          className={`border-l border-border bg-background overflow-hidden transition-[width] duration-200 ease-in-out ${
            isOpen ? 'w-[var(--panel-width)]' : 'w-0'
          }`}
        >
          <div className="w-[var(--panel-width)] h-full overflow-hidden">
            {panel}
          </div>
        </aside>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Move and update Sidebar**

Move `packages/web/src/components/sidebar.tsx` to `packages/web/src/components/layout/sidebar.tsx`.

Refactor to use new UI primitives and add conversation list. The sidebar now has two sections: top (project/datasource selectors) and bottom (nav + conversations list).

```typescript
// packages/web/src/components/layout/sidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { usePanelStore } from '@/stores/panel-store';
import { Icon, type IconName } from '@/components/shared/icon';
import { Button } from '@/components/ui';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { href: '/', label: '对话', icon: 'message' },
  { href: '/schema', label: '数据源', icon: 'database' },
  { href: '/metrics', label: '指标', icon: 'chart' },
  { href: '/knowledge', label: '知识库', icon: 'book' },
  { href: '/dashboard', label: '看板', icon: 'layout' },
];

export function Sidebar() {
  const pathname = usePathname();
  const {
    projects,
    datasources,
    currentProjectId,
    currentDatasourceId,
    setCurrentProject,
    setCurrentDatasource,
    fetchProjects,
    fetchDatasources,
    createProject,
    createDatasource,
  } = useProjectStore();

  const togglePanel = usePanelStore((s) => s.togglePanel);
  const isPanelOpen = usePanelStore((s) => s.isOpen);

  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewDatasource, setShowNewDatasource] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newDsName, setNewDsName] = useState('');
  const [newDsDialect, setNewDsDialect] = useState<string>('postgresql');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (currentProjectId) fetchDatasources(currentProjectId);
  }, [currentProjectId, fetchDatasources]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    await createProject(newProjectName.trim());
    setNewProjectName('');
    setShowNewProject(false);
  };

  const handleCreateDatasource = async () => {
    if (!newDsName.trim()) return;
    await createDatasource(newDsName.trim(), newDsDialect);
    setNewDsName('');
    setShowNewDatasource(false);
  };

  return (
    <aside className="w-[var(--sidebar-width)] flex flex-col border-r border-border bg-[var(--sidebar-bg)] h-full">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border">
        <h1 className="text-lg font-bold text-foreground tracking-tight">NL2SQL</h1>
        <p className="text-xs text-muted mt-0.5">智能数据查询平台</p>
      </div>

      {/* Project / Datasource selectors */}
      <div className="px-3 py-3 border-b border-border space-y-2">
        <div>
          <label className="block text-xs text-muted mb-1 px-1">项目</label>
          <select
            value={currentProjectId ?? ''}
            onChange={(e) => setCurrentProject(e.target.value || null)}
            className="w-full h-8 rounded-[var(--radius-md)] border border-border bg-background px-2 text-sm text-foreground outline-none"
          >
            <option value="">选择项目...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {!showNewProject ? (
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-1 cursor-pointer"
          >
            <Icon name="plus" size={12} /> 新建项目
          </button>
        ) : (
          <div className="flex gap-1">
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="项目名称"
              className="flex-1 h-7 rounded border border-border bg-background px-2 text-xs outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              autoFocus
            />
            <Button size="sm" onClick={handleCreateProject}>创建</Button>
          </div>
        )}

        {currentProjectId && (
          <>
            <div>
              <label className="block text-xs text-muted mb-1 px-1">数据源</label>
              <select
                value={currentDatasourceId ?? ''}
                onChange={(e) => setCurrentDatasource(e.target.value || null)}
                className="w-full h-8 rounded-[var(--radius-md)] border border-border bg-background px-2 text-sm text-foreground outline-none"
              >
                <option value="">选择数据源...</option>
                {datasources.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {!showNewDatasource ? (
              <button
                onClick={() => setShowNewDatasource(true)}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-1 cursor-pointer"
              >
                <Icon name="plus" size={12} /> 新建数据源
              </button>
            ) : (
              <div className="space-y-1">
                <input
                  value={newDsName}
                  onChange={(e) => setNewDsName(e.target.value)}
                  placeholder="数据源名称"
                  className="w-full h-7 rounded border border-border bg-background px-2 text-xs outline-none"
                  autoFocus
                />
                <div className="flex gap-1">
                  <select
                    value={newDsDialect}
                    onChange={(e) => setNewDsDialect(e.target.value)}
                    className="flex-1 h-7 rounded border border-border bg-background px-2 text-xs outline-none"
                  >
                    {['postgresql', 'mysql', 'hive', 'sparksql', 'flinksql'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <Button size="sm" onClick={handleCreateDatasource}>创建</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--surface-hover)] text-foreground font-medium'
                  : 'text-muted hover:bg-surface hover:text-foreground'
              }`}
            >
              <Icon
                name={item.icon}
                size={18}
                className={isActive ? 'text-primary' : ''}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Panel toggle (visible on chat page) */}
      {pathname === '/' && (
        <div className="px-3 py-2 border-t border-border">
          <button
            onClick={togglePanel}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-[var(--radius-md)] text-sm text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
          >
            <Icon name={isPanelOpen ? 'panelRightClose' : 'panelRight'} size={16} />
            {isPanelOpen ? '收起面板' : '展开面板'}
          </button>
        </div>
      )}

      {/* Version */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-muted">NL2SQL v2.0</p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Create panel container (placeholder — detail implementation in Phase 2)**

```typescript
// packages/web/src/components/layout/panel.tsx
'use client';

import { usePanelStore } from '@/stores/panel-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

export function Panel() {
  const { activeTab, setActiveTab } = usePanelStore();

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onChange={(v) => setActiveTab(v as 'detail' | 'schema' | 'history')}>
        <TabsList className="px-2 flex-shrink-0">
          <TabsTrigger value="detail">
            <span className="flex items-center gap-1.5">
              <Icon name="table" size={14} />
              详情
            </span>
          </TabsTrigger>
          <TabsTrigger value="schema">
            <span className="flex items-center gap-1.5">
              <Icon name="database" size={14} />
              Schema
            </span>
          </TabsTrigger>
          <TabsTrigger value="history">
            <span className="flex items-center gap-1.5">
              <Icon name="clock" size={14} />
              历史
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detail" className="flex-1 overflow-y-auto p-4">
          <div className="text-sm text-muted text-center py-8">
            点击消息查看详情
          </div>
        </TabsContent>

        <TabsContent value="schema" className="flex-1 overflow-y-auto p-4">
          <div className="text-sm text-muted text-center py-8">
            选择数据源查看 Schema
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-y-auto p-4">
          <div className="text-sm text-muted text-center py-8">
            查询历史
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 5: Update root layout**

```typescript
// packages/web/src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NL2SQL - 智能数据查询平台',
  description: '用自然语言查询数据',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm --filter web build`
Expected: Build passes.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/layout/ packages/web/src/stores/panel-store.ts packages/web/src/app/layout.tsx
git commit -m "feat(web): add app shell layout with sidebar, panel framework, and panel store"
```

---

## Task 4: Chat Store Upgrade

**Files:**
- Modify: `packages/web/src/stores/chat-store.ts`

- [ ] **Step 1: Extend chat store with streaming state and message selection**

```typescript
// packages/web/src/stores/chat-store.ts
import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  confidence?: number;
  feedback?: 'accepted' | 'rejected';
  isGolden?: boolean;
  isStreaming?: boolean;
  executionResult?: {
    rows: Record<string, unknown>[];
    columns: Array<{ name: string; dataType: string }>;
    truncated: boolean;
    executionTimeMs?: number;
  };
  chartRecommendation?: {
    chartType: string;
    config: unknown;
  };
  tablesUsed?: string[];
  pipelineStatus?: PipelineStatus;
}

export type PipelineStep =
  | 'intent_classification'
  | 'schema_linking'
  | 'sql_generation'
  | 'sql_validation'
  | 'error_recovery'
  | 'executing';

export interface PipelineStatus {
  currentStep: PipelineStep;
  message: string;
  completedSteps: PipelineStep[];
}

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  conversationId: string | null;
  selectedMessageId: string | null;
}

interface ChatActions {
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
  setConversationId: (id: string | null) => void;
  setFeedback: (id: string, feedback: 'accepted' | 'rejected') => void;
  setGolden: (id: string, isGolden: boolean) => void;
  selectMessage: (id: string | null) => void;
  appendContent: (id: string, chunk: string) => void;
  setPipelineStatus: (id: string, status: PipelineStatus) => void;
}

export const useChatStore = create<ChatState & ChatActions>((set) => ({
  messages: [],
  loading: false,
  conversationId: null,
  selectedMessageId: null,

  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),

  updateMessage: (id, updates) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      ),
    })),

  setLoading: (loading) => set({ loading }),

  clearMessages: () =>
    set({ messages: [], conversationId: null, selectedMessageId: null }),

  setConversationId: (conversationId) => set({ conversationId }),

  setFeedback: (id, feedback) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, feedback } : m,
      ),
    })),

  setGolden: (id, isGolden) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, isGolden } : m,
      ),
    })),

  selectMessage: (selectedMessageId) => set({ selectedMessageId }),

  appendContent: (id, chunk) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + chunk } : m,
      ),
    })),

  setPipelineStatus: (id, pipelineStatus) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, pipelineStatus } : m,
      ),
    })),
}));
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/stores/chat-store.ts
git commit -m "feat(web): upgrade chat store — tri-state feedback, pipeline status, message selection"
```

---

## Task 5: SSE Streaming Client

**Files:**
- Create: `packages/web/src/lib/sse.ts`
- Create: `packages/web/src/hooks/use-sse-stream.ts`

- [ ] **Step 1: Create SSE parser utility**

```typescript
// packages/web/src/lib/sse.ts

export interface SSEEvent {
  event: string;
  data: unknown;
}

export type SSEHandler = (event: SSEEvent) => void;

/**
 * Connect to an SSE endpoint using fetch + ReadableStream.
 * Returns an abort function.
 */
export function connectSSE(
  url: string,
  body: unknown,
  onEvent: SSEHandler,
  onError: (error: Error) => void,
  onDone: () => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6).trim();
          } else if (line === '' && currentEvent && currentData) {
            try {
              const parsed = JSON.parse(currentData);
              onEvent({ event: currentEvent, data: parsed });
            } catch {
              onEvent({ event: currentEvent, data: currentData });
            }
            currentEvent = '';
            currentData = '';
          }
        }
      }

      onDone();
    } catch (err) {
      if (controller.signal.aborted) return;
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return () => controller.abort();
}
```

- [ ] **Step 2: Create SSE streaming hook**

```typescript
// packages/web/src/hooks/use-sse-stream.ts
'use client';

import { useCallback, useRef } from 'react';
import { connectSSE, type SSEEvent } from '@/lib/sse';
import { useChatStore, type PipelineStep } from '@/stores/chat-store';
import { usePanelStore } from '@/stores/panel-store';
import { useProjectStore } from '@/stores/project-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100';

export function useSSEStream() {
  const abortRef = useRef<(() => void) | null>(null);

  const {
    addMessage,
    updateMessage,
    setLoading,
    setConversationId,
    setPipelineStatus,
    conversationId,
  } = useChatStore();

  const { selectMessage } = usePanelStore();
  const { currentProjectId, currentDatasourceId } = useProjectStore();

  const sendQuery = useCallback(
    (query: string, conversationHistory: Array<{ role: string; content: string; sql?: string }>) => {
      if (!currentProjectId || !currentDatasourceId) return;

      // Abort previous stream if any
      abortRef.current?.();

      const userMessageId = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID();

      // Add user message
      addMessage({
        id: userMessageId,
        role: 'user',
        content: query,
      });

      // Add placeholder assistant message
      addMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      setLoading(true);

      const handleEvent = (event: SSEEvent) => {
        const data = event.data as Record<string, unknown>;

        switch (event.event) {
          case 'conversation':
            setConversationId(data.id as string);
            break;

          case 'status':
            setPipelineStatus(assistantMessageId, {
              currentStep: data.step as PipelineStep,
              message: data.message as string,
              completedSteps: [],
            });
            break;

          case 'result': {
            updateMessage(assistantMessageId, {
              content: (data.explanation as string) ?? '',
              sql: data.sql as string | undefined,
              confidence: data.confidence as number | undefined,
              tablesUsed: data.tablesUsed as string[] | undefined,
              isStreaming: false,
              pipelineStatus: undefined,
            });

            // Auto-select in panel
            selectMessage(assistantMessageId);
            break;
          }

          case 'execution_result':
            updateMessage(assistantMessageId, {
              executionResult: data as ChatMessage['executionResult'],
            });
            break;

          case 'chart':
            updateMessage(assistantMessageId, {
              chartRecommendation: data as ChatMessage['chartRecommendation'],
            });
            break;

          case 'error':
            updateMessage(assistantMessageId, {
              content: `查询出错: ${data.message}`,
              isStreaming: false,
              pipelineStatus: undefined,
            });
            break;
        }
      };

      const handleError = (error: Error) => {
        updateMessage(assistantMessageId, {
          content: `连接失败: ${error.message}`,
          isStreaming: false,
          pipelineStatus: undefined,
        });
        setLoading(false);
      };

      const handleDone = () => {
        setLoading(false);
      };

      abortRef.current = connectSSE(
        `${API_BASE}/api/query/stream`,
        {
          projectId: currentProjectId,
          datasourceId: currentDatasourceId,
          query,
          conversationId,
          conversationHistory,
        },
        handleEvent,
        handleError,
        handleDone,
      );
    },
    [
      currentProjectId,
      currentDatasourceId,
      conversationId,
      addMessage,
      updateMessage,
      setLoading,
      setConversationId,
      setPipelineStatus,
      selectMessage,
    ],
  );

  const abort = useCallback(() => {
    abortRef.current?.();
    setLoading(false);
  }, [setLoading]);

  return { sendQuery, abort };
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/sse.ts packages/web/src/hooks/use-sse-stream.ts
git commit -m "feat(web): add SSE streaming client with pipeline status tracking"
```

---

## Task 6: Rich Chat Message Components

**Files:**
- Create: `packages/web/src/components/chat/message-sql-block.tsx`
- Create: `packages/web/src/components/chat/message-result-preview.tsx`
- Create: `packages/web/src/components/chat/message-chart-preview.tsx`
- Create: `packages/web/src/components/chat/message-feedback.tsx`
- Create: `packages/web/src/components/chat/streaming-indicator.tsx`
- Create: `packages/web/src/components/chat/follow-up-suggestions.tsx`

- [ ] **Step 1: Create SQL block component with expand affordance**

```typescript
// packages/web/src/components/chat/message-sql-block.tsx
'use client';

import { useState } from 'react';
import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui';
import { usePanelStore } from '@/stores/panel-store';

interface MessageSqlBlockProps {
  sql: string;
  messageId: string;
  confidence?: number;
}

const SQL_KEYWORDS =
  /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|GROUP\s+BY|ORDER\s+BY|LIMIT|HAVING|DISTINCT|CASE|WHEN|THEN|ELSE|END|AS|COUNT|SUM|AVG|MIN|MAX|COALESCE|CAST|UNION|ALL|EXISTS|BETWEEN|LIKE|IS|NULL|ASC|DESC|WITH|OVER|PARTITION\s+BY|ROW_NUMBER|RANK|DENSE_RANK|LAG|LEAD)\b/gi;

function highlightSql(sql: string): Array<{ text: string; isKeyword: boolean }> {
  const parts: Array<{ text: string; isKeyword: boolean }> = [];
  let lastIndex = 0;

  sql.replace(SQL_KEYWORDS, (match, _group, offset) => {
    if (offset > lastIndex) {
      parts.push({ text: sql.slice(lastIndex, offset), isKeyword: false });
    }
    parts.push({ text: match.toUpperCase(), isKeyword: true });
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < sql.length) {
    parts.push({ text: sql.slice(lastIndex), isKeyword: false });
  }

  return parts;
}

export function MessageSqlBlock({ sql, messageId, confidence }: MessageSqlBlockProps) {
  const [copied, setCopied] = useState(false);
  const { selectMessage } = usePanelStore();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parts = highlightSql(sql);

  return (
    <div className="mt-3 rounded-[var(--radius-lg)] overflow-hidden border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">SQL</span>
          {confidence !== undefined && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                confidence >= 0.8
                  ? 'bg-emerald-900/50 text-emerald-400'
                  : confidence >= 0.6
                    ? 'bg-amber-900/50 text-amber-400'
                    : 'bg-red-900/50 text-red-400'
              }`}
            >
              {Math.round(confidence * 100)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-white h-7 w-7"
            onClick={() => selectMessage(messageId)}
            title="在面板中编辑"
          >
            <Icon name="edit" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-white h-7 w-7"
            onClick={handleCopy}
          >
            <Icon name={copied ? 'check' : 'copy'} size={14} />
          </Button>
        </div>
      </div>

      {/* SQL Code */}
      <pre className="px-4 py-3 bg-zinc-900 dark:bg-zinc-950 overflow-x-auto">
        <code className="text-[13px] font-mono leading-relaxed">
          {parts.map((part, i) => (
            <span
              key={i}
              className={
                part.isKeyword
                  ? 'text-blue-400 font-semibold'
                  : 'text-emerald-400'
              }
            >
              {part.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
```

- [ ] **Step 2: Create result preview component**

```typescript
// packages/web/src/components/chat/message-result-preview.tsx
'use client';

import { Icon } from '@/components/shared/icon';
import { usePanelStore } from '@/stores/panel-store';

interface MessageResultPreviewProps {
  messageId: string;
  columns: Array<{ name: string; dataType: string }>;
  rows: Record<string, unknown>[];
  truncated: boolean;
  executionTimeMs?: number;
}

export function MessageResultPreview({
  messageId,
  columns,
  rows,
  truncated,
  executionTimeMs,
}: MessageResultPreviewProps) {
  const { selectMessage } = usePanelStore();
  const previewRows = rows.slice(0, 5);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted flex items-center gap-1">
          <Icon name="table" size={12} />
          {rows.length} 行 {truncated ? '(已截断)' : ''} · {columns.length} 列
          {executionTimeMs !== undefined && ` · ${executionTimeMs}ms`}
        </span>
        <button
          onClick={() => selectMessage(messageId)}
          className="text-xs text-primary hover:underline cursor-pointer"
        >
          查看全部
        </button>
      </div>
      <div className="rounded-[var(--radius-md)] border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface">
              {columns.slice(0, 6).map((col) => (
                <th
                  key={col.name}
                  className="px-2 py-1.5 text-left font-medium text-muted border-b border-border truncate max-w-[120px]"
                >
                  {col.name}
                </th>
              ))}
              {columns.length > 6 && (
                <th className="px-2 py-1.5 text-left font-medium text-muted border-b border-border">
                  ...
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {columns.slice(0, 6).map((col) => (
                  <td
                    key={col.name}
                    className="px-2 py-1 text-foreground truncate max-w-[120px] font-mono"
                  >
                    {row[col.name] == null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      String(row[col.name])
                    )}
                  </td>
                ))}
                {columns.length > 6 && (
                  <td className="px-2 py-1 text-muted">...</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create chart preview component**

```typescript
// packages/web/src/components/chat/message-chart-preview.tsx
'use client';

import dynamic from 'next/dynamic';
import { usePanelStore } from '@/stores/panel-store';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface MessageChartPreviewProps {
  messageId: string;
  chartType: string;
  config: Record<string, unknown>;
}

export function MessageChartPreview({
  messageId,
  chartType,
  config,
}: MessageChartPreviewProps) {
  const { selectMessage } = usePanelStore();

  if (chartType === 'kpi') {
    const series = (config.series as Array<{ data: unknown[] }>)?.[0];
    const value = series?.data?.[0];
    return (
      <div
        onClick={() => selectMessage(messageId)}
        className="mt-2 p-4 rounded-[var(--radius-lg)] border border-border bg-surface cursor-pointer hover:bg-surface-hover transition-colors"
      >
        <p className="text-xs text-muted mb-1">{(config.title as Record<string, string>)?.text ?? 'KPI'}</p>
        <p className="text-2xl font-bold text-foreground">{String(value)}</p>
      </div>
    );
  }

  return (
    <div
      onClick={() => selectMessage(messageId)}
      className="mt-2 rounded-[var(--radius-lg)] border border-border overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
    >
      <ReactECharts
        option={config}
        style={{ height: 200 }}
        opts={{ renderer: 'svg' }}
        notMerge
      />
    </div>
  );
}
```

- [ ] **Step 4: Create feedback component (tri-state + golden)**

```typescript
// packages/web/src/components/chat/message-feedback.tsx
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
  const { setFeedback, setGolden } = useChatStore();

  if (!sql) return null;

  return (
    <div className="flex items-center gap-1 mt-2">
      <Tooltip content="标记正确">
        <button
          onClick={() =>
            setFeedback(messageId, feedback === 'accepted' ? undefined! : 'accepted')
          }
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
          onClick={() =>
            setFeedback(messageId, feedback === 'rejected' ? undefined! : 'rejected')
          }
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
        <Tooltip content={isGolden ? '移出 Golden SQL' : '标为 Golden SQL（训练样本）'}>
          <button
            onClick={() => setGolden(messageId, !isGolden)}
            className={`p-1.5 rounded-[var(--radius-md)] transition-colors cursor-pointer ${
              isGolden
                ? 'text-[var(--golden)] bg-[var(--golden-bg)]'
                : 'text-muted hover:text-foreground hover:bg-surface'
            }`}
          >
            <Icon name={isGolden ? 'starFilled' : 'star'} size={14} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create streaming indicator component**

```typescript
// packages/web/src/components/chat/streaming-indicator.tsx
'use client';

import type { PipelineStatus, PipelineStep } from '@/stores/chat-store';
import { Icon } from '@/components/shared/icon';

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

export function StreamingIndicator({ status, isStreaming }: StreamingIndicatorProps) {
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
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create follow-up suggestions component**

```typescript
// packages/web/src/components/chat/follow-up-suggestions.tsx
'use client';

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSelect: (query: string) => void;
}

export function FollowUpSuggestions({ suggestions, onSelect }: FollowUpSuggestionsProps) {
  if (!suggestions.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          onClick={() => onSelect(suggestion)}
          className="px-3 py-1.5 text-xs rounded-[var(--radius-full)] border border-border text-muted hover:text-foreground hover:bg-surface hover:border-primary/30 transition-colors cursor-pointer"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/chat/
git commit -m "feat(web): add rich chat message components — SQL block, result preview, chart preview, feedback, streaming indicator"
```

---

## Task 7: Rewrite Chat Message Component

**Files:**
- Modify: `packages/web/src/components/chat-message.tsx` → `packages/web/src/components/chat/chat-message.tsx`

- [ ] **Step 1: Rewrite chat-message.tsx composing new sub-components**

Move to `packages/web/src/components/chat/chat-message.tsx` and rewrite using the new sub-components:

```typescript
// packages/web/src/components/chat/chat-message.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSqlBlock } from './message-sql-block';
import { MessageResultPreview } from './message-result-preview';
import { MessageChartPreview } from './message-chart-preview';
import { MessageFeedback } from './message-feedback';
import { StreamingIndicator } from './streaming-indicator';
import type { ChatMessage as ChatMessageType } from '@/stores/chat-store';
import { usePanelStore } from '@/stores/panel-store';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { selectedMessageId } = usePanelStore();
  const isSelected = selectedMessageId === message.id;

  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[70%] px-4 py-2.5 rounded-2xl rounded-br-md bg-primary text-white text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-4 ${isSelected ? 'ring-2 ring-primary/20 rounded-[var(--radius-lg)]' : ''}`}>
      <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md bg-surface border border-border">
        {/* Streaming status */}
        {message.isStreaming && !message.content && (
          <StreamingIndicator
            status={message.pipelineStatus}
            isStreaming={message.isStreaming}
          />
        )}

        {/* Markdown content */}
        {message.content && (
          <div className="prose-sm text-sm text-foreground leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 mb-2">{children}</ol>,
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="bg-[var(--surface-hover)] px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <pre className="bg-zinc-900 dark:bg-zinc-950 p-3 rounded-[var(--radius-md)] overflow-x-auto my-2">
                      <code className="text-[13px] font-mono text-zinc-100" {...props}>
                        {children}
                      </code>
                    </pre>
                  );
                },
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="w-full text-sm border-collapse">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border px-3 py-1.5 bg-surface text-left font-medium">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="border border-border px-3 py-1.5">{children}</td>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>

            {/* Streaming cursor */}
            {message.isStreaming && message.content && (
              <span className="inline-block w-2 h-4 bg-primary animate-pulse-subtle ml-0.5" />
            )}
          </div>
        )}

        {/* SQL block */}
        {message.sql && (
          <MessageSqlBlock
            sql={message.sql}
            messageId={message.id}
            confidence={message.confidence}
          />
        )}

        {/* Execution result preview */}
        {message.executionResult && (
          <MessageResultPreview
            messageId={message.id}
            columns={message.executionResult.columns}
            rows={message.executionResult.rows}
            truncated={message.executionResult.truncated}
            executionTimeMs={message.executionResult.executionTimeMs}
          />
        )}

        {/* Chart preview */}
        {message.chartRecommendation &&
          message.chartRecommendation.chartType !== 'table' && (
            <MessageChartPreview
              messageId={message.id}
              chartType={message.chartRecommendation.chartType}
              config={message.chartRecommendation.config as Record<string, unknown>}
            />
          )}

        {/* Feedback */}
        {!message.isStreaming && message.sql && (
          <MessageFeedback
            messageId={message.id}
            feedback={message.feedback}
            isGolden={message.isGolden}
            sql={message.sql}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/chat/chat-message.tsx
git rm packages/web/src/components/chat-message.tsx 2>/dev/null || true
git commit -m "feat(web): rewrite chat message — composed from rich sub-components"
```

---

## Task 8: Rewrite Chat Page

**Files:**
- Modify: `packages/web/src/app/page.tsx`

- [ ] **Step 1: Rewrite page.tsx using AppShell, SSE streaming, and new components**

```typescript
// packages/web/src/app/page.tsx
'use client';

import { useEffect, useRef } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Panel } from '@/components/layout/panel';
import { ChatMessage } from '@/components/chat/chat-message';
import { ChatInput } from '@/components/chat-input';
import { StreamingIndicator } from '@/components/chat/streaming-indicator';
import { ToastProvider } from '@/components/toast';
import { useChatStore } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
import { useSSEStream } from '@/hooks/use-sse-stream';
import { Icon } from '@/components/shared/icon';

const EXAMPLE_QUERIES = [
  '上个月各区域的 GMV 是多少？',
  '最近 7 天日活用户趋势如何？',
  '销量 Top 10 的商品有哪些？',
  '复购率最高的用户群体是哪个城市？',
  '本月订单取消率和上月相比有什么变化？',
  '客单价最高的渠道是哪个？',
];

function ChatPageInner() {
  const { messages, loading, clearMessages } = useChatStore();
  const { currentProjectId, currentDatasourceId } = useProjectStore();
  const { sendQuery } = useSSEStream();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (query: string) => {
    if (!currentProjectId || !currentDatasourceId) return;

    const conversationHistory = messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.isStreaming))
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.content,
        sql: m.sql,
      }));

    sendQuery(query, conversationHistory);
  };

  const hasContext = currentProjectId && currentDatasourceId;

  return (
    <AppShell panel={<Panel />}>
      <ToastProvider>
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">对话</h2>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              新对话
            </button>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Icon name="message" size={24} className="text-primary" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                用自然语言查询数据
              </h3>
              <p className="text-sm text-muted text-center mb-6">
                {hasContext
                  ? '输入你的问题，或试试下面的示例：'
                  : '请先在左侧选择项目和数据源'}
              </p>

              {hasContext && (
                <div className="grid grid-cols-2 gap-2 w-full">
                  {EXAMPLE_QUERIES.map((query) => (
                    <button
                      key={query}
                      onClick={() => handleSend(query)}
                      className="text-left text-sm px-3 py-2.5 rounded-[var(--radius-md)] border border-border text-muted hover:text-foreground hover:bg-surface hover:border-primary/30 transition-colors cursor-pointer"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-border px-6 py-3">
          <ChatInput
            onSend={handleSend}
            disabled={loading || !hasContext}
          />
        </div>
      </ToastProvider>
    </AppShell>
  );
}

export default function ChatPage() {
  return <ChatPageInner />;
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm --filter web build`
Expected: Build passes.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/app/page.tsx
git commit -m "feat(web): rewrite chat page with AppShell layout, SSE streaming, and rich messages"
```

---

## Task 9: Backend — Feedback Tri-State Migration

**Files:**
- Create: `packages/db/src/schema/query-history-upgrade.sql` (reference only)
- Modify: `packages/db/src/schema/conversations.ts`
- Modify: `packages/api/src/routes/query.ts`
- Modify: `packages/api/src/services/conversation-service.ts`

- [ ] **Step 1: Update query_history schema in Drizzle**

Add `status` and `isGolden` columns to query_history in `packages/db/src/schema/conversations.ts`:

```typescript
// In packages/db/src/schema/conversations.ts
// Add to queryHistory table definition:

// After the existing columnsUsed field, add:
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  isGolden: boolean('is_golden').default(false).notNull(),
```

- [ ] **Step 2: Generate migration**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm --filter @nl2sql/db drizzle-kit generate`
Expected: New migration SQL file generated in `packages/db/drizzle/`

- [ ] **Step 3: Run migration**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm --filter @nl2sql/db drizzle-kit migrate`
Expected: Migration applies successfully.

- [ ] **Step 4: Update feedback API in query.ts**

Replace the existing `feedbackSchema` and POST `/api/query/feedback` handler:

```typescript
// In packages/api/src/routes/query.ts
// Replace feedbackSchema:
const feedbackSchema = z.object({
  projectId: z.string().uuid(),
  naturalLanguage: z.string(),
  generatedSql: z.string(),
  correctedSql: z.string().optional(),
  status: z.enum(['accepted', 'pending', 'rejected']),
  isGolden: z.boolean().optional(),
});

// Replace feedback handler:
router.post('/api/query/feedback', async (ctx) => {
  const parsed = feedbackSchema.safeParse(ctx.request.body);
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
    };
    return;
  }

  const conversationService = new ConversationService(ctx.state.db);
  const record = await conversationService.recordQuery(parsed.data.projectId, {
    naturalLanguage: parsed.data.naturalLanguage,
    generatedSql: parsed.data.generatedSql,
    correctedSql: parsed.data.correctedSql,
    status: parsed.data.status,
    isGolden: parsed.data.isGolden ?? false,
  });

  ctx.body = { success: true, data: record };
});
```

- [ ] **Step 5: Update ConversationService.recordQuery**

In `packages/api/src/services/conversation-service.ts`, update the `recordQuery` method to accept `status` and `isGolden`:

```typescript
// Update recordQuery signature and implementation:
async recordQuery(projectId: string, input: {
  naturalLanguage: string;
  generatedSql: string;
  correctedSql?: string;
  status?: string;
  isGolden?: boolean;
  tablesUsed?: string[];
  columnsUsed?: string[];
}): Promise<QueryHistoryRecord> {
  const [record] = await this.db
    .insert(queryHistory)
    .values({
      projectId: input.projectId ?? projectId,
      naturalLanguage: input.naturalLanguage,
      generatedSql: input.generatedSql,
      correctedSql: input.correctedSql,
      status: input.status ?? 'pending',
      isGolden: input.isGolden ?? false,
      tablesUsed: input.tablesUsed,
      columnsUsed: input.columnsUsed,
    })
    .returning();

  return record;
}
```

- [ ] **Step 6: Add query history list endpoint**

Add to `packages/api/src/routes/query.ts`:

```typescript
// GET /api/query/history — list query history for a project
router.get('/api/query/history', async (ctx) => {
  const projectId = ctx.query.projectId as string;
  if (!projectId) {
    ctx.status = 400;
    ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: 'projectId required' } };
    return;
  }

  const conversationService = new ConversationService(ctx.state.db);
  const records = await conversationService.listQueryHistory(projectId);
  ctx.body = { success: true, data: records };
});
```

Add to `ConversationService`:

```typescript
async listQueryHistory(projectId: string): Promise<QueryHistoryRecord[]> {
  return this.db
    .select()
    .from(queryHistory)
    .where(eq(queryHistory.projectId, projectId))
    .orderBy(desc(queryHistory.createdAt))
    .limit(100);
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/conversations.ts packages/db/drizzle/ packages/api/src/routes/query.ts packages/api/src/services/conversation-service.ts
git commit -m "feat(api): add tri-state feedback (accepted/pending/rejected) + golden SQL + query history endpoint"
```

---

## Task 10: Update SSE Backend to Stream Pipeline Steps

**Files:**
- Modify: `packages/api/src/routes/query.ts`

- [ ] **Step 1: Enhance SSE streaming to send granular pipeline status**

In `POST /api/query/stream`, add more granular status events and send execution results + chart recommendations as separate events:

After the pipeline result is generated and validated, add:

```typescript
// After sending the 'result' event, add execution and chart events:

// Execute SQL if datasource has connection config
if (finalResult.sql) {
  try {
    sendSSE(stream, 'status', { step: 'executing', message: '正在执行查询...' });

    const { QueryExecutor } = await import('@nl2sql/engine');
    const ds = await datasourceService.getById(parsed.data.datasourceId);
    if (ds?.connectionConfig) {
      const executor = new QueryExecutor();
      const execResult = await executor.execute(finalResult.sql, ds.connectionConfig, {
        timeoutMs: 30000,
        maxRows: 1000,
      });

      sendSSE(stream, 'execution_result', {
        rows: execResult.rows,
        columns: execResult.columns,
        truncated: execResult.truncated,
        executionTimeMs: execResult.executionTimeMs,
      });

      // Chart recommendation
      const { ChartRecommender } = await import('@nl2sql/engine');
      const recommender = new ChartRecommender();
      const chart = recommender.recommend(execResult.rows, execResult.columns);
      if (chart) {
        sendSSE(stream, 'chart', {
          chartType: chart.chartType,
          config: chart.config,
        });
      }

      // Save execution result + chart to message
      await conversationService.addMessage({
        conversationId: convId,
        role: 'assistant',
        content: finalResult.explanation,
        generatedSql: finalResult.sql,
        executionResult: {
          rows: execResult.rows.slice(0, 100),
          columns: execResult.columns,
          truncated: execResult.truncated,
        },
        chartConfig: chart ? { chartType: chart.chartType, config: chart.config } : undefined,
        confidence: finalResult.confidence,
      });
    }
  } catch (execErr) {
    // Execution failure is non-fatal — SQL was already sent
    sendSSE(stream, 'execution_error', {
      message: execErr instanceof Error ? execErr.message : 'Execution failed',
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routes/query.ts
git commit -m "feat(api): enhance SSE streaming with execution results and chart recommendations"
```

---

## Task 11: Update Other Pages for AppShell

**Files:**
- Modify: `packages/web/src/app/schema/page.tsx`
- Modify: `packages/web/src/app/metrics/page.tsx`
- Modify: `packages/web/src/app/knowledge/page.tsx`

- [ ] **Step 1: Wrap each page with AppShell (no panel on non-chat pages)**

For each of the three pages, wrap the content with `<AppShell>`:

```typescript
// Example pattern for packages/web/src/app/schema/page.tsx:
// Add at top:
import { AppShell } from '@/components/layout/app-shell';

// Wrap the existing page content:
export default function SchemaPage() {
  return (
    <AppShell>
      <ToastProvider>
        {/* existing page content stays the same */}
      </ToastProvider>
    </AppShell>
  );
}
```

Apply the same pattern to metrics/page.tsx and knowledge/page.tsx.

- [ ] **Step 2: Verify all pages build**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm --filter web build`
Expected: Build passes.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/app/schema/page.tsx packages/web/src/app/metrics/page.tsx packages/web/src/app/knowledge/page.tsx
git commit -m "feat(web): wrap all pages with AppShell layout"
```

---

## Task 12: Cleanup and Verify Phase 1

- [ ] **Step 1: Remove old sidebar.tsx if still exists**

```bash
# Check and remove old sidebar location
test -f packages/web/src/components/sidebar.tsx && git rm packages/web/src/components/sidebar.tsx
```

- [ ] **Step 2: Remove old chat-message.tsx if still exists**

```bash
test -f packages/web/src/components/chat-message.tsx && git rm packages/web/src/components/chat-message.tsx
```

- [ ] **Step 3: Full build verification**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm build`
Expected: All packages build successfully.

- [ ] **Step 4: Start dev and manual verification**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm dev:web`

Verify:
- Chat page loads with two-column layout (sidebar + main)
- Panel toggle button in sidebar works
- Panel opens/closes with animation
- Example queries display in empty state
- Submitting a query streams SSE events (if API running)
- Feedback buttons show tri-state (accept/reject/golden)
- All nav links work (schema, metrics, knowledge)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(web): complete Phase 1 — UI restructure with design system, SSE streaming, rich messages, tri-state feedback"
```

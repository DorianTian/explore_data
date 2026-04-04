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
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
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
    <div className={`flex border-b border-border ${className}`} role="tablist">
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

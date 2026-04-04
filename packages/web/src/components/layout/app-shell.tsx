'use client';

import { type ReactNode, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { usePanelStore } from '@/stores/panel-store';

interface AppShellProps {
  children: ReactNode;
  panel?: ReactNode;
}

export function AppShell({ children, panel }: AppShellProps) {
  const isOpen = usePanelStore((s) => s.isOpen);
  const closePanel = usePanelStore((s) => s.closePanel);

  /* Auto-close panel on narrow viewports */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches && isOpen) closePanel();
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [isOpen, closePanel]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>

      {/* Right panel — slide-over on tablet, inline on desktop */}
      {panel && isOpen && (
        <>
          {/* Overlay for tablet */}
          <div
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={closePanel}
          />

          <aside
            className="fixed right-0 top-0 h-full z-50 lg:relative lg:z-auto border-l border-border bg-background w-[var(--panel-width)] overflow-hidden transition-transform duration-200 ease-in-out"
          >
            <div className="w-[var(--panel-width)] h-full overflow-hidden">
              {panel}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { usePanelStore } from '@/stores/panel-store';

export function useKeyboardShortcuts() {
  const togglePanel = usePanelStore((s) => s.togglePanel);
  const openPanel = usePanelStore((s) => s.openPanel);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      /* Cmd/Ctrl + B: Toggle panel */
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        togglePanel();
      }

      /* Cmd/Ctrl + Shift + 1/2/3: Switch panel tabs (avoid browser tab conflicts) */
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '1') {
        e.preventDefault();
        openPanel('detail');
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '2') {
        e.preventDefault();
        openPanel('schema');
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '3') {
        e.preventDefault();
        openPanel('history');
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [togglePanel, openPanel]);
}

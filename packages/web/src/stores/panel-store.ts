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
  openPanel: (tab) => set((s) => ({ isOpen: true, activeTab: tab ?? s.activeTab })),
  closePanel: () => set({ isOpen: false }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectMessage: (messageId) =>
    set({ selectedMessageId: messageId, isOpen: true, activeTab: 'detail' }),
  clearSelection: () => set({ selectedMessageId: null }),
}));

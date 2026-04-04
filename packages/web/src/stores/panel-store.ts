import { create } from 'zustand';

export type PanelTab = 'detail' | 'schema' | 'history';
export type ArtifactTab = 'result' | 'schema';

interface PanelState {
  isOpen: boolean;
  activeTab: PanelTab;
  selectedMessageId: string | null;
  artifactTab: ArtifactTab;
}

interface PanelActions {
  togglePanel: () => void;
  openPanel: (tab?: PanelTab) => void;
  closePanel: () => void;
  setActiveTab: (tab: PanelTab) => void;
  selectMessage: (messageId: string) => void;
  clearSelection: () => void;
  openArtifact: (messageId: string, tab?: ArtifactTab) => void;
  closeArtifact: () => void;
  setArtifactTab: (tab: ArtifactTab) => void;
}

export const usePanelStore = create<PanelState & PanelActions>((set) => ({
  isOpen: true,
  activeTab: 'detail',
  selectedMessageId: null,
  artifactTab: 'result',

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  openPanel: (tab) => set((s) => ({ isOpen: true, activeTab: tab ?? s.activeTab })),
  closePanel: () => set({ isOpen: false }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectMessage: (messageId) =>
    set({ selectedMessageId: messageId, isOpen: true, activeTab: 'detail' }),
  clearSelection: () => set({ selectedMessageId: null }),
  openArtifact: (messageId, tab) =>
    set({ selectedMessageId: messageId, isOpen: true, artifactTab: tab ?? 'result' }),
  closeArtifact: () => set({ artifactTab: 'schema', selectedMessageId: null }),
  setArtifactTab: (tab) => set({ artifactTab: tab }),
}));

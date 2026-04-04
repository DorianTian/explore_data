import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const SIDEBAR_MIN = 56;
const SIDEBAR_DEFAULT = 240;
const SIDEBAR_MAX = 400;
const COLLAPSE_THRESHOLD = 80;

interface SidebarState {
  width: number;
  isCollapsed: boolean;
}

interface SidebarActions {
  setWidth: (w: number) => void;
  toggleCollapse: () => void;
}

type SidebarStore = SidebarState & SidebarActions;

export { SIDEBAR_MIN, SIDEBAR_DEFAULT, SIDEBAR_MAX, COLLAPSE_THRESHOLD };

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      width: SIDEBAR_DEFAULT,
      isCollapsed: false,

      setWidth: (w: number) => {
        const clamped = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w));
        set({ width: clamped, isCollapsed: clamped < COLLAPSE_THRESHOLD });
      },

      toggleCollapse: () =>
        set((s) => {
          const nextCollapsed = !s.isCollapsed;
          return {
            isCollapsed: nextCollapsed,
            width: nextCollapsed ? SIDEBAR_MIN : SIDEBAR_DEFAULT,
          };
        }),
    }),
    {
      name: 'nl2sql-sidebar',
      partialize: (state) => ({
        width: state.width,
        isCollapsed: state.isCollapsed,
      }),
    },
  ),
);

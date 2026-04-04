import { create } from 'zustand';
import { apiFetch, apiPost, apiDelete } from '@/lib/api';
import type { ChatMessage } from '@/stores/chat-store';

/** Widget as returned by the backend */
export interface Widget {
  id: string;
  projectId: string;
  datasourceId: string;
  title: string;
  description: string | null;
  sourceType: 'chat' | 'manual';
  sourceMessageId: string | null;
  naturalLanguageQuery: string | null;
  sql: string;
  chartType: string;
  chartConfig: unknown;
  refreshInterval: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Placement of a widget inside a dashboard grid */
export interface WidgetPlacement {
  id: string;
  dashboardId: string;
  widgetId: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  widget?: Widget;
}

/** Dashboard summary (list endpoint) */
export interface Dashboard {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  layoutConfig: { columns?: number };
  createdAt: string;
  updatedAt: string;
}

/** Dashboard with its placements (detail endpoint) */
export interface DashboardDetail extends Dashboard {
  placements: WidgetPlacement[];
}

/** Favorite record */
export interface Favorite {
  id: string;
  userId: string;
  targetType: 'widget' | 'dashboard';
  targetId: string;
}

interface DashboardState {
  widgets: Widget[];
  dashboards: Dashboard[];
  favorites: Favorite[];
  currentDashboard: DashboardDetail | null;
  loading: boolean;
}

interface DashboardActions {
  fetchWidgets: (projectId: string) => Promise<void>;
  fetchDashboards: (projectId: string) => Promise<void>;
  fetchFavorites: () => Promise<void>;
  fetchDashboard: (id: string) => Promise<void>;
  createWidget: (params: CreateWidgetParams) => Promise<Widget | null>;
  createDashboard: (params: CreateDashboardParams) => Promise<Dashboard | null>;
  deleteDashboard: (id: string) => Promise<boolean>;
  deleteWidget: (id: string) => Promise<boolean>;
  toggleFavorite: (targetType: 'widget' | 'dashboard', targetId: string) => Promise<void>;
  isFavorited: (targetType: 'widget' | 'dashboard', targetId: string) => boolean;
}

interface CreateWidgetParams {
  projectId: string;
  datasourceId: string;
  title: string;
  description?: string;
  message: ChatMessage;
}

interface CreateDashboardParams {
  projectId: string;
  name: string;
  description?: string;
}

type DashboardStore = DashboardState & DashboardActions;

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  widgets: [],
  dashboards: [],
  favorites: [],
  currentDashboard: null,
  loading: false,

  fetchWidgets: async (projectId) => {
    set({ loading: true });
    try {
      const res = await apiFetch<Widget[]>(`/api/widgets?projectId=${projectId}`);
      if (res.success && res.data) {
        set({ widgets: res.data });
      }
    } finally {
      set({ loading: false });
    }
  },

  fetchDashboards: async (projectId) => {
    set({ loading: true });
    try {
      const res = await apiFetch<Dashboard[]>(`/api/dashboards?projectId=${projectId}`);
      if (res.success && res.data) {
        set({ dashboards: res.data });
      }
    } finally {
      set({ loading: false });
    }
  },

  fetchFavorites: async () => {
    const res = await apiFetch<Favorite[]>('/api/favorites');
    if (res.success && res.data) {
      set({ favorites: res.data });
    }
  },

  fetchDashboard: async (id) => {
    set({ loading: true });
    try {
      const res = await apiFetch<DashboardDetail>(`/api/dashboards/${id}`);
      if (res.success && res.data) {
        set({ currentDashboard: res.data });
      }
    } finally {
      set({ loading: false });
    }
  },

  createWidget: async ({ projectId, datasourceId, title, description, message }) => {
    const body = {
      projectId,
      datasourceId,
      title,
      description: description || undefined,
      sourceType: 'chat' as const,
      sourceMessageId: message.id,
      naturalLanguageQuery: message.content,
      sql: message.sql,
      chartType: message.chartRecommendation?.chartType ?? 'table',
      chartConfig: message.chartRecommendation?.config ?? {},
    };

    const res = await apiPost<Widget>('/api/widgets', body);
    if (res.success && res.data) {
      set((s) => ({ widgets: [...s.widgets, res.data!] }));
      return res.data;
    }
    return null;
  },

  createDashboard: async ({ projectId, name, description }) => {
    const res = await apiPost<Dashboard>('/api/dashboards', {
      projectId,
      name,
      description: description || undefined,
    });
    if (res.success && res.data) {
      set((s) => ({ dashboards: [...s.dashboards, res.data!] }));
      return res.data;
    }
    return null;
  },

  deleteDashboard: async (id) => {
    const res = await apiDelete(`/api/dashboards/${id}`);
    if (res.success) {
      set((s) => ({ dashboards: s.dashboards.filter((d) => d.id !== id) }));
      return true;
    }
    return false;
  },

  deleteWidget: async (id) => {
    const res = await apiDelete(`/api/widgets/${id}`);
    if (res.success) {
      set((s) => ({ widgets: s.widgets.filter((w) => w.id !== id) }));
      return true;
    }
    return false;
  },

  toggleFavorite: async (targetType, targetId) => {
    const { favorites } = get();
    const existing = favorites.find(
      (f) => f.targetType === targetType && f.targetId === targetId,
    );

    if (existing) {
      const res = await apiDelete(`/api/favorites/${existing.id}`);
      if (res.success) {
        set((s) => ({ favorites: s.favorites.filter((f) => f.id !== existing.id) }));
      }
    } else {
      const res = await apiPost<Favorite>('/api/favorites', { targetType, targetId });
      if (res.success && res.data) {
        set((s) => ({ favorites: [...s.favorites, res.data!] }));
      }
    }
  },

  isFavorited: (targetType, targetId) => {
    const { favorites } = get();
    return favorites.some(
      (f) => f.targetType === targetType && f.targetId === targetId,
    );
  },
}));

import { create } from 'zustand';
import { apiFetch, apiPost, apiDelete } from '@/lib/api';
import type { ChatMessage } from '@/stores/chat-store';

/** Widget as returned by the backend */
export interface Widget {
  id: string;
  projectId: string;
  datasourceId: string;
  conversationId: string | null;
  messageId: string | null;
  title: string;
  description: string | null;
  naturalLanguage: string;
  sql: string;
  chartType: string;
  chartConfig: unknown;
  dataSnapshot: unknown;
  isLive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Placement of a widget inside a dashboard grid */
export interface WidgetPlacement {
  placement: {
    id: string;
    dashboardId: string;
    widgetId: string;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  };
  widget: Widget;
}

/** Dashboard summary (list endpoint) */
export interface Dashboard {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  layoutConfig: { columns?: number };
  createdAt: string;
  updatedAt: string;
}

/** Dashboard with its widget placements (detail endpoint) */
export interface DashboardDetail {
  dashboard: Dashboard;
  widgets: WidgetPlacement[];
}

/** Favorite record */
export interface Favorite {
  id: string;
  projectId: string;
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
  fetchFavorites: (projectId: string) => Promise<void>;
  fetchDashboard: (id: string) => Promise<void>;
  createWidget: (params: CreateWidgetParams) => Promise<Widget | null>;
  createDashboard: (params: CreateDashboardParams) => Promise<Dashboard | null>;
  deleteDashboard: (id: string) => Promise<boolean>;
  deleteWidget: (id: string) => Promise<boolean>;
  toggleFavorite: (projectId: string, targetType: 'widget' | 'dashboard', targetId: string) => Promise<void>;
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
  title: string;
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

  fetchFavorites: async (projectId) => {
    const res = await apiFetch<Favorite[]>(`/api/favorites?projectId=${projectId}`);
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
      naturalLanguage: message.content,
      sql: message.sql,
      chartType: message.chartRecommendation?.chartType ?? 'table',
      chartConfig: message.chartRecommendation?.config ?? {},
      dataSnapshot: message.executionResult ?? undefined,
      messageId: message.id,
    };

    const res = await apiPost<Widget>('/api/widgets', body);
    if (res.success && res.data) {
      set((s) => ({ widgets: [...s.widgets, res.data!] }));
      return res.data;
    }
    return null;
  },

  createDashboard: async ({ projectId, title, description }) => {
    const res = await apiPost<Dashboard>('/api/dashboards', {
      projectId,
      title,
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

  toggleFavorite: async (projectId, targetType, targetId) => {
    const res = await apiPost<{ favorited: boolean; id?: string }>('/api/favorites/toggle', {
      projectId,
      targetType,
      targetId,
    });
    if (res.success) {
      /* Re-fetch to stay in sync */
      get().fetchFavorites(projectId);
    }
  },

  isFavorited: (targetType, targetId) => {
    const { favorites } = get();
    return favorites.some(
      (f) => f.targetType === targetType && f.targetId === targetId,
    );
  },
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch, apiPost } from '@/lib/api';

async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 1000): Promise<T> {
  let lastResult: T | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    lastResult = await fn();
    if ((lastResult as { success?: boolean }).success) return lastResult;
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
    }
  }
  return lastResult as T;
}

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface Datasource {
  id: string;
  name: string;
  dialect: string;
  projectId: string;
}

interface ProjectState {
  projects: Project[];
  datasources: Datasource[];
  currentProjectId: string | null;
  currentDatasourceId: string | null;
  loadingProjects: boolean;
  loadingDatasources: boolean;
}

interface ProjectActions {
  setCurrentProject: (id: string | null) => void;
  setCurrentDatasource: (id: string | null) => void;
  fetchProjects: () => Promise<void>;
  fetchDatasources: (projectId: string) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project | null>;
  createDatasource: (name: string, dialect: string) => Promise<Datasource | null>;
}

type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      datasources: [],
      currentProjectId: null,
      currentDatasourceId: null,
      loadingProjects: false,
      loadingDatasources: false,

      setCurrentProject: (id) => {
        set({ currentProjectId: id, currentDatasourceId: null, datasources: [] });
        if (id) {
          get().fetchDatasources(id);
        }
      },

      setCurrentDatasource: (id) => {
        set({ currentDatasourceId: id });
      },

      fetchProjects: async () => {
        set({ loadingProjects: true });
        try {
          const res = await withRetry(() => apiFetch<Project[]>('/api/projects'));
          if (res.success && res.data) {
            set({ projects: res.data });
          }
        } finally {
          set({ loadingProjects: false });
        }
      },

      fetchDatasources: async (projectId) => {
        set({ loadingDatasources: true });
        try {
          const res = await withRetry(() =>
            apiFetch<Datasource[]>(`/api/datasources?projectId=${projectId}`),
          );
          if (res.success && res.data) {
            set({ datasources: res.data });
            if (res.data.length === 1) {
              set({ currentDatasourceId: res.data[0].id });
            }
          }
        } finally {
          set({ loadingDatasources: false });
        }
      },

      createProject: async (name, description) => {
        const res = await apiPost<Project>('/api/projects', { name, description });
        if (res.success && res.data) {
          set((state) => ({ projects: [...state.projects, res.data!] }));
          return res.data;
        }
        return null;
      },

      createDatasource: async (name, dialect) => {
        const projectId = get().currentProjectId;
        if (!projectId) return null;
        const res = await apiPost<Datasource>('/api/datasources', {
          projectId,
          name,
          dialect,
        });
        if (res.success && res.data) {
          set((state) => ({ datasources: [...state.datasources, res.data!] }));
          return res.data;
        }
        return null;
      },
    }),
    {
      name: 'nl2sql-project',
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        currentDatasourceId: state.currentDatasourceId,
      }),
    },
  ),
);

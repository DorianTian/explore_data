import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch, apiPost } from '@/lib/api';

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface Datasource {
  id: string;
  name: string;
  dbType: string;
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
          const res = await apiFetch<Project[]>('/api/projects');
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
          const res = await apiFetch<Datasource[]>(
            `/api/projects/${projectId}/datasources`,
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

import { create } from 'zustand';
import { apiPost } from '@/lib/api';

export interface AppUser {
  id: string;
  name: string;
  createdAt: string;
}

const STORAGE_KEY = 'nl2sql-user';

interface UserState {
  user: AppUser | null;
  loading: boolean;
}

interface UserActions {
  login: (name: string) => Promise<boolean>;
  logout: () => void;
  restore: () => void;
}

type UserStore = UserState & UserActions;

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  loading: true,

  login: async (name) => {
    const res = await apiPost<AppUser>('/api/users/login', { name });
    if (res.data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(res.data));
      set({ user: res.data, loading: false });
      return true;
    }
    return false;
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null, loading: false });
  },

  restore: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        set({ user: JSON.parse(raw), loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },
}));

import { create } from 'zustand';
import { User } from '../types';
import { authApi } from '../api/auth';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setUser: (user: User) => void;
  setTokens: (tokens: { access_token: string; refresh_token: string }) => void;
  logout: () => void;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: true,

  setUser: (user: User) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  setTokens: (tokens: { access_token: string; refresh_token: string }) => {
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },

  init: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      set({ isInitializing: false });
      return;
    }

    // Try to restore from localStorage first for instant UX
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser) as User;
        set({ user, isAuthenticated: true });
      } catch {
        // ignore parse error
      }
    }

    // Verify token is still valid with the server
    try {
      const user = await authApi.me();
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isInitializing: false });
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      set({ user: null, isAuthenticated: false, isInitializing: false });
    }
  },
}));

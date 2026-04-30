import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  kdf_salt: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  setToken: (token: string | null) => void;
  clearAuth: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (token, user) => {
        set({ token, user, isAuthenticated: true, isLoading: false });
        // Also set the session cookie for middleware
        document.cookie = `session_token=${token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
      },

      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },

      setToken: (token) => {
        set({ token });
      },

      clearAuth: () => {
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
        document.cookie = 'session_token=; path=/; max-age=0';
      },

      initialize: () => {
        const state = get();
        if (state.token) {
          set({ isLoading: false });
        } else {
          // Check cookie
          const cookie = document.cookie
            .split('; ')
            .find((c) => c.startsWith('session_token='));
          if (cookie) {
            const token = decodeURIComponent(cookie.split('=')[1]);
            if (token) {
              set({ token, isLoading: true });
              return;
            }
          }
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'criptenv-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);

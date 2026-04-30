import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  kdf_salt: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (isLoading: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => {
    set({ user, isAuthenticated: Boolean(user), isLoading: false });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  clearAuth: () => {
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
}));

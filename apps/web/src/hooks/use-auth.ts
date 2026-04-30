'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { authApi, setToken, ApiError } from '@/lib/api';

const COOKIE_NAME = 'session_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function writeCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function eraseCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

export function useAuth() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading, setUser, setToken: storeSetToken, clearAuth, initialize } = useAuthStore();

  // Initialize from cookie on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Sync token with the api module and fetch session if we have a token but no user
  useEffect(() => {
    if (token) {
      setToken(token);

      if (!user) {
        authApi
          .session()
          .then(setUser)
          .catch((err) => {
            if (err instanceof ApiError && err.status === 401) {
              clearAuth();
              eraseCookie(COOKIE_NAME);
              setToken(null);
            }
          });
      }
    } else {
      setToken(null);
    }
  }, [token, user, setUser, clearAuth]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.signin({ email, password });
      writeCookie(COOKIE_NAME, res.session_token, COOKIE_MAX_AGE);
      storeSetToken(res.session_token);
      setUser(res.user);
      return res.user;
    },
    [storeSetToken, setUser],
  );

  const signup = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await authApi.signup({ email, password, name });
      writeCookie(COOKIE_NAME, res.session_token, COOKIE_MAX_AGE);
      storeSetToken(res.session_token);
      setUser(res.user);
      return res.user;
    },
    [storeSetToken, setUser],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.signout();
    } catch {
      // ignore errors on signout
    }
    clearAuth();
    eraseCookie(COOKIE_NAME);
    setToken(null);
    router.push('/login');
  }, [clearAuth, router]);

  // Global 401 handler: wrap any API call to auto-logout on 401
  const withAuth = useCallback(
    <T>(promise: Promise<T>): Promise<T> => {
      return promise.catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearAuth();
          eraseCookie(COOKIE_NAME);
          setToken(null);
          router.push('/login');
        }
        throw err;
      });
    },
    [clearAuth, router],
  );

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    signup,
    logout,
    withAuth,
  };
}

'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { authApi, ApiError } from '@/lib/api';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setUser, setLoading, clearAuth } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('criptenv-auth');
    }

    setLoading(true);
    authApi
      .session()
      .then((sessionUser) => {
        if (isMounted) {
          setUser(sessionUser);
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (err instanceof ApiError && err.status === 401) {
            clearAuth();
          } else {
            clearAuth();
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [setUser, setLoading, clearAuth]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.signin({ email, password });
      setUser(res.user);
      return res.user;
    },
    [setUser],
  );

  const signup = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await authApi.signup({ email, password, name });
      setUser(res.user);
      return res.user;
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.signout();
    } catch {
      // ignore errors on signout
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('criptenv-auth');
    }
    clearAuth();
    router.push('/login');
  }, [clearAuth, router]);

  // Global 401 handler: wrap any API call to auto-logout on 401
  const withAuth = useCallback(
    <T>(promise: Promise<T>): Promise<T> => {
      return promise.catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('criptenv-auth');
          }
          clearAuth();
          router.push('/login');
        }
        throw err;
      });
    },
    [clearAuth, router],
  );

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    signup,
    logout,
    withAuth,
  };
}

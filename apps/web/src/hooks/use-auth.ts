'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, type AuthUser } from '@/stores/auth';
import { authApi, ApiError } from '@/lib/api';

let sessionRequest: Promise<AuthUser | null> | null = null;

function loadSession(): Promise<AuthUser | null> {
  if (!sessionRequest) {
    sessionRequest = authApi
      .session()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          return null;
        }
        return null;
      })
      .finally(() => {
        sessionRequest = null;
      });
  }

  return sessionRequest;
}

export function useAuth() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isLoading,
    hasCheckedSession,
    setUser,
    setLoading,
    clearAuth,
  } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    if (hasCheckedSession) {
      return () => {
        isMounted = false;
      };
    }

    setLoading(true);
    loadSession().then((sessionUser) => {
      if (isMounted) {
        if (useAuthStore.getState().hasCheckedSession) {
          return;
        }

        if (sessionUser) {
          setUser(sessionUser);
        } else {
          clearAuth();
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [hasCheckedSession, setUser, setLoading, clearAuth]);

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
      await authApi.signup({ email, password, name });
      // User is not authenticated until email is verified
      return null;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.signout();
    } catch {
      // ignore errors on signout
    }
    clearAuth();
    router.push('/login');
  }, [clearAuth, router]);

  // Global 401 handler: wrap any API call to auto-logout on 401
  const withAuth = useCallback(
    <T>(promise: Promise<T>): Promise<T> => {
      return promise.catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
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

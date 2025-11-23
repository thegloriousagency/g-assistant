'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { clearToken, getToken, setToken } from '@/lib/auth-storage';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'client';
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Tenant {
  id: string;
  name: string;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  wpSiteUrl?: string | null;
  wpApiUser?: string | null;
  wpAppPassword?: string | null;
  hostingExpirationDate?: string | null;
  hostingCpanelUsername?: string | null;
  hostingOrdered?: boolean | null;
  maintenancePlanName?: string | null;
  maintenanceHoursPerMonth?: number | null;
  maintenanceCarryoverMode?: string | null;
  maintenanceStartDate?: string | null;
  maintenanceExpirationDate?: string | null;
  maintenanceOrdered?: boolean | null;
}

interface MeResponse {
  user: User;
  tenant: Tenant | null;
}

interface AuthContextValue {
  user: User | null;
  tenant: Tenant | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<MeResponse | null>;
  logout: () => void;
  refreshMe: () => Promise<MeResponse | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [status, setStatus] = useState<AuthStatus>('idle');

  const handleAuthSuccess = useCallback((data: MeResponse | null) => {
    if (data) {
      setUser(data.user);
      setTenant(data.tenant);
      setStatus('authenticated');
    } else {
      setUser(null);
      setTenant(null);
      setStatus('unauthenticated');
    }
    return data;
  }, []);

  const refreshMe = useCallback(async (): Promise<MeResponse | null> => {
    const token = getToken();
    if (!token) {
      return handleAuthSuccess(null);
    }

    setStatus((prev) => (prev === 'authenticated' ? prev : 'loading'));
    try {
      const data = await apiFetch<MeResponse>('/auth/me', { method: 'GET' }, true);
      return handleAuthSuccess(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearToken();
        return handleAuthSuccess(null);
      }
      setStatus('unauthenticated');
      throw error;
    }
  }, [handleAuthSuccess]);

  const login = useCallback(
    async (email: string, password: string) => {
      setStatus('loading');
      const { accessToken } = await apiFetch<{ accessToken: string }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
      );
      setToken(accessToken);
      return refreshMe();
    },
    [refreshMe],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setTenant(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    refreshMe().catch(() => {
      setStatus('unauthenticated');
    });
  }, [refreshMe]);

  const value = useMemo(
    () => ({ user, tenant, status, login, logout, refreshMe }),
    [login, logout, refreshMe, status, tenant, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

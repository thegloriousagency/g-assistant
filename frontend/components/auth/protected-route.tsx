'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'client';
  fallbackPath?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  fallbackPath,
}: ProtectedRouteProps) {
  const { status, user, refreshMe } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'idle') {
      refreshMe().catch(() => undefined);
    }
  }, [status, refreshMe]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (
      status === 'authenticated' &&
      requiredRole &&
      user &&
      user.role !== requiredRole
    ) {
      router.replace(fallbackPath ?? '/dashboard');
    }
  }, [status, user, requiredRole, fallbackPath, router]);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}

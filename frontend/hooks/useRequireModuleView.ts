'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { useHasPermission } from '@/hooks/useHasPermission';
import type { ModuleKey } from '@/lib/modulePermissions';

/**
 * Redirects to /dashboard when the user cannot view the module (e.g. access none).
 * Waits until auth and module permissions have finished loading.
 */
export function useRequireModuleView(module: ModuleKey): void {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: permLoading } = usePermissions();
  const canView = useHasPermission(module, 'view');

  useEffect(() => {
    if (authLoading || permLoading) return;
    if (!user) return;
    if (!canView) router.replace('/dashboard');
  }, [authLoading, permLoading, user, canView, router]);
}

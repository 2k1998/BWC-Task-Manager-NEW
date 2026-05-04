'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { defaultPermissionsMap, MODULE_KEYS, type AccessLevel, type ModuleKey } from '@/lib/modulePermissions';

type PermissionsMap = Record<ModuleKey, AccessLevel>;

interface PermissionsContextValue {
  permissions: PermissionsMap;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

function permissionsObjectToMap(permissions: Record<string, string>): PermissionsMap {
  const base = defaultPermissionsMap();
  for (const key of MODULE_KEYS) {
    const v = permissions[key];
    if (v && isAccessLevel(v)) {
      base[key] = v;
    }
  }
  return base;
}

function isAccessLevel(v: string): v is AccessLevel {
  return (['none', 'view', 'edit', 'delete'] as const).includes(v as AccessLevel);
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<PermissionsMap>(defaultPermissionsMap);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      setPermissions(defaultPermissionsMap());
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data } = await apiClient.get<{ permissions: Record<string, string> }>(
        `/auth/me/module-permissions`,
      );
      const perms = data?.permissions && typeof data.permissions === 'object' ? data.permissions : {};
      setPermissions(permissionsObjectToMap(perms));
    } catch {
      setPermissions(defaultPermissionsMap());
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo(
    () => ({
      permissions,
      isLoading: authLoading || isLoading,
      refetch: load,
    }),
    [permissions, authLoading, isLoading, load],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (ctx === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return ctx;
}

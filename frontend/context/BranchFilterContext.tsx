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
import apiClient from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';

export type BranchHead = {
  id: string;
  full_name: string;
  user_type: string;
};

type BranchFilterContextValue = {
  selectedBranchUserId: string | null;
  selectedBranchLabel: string | null;
  branchHeads: BranchHead[];
  branchHeadsLoading: boolean;
  setBranch: (userId: string | null, label?: string | null) => void;
  clearBranch: () => void;
  isAdmin: boolean;
};

const BranchFilterContext = createContext<BranchFilterContextValue | undefined>(
  undefined
);

export function BranchFilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.user_type === 'Admin';

  const [selectedBranchUserId, setSelectedBranchUserId] = useState<string | null>(
    null
  );
  const [selectedBranchLabel, setSelectedBranchLabel] = useState<string | null>(
    null
  );
  const [branchHeads, setBranchHeads] = useState<BranchHead[]>([]);
  const [branchHeadsLoading, setBranchHeadsLoading] = useState(false);

  useEffect(() => {
    if (!user || user.user_type !== 'Admin') {
      setBranchHeads([]);
      setSelectedBranchUserId(null);
      setSelectedBranchLabel(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setBranchHeadsLoading(true);
        const res = await apiClient.get<BranchHead[]>('/admin/branch-heads');
        if (!cancelled) {
          setBranchHeads(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        console.error('Failed to load branch heads:', err);
        if (!cancelled) setBranchHeads([]);
      } finally {
        if (!cancelled) setBranchHeadsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setBranch = useCallback(
    (userId: string | null, label?: string | null) => {
      if (!isAdmin) return;
      setSelectedBranchUserId(userId);
      setSelectedBranchLabel(label ?? null);
    },
    [isAdmin]
  );

  const clearBranch = useCallback(() => {
    setSelectedBranchUserId(null);
    setSelectedBranchLabel(null);
  }, []);

  const value = useMemo(
    () => ({
      selectedBranchUserId: isAdmin ? selectedBranchUserId : null,
      selectedBranchLabel: isAdmin ? selectedBranchLabel : null,
      branchHeads: isAdmin ? branchHeads : [],
      branchHeadsLoading: isAdmin ? branchHeadsLoading : false,
      setBranch,
      clearBranch,
      isAdmin: !!isAdmin,
    }),
    [
      isAdmin,
      selectedBranchUserId,
      selectedBranchLabel,
      branchHeads,
      branchHeadsLoading,
      setBranch,
      clearBranch,
    ]
  );

  return (
    <BranchFilterContext.Provider value={value}>
      {children}
    </BranchFilterContext.Provider>
  );
}

const defaultBranchFilterValue: BranchFilterContextValue = {
  selectedBranchUserId: null,
  selectedBranchLabel: null,
  branchHeads: [],
  branchHeadsLoading: false,
  setBranch: () => {},
  clearBranch: () => {},
  isAdmin: false,
};

export function useBranchFilter(): BranchFilterContextValue {
  const ctx = useContext(BranchFilterContext);
  if (!ctx) {
    return defaultBranchFilterValue;
  }
  return ctx;
}

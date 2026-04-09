'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getPublicWsBaseUrl } from '@/lib/apiBase';
import apiClient from '@/lib/apiClient';
import type { PresenceEntry } from '@/lib/types';
import { getAccessToken } from '@/lib/auth';

interface PresenceContextType {
  presence: PresenceEntry[];
  isLoading: boolean;
  isConnected: boolean;
  lastUpdatedAt: string | null;
  refreshPresence: () => Promise<void>;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
}

function normalizePresence(input: unknown): PresenceEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const row = asRecord(item);
      const firstName = typeof row.first_name === 'string' ? row.first_name : '';
      const lastName = typeof row.last_name === 'string' ? row.last_name : '';
      return {
        user_id: typeof row.user_id === 'string' ? row.user_id : typeof row.id === 'string' ? row.id : '',
        name:
          (typeof row.name === 'string' ? row.name : '') ||
          [firstName, lastName].filter(Boolean).join(' ') ||
          (typeof row.username === 'string' ? row.username : 'Unknown user'),
        username: typeof row.username === 'string' ? row.username : null,
        profile_photo_url: typeof row.profile_photo_url === 'string' ? row.profile_photo_url : null,
        is_online: Boolean(row.is_online),
        last_seen_at: typeof row.last_seen_at === 'string' ? row.last_seen_at : typeof row.last_seen === 'string' ? row.last_seen : null,
      };
    })
    .filter((item) => item.user_id.length > 0);
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const hasShownOutageToastRef = useRef(false);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  const showOutageToastOnce = useCallback(() => {
    if (hasShownOutageToastRef.current) return;
    hasShownOutageToastRef.current = true;
    toast.warning('Presence updates are temporarily unavailable.');
  }, []);

  const clearOutageToastLock = useCallback(() => {
    hasShownOutageToastRef.current = false;
  }, []);

  const fetchPresence = useCallback(async () => {
    try {
      const response = await apiClient.get('/presence');
      const nextPresence = normalizePresence(response.data?.users || response.data?.presence || response.data);
      setPresence(nextPresence);
      setLastUpdatedAt(new Date().toISOString());
      clearOutageToastLock();
    } catch {
      showOutageToastOnce();
    } finally {
      setIsLoading(false);
    }
  }, [clearOutageToastLock, showOutageToastOnce]);

  const closeWs = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connectWs = useCallback(() => {
    closeWs();
    try {
      const token = getAccessToken();
      const wsUrl = token
        ? `${getPublicWsBaseUrl()}/ws/presence?token=${encodeURIComponent(token)}`
        : `${getPublicWsBaseUrl()}/ws/presence`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        setIsConnected(true);
        clearOutageToastLock();
        // Backend presence uses heartbeat updates to refresh last_seen.
        heartbeatIntervalRef.current = setInterval(() => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          wsRef.current.send(JSON.stringify({ type: 'heartbeat' }));
        }, 30000);
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const parsed = JSON.parse(event.data);
          const type = parsed?.type;
          const payload = parsed?.payload ?? parsed;

          if (type === 'presence_list' || type === 'presence_snapshot') {
            setPresence(normalizePresence(payload?.users || payload?.presence || payload));
            setLastUpdatedAt(new Date().toISOString());
            return;
          }

          if (type === 'presence_update') {
            const next = normalizePresence([payload])[0];
            if (!next) return;
            setPresence((prev) => {
              const idx = prev.findIndex((p) => p.user_id === next.user_id);
              if (idx === -1) return [next, ...prev];
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...next };
              return copy;
            });
            setLastUpdatedAt(new Date().toISOString());
            return;
          }

          const maybeList = normalizePresence(payload);
          if (maybeList.length > 0) {
            setPresence(maybeList);
            setLastUpdatedAt(new Date().toISOString());
          }
        } catch {
          // Ignore malformed realtime events
        }
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        setIsConnected(false);
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        reconnectTimerRef.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        if (isUnmountedRef.current) return;
        showOutageToastOnce();
      };
    } catch {
      showOutageToastOnce();
    }
  }, [clearOutageToastLock, closeWs, showOutageToastOnce]);

  useEffect(() => {
    isUnmountedRef.current = false;
    fetchPresence();
    connectWs();

    const startPolling = () => {
      fetchPresence();
      pollIntervalRef.current = setInterval(fetchPresence, 30000);
    };

    const stopPolling = () => {
      if (!pollIntervalRef.current) return;
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isUnmountedRef.current = true;
      stopPolling();
      closeWs();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [connectWs, closeWs, fetchPresence]);

  const value = useMemo(
    () => ({
      presence,
      isLoading,
      isConnected,
      lastUpdatedAt,
      refreshPresence: fetchPresence,
    }),
    [presence, isLoading, isConnected, lastUpdatedAt, fetchPresence]
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within PresenceProvider');
  }
  return context;
}

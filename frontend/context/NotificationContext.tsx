'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';


interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  isPolling: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCount = useCallback(async () => {
    if (!user) return;
    try {
      // Use apiClient — handles baseURL and Authorization header via interceptor.
      // No direct localStorage access. Follows Phase 6 auth hardening.
      const response = await apiClient.get('/notifications/unread-count');
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [user]);

  // Public refresher
  const refreshUnreadCount = useCallback(async () => {
      await fetchCount();
  }, [fetchCount]);

  // Polling Logic
  useEffect(() => {
    // 1. cleanup previous interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // 2. Conditions to start polling
    if (!user) {
      setIsPolling(false);
      return;
    }

    const startPolling = () => {
       fetchCount(); // Initial fetch
       pollIntervalRef.current = setInterval(fetchCount, 30000); // 30s
       setIsPolling(true);
    };

    const stopPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        setIsPolling(false);
    };

    // 3. Document Visibility Handling
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    // 4. Start based on current visibility
    if (!document.hidden) {
        startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount, isPolling }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}

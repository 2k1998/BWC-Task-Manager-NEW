import { useState, useCallback } from "react";
import { useNotificationContext } from "@/context/NotificationContext";
import apiClient from "@/lib/apiClient";

interface Notification {
  id: string;
  title: string;
  message: string;
  link: string;
  read_status: 'Unread' | 'Read'; // Strict backend contract — no boolean abstraction
  created_at: string;
  notification_type: string;
}

interface UseNotificationListProps {
  limit?: number;
  unreadOnly?: boolean;
  cacheKey?: string; // If provided, uses module-level caching
}

// Module-level cache to persist across unmounts (e.g., Dropdown toggles)
const CACHE_STORE: Record<string, { data: Notification[]; timestamp: number }> =
  {};
const CACHE_TTL = 30000; // 30 seconds

export function useNotificationList({
  limit = 10,
  unreadOnly = false,
  cacheKey,
}: UseNotificationListProps = {}) {
  const { refreshUnreadCount } = useNotificationContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [lastFetched, setLastFetched] = useState<number>(0);

  // Helper to fetch data
  const fetchNotifications = useCallback(
    async (pageNum: number, isRefresh = false, force = false) => {
      // Cache Check
      if (cacheKey && !force && isRefresh && pageNum === 1) {
        const cached = CACHE_STORE[cacheKey];
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setNotifications(cached.data);
          setLastFetched(cached.timestamp);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get("/notifications", {
          params: {
            page: pageNum,
            limit: limit,
            unread_only: unreadOnly || undefined,
          },
        });

        const data = response.data;

        setNotifications((prev) => {
          const newList = isRefresh
            ? data.notifications
            : [...prev, ...data.notifications];
          // Update Cache if applicable
          if (cacheKey && isRefresh) {
            CACHE_STORE[cacheKey] = { data: newList, timestamp: Date.now() };
          }
          return newList;
        });

        setHasMore(data.notifications.length === limit);
        setLastFetched(Date.now());
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
        setError("Failed to load notifications. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [limit, unreadOnly, cacheKey],
  );

  // Initial fetch / Refresh
  // We expose a function that allows forcing a refresh (bypassing cache)
  const refresh = useCallback(
    (force = false) => {
      setPage(1);
      fetchNotifications(1, true, force);
    },
    [fetchNotifications],
  );

  // Load More
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNotifications(nextPage, false);
    }
  }, [loading, hasMore, page, fetchNotifications]);

  // Mark As Read — STRICT: Await PATCH → Refetch count → Refetch list (no local mutation)
  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await apiClient.patch(`/notifications/${id}/read`);
        await refreshUnreadCount();
        refresh(true); // Force-bypass cache, replace state entirely with backend response
      } catch (error) {
        console.error("Failed to mark as read:", error);
      }
    },
    [refreshUnreadCount, refresh],
  );

  // Mark All As Read — STRICT: Await PATCH → Refetch count → Refetch list (no local mutation)
  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.patch("/notifications/read-all");
      await refreshUnreadCount();
      refresh(true); // Force-bypass cache, replace state entirely with backend response
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, [refreshUnreadCount, refresh]);

  return {
    notifications,
    loading,
    error,
    hasMore,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
    lastFetched,
  };
}

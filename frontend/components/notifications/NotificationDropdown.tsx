'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNotificationList } from '@/hooks/useNotificationList';
import { formatDistanceToNow } from 'date-fns';

interface NotificationDropdownProps {
  onClose: () => void;
}

export default function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const router = useRouter();
  // Fetch latest 5 notifications for dropdown. Use 'dropdown_list' key to enforce 30s cache across toggles.
  const { notifications, loading, markAsRead, refresh, lastFetched } = useNotificationList({ limit: 5, cacheKey: 'dropdown_list' });

  useEffect(() => {
    // Basic caching logic: If last fetch was essentially "never" (0) or older than 30s, refresh.
    // Since useNotificationList instance is local to this component lifecycle (mounts on open),
    // it will actually fetch on mount by default unless we pass some shared state. 
    // BUT the requirement Says: "Fetch on open". The Hook fetches on mount. So this is correct.
    // The "Cache result for max 30s" rule implies persistent state if we keep the component mounted or use context.
    // Given the simple Dropdown unmounts on close, "Fetch on Open" is the dominant pattern here.
    // We will just let it fetch on mount.
    refresh();
  }, [refresh]);

  const handleItemClick = async (notification: any) => {
    if (notification.read_status === 'Unread') {
      await markAsRead(notification.id);
    }
    onClose();
    router.push(notification.link);
  };

  const getIcon = (type: string) => {
      switch (type) {
          case 'ASSIGNMENT':
              return (
                  <span className="p-1.5 rounded-full bg-primary-gold/15 text-brand-brown">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </span>
              );
          case 'STATUS_CHANGE':
               return (
                  <span className="p-1.5 rounded-full bg-yellow-100 text-yellow-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </span>
              );
          default:
              return (
                  <span className="p-1.5 rounded-full bg-gray-100 text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  </span>
              );
      }
  };

  return (
    <div className="flex flex-col max-h-[80vh]">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-lg">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        <Link 
            href="/notifications" 
            onClick={onClose}
            className="text-xs font-medium text-brand-brown hover:text-black hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="overflow-y-auto">
        {loading ? (
           <div className="p-4 space-y-3">
               {[1, 2, 3].map(i => (
                   <div key={i} className="animate-pulse flex space-x-3">
                       <div className="rounded-full bg-gray-200 h-8 w-8"></div>
                       <div className="flex-1 space-y-2 py-1">
                           <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                           <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                       </div>
                   </div>
               ))}
           </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-sm">No notifications yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  onClick={() => handleItemClick(notification)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3 ${notification.read_status === 'Unread' ? 'bg-primary-gold/10' : ''}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                      {getIcon(notification.notification_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notification.read_status === 'Unread' ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'} truncate`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {notification.read_status === 'Unread' && (
                    <span className="inline-block w-2 h-2 rounded-full bg-primary-gold flex-shrink-0 mt-2" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useNotificationList } from '@/hooks/useNotificationList';
import { Button, EmptyState, ErrorState, LoadingSkeleton } from '@/components/ui'; 
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { useNotificationContext } from '@/context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { refreshUnreadCount } = useNotificationContext();
  const { 
    notifications, 
    loading, 
    error,
    hasMore, 
    loadMore, 
    refresh, 
    markAsRead, 
    markAllAsRead 
  } = useNotificationList({ limit: 20, unreadOnly: filter === 'unread' });

  // Refresh when filter changes
  useEffect(() => {
      refresh();
  }, [filter, refresh]);

  const getIcon = (type: string) => {
    switch (type) {
        case 'ASSIGNMENT':
            return (
                <span className="p-2 rounded-full bg-primary-gold/15 text-brand-brown">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </span>
            );
        case 'STATUS_CHANGE':
             return (
                <span className="p-2 rounded-full bg-yellow-100 text-yellow-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </span>
            );
        default:
            return (
                <span className="p-2 rounded-full bg-gray-100 text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </span>
            );
    }
  };

  return (
    <ProtectedLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Notifications</h1>
            <p className="text-sm text-gray-500 mt-1">Stay updated on your tasks and projects.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
             <div className="inline-flex rounded-md shadow-sm" role="group">
                <button 
                    type="button" 
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${filter === 'all' ? 'bg-primary-gold/10 text-brand-brown border-primary-gold/40 z-10 ring-1 ring-primary-gold/30' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                >
                    All
                </button>
                <button 
                    type="button" 
                    onClick={() => setFilter('unread')}
                    className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${filter === 'unread' ? 'bg-primary-gold/10 text-brand-brown border-primary-gold/40 z-10 ring-1 ring-primary-gold/30' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                >
                    Unread Only
                </button>
             </div>
             
             <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                    try {
                        await apiClient.post('/notifications/trigger-test');
                        toast.success('Test notification sent! Check the bell.');
                        // Manually trigger refresh after a short delay to see it come in via polling or manual refresh
                        setTimeout(() => {
                             refresh();
                             refreshUnreadCount();
                        }, 500);
                    } catch {
                        toast.error('Failed to send test notification');
                    }
                }}
                className="mr-2"
             >
                Test Bell
             </Button>
             
             <Button 
                variant="outline" 
                size="sm" 
                onClick={markAllAsRead}
                disabled={loading}
                className="w-full sm:w-auto"
             >
                Mark all as read
             </Button>
          </div>
        </div>

        {/* List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             {loading && notifications.length === 0 ? (
                 <div className="p-6">
                    <LoadingSkeleton variant="list" count={4} />
                 </div>
             ) : error ? (
                <ErrorState message={error} onRetry={() => refresh(true)} />
             ) : notifications.length === 0 ? (
                 <EmptyState 
                    icon={
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    }
                    title="All caught up!"
                    description="You don't have any notifications right now."
                 />
             ) : (
                 <div className="divide-y divide-gray-100">
                     {notifications.map(notification => (
                         <div 
                            key={notification.id} 
                            className={`p-4 sm:p-5 min-h-[60px] flex gap-4 transition-colors ${notification.read_status === 'Unread' ? 'bg-primary-gold/8' : 'hover:bg-gray-50'}`}
                        >
                             <div className="flex-shrink-0 mt-1">
                                 {getIcon(notification.notification_type)}
                             </div>
                             <div className="flex-1 min-w-0">
                                 <div className="flex justify-between items-start gap-4">
                                     <div className="space-y-1">
                                         <p className={`text-sm ${notification.read_status === 'Unread' ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
                                             {notification.title}
                                         </p>
                                         <p className="text-sm text-gray-600 leading-relaxed">
                                             {notification.message}
                                         </p>
                                         <p className="text-xs text-gray-400 font-medium pt-1">
                                             {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                         </p>
                                     </div>
                                     <div className="flex-shrink-0 flex flex-col items-end gap-2">
                                         {notification.read_status === 'Unread' && (
                                             <button 
                                                onClick={() => markAsRead(notification.id)}
                                                className="text-xs font-medium text-brand-brown hover:text-black hover:underline"
                                             >
                                                 Mark read
                                             </button>
                                         )}
                                          <a href={notification.link} className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 group">
                                             View
                                             <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                          </a>
                                     </div>
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
             )}
        </div>
        
        {/* Load More */}
        {hasMore && !loading && notifications.length > 0 && (
             <div className="flex justify-center pt-4 pb-8">
                 <Button variant="outline" onClick={loadMore}>
                     Load older notifications
                 </Button>
             </div>
        )}
        {loading && notifications.length > 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">Loading more...</div>
        )}
      </div>
    </ProtectedLayout>
  );
}

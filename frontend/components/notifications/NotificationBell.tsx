'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useNotificationContext } from '@/context/NotificationContext';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';

export default function NotificationBell() {
  const { unreadCount } = useNotificationContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside or ESC key
  useEffect(() => {
    function handleGlobalInput(event: MouseEvent | KeyboardEvent) {
      if (event.type === 'keydown' && (event as KeyboardEvent).key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (event.type === 'mousedown' && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleGlobalInput as EventListener);
    document.addEventListener('keydown', handleGlobalInput as EventListener);
    
    return () => {
      document.removeEventListener('mousedown', handleGlobalInput as EventListener);
      document.removeEventListener('keydown', handleGlobalInput as EventListener);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-gold"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white transform scale-100 transition-transform duration-200" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50 origin-top-right transition-all duration-200 ease-out">
            <NotificationDropdown onClose={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
}

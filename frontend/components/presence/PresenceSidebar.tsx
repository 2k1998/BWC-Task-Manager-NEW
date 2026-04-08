'use client';

import { useMemo } from 'react';
import { usePresence } from '@/context/PresenceContext';
import { EmptyState, LoadingSkeleton } from '@/components/ui';

function formatLastSeen(iso: string | null | undefined) {
  if (!iso) return 'Last seen unavailable';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Last seen unavailable';
  return `Last seen ${date.toLocaleString()}`;
}

export default function PresenceSidebar() {
  const { presence, isLoading } = usePresence();

  const sortedPresence = useMemo(() => {
    return [...presence].sort((a, b) => Number(b.is_online) - Number(a.is_online));
  }, [presence]);

  return (
    <aside className="hidden lg:flex w-72 border-l border-gray-200 bg-white flex-col">
      <div className="h-16 px-4 border-b border-gray-200 flex items-center">
        <h2 className="text-[15px] font-semibold text-gray-900">Presence</h2>
      </div>

      <div className="p-4 overflow-y-auto flex-1">
        {isLoading ? (
          <LoadingSkeleton variant="list" count={6} />
        ) : sortedPresence.length === 0 ? (
          <EmptyState title="No users found" description="Presence data will appear here." />
        ) : (
          <ul className="space-y-3">
            {sortedPresence.map((user) => (
              <li key={user.user_id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="relative w-9 h-9 rounded-full bg-gray-100 text-gray-700 font-semibold flex items-center justify-center text-sm">
                    {user.name.charAt(0).toUpperCase()}
                    <span
                      className={`absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border border-white ${
                        user.is_online ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                      aria-label={user.is_online ? 'Online' : 'Offline'}
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[15px] text-gray-800 font-medium truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {user.is_online ? 'Online now' : formatLastSeen(user.last_seen_at)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

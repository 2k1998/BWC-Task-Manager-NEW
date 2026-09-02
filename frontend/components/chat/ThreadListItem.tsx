'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui';
import type { ChatThread } from '@/lib/types';
import { threadDisplayName } from './chatUtils';
import MemberAvatar from './MemberAvatar';

interface ThreadListItemProps {
  thread: ChatThread;
  isSelected: boolean;
  currentUserId: string | null;
  onSelect: (threadId: string) => void;
}

export default function ThreadListItem({ thread, isSelected, currentUserId, onSelect }: ThreadListItemProps) {
  const t = useTranslations('Chat');
  const title = threadDisplayName(thread, currentUserId);
  const other = thread.is_group ? null : thread.members.find((m) => m.user_id !== currentUserId);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(thread.id)}
        className={`w-full p-3 min-h-[60px] border-b border-gray-100 text-left flex items-start gap-3 ${
          isSelected ? 'bg-[#D1AE62]/10' : 'hover:bg-gray-50'
        }`}
      >
        {thread.is_group ? (
          <span
            className="rounded-full bg-[#342C19] text-[#D1AE62] font-semibold flex items-center justify-center shrink-0 mt-0.5"
            style={{ width: 36, height: 36, fontSize: 14 }}
            aria-hidden
          >
            {thread.members.length}
          </span>
        ) : (
          <span className="mt-0.5">
            <MemberAvatar name={title} photoUrl={other?.profile_photo_url} size={36} />
          </span>
        )}
        <span className="flex-1 min-w-0 block">
          <span className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-medium text-gray-900 truncate">{title}</span>
            {thread.unread_count ? <Badge color="blue">{thread.unread_count}</Badge> : null}
          </span>
          <span className="block text-sm text-gray-600 line-clamp-2">
            {thread.last_message_text || t('noMessagesYet')}
          </span>
          <span className="block text-xs text-gray-400 mt-1">
            {thread.last_message_created_at ? new Date(thread.last_message_created_at).toLocaleString() : ''}
          </span>
        </span>
      </button>
    </li>
  );
}

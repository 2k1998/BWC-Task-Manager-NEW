'use client';

import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useChatbot } from '@/context/ChatbotContext';

interface ChatbotConversationListProps {
  onClose: () => void;
}

function truncateTitle(title: string | null, maxLength = 36): string {
  if (!title) return '…';
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength)}…`;
}

export default function ChatbotConversationList({ onClose }: ChatbotConversationListProps) {
  const t = useTranslations('Chatbot');
  const { conversations, activeConversationId, selectConversation } = useChatbot();

  const handleSelect = (id: string) => {
    void selectConversation(id);
    onClose();
  };

  return (
    <div className="absolute top-full right-0 z-50 mt-2 w-[280px] max-h-80 overflow-hidden rounded-md border border-[#E5E7EB] bg-white shadow-md">
      <div className="border-b border-[#E5E7EB] px-3 py-2">
        <p className="text-xs font-medium text-gray-500">{t('conversations')}</p>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-400">{t('noConversations')}</p>
        ) : (
          <ul>
            {conversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(conv.id)}
                    className={`w-full border-l-[3px] px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'border-primary-gold bg-primary-gold/10'
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <p className="truncate text-sm text-gray-900">{truncateTitle(conv.title)}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

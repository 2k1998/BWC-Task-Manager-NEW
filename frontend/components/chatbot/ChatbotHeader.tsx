'use client';

import { useEffect, useRef, useState } from 'react';
import { List, MessageCircle, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useChatbot } from '@/context/ChatbotContext';
import ChatbotConversationList from './ChatbotConversationList';

export default function ChatbotHeader() {
  const t = useTranslations('Chatbot');
  const { close, newConversation } = useChatbot();
  const [showConversations, setShowConversations] = useState(false);
  const conversationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showConversations) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        conversationsRef.current &&
        !conversationsRef.current.contains(event.target as Node)
      ) {
        setShowConversations(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showConversations]);

  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between bg-brand-black px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-gold">
          <MessageCircle className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-primary-gold">{t('title')}</h2>
          <p className="truncate text-xs text-brand-silver">{t('tagline')}</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="relative" ref={conversationsRef}>
          <button
            type="button"
            onClick={() => setShowConversations((v) => !v)}
            aria-label={t('conversations')}
            className="rounded-md p-2 text-brand-silver transition-colors hover:text-white"
          >
            <List className="h-5 w-5" aria-hidden="true" />
          </button>
          {showConversations && (
            <ChatbotConversationList onClose={() => setShowConversations(false)} />
          )}
        </div>

        <button
          type="button"
          onClick={() => void newConversation()}
          aria-label={t('newConversation')}
          className="rounded-md p-2 text-brand-silver transition-colors hover:text-white"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={close}
          aria-label={t('closeLabel')}
          className="rounded-md p-2 text-brand-silver transition-colors hover:text-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useChatbot } from '@/context/ChatbotContext';
import ChatbotMessage from './ChatbotMessage';

export default function ChatbotMessages() {
  const t = useTranslations('Chatbot');
  const { messages, loadingMessages, sendingMessage } = useChatbot();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevSendingRef = useRef(sendingMessage);

  const visibleMessages = messages.filter(
    (m) => m.role === 'user' || m.role === 'assistant',
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [visibleMessages.length, sendingMessage]);

  useEffect(() => {
    if (prevSendingRef.current && !sendingMessage) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    prevSendingRef.current = sendingMessage;
  }, [sendingMessage]);

  const showEmpty = visibleMessages.length === 0 && !loadingMessages && !sendingMessage;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden bg-[#FAFAFA] p-4"
    >
      {showEmpty ? (
        <div className="flex h-full flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-gold/15">
            <MessageCircle className="h-8 w-8 text-primary-gold" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{t('emptyState')}</h3>
          <p className="mt-2 max-w-xs text-sm text-gray-500">{t('emptyHints')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleMessages.map((message) => (
            <ChatbotMessage key={message.id} message={message} />
          ))}

          {sendingMessage && (
            <div className="flex flex-col items-start" aria-label={t('thinking')}>
              <div className="rounded-2xl rounded-bl-md bg-[#F3F4F6] px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                </div>
              </div>
              <span className="mt-1 text-meta text-gray-400">{t('thinking')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

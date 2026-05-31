'use client';

import { MessageCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { useChatbot } from '@/context/ChatbotContext';

export default function ChatbotButton() {
  const { user } = useAuth();
  const { isOpen, toggle } = useChatbot();
  const t = useTranslations('Chatbot');

  if (!user) return null;

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-label={isOpen ? t('closeLabel') : t('buttonLabel')}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary-gold text-white shadow-md transition-transform hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-gold focus:ring-offset-2"
    >
      {isOpen ? (
        <X className="h-6 w-6" aria-hidden="true" />
      ) : (
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
      )}
    </button>
  );
}

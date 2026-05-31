'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useChatbot } from '@/context/ChatbotContext';

const MAX_CHARS = 4000;

export default function ChatbotInput() {
  const t = useTranslations('Chatbot');
  const { send, sendingMessage } = useChatbot();
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 24;
    const maxHeight = lineHeight * 5;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || sendingMessage) return;

    await send(trimmed);
    setValue('');
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      adjustHeight();
    });
  }, [value, sendingMessage, send, adjustHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let next = e.target.value;
    if (next.length > MAX_CHARS) {
      next = next.slice(0, MAX_CHARS);
      toast.error(`Message truncated to ${MAX_CHARS} characters.`);
    }
    setValue(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !sendingMessage;

  return (
    <div className="shrink-0 border-t border-[#E5E7EB] bg-white px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('inputPlaceholder')}
          rows={1}
          disabled={sendingMessage}
          className="min-h-[40px] flex-1 resize-none rounded-md border border-[#D1D5DB] px-3 py-2 text-[15px] leading-6 focus:border-primary-gold focus:outline-none focus:ring-2 focus:ring-primary-gold/30 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label={sendingMessage ? t('sending') : t('send')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-gold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sendingMessage ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

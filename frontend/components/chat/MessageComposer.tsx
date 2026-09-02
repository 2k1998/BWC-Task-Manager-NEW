'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';

interface MessageComposerProps {
  sending: boolean;
  onSend: (text: string, attachment: File | null) => Promise<boolean>;
  onTyping: (isTyping: boolean) => void;
  onRequestApproval: () => void;
}

export default function MessageComposer({ sending, onSend, onTyping, onRequestApproval }: MessageComposerProps) {
  const t = useTranslations('Chat');
  const [messageInput, setMessageInput] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSend = async () => {
    if (!messageInput.trim() && !attachment) return;
    const ok = await onSend(messageInput.trim(), attachment);
    if (ok) {
      setMessageInput('');
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onTyping(false);
    }
  };

  return (
    <footer className="border-t border-gray-200 p-3 space-y-2 fixed inset-x-0 bottom-0 bg-white md:static">
      <div className="flex items-center gap-2">
        <input
          type="file"
          id="chat-attachment"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => setAttachment(e.target.files?.[0] || null)}
        />
        <label
          htmlFor="chat-attachment"
          className="px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
        >
          {t('attachFile')}
        </label>
        {attachment ? <span className="text-xs text-gray-500 truncate">{attachment.name}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={onRequestApproval}>
          {t('requestApproval')}
        </Button>
        <input
          value={messageInput}
          onChange={(e) => {
            setMessageInput(e.target.value);
            onTyping(true);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => onTyping(false), 1000);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-900 caret-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-[#D1AE62] focus:border-[#D1AE62]"
          placeholder={t('typeMessage')}
        />
        <Button type="button" onClick={handleSend} disabled={sending}>
          {sending ? t('sending') : t('send')}
        </Button>
      </div>
    </footer>
  );
}

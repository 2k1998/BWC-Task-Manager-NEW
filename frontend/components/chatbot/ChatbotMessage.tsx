'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
import type { ChatbotMessage as ChatbotMessageType } from '@/lib/chatbotApi';

interface ChatbotMessageProps {
  message: ChatbotMessageType;
}

export default function ChatbotMessage({ message }: ChatbotMessageProps) {
  const t = useTranslations('Chatbot');

  if (!message.content) return null;

  const isUser = message.role === 'user';
  const relativeTime = formatDistanceToNow(new Date(message.created_at), { addSuffix: true });

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`px-3.5 py-2.5 text-[15px] leading-relaxed ${
          isUser
            ? 'max-w-[80%] rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-md bg-primary-gold text-white'
            : 'max-w-[90%] rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-md bg-[#F3F4F6] text-black'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none break-words prose-headings:my-2 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2 prose-code:text-xs prose-pre:overflow-x-auto prose-pre:rounded prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-a:text-primary-gold prose-a:underline hover:prose-a:text-brand-brown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
      <span className="mt-1 text-meta text-gray-400">
        {isUser ? t('you') : t('assistant')} · {relativeTime}
      </span>
    </div>
  );
}

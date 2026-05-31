'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import {
  createConversation,
  getMessages,
  listConversations,
  sendMessage,
  type ChatbotConversationListItem,
  type ChatbotMessage,
} from '@/lib/chatbotApi';
import { extractErrorMessage } from '@/lib/utils';

interface ChatbotContextType {
  isOpen: boolean;
  conversations: ChatbotConversationListItem[];
  activeConversationId: string | null;
  messages: ChatbotMessage[];
  loadingMessages: boolean;
  sendingMessage: boolean;
  error: string | null;
  open: () => Promise<void>;
  close: () => void;
  toggle: () => Promise<void>;
  send: (content: string) => Promise<void>;
  newConversation: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export function ChatbotProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const t = useTranslations('Chatbot');

  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<ChatbotConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasInitializedRef = useRef(false);
  const initializingRef = useRef(false);

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    try {
      const list = await listConversations();
      setConversations(list);
    } catch (err) {
      console.error('Failed to refresh conversations:', err);
    }
  }, [user]);

  const selectConversation = useCallback(
    async (id: string) => {
      if (!user) return;
      setActiveConversationId(id);
      setLoadingMessages(true);
      setError(null);
      try {
        const msgs = await getMessages(id);
        setMessages(msgs);
      } catch (err) {
        const msg = extractErrorMessage(err);
        setError(msg);
        toast.error(t('errorLoad'));
      } finally {
        setLoadingMessages(false);
      }
    },
    [user, t],
  );

  const newConversation = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const conv = await createConversation();
      setActiveConversationId(conv.id);
      setMessages([]);
      await refreshConversations();
    } catch (err) {
      toast.error(t('errorCreate'));
      console.error('Failed to create conversation:', err);
    }
  }, [user, t, refreshConversations]);

  const initializeOnFirstOpen = useCallback(async () => {
    if (!user || hasInitializedRef.current || initializingRef.current) return;
    initializingRef.current = true;
    try {
      const list = await listConversations();
      setConversations(list);
      if (list.length > 0) {
        await selectConversation(list[0].id);
      } else {
        await newConversation();
      }
      hasInitializedRef.current = true;
    } catch (err) {
      console.error('Failed to initialize chatbot:', err);
      toast.error(t('errorLoad'));
    } finally {
      initializingRef.current = false;
    }
  }, [user, selectConversation, newConversation, t]);

  const open = useCallback(async () => {
    if (!user) return;
    setIsOpen(true);
    if (!hasInitializedRef.current) {
      await initializeOnFirstOpen();
    }
  }, [user, initializeOnFirstOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(async () => {
    if (isOpen) {
      close();
    } else {
      await open();
    }
  }, [isOpen, open, close]);

  const send = useCallback(
    async (content: string) => {
      if (!user || !activeConversationId || sendingMessage) return;

      const trimmed = content.trim();
      if (!trimmed) return;

      setError(null);
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: ChatbotMessage = {
        id: tempId,
        role: 'user',
        content: trimmed,
        tool_name: null,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setSendingMessage(true);

      try {
        const assistantReply = await sendMessage(activeConversationId, trimmed);
        setMessages((prev) => [...prev, assistantReply]);
        refreshConversations();
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast.error(t('errorSend'));
        console.error('Failed to send message:', extractErrorMessage(err));
      } finally {
        setSendingMessage(false);
      }
    },
    [user, activeConversationId, sendingMessage, t, refreshConversations],
  );

  return (
    <ChatbotContext.Provider
      value={{
        isOpen,
        conversations,
        activeConversationId,
        messages,
        loadingMessages,
        sendingMessage,
        error,
        open,
        close,
        toggle,
        send,
        newConversation,
        selectConversation,
        refreshConversations,
      }}
    >
      {children}
    </ChatbotContext.Provider>
  );
}

export function useChatbot() {
  const context = useContext(ChatbotContext);
  if (context === undefined) {
    throw new Error('useChatbot must be used within a ChatbotProvider');
  }
  return context;
}

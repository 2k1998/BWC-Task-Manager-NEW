'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Badge, Button, EmptyState, ErrorState, Input, LoadingSkeleton } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { getAccessToken } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errorHandler';
import type { ChatMessage, ChatThread, UserSearchResult } from '@/lib/types';

function getWsBaseUrl() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  if (apiBase.startsWith('https://')) return apiBase.replace('https://', 'wss://');
  if (apiBase.startsWith('http://')) return apiBase.replace('http://', 'ws://');
  return apiBase;
}

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
}

function normalizeThreads(data: unknown): ChatThread[] {
  const container = asRecord(data);
  const raw = Array.isArray(container.threads) ? container.threads : Array.isArray(data) ? data : [];
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => {
    const row = asRecord(t);
    const lastMessage = asRecord(row.last_message);
    const firstName = typeof row.other_user_first_name === 'string' ? row.other_user_first_name : '';
    const lastName = typeof row.other_user_last_name === 'string' ? row.other_user_last_name : '';
    return {
      id: typeof row.id === 'string' ? row.id : '',
      other_user_id:
        typeof row.other_user_id === 'string'
          ? row.other_user_id
          : typeof row.user_id === 'string'
          ? row.user_id
          : typeof row.participant_id === 'string'
          ? row.participant_id
          : null,
      other_user_name:
        (typeof row.other_user_name === 'string' ? row.other_user_name : '') ||
        (typeof row.user_name === 'string' ? row.user_name : '') ||
        [firstName, lastName].filter(Boolean).join(' ') ||
        'Unknown user',
      other_user_username:
        typeof row.other_user_username === 'string'
          ? row.other_user_username
          : typeof row.username === 'string'
          ? row.username
          : null,
      other_user_photo_url:
        typeof row.other_user_photo_url === 'string'
          ? row.other_user_photo_url
          : typeof row.profile_photo_url === 'string'
          ? row.profile_photo_url
          : null,
      last_message_text:
        (typeof row.last_message_text === 'string' ? row.last_message_text : '') ||
        (typeof lastMessage.message_text === 'string' ? lastMessage.message_text : ''),
      last_message_created_at:
        (typeof row.last_message_created_at === 'string' ? row.last_message_created_at : null) ||
        (typeof lastMessage.created_at === 'string' ? lastMessage.created_at : null) ||
        (typeof row.created_at === 'string' ? row.created_at : null),
      unread_count: Number(typeof row.unread_count === 'number' ? row.unread_count : 0),
      created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
    };
  }).filter((t) => t.id.length > 0);
}

function normalizeMessages(data: unknown, threadId: string): ChatMessage[] {
  const container = asRecord(data);
  const raw = Array.isArray(container.messages) ? container.messages : Array.isArray(data) ? data : [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => {
      const row = asRecord(m);
      return {
        id: typeof row.id === 'string' ? row.id : '',
        thread_id: typeof row.thread_id === 'string' ? row.thread_id : threadId,
        sender_user_id: typeof row.sender_user_id === 'string' ? row.sender_user_id : '',
        message_text: typeof row.message_text === 'string' ? row.message_text : '',
        file_id: typeof row.file_id === 'string' ? row.file_id : null,
        is_read: Boolean(row.is_read),
        created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
      };
    })
    .filter((m) => m.id.length > 0 && m.sender_user_id.length > 0);
}

export default function ChatPage() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [typingText, setTypingText] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const groupedMessages = useMemo(() => {
    return messages.reduce<Record<string, ChatMessage[]>>((acc, message) => {
      const key = new Date(message.created_at).toDateString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(message);
      return acc;
    }, {});
  }, [messages]);

  const fetchThreads = useCallback(async () => {
    try {
      setLoadingThreads(true);
      setError(null);
      const response = await apiClient.get('/chat/threads');
      const nextThreads = normalizeThreads(response.data).sort((a, b) => {
        const aTime = new Date(a.last_message_created_at || a.created_at || 0).getTime();
        const bTime = new Date(b.last_message_created_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
      setThreads(nextThreads);
      if (!selectedThreadId && nextThreads[0]?.id) {
        setSelectedThreadId(nextThreads[0].id);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load chat threads.'));
    } finally {
      setLoadingThreads(false);
    }
  }, [selectedThreadId]);

  const fetchThreadMessages = async (threadId: string) => {
    try {
      setLoadingMessages(true);
      const response = await apiClient.get(`/chat/threads/${threadId}`);
      setMessages(normalizeMessages(response.data, threadId));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load conversation.'));
    } finally {
      setLoadingMessages(false);
    }
  };

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const openThreadWs = useCallback((threadId: string) => {
    closeWs();
    const token = getAccessToken();
    const wsUrl = token
      ? `${getWsBaseUrl()}/ws/chat/${threadId}?token=${encodeURIComponent(token)}`
      : `${getWsBaseUrl()}/ws/chat/${threadId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data?.type;
        const payload = data?.payload || {};

        if (type === 'message' || type === 'new_message') {
          const messagePayload = type === 'new_message' ? data?.message : payload;
          const incoming = normalizeMessages([messagePayload], threadId)[0];
          if (!incoming) return;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          setThreads((prev) =>
            prev
              .map((thread) =>
                thread.id === threadId
                  ? {
                      ...thread,
                      last_message_text: incoming.message_text || '[Attachment]',
                      last_message_created_at: incoming.created_at,
                    }
                  : thread
              )
              .sort((a, b) => {
                const aTime = new Date(a.last_message_created_at || a.created_at || 0).getTime();
                const bTime = new Date(b.last_message_created_at || b.created_at || 0).getTime();
                return bTime - aTime;
              })
          );
          return;
        }

        if (type === 'typing') {
          const typingPayload = {
            user_id: data?.user_id ?? payload?.user_id,
            is_typing: data?.is_typing ?? payload?.is_typing,
          };
          const isOwn = typingPayload.user_id && typingPayload.user_id === currentUserIdRef.current;
          if (!isOwn && typingPayload.is_typing) {
            setTypingText('User is typing...');
          } else {
            setTypingText('');
          }
          return;
        }

        if (type === 'read_receipt') {
          const messageId = data?.message_id ?? payload?.message_id;
          const ids: string[] = Array.isArray(payload?.message_ids)
            ? payload.message_ids
            : messageId
            ? [messageId]
            : [];
          if (ids.length === 0) return;
          setMessages((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, is_read: true } : m)));
        }
      } catch {
        // Ignore unknown payloads
      }
    };
  }, [closeWs]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: isTyping }));
  }, []);

  useEffect(() => {
    apiClient
      .get('/auth/me')
      .then((res) => {
        currentUserIdRef.current = res.data?.id || null;
      })
      .catch(() => {
        currentUserIdRef.current = null;
      });
    fetchThreads();
    return () => {
      closeWs();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [fetchThreads, closeWs]);

  useEffect(() => {
    if (!selectedThreadId) return;
    setTypingText('');
    fetchThreadMessages(selectedThreadId);
    openThreadWs(selectedThreadId);
  }, [selectedThreadId, openThreadWs]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await apiClient.get('/users', { params: { query: q } });
        setSearchResults(response.data?.users || response.data || []);
      } catch {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleStartThread = async (user: UserSearchResult) => {
    try {
      const response = await apiClient.post('/chat/threads', { other_user_id: user.id });
      const threadId = response.data?.thread_id || response.data?.id || response.data?.thread?.id;
      if (!threadId) throw new Error('No thread id returned');
      await fetchThreads();
      setSelectedThreadId(threadId);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to start conversation.'));
    }
  };

  const handleSendMessage = async () => {
    if (!selectedThreadId) return;
    if (!messageInput.trim() && !attachment) return;
    try {
      setSending(true);
      let fileId: string | null = null;
      if (attachment) {
        const fd = new FormData();
        fd.append('file', attachment);
        const uploadRes = await apiClient.post('/documents', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        fileId =
          uploadRes.data?.id ||
          uploadRes.data?.file_id ||
          uploadRes.data?.document_id ||
          uploadRes.data?.document?.id ||
          null;
      }

      await apiClient.post('/chat/messages', {
        thread_id: selectedThreadId,
        message_text: messageInput.trim() || null,
        file_id: fileId,
      });
      setMessageInput('');
      setAttachment(null);
      sendTyping(false);
      await fetchThreadMessages(selectedThreadId);
      await fetchThreads();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send message.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="h-[calc(100vh-120px)] bg-white border border-gray-200 rounded-lg overflow-hidden relative">
        <div className="h-full grid grid-cols-1 md:grid-cols-[340px_1fr]">
          <section
            className={`border-r border-gray-200 flex flex-col min-h-0 ${
              selectedThreadId ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="p-4 border-b border-gray-200">
              <Input
                label="Start or find conversation"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user..."
              />
              {searchResults.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-md bg-white max-h-48 overflow-y-auto">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => handleStartThread(u)}
                    >
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || u.email || 'User'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingThreads ? (
                <div className="p-4">
                  <LoadingSkeleton variant="list" count={6} />
                </div>
              ) : error ? (
                <ErrorState message={error} onRetry={fetchThreads} />
              ) : threads.length === 0 ? (
                <EmptyState title="No conversations yet" description="Search a user above to start chatting." />
              ) : (
                <ul>
                  {threads.map((thread) => (
                    <li key={thread.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedThreadId(thread.id)}
                        className={`w-full p-3 min-h-[60px] border-b border-gray-100 text-left ${
                          selectedThreadId === thread.id ? 'bg-[#D1AE62]/10' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[15px] font-medium text-gray-900 truncate">{thread.other_user_name}</p>
                          {thread.unread_count ? <Badge color="blue">{thread.unread_count}</Badge> : null}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{thread.last_message_text || 'No messages yet'}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {thread.last_message_created_at
                            ? new Date(thread.last_message_created_at).toLocaleString()
                            : 'No timestamp'}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section
            className={`flex flex-col min-h-0 ${
              selectedThreadId ? 'fixed inset-0 z-40 bg-white md:static md:z-auto' : 'hidden md:flex'
            }`}
          >
            {!selectedThreadId ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState title="Select a conversation or start a new one." />
              </div>
            ) : (
              <>
                <header className="h-16 px-4 border-b border-gray-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedThreadId(null)}
                      className="md:hidden text-gray-700 hover:text-gray-900"
                      aria-label="Back to threads"
                    >
                      ←
                    </button>
                    <h2 className="font-semibold text-gray-900 truncate">{selectedThread?.other_user_name || 'Conversation'}</h2>
                  </div>
                  <span className="text-xs text-gray-500">{typingText}</span>
                </header>

                <div className="flex-1 overflow-y-auto p-4 pb-36 md:pb-4 space-y-4">
                  {loadingMessages ? (
                    <LoadingSkeleton variant="list" count={4} />
                  ) : Object.keys(groupedMessages).length === 0 ? (
                    <EmptyState title="No messages yet" description="Start the conversation." />
                  ) : (
                    Object.entries(groupedMessages).map(([date, dayMessages]) => (
                      <div key={date} className="space-y-2">
                        <p className="text-xs text-gray-400 text-center">{date}</p>
                        {dayMessages.map((message) => {
                          const isMine = message.sender_user_id === currentUserIdRef.current;
                          return (
                            <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                              <div className="max-w-[70%] border border-gray-200 rounded-md px-3 py-2 bg-white">
                                {message.message_text ? <p className="text-[15px] text-gray-800">{message.message_text}</p> : null}
                                {message.file_id ? <p className="text-xs text-gray-500 mt-1">Attachment: {message.file_id}</p> : null}
                                <div className="text-[11px] text-gray-400 mt-1">
                                  {new Date(message.created_at).toLocaleTimeString()} {isMine ? (message.is_read ? '· Read' : '· Sent') : ''}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>

                <footer className="border-t border-gray-200 p-3 space-y-2 fixed inset-x-0 bottom-0 bg-white md:static">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="chat-attachment"
                      className="hidden"
                      onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                    />
                    <label
                      htmlFor="chat-attachment"
                      className="px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      Attach file
                    </label>
                    {attachment ? <span className="text-xs text-gray-500 truncate">{attachment.name}</span> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        sendTyping(true);
                        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                        typingTimerRef.current = setTimeout(() => sendTyping(false), 1000);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-900 caret-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-[#D1AE62] focus:border-[#D1AE62]"
                      placeholder="Type a message..."
                    />
                    <Button type="button" onClick={handleSendMessage} disabled={sending}>
                      {sending ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </footer>
              </>
            )}
          </section>
        </div>
      </div>
    </ProtectedLayout>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Badge, Button, EmptyState, ErrorState, Input, LoadingSkeleton, Modal } from '@/components/ui';
import { getPublicWsBaseUrl } from '@/lib/apiBase';
import apiClient from '@/lib/apiClient';
import { getAccessToken } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errorHandler';
import type { ChatMessage, ChatThread, ChatThreadMember, UserSearchResult } from '@/lib/types';

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
}

function fullName(member: Partial<ChatThreadMember> | UserSearchResult): string {
  const first = String(member.first_name || '').trim();
  const last = String(member.last_name || '').trim();
  const named = `${first} ${last}`.trim();
  return named || String(member.email || '').trim() || 'Unknown user';
}

function normalizeThreads(data: unknown): ChatThread[] {
  const container = asRecord(data);
  const raw = Array.isArray(container.threads) ? container.threads : Array.isArray(data) ? data : [];
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => {
    const row = asRecord(t);
    const membersRaw = Array.isArray(row.members) ? row.members : [];
    const members = membersRaw.map((m) => {
      const member = asRecord(m);
      return {
        user_id: String(member.user_id || ''),
        first_name: String(member.first_name || ''),
        last_name: String(member.last_name || ''),
        email: String(member.email || ''),
      };
    }).filter((m) => m.user_id);
    return {
      id: typeof row.id === 'string' ? row.id : '',
      is_group: Boolean(row.is_group),
      group_name: typeof row.group_name === 'string' ? row.group_name : null,
      members,
      last_message_text: typeof row.last_message_text === 'string' ? row.last_message_text : null,
      last_message_created_at: typeof row.last_message_created_at === 'string' ? row.last_message_created_at : null,
      unread_count: Number(typeof row.unread_count === 'number' ? row.unread_count : 0),
      created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
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
        message_type: typeof row.message_type === 'string' ? row.message_type : 'text',
        approval_status:
          row.approval_status === 'approved' || row.approval_status === 'declined' || row.approval_status === 'pending'
            ? row.approval_status
            : null,
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
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalForm, setApprovalForm] = useState({
    request_type: 'General',
    title: '',
    description: '',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const selectedThreadTitle = useMemo(() => {
    if (!selectedThread) return 'Conversation';
    if (selectedThread.is_group) {
      return selectedThread.group_name || selectedThread.members.map((m) => fullName(m)).join(', ');
    }
    const other = selectedThread.members.find((m) => m.user_id !== currentUserIdRef.current);
    return fullName(other || {});
  }, [selectedThread]);

  const selectedThreadMembersLabel = useMemo(() => {
    if (!selectedThread) return '';
    if (selectedThread.is_group) {
      return selectedThread.members.map((m) => fullName(m)).join(', ');
    }
    const other = selectedThread.members.find((m) => m.user_id !== currentUserIdRef.current);
    return fullName(other || {});
  }, [selectedThread]);

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
      const response = await apiClient.get(`/chat/threads/${threadId}/messages`);
      setMessages(normalizeMessages(response.data, threadId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
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
      ? `${getPublicWsBaseUrl()}/ws/chat/${threadId}?token=${encodeURIComponent(token)}`
      : `${getPublicWsBaseUrl()}/ws/chat/${threadId}`;

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

  const createDirectThread = async (user: UserSearchResult) => {
    try {
      const response = await apiClient.post('/chat/threads', { member_ids: [user.id], is_group: false });
      const threadId = response.data?.id;
      if (!threadId) throw new Error('No thread id returned');
      await fetchThreads();
      setSelectedThreadId(threadId);
      setSearchQuery('');
      setSearchResults([]);
      setIsGroupMode(false);
      setSelectedMemberIds([]);
      setGroupName('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to start conversation.'));
    }
  };

  const toggleGroupMember = (userId: string) => {
    setSelectedMemberIds((prev) => (
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    ));
  };

  const createGroupThread = async () => {
    if (!groupName.trim()) {
      toast.error('Group name is required');
      return;
    }
    if (selectedMemberIds.length === 0) {
      toast.error('Select at least one user');
      return;
    }
    try {
      const response = await apiClient.post('/chat/threads', {
        member_ids: selectedMemberIds,
        is_group: true,
        group_name: groupName.trim(),
      });
      const threadId = response.data?.id;
      if (!threadId) throw new Error('No thread id returned');
      await fetchThreads();
      setSelectedThreadId(threadId);
      setSearchQuery('');
      setSearchResults([]);
      setIsGroupMode(false);
      setSelectedMemberIds([]);
      setGroupName('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create group chat.'));
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

      await apiClient.post(`/chat/threads/${selectedThreadId}/messages`, {
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

  const handleSendApprovalRequest = async () => {
    if (!selectedThreadId) return;
    if (!approvalForm.title.trim() || !approvalForm.description.trim()) {
      toast.error('Title and description are required');
      return;
    }
    try {
      await apiClient.post(`/chat/threads/${selectedThreadId}/approval-request`, approvalForm);
      setShowApprovalModal(false);
      setApprovalForm({ request_type: 'General', title: '', description: '' });
      await fetchThreadMessages(selectedThreadId);
      await fetchThreads();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send approval request.'));
    }
  };

  const handleApprovalAction = async (messageId: string, status: 'approved' | 'declined') => {
    try {
      await apiClient.patch(`/chat/messages/${messageId}/approval`, { status });
      if (selectedThreadId) {
        await fetchThreadMessages(selectedThreadId);
        await fetchThreads();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update approval status.'));
    }
  };

  const parseApprovalText = (text: string | null | undefined) => {
    if (!text) return null;
    const parsed = {
      request_type: '',
      title: '',
      description: '',
    };
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().startsWith('type:')) parsed.request_type = line.slice(5).trim();
      if (line.toLowerCase().startsWith('title:')) parsed.title = line.slice(6).trim();
      if (line.toLowerCase().startsWith('description:')) parsed.description = line.slice(12).trim();
    }
    if (!parsed.title && !parsed.description && !parsed.request_type) return null;
    return parsed;
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
              {searchQuery.trim() && (
                <div className="mt-2 border border-gray-200 rounded-md bg-white max-h-48 overflow-y-auto">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 font-medium"
                    onClick={() => {
                      setIsGroupMode(true);
                      setSelectedMemberIds([]);
                    }}
                  >
                    + New Group
                  </button>
                  {searchResults.map((u) => (
                    isGroupMode ? (
                      <label key={u.id} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(u.id)}
                          onChange={() => toggleGroupMember(u.id)}
                        />
                        <span>{fullName(u)}</span>
                      </label>
                    ) : (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => createDirectThread(u)}
                      >
                        {fullName(u)}
                      </button>
                    )
                  ))}
                  {isGroupMode && (
                    <div className="p-3 border-t border-gray-200 space-y-2">
                      <input
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Group name"
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button type="button" onClick={createGroupThread}>Create Group</Button>
                        <Button type="button" variant="secondary" onClick={() => setIsGroupMode(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
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
                          <p className="text-[15px] font-medium text-gray-900 truncate">
                            {thread.is_group
                              ? (thread.group_name || thread.members.map((m) => fullName(m)).join(', '))
                              : fullName(thread.members.find((m) => m.user_id !== currentUserIdRef.current) || {})}
                          </p>
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
                    <div className="min-w-0">
                      <h2 className="font-semibold text-gray-900 truncate">{selectedThreadTitle}</h2>
                      <p className="text-xs text-gray-500 truncate">{selectedThreadMembersLabel}</p>
                    </div>
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
                              {message.message_type === 'approval' ? (
                                <div className="max-w-[80%] border border-gray-200 rounded-md px-3 py-3 bg-white space-y-2">
                                  {(() => {
                                    const parsed = parseApprovalText(message.message_text);
                                    return (
                                      <>
                                        <p className="text-sm font-semibold text-gray-900">{parsed?.title || 'Approval Request'}</p>
                                        {parsed?.request_type ? <p className="text-xs text-gray-500">Type: {parsed.request_type}</p> : null}
                                        <p className="text-sm text-gray-700">{parsed?.description || message.message_text}</p>
                                      </>
                                    );
                                  })()}
                                  <Badge color={
                                    message.approval_status === 'approved' ? 'green' :
                                    message.approval_status === 'declined' ? 'red' : 'yellow'
                                  }>
                                    {message.approval_status ? message.approval_status : 'pending'}
                                  </Badge>
                                  {!isMine && message.approval_status === 'pending' && (
                                    <div className="flex flex-wrap gap-2">
                                      <Button type="button" size="sm" onClick={() => handleApprovalAction(message.id, 'approved')}>Approve</Button>
                                      <Button type="button" size="sm" variant="destructive" onClick={() => handleApprovalAction(message.id, 'declined')}>Decline</Button>
                                      <Button type="button" size="sm" variant="secondary">Discuss</Button>
                                    </div>
                                  )}
                                  <div className="text-[11px] text-gray-400 mt-1">
                                    {new Date(message.created_at).toLocaleTimeString()} {isMine ? (message.is_read ? '· Read' : '· Sent') : ''}
                                  </div>
                                </div>
                              ) : (
                                <div className="max-w-[70%] border border-gray-200 rounded-md px-3 py-2 bg-white">
                                  {message.message_text ? <p className="text-[15px] text-gray-800">{message.message_text}</p> : null}
                                  {message.file_id ? <p className="text-xs text-gray-500 mt-1">Attachment: {message.file_id}</p> : null}
                                  <div className="text-[11px] text-gray-400 mt-1">
                                    {new Date(message.created_at).toLocaleTimeString()} {isMine ? (message.is_read ? '· Read' : '· Sent') : ''}
                                  </div>
                                </div>
                              )}
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
                    <Button type="button" variant="secondary" onClick={() => setShowApprovalModal(true)}>
                      Request Approval
                    </Button>
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
      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title="Request Approval"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
            <select
              value={approvalForm.request_type}
              onChange={(e) => setApprovalForm((prev) => ({ ...prev, request_type: e.target.value }))}
              className="w-full border border-gray-200 rounded-md px-3 py-2"
            >
              <option value="General">General</option>
              <option value="Financial">Financial</option>
              <option value="Leave">Leave</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              value={approvalForm.title}
              onChange={(e) => setApprovalForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={approvalForm.description}
              onChange={(e) => setApprovalForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-md px-3 py-2"
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowApprovalModal(false)}>Cancel</Button>
            <Button type="button" onClick={handleSendApprovalRequest}>Send Request</Button>
          </div>
        </div>
      </Modal>
    </ProtectedLayout>
  );
}

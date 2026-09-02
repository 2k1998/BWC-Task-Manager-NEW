'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Button, EmptyState, ErrorState, Input, LoadingSkeleton, Modal } from '@/components/ui';
import GroupMembersPanel from '@/components/chat/GroupMembersPanel';
import MessageBubble from '@/components/chat/MessageBubble';
import MessageComposer from '@/components/chat/MessageComposer';
import NewGroupChatModal from '@/components/chat/NewGroupChatModal';
import ThreadListItem from '@/components/chat/ThreadListItem';
import {
  fullName,
  memberName,
  normalizeMessages,
  normalizeThreads,
  threadDisplayName,
  threadMembersLabel,
} from '@/components/chat/chatUtils';
import { getPublicWsBaseUrl } from '@/lib/apiBase';
import apiClient from '@/lib/apiClient';
import { getAccessToken } from '@/lib/auth';
import { getAssignableUsers, type UserBrief } from '@/lib/api/users';
import { getErrorMessage } from '@/lib/errorHandler';
import type { ChatMessage, ChatThread } from '@/lib/types';

const WS_RECONNECT_DELAY_MS = 3000;

export default function ChatPage() {
  const t = useTranslations('Chat');
  const tCommon = useTranslations('Common');
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignableUsers, setAssignableUsers] = useState<UserBrief[]>([]);
  const [sending, setSending] = useState(false);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalForm, setApprovalForm] = useState({
    request_type: 'General',
    title: '',
    description: '',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const selectedThreadIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = currentUserId;
  selectedThreadIdRef.current = selectedThreadId;

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const selectedThreadTitle = useMemo(
    () => (selectedThread ? threadDisplayName(selectedThread, currentUserId) : ''),
    [selectedThread, currentUserId]
  );

  const selectedThreadMembers = useMemo(
    () => (selectedThread ? threadMembersLabel(selectedThread, currentUserId) : ''),
    [selectedThread, currentUserId]
  );

  const groupedMessages = useMemo(() => {
    return messages.reduce<Record<string, ChatMessage[]>>((acc, message) => {
      const key = new Date(message.created_at).toDateString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(message);
      return acc;
    }, {});
  }, [messages]);

  const typingText = useMemo(() => {
    if (!typingUserId || !selectedThread) return '';
    return t('typing', { name: memberName(selectedThread, typingUserId) });
  }, [typingUserId, selectedThread, t]);

  const fetchThreads = useCallback(async () => {
    try {
      setError(null);
      const response = await apiClient.get('/chat/threads');
      const nextThreads = normalizeThreads(response.data).sort((a, b) => {
        const aTime = new Date(a.last_message_created_at || a.created_at || 0).getTime();
        const bTime = new Date(b.last_message_created_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
      setThreads(nextThreads);
      setSelectedThreadId((prev) => prev ?? nextThreads[0]?.id ?? null);
    } catch (err) {
      setError(getErrorMessage(err, t('failedLoadThreads')));
    } finally {
      setLoadingThreads(false);
    }
  }, [t]);

  const fetchThreadMessages = useCallback(async (threadId: string) => {
    try {
      setLoadingMessages(true);
      const response = await apiClient.get(`/chat/threads/${threadId}/messages`);
      setMessages(
        normalizeMessages(response.data, threadId).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      );
    } catch (err) {
      toast.error(getErrorMessage(err, t('failedLoadConversation')));
    } finally {
      setLoadingMessages(false);
    }
  }, [t]);

  const closeWs = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
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
          if (incoming.message_type === 'system') {
            // Membership or name changed — refresh thread metadata.
            fetchThreads();
          } else {
            setThreads((prev) =>
              prev
                .map((thread) =>
                  thread.id === threadId
                    ? {
                        ...thread,
                        last_message_text: incoming.message_text || t('attachment'),
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
          }
          return;
        }

        if (type === 'typing') {
          const userId = data?.user_id ?? payload?.user_id;
          const isTyping = data?.is_typing ?? payload?.is_typing;
          const isOwn = userId && userId === currentUserIdRef.current;
          setTypingUserId(!isOwn && isTyping ? String(userId) : null);
          return;
        }

        if (type === 'message_updated') {
          const incoming = normalizeMessages([data?.message], threadId)[0];
          if (!incoming) return;
          setMessages((prev) => prev.map((m) => (m.id === incoming.id ? incoming : m)));
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

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      // Reconnect while this thread is still the one on screen.
      reconnectTimerRef.current = setTimeout(() => {
        if (selectedThreadIdRef.current === threadId) {
          openThreadWs(threadId);
        }
      }, WS_RECONNECT_DELAY_MS);
    };
  }, [closeWs, fetchThreads, t]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: isTyping }));
  }, []);

  useEffect(() => {
    apiClient
      .get('/auth/me')
      .then((res) => setCurrentUserId(res.data?.id || null))
      .catch(() => setCurrentUserId(null));
    fetchThreads();
    getAssignableUsers()
      .then(setAssignableUsers)
      .catch(() => setAssignableUsers([]));
    return () => {
      closeWs();
    };
  }, [fetchThreads, closeWs]);

  useEffect(() => {
    if (!selectedThreadId) return;
    setTypingUserId(null);
    fetchThreadMessages(selectedThreadId);
    openThreadWs(selectedThreadId);
  }, [selectedThreadId, openThreadWs, fetchThreadMessages]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return assignableUsers
      .filter((u) => u.id !== currentUserId)
      .filter(
        (u) =>
          (u.full_name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [searchQuery, assignableUsers, currentUserId]);

  const createDirectThread = async (userId: string) => {
    try {
      const response = await apiClient.post('/chat/threads', { member_ids: [userId], is_group: false });
      const threadId = response.data?.id;
      if (!threadId) throw new Error('No thread id returned');
      await fetchThreads();
      setSelectedThreadId(threadId);
      setSearchQuery('');
    } catch (err) {
      toast.error(getErrorMessage(err, t('failedStartConversation')));
    }
  };

  const handleGroupCreated = async (threadId: string) => {
    await fetchThreads();
    setSelectedThreadId(threadId);
  };

  const handleSendMessage = async (text: string, attachment: File | null): Promise<boolean> => {
    if (!selectedThreadId) return false;
    try {
      setSending(true);
      let fileId: string | null = null;
      if (attachment) {
        const fd = new FormData();
        fd.append('file', attachment);
        const uploadRes = await apiClient.post('/documents?source=chat', fd, {
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
        message_text: text || null,
        file_id: fileId,
      });
      await fetchThreadMessages(selectedThreadId);
      await fetchThreads();
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, t('failedSendMessage')));
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleSendApprovalRequest = async () => {
    if (!selectedThreadId) return;
    if (!approvalForm.title.trim() || !approvalForm.description.trim()) {
      toast.error(t('approvalFieldsRequired'));
      return;
    }
    try {
      await apiClient.post(`/chat/threads/${selectedThreadId}/approval-request`, approvalForm);
      setShowApprovalModal(false);
      setApprovalForm({ request_type: 'General', title: '', description: '' });
      await fetchThreadMessages(selectedThreadId);
      await fetchThreads();
    } catch (err) {
      toast.error(getErrorMessage(err, t('failedSendApproval')));
    }
  };

  const handleApprovalAction = async (messageId: string, status: 'approved' | 'declined') => {
    try {
      await apiClient.patch(`/chat/messages/${messageId}/approval`, { status });
      if (selectedThreadId) {
        await fetchThreadMessages(selectedThreadId);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, t('failedUpdateApproval')));
    }
  };

  const handleLeftGroup = async () => {
    setSelectedThreadId(null);
    setMessages([]);
    closeWs();
    await fetchThreads();
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
            <div className="p-4 border-b border-gray-200 space-y-3">
              <Button type="button" className="w-full" onClick={() => setShowGroupModal(true)}>
                {t('newGroup')}
              </Button>
              <div>
                <Input
                  label={t('startOrFind')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchUser')}
                />
                {searchQuery.trim() && (
                  <div className="mt-2 border border-gray-200 rounded-md bg-white max-h-48 overflow-y-auto">
                    {searchResults.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-500">{t('noUsersFound')}</p>
                    ) : (
                      searchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => createDirectThread(u.id)}
                        >
                          {u.full_name || u.email}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingThreads ? (
                <div className="p-4">
                  <LoadingSkeleton variant="list" count={6} />
                </div>
              ) : error ? (
                <ErrorState message={error} onRetry={fetchThreads} />
              ) : threads.length === 0 ? (
                <EmptyState title={t('noConversationsYet')} description={t('searchToStart')} />
              ) : (
                <ul>
                  {threads.map((thread) => (
                    <ThreadListItem
                      key={thread.id}
                      thread={thread}
                      isSelected={selectedThreadId === thread.id}
                      currentUserId={currentUserId}
                      onSelect={setSelectedThreadId}
                    />
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
                <EmptyState title={t('selectConversation')} />
              </div>
            ) : (
              <>
                <header className="h-16 px-4 border-b border-gray-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedThreadId(null)}
                      className="md:hidden text-gray-700 hover:text-gray-900"
                      aria-label={t('backToThreads')}
                    >
                      ←
                    </button>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-gray-900 truncate">{selectedThreadTitle}</h2>
                      <p className="text-xs text-gray-500 truncate">{selectedThreadMembers}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-500">{typingText}</span>
                    {selectedThread?.is_group && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => setShowMembersPanel(true)}>
                        {t('membersCount', { count: selectedThread.members.length })}
                      </Button>
                    )}
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 pb-36 md:pb-4 space-y-4">
                  {loadingMessages ? (
                    <LoadingSkeleton variant="list" count={4} />
                  ) : Object.keys(groupedMessages).length === 0 ? (
                    <EmptyState title={t('noMessagesYet')} description={t('startConversation')} />
                  ) : (
                    Object.entries(groupedMessages).map(([date, dayMessages]) => (
                      <div key={date} className="space-y-2">
                        <p className="text-xs text-gray-400 text-center">{date}</p>
                        {dayMessages.map((message) => {
                          const isMine = message.sender_user_id === currentUserId;
                          const sender = selectedThread?.members.find(
                            (m) => m.user_id === message.sender_user_id
                          );
                          return (
                            <MessageBubble
                              key={message.id}
                              message={message}
                              isMine={isMine}
                              showSender={Boolean(selectedThread?.is_group)}
                              senderName={sender ? fullName(sender) : null}
                              senderPhotoUrl={sender?.profile_photo_url}
                              onApprovalAction={handleApprovalAction}
                            />
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>

                <MessageComposer
                  sending={sending}
                  onSend={handleSendMessage}
                  onTyping={sendTyping}
                  onRequestApproval={() => setShowApprovalModal(true)}
                />
              </>
            )}
          </section>
        </div>
      </div>

      <NewGroupChatModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        currentUserId={currentUserId}
        onCreated={handleGroupCreated}
      />

      {selectedThread?.is_group && (
        <GroupMembersPanel
          isOpen={showMembersPanel}
          onClose={() => setShowMembersPanel(false)}
          thread={selectedThread}
          currentUserId={currentUserId}
          onChanged={fetchThreads}
          onLeft={handleLeftGroup}
        />
      )}

      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title={t('requestApproval')}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('requestType')}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('approvalTitle')}</label>
            <input
              value={approvalForm.title}
              onChange={(e) => setApprovalForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('approvalDescription')}</label>
            <textarea
              value={approvalForm.description}
              onChange={(e) => setApprovalForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-md px-3 py-2"
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowApprovalModal(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="button" onClick={handleSendApprovalRequest}>
              {t('sendRequest')}
            </Button>
          </div>
        </div>
      </Modal>
    </ProtectedLayout>
  );
}

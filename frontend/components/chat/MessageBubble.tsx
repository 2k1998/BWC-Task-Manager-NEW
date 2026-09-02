'use client';

import { useTranslations } from 'next-intl';
import { Badge, Button } from '@/components/ui';
import type { ChatMessage } from '@/lib/types';
import { parseSystemMessage } from './chatUtils';
import MemberAvatar from './MemberAvatar';

interface MessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  /** Shown above incoming bubbles in group threads. */
  senderName?: string | null;
  senderPhotoUrl?: string | null;
  showSender: boolean;
  onApprovalAction: (messageId: string, status: 'approved' | 'declined') => void;
}

/** Approval payloads are stored as "request_type|title|description". */
function parseApprovalText(text: string | null | undefined) {
  if (!text) return null;
  const parts = text.split('|');
  if (parts.length >= 3) {
    return {
      request_type: parts[0].trim(),
      title: parts[1].trim(),
      description: parts.slice(2).join('|').trim(),
    };
  }
  return null;
}

export default function MessageBubble({
  message,
  isMine,
  senderName,
  senderPhotoUrl,
  showSender,
  onApprovalAction,
}: MessageBubbleProps) {
  const t = useTranslations('Chat');

  if (message.message_type === 'system') {
    const payload = parseSystemMessage(message.message_text);
    let text = message.message_text || '';
    if (payload) {
      const targets = (payload.targets || []).join(', ');
      const actor = payload.actor || '';
      switch (payload.event) {
        case 'member_added':
          text = t('systemMemberAdded', { actor, targets });
          break;
        case 'member_removed':
          text = t('systemMemberRemoved', { actor, targets });
          break;
        case 'member_left':
          text = t('systemMemberLeft', { actor });
          break;
        case 'renamed':
          text = t('systemRenamed', { actor, name: payload.name || '' });
          break;
      }
    }
    return (
      <div className="flex justify-center">
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-3 py-1 text-center">
          {text}
        </p>
      </div>
    );
  }

  const timestamp = (
    <div className="text-[11px] text-gray-400 mt-1">
      {new Date(message.created_at).toLocaleTimeString()}{' '}
      {isMine ? (message.is_read ? `· ${t('read')}` : `· ${t('sent')}`) : ''}
    </div>
  );

  const senderHeader =
    !isMine && showSender && senderName ? (
      <div className="flex items-center gap-1.5 mb-1">
        <MemberAvatar name={senderName} photoUrl={senderPhotoUrl} size={20} />
        <span className="text-xs font-medium text-gray-600 truncate">{senderName}</span>
      </div>
    ) : null;

  if (message.message_type === 'approval') {
    const parsed = parseApprovalText(message.message_text);
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[80%] border border-gray-200 rounded-md px-3 py-3 bg-white space-y-2">
          {senderHeader}
          <p className="text-sm font-semibold text-gray-900">{parsed?.title || t('approvalRequest')}</p>
          {parsed?.request_type ? (
            <p className="text-xs text-gray-500">
              {t('requestType')}: {parsed.request_type}
            </p>
          ) : null}
          <p className="text-sm text-gray-700">{parsed?.description || message.message_text}</p>
          <Badge
            color={
              message.approval_status === 'approved' ? 'green' : message.approval_status === 'declined' ? 'red' : 'yellow'
            }
          >
            {message.approval_status || 'pending'}
          </Badge>
          {!isMine && message.approval_status === 'pending' && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => onApprovalAction(message.id, 'approved')}>
                {t('approve')}
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => onApprovalAction(message.id, 'declined')}>
                {t('decline')}
              </Button>
            </div>
          )}
          {timestamp}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] border border-gray-200 rounded-md px-3 py-2 ${
          isMine ? 'bg-[#D1AE62]/10' : 'bg-white'
        }`}
      >
        {senderHeader}
        {message.message_text ? <p className="text-[15px] text-gray-800 whitespace-pre-wrap">{message.message_text}</p> : null}
        {message.file_id ? (
          <p className="text-xs text-gray-500 mt-1">{t('attachment')}: {message.file_id}</p>
        ) : null}
        {timestamp}
      </div>
    </div>
  );
}

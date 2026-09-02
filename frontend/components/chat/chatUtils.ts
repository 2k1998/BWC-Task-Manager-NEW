import type { ChatMessage, ChatThread, ChatThreadMember, UserSearchResult } from '@/lib/types';

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
}

export function fullName(member: Partial<ChatThreadMember> | UserSearchResult): string {
  const first = String(member.first_name || '').trim();
  const last = String(member.last_name || '').trim();
  const named = `${first} ${last}`.trim();
  return named || String(member.email || '').trim() || 'Unknown user';
}

/** Display title for a thread: group name, or the other participant's name for 1:1. */
export function threadDisplayName(thread: ChatThread, currentUserId: string | null): string {
  if (thread.is_group) {
    return thread.group_name || thread.members.map((m) => fullName(m)).join(', ');
  }
  const other = thread.members.find((m) => m.user_id !== currentUserId);
  return fullName(other || {});
}

export function threadMembersLabel(thread: ChatThread, currentUserId: string | null): string {
  if (thread.is_group) {
    return thread.members.map((m) => fullName(m)).join(', ');
  }
  const other = thread.members.find((m) => m.user_id !== currentUserId);
  return fullName(other || {});
}

export function memberName(thread: ChatThread | null, userId: string): string {
  const member = thread?.members.find((m) => m.user_id === userId);
  return member ? fullName(member) : 'Unknown user';
}

export interface SystemMessagePayload {
  event: 'member_added' | 'member_removed' | 'member_left' | 'renamed' | string;
  actor?: string;
  targets?: string[];
  name?: string;
}

/** System messages store a JSON payload in message_text; returns null if unparsable. */
export function parseSystemMessage(text: string | null | undefined): SystemMessagePayload | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.event === 'string') {
      return parsed as SystemMessagePayload;
    }
  } catch {
    // Not a system payload
  }
  return null;
}

export function normalizeThreads(data: unknown): ChatThread[] {
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
        role: typeof member.role === 'string' ? member.role : 'member',
        profile_photo_url: typeof member.profile_photo_url === 'string' ? member.profile_photo_url : null,
      };
    }).filter((m) => m.user_id);
    return {
      id: typeof row.id === 'string' ? row.id : '',
      is_group: Boolean(row.is_group),
      group_name: typeof row.group_name === 'string' ? row.group_name : null,
      created_by: typeof row.created_by === 'string' ? row.created_by : null,
      members,
      last_message_text: typeof row.last_message_text === 'string' ? row.last_message_text : null,
      last_message_created_at: typeof row.last_message_created_at === 'string' ? row.last_message_created_at : null,
      unread_count: Number(typeof row.unread_count === 'number' ? row.unread_count : 0),
      created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    };
  }).filter((t) => t.id.length > 0);
}

export function normalizeMessages(data: unknown, threadId: string): ChatMessage[] {
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
        approval_status: (row.approval_status as 'pending' | 'approved' | 'declined' | null) ?? null,
        is_read: Boolean(row.is_read),
        created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
      };
    })
    .filter((m) => m.id.length > 0 && m.sender_user_id.length > 0);
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge, Button, Modal } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { getAssignableUsers, type UserBrief } from '@/lib/api/users';
import type { ChatThread } from '@/lib/types';
import { fullName } from './chatUtils';
import MultiUserSelect from './MultiUserSelect';
import MemberAvatar from './MemberAvatar';

interface GroupMembersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  thread: ChatThread;
  currentUserId: string | null;
  /** Called after membership or name changes so the parent can refetch. */
  onChanged: () => void;
  /** Called after the current user leaves the group. */
  onLeft: () => void;
}

export default function GroupMembersPanel({
  isOpen,
  onClose,
  thread,
  currentUserId,
  onChanged,
  onLeft,
}: GroupMembersPanelProps) {
  const t = useTranslations('Chat');
  const tCommon = useTranslations('Common');
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [addIds, setAddIds] = useState<string[]>([]);
  const [newName, setNewName] = useState(thread.group_name || '');
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);

  const isOwner = useMemo(
    () => thread.members.some((m) => m.user_id === currentUserId && m.role === 'owner'),
    [thread.members, currentUserId]
  );
  const memberIds = useMemo(() => thread.members.map((m) => m.user_id), [thread.members]);

  useEffect(() => {
    if (!isOpen) return;
    setAddIds([]);
    setNewName(thread.group_name || '');
    setRenaming(false);
    getAssignableUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [isOpen, thread.id, thread.group_name]);

  const handleAddMembers = async () => {
    if (addIds.length === 0) return;
    try {
      setBusy(true);
      await apiClient.post(`/chat/threads/${thread.id}/members`, { member_ids: addIds });
      setAddIds([]);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, t('failedAddMembers')));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!window.confirm(t('confirmRemove', { name }))) return;
    try {
      setBusy(true);
      await apiClient.delete(`/chat/threads/${thread.id}/members/${userId}`);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, t('failedRemoveMember')));
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!currentUserId) return;
    if (!window.confirm(t('confirmLeave'))) return;
    try {
      setBusy(true);
      await apiClient.delete(`/chat/threads/${thread.id}/members/${currentUserId}`);
      onClose();
      onLeft();
    } catch (err) {
      toast.error(getErrorMessage(err, t('failedLeaveGroup')));
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async () => {
    if (!newName.trim()) {
      toast.error(t('groupNameRequired'));
      return;
    }
    try {
      setBusy(true);
      await apiClient.patch(`/chat/threads/${thread.id}`, { group_name: newName.trim() });
      setRenaming(false);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, t('failedRenameGroup')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('members')}>
      <div className="space-y-5">
        {/* Group name / rename */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('groupName')}</label>
          {renaming ? (
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#D1AE62] focus:border-transparent outline-none text-[15px] text-gray-900"
                maxLength={200}
              />
              <Button type="button" size="sm" onClick={handleRename} disabled={busy}>
                {tCommon('save')}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setRenaming(false)}>
                {tCommon('cancel')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] text-gray-900 truncate">{thread.group_name}</p>
              {isOwner && (
                <Button type="button" size="sm" variant="secondary" onClick={() => setRenaming(true)}>
                  {t('renameGroup')}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Member list */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            {t('membersCount', { count: thread.members.length })}
          </p>
          <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {thread.members.map((member) => {
              const name = fullName(member);
              const isSelf = member.user_id === currentUserId;
              return (
                <li key={member.user_id} className="flex items-center gap-3 px-3 py-2">
                  <MemberAvatar name={name} photoUrl={member.profile_photo_url} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-gray-900 truncate">
                      {name}
                      {isSelf ? ` (${t('you')})` : ''}
                    </p>
                  </div>
                  {member.role === 'owner' && <Badge color="yellow">{t('owner')}</Badge>}
                  {isOwner && !isSelf && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemoveMember(member.user_id, name)}
                      disabled={busy}
                    >
                      {t('removeMember')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Add participants */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('addParticipants')}</label>
          <MultiUserSelect users={users} value={addIds} onChange={setAddIds} excludeIds={memberIds} />
          {addIds.length > 0 && (
            <div className="mt-2 flex justify-end">
              <Button type="button" size="sm" onClick={handleAddMembers} disabled={busy}>
                {t('addMembers')}
              </Button>
            </div>
          )}
        </div>

        {/* Leave group */}
        <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
          <Button type="button" variant="destructive" onClick={handleLeave} disabled={busy}>
            {t('leaveGroup')}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            {tCommon('close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

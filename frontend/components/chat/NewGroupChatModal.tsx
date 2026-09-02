'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button, Modal } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { getAssignableUsers, type UserBrief } from '@/lib/api/users';
import MultiUserSelect from './MultiUserSelect';

interface NewGroupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string | null;
  onCreated: (threadId: string) => void;
}

export default function NewGroupChatModal({ isOpen, onClose, currentUserId, onCreated }: NewGroupChatModalProps) {
  const t = useTranslations('Chat');
  const tCommon = useTranslations('Common');
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [groupName, setGroupName] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    getAssignableUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [isOpen]);

  const reset = () => {
    setGroupName('');
    setMemberIds([]);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error(t('groupNameRequired'));
      return;
    }
    if (memberIds.length < 2) {
      toast.error(t('selectAtLeastTwo'));
      return;
    }
    try {
      setCreating(true);
      const response = await apiClient.post('/chat/threads', {
        member_ids: memberIds,
        is_group: true,
        group_name: groupName.trim(),
      });
      const threadId = response.data?.id;
      if (!threadId) throw new Error('No thread id returned');
      reset();
      onClose();
      onCreated(threadId);
    } catch (err) {
      toast.error(getErrorMessage(err, t('failedCreateGroup')));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t('newGroup')}
      panelClassName="shadow-xl max-w-2xl"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('groupName')}</label>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t('groupNamePlaceholder')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#D1AE62] focus:border-transparent outline-none text-[15px] text-gray-900 placeholder:text-gray-400"
            maxLength={200}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('addParticipants')}</label>
          <MultiUserSelect
            users={users}
            value={memberIds}
            onChange={setMemberIds}
            excludeIds={currentUserId ? [currentUserId] : []}
            expanded
          />
          <p className="text-xs text-gray-500 mt-1">{t('groupMinimumHint')}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            {tCommon('cancel')}
          </Button>
          <Button type="button" onClick={handleCreate} disabled={creating}>
            {creating ? tCommon('loading') : t('createGroup')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

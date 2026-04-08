'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Modal, Select } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import type { UserSearchResult } from '@/lib/types';

interface NewApprovalRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TYPE_OPTIONS = ['General', 'Expenses', 'Task', 'Project', 'Purchase'];

export default function NewApprovalRequestModal({ isOpen, onClose, onSuccess }: NewApprovalRequestModalProps) {
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [receiverUserId, setReceiverUserId] = useState('');
  const [requestType, setRequestType] = useState(TYPE_OPTIONS[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    apiClient
      .get('/users', { params: { query: '' } })
      .then((res) => setUsers(res.data?.users || res.data || []))
      .catch(() => setUsers([]));
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required.');
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.post('/approvals', {
        receiver_user_id: receiverUserId || null,
        request_type: requestType,
        title: title.trim(),
        description: description.trim() || null,
      });
      toast.success('Approval request created.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create approval request.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Approval Request">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Receiver"
          value={receiverUserId}
          onChange={(e) => setReceiverUserId(e.target.value)}
          options={[
            { value: '', label: 'Select receiver' },
            ...users.map((u) => ({
              value: u.id,
              label: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || u.email || u.id,
            })),
          ]}
        />

        <Select
          label="Type"
          value={requestType}
          onChange={(e) => setRequestType(e.target.value)}
          options={TYPE_OPTIONS.map((type) => ({ value: type, label: type }))}
        />

        <Input label="Title *" value={title} onChange={(e) => setTitle(e.target.value)} required />

        <div>
          <label className="block text-[13px] font-medium text-gray-600 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#D1AE62] focus:border-[#D1AE62]"
            placeholder="Describe what needs approval..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

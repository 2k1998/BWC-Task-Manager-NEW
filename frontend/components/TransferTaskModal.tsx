'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import type { User } from '@/lib/types';

interface TransferTaskModalProps {
  taskId: string;
  taskTitle: string;
  urgencyLabel: string;
  subordinates: User[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function TransferTaskModal({
  taskId,
  taskTitle,
  urgencyLabel,
  subordinates,
  onClose,
  onSuccess,
}: TransferTaskModalProps) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [transferring, setTransferring] = useState(false);

  const isTransferable = urgencyLabel === 'Not Urgent & Not Important';
  const hasSubordinates = subordinates.length > 0;

  const handleTransfer = async () => {
    if (!selectedUserId) {
      toast.error('Please select a user to transfer to');
      return;
    }

    try {
      setTransferring(true);
      await apiClient.post(`/tasks/${taskId}/transfer`, {
        new_assigned_to_user_id: selectedUserId,
      });
      toast.success('Task transferred successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to transfer task');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Transfer Task</h2>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Task: <span className="font-semibold">{taskTitle}</span></p>
          <p className="text-sm text-gray-600">Urgency: <span className="font-semibold">{urgencyLabel}</span></p>
        </div>

        {!isTransferable && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ Only tasks with "Not Urgent & Not Important" urgency can be transferred.
            </p>
          </div>
        )}

        {!hasSubordinates && isTransferable && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ You have no subordinates to transfer this task to.
            </p>
          </div>
        )}

        {isTransferable && hasSubordinates && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer to (Subordinates only)
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none"
              >
                <option value="">Select a user...</option>
                {subordinates.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                💡 Transfer rules: Only "Yellow" urgency tasks can be transferred, and only to your direct subordinates.
              </p>
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={!isTransferable || !hasSubordinates || !selectedUserId || transferring}
            className="flex-1 px-4 py-2 bg-primary-gold text-black font-semibold rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {transferring ? 'Transferring...' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { toast } from 'sonner';
import { Button, Badge, Modal } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import type { ApprovalRequest } from '@/lib/types';

interface ApprovalDetailModalProps {
  isOpen: boolean;
  approval: ApprovalRequest | null;
  canResolve: boolean;
  onClose: () => void;
  onResolved: () => void;
}

function statusColor(status: string): 'yellow' | 'green' | 'red' | 'gray' {
  if (status === 'pending') return 'yellow';
  if (status === 'approved') return 'green';
  if (status === 'denied') return 'red';
  return 'gray';
}

export default function ApprovalDetailModal({
  isOpen,
  approval,
  canResolve,
  onClose,
  onResolved,
}: ApprovalDetailModalProps) {
  if (!approval) return null;

  const resolve = async (action: 'approve' | 'deny') => {
    try {
      await apiClient.post(`/approvals/${approval.id}/${action}`);
      toast.success(`Request ${action === 'approve' ? 'approved' : 'denied'}.`);
      onResolved();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to ${action} request.`));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Approval Details">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Badge color={statusColor(approval.status)}>{approval.status}</Badge>
          <span className="text-xs text-gray-500">{new Date(approval.created_at).toLocaleString()}</span>
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-1">Type</p>
          <p className="text-[15px] text-gray-800">{approval.request_type}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-1">Title</p>
          <p className="text-[15px] text-gray-800 font-medium">{approval.title}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-1">Description</p>
          <p className="text-[15px] text-gray-800 whitespace-pre-wrap">{approval.description || 'No description provided.'}</p>
        </div>

        {approval.resolved_at ? (
          <p className="text-xs text-gray-500">Resolved at: {new Date(approval.resolved_at).toLocaleString()}</p>
        ) : null}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canResolve ? (
            <>
              <Button type="button" variant="destructive" onClick={() => resolve('deny')}>
                Deny
              </Button>
              <Button type="button" onClick={() => resolve('approve')}>
                Approve
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

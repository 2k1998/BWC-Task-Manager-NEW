'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Badge, Button, EmptyState, ErrorState, LoadingSkeleton, Table } from '@/components/ui';
import NewApprovalRequestModal from '@/components/modals/NewApprovalRequestModal';
import ApprovalDetailModal from '@/components/modals/ApprovalDetailModal';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import type { ApprovalRequest } from '@/lib/types';

type ApprovalsTab = 'received' | 'sent';

function statusColor(status: string): 'yellow' | 'green' | 'red' | 'gray' {
  if (status === 'pending') return 'yellow';
  if (status === 'approved') return 'green';
  if (status === 'denied') return 'red';
  return 'gray';
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [tab, setTab] = useState<ApprovalsTab>('received');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/approvals');
      const list = response.data?.approvals || response.data || [];
      setApprovals(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load approvals.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const filteredApprovals = useMemo(() => {
    if (!user?.id) return [];
    if (tab === 'received') return approvals.filter((a) => a.receiver_user_id === user.id);
    return approvals.filter((a) => a.requester_user_id === user.id);
  }, [approvals, tab, user?.id]);

  if (loading) {
    return (
      <ProtectedLayout>
        <LoadingSkeleton variant="table" count={8} />
      </ProtectedLayout>
    );
  }

  if (error) {
    return (
      <ProtectedLayout>
        <ErrorState message={error} onRetry={fetchApprovals} />
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
          <Button type="button" onClick={() => setShowCreateModal(true)}>
            New Approval Request
          </Button>
        </div>

        <div className="border-b border-gray-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('received')}
            className={`px-4 py-3 text-[15px] border-b-2 ${
              tab === 'received' ? 'border-[#D1AE62] text-[#D1AE62]' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Received
          </button>
          <button
            type="button"
            onClick={() => setTab('sent')}
            className={`px-4 py-3 text-[15px] border-b-2 ${
              tab === 'sent' ? 'border-[#D1AE62] text-[#D1AE62]' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Sent
          </button>
        </div>

        {filteredApprovals.length === 0 ? (
          <EmptyState title={`No ${tab} approvals`} description="Approval requests will appear here." />
        ) : (
          <Table>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">{tab === 'received' ? 'Requester' : 'Receiver'}</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredApprovals.map((approval) => (
                  <tr
                    key={approval.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedApproval(approval)}
                  >
                    <td className="px-4 py-3 text-[15px] text-gray-800">
                      <Badge color="blue">{approval.request_type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[15px] text-gray-900 font-medium">{approval.title}</td>
                    <td className="px-4 py-3 text-[15px] text-gray-700">
                      {tab === 'received'
                        ? approval.requester_name || approval.requester_user_id
                        : approval.receiver_name || approval.receiver_user_id}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={statusColor(approval.status)}>{approval.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-500">{new Date(approval.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Table>
        )}
      </div>

      <NewApprovalRequestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchApprovals}
      />

      <ApprovalDetailModal
        isOpen={Boolean(selectedApproval)}
        approval={selectedApproval}
        canResolve={Boolean(
          selectedApproval &&
            user?.id &&
            selectedApproval.receiver_user_id === user.id &&
            selectedApproval.status === 'pending'
        )}
        onClose={() => setSelectedApproval(null)}
        onResolved={fetchApprovals}
      />
    </ProtectedLayout>
  );
}

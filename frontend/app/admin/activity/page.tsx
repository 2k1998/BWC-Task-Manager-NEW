'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/apiClient';
import { ActivityLog, ActivityLogListResponse } from '@/lib/types';
import AdminRoute from '@/components/AdminRoute';
import { format } from 'date-fns';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const pageSize = 20;

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<ActivityLogListResponse>('/activity-logs/admin', {
        params: {
          page,
          page_size: pageSize,
        },
      });
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (err) {
      console.error('Failed to fetch global logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatValue = (val: any): string => {
      if (val === null || val === undefined) return 'null';
      if (val === '[REDACTED]') return '[REDACTED]';
      if (typeof val === 'object') return JSON.stringify(val, null, 2);
      return String(val);
  };

  return (
    <AdminRoute>
      <div className="p-4 sm:p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Activity Logs</h1>
            <p className="text-gray-500 text-sm mt-1">
              Audit trail of all system write operations.
            </p>
          </div>
          <div className="text-sm text-gray-500">
            Total Records: <span className="font-semibold text-gray-900">{total}</span>
          </div>
        </div>

        <div className="overflow-x-auto whitespace-nowrap border-b border-gray-200 mb-6">
          <div className="inline-flex items-center gap-2 py-2">
            <Link href="/admin/users" className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900">
              Users
            </Link>
            <Link href="/admin/activity" className="px-4 py-2 text-sm font-medium border-b-2 border-primary-gold text-primary-gold">
              Activity Logs
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-0 overflow-hidden">
          <div className="block sm:hidden">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-2/3 mb-2"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                </div>
              ))
            ) : logs.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No logs found.</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 mb-3 cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="font-semibold text-gray-900">{log.perform_by_user_name || 'Unknown'}</div>
                  <div className="mt-2 text-sm text-gray-700"><span className="font-medium">Action: </span>{log.action_type}</div>
                  <div className="mt-1 text-sm text-gray-700">
                    <span className="font-medium">Timestamp: </span>
                    {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Entity</th>
                  <th className="px-6 py-4">Performed By</th>
                  <th className="px-6 py-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-20"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-28"></div></td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">
                            No logs found.
                        </td>
                    </tr>
                ) : (
                  logs.map((log) => (
                    <tr 
                        key={log.id} 
                        className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="text-xs font-mono">
                          {log.action_type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="font-medium">{log.entity_type}</span>
                        <span className="text-xs text-gray-400 ml-2 font-mono">#{log.entity_id.slice(0, 8)}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                {log.perform_by_user_name?.[0] || '?'}
                            </div>
                            {log.perform_by_user_name || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-primary-gold opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium">
                            View Diff →
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-primary-gold disabled:opacity-30 disabled:hover:text-gray-600 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500 font-medium">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-primary-gold disabled:opacity-30 disabled:hover:text-gray-600 transition-colors"
            >
              Next
            </button>
          </div>
        </div>

        {/* Diff Modal */}
        <Modal
            isOpen={!!selectedLog}
            onClose={() => setSelectedLog(null)}
            title={`Log Details: ${selectedLog?.action_type}`}
        >
            {selectedLog && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="block text-xs uppercase text-gray-400 font-semibold mb-1">Performed By</span>
                            <div className="font-medium text-gray-900">{selectedLog.perform_by_user_name}</div>
                            <div className="text-xs text-gray-400">{selectedLog.performed_by_user_id}</div>
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-gray-400 font-semibold mb-1">Entity</span>
                            <div className="font-medium text-gray-900">{selectedLog.entity_type}</div>
                            <div className="text-xs text-gray-400">{selectedLog.entity_id}</div>
                        </div>
                        <div>
                            <span className="block text-xs uppercase text-gray-400 font-semibold mb-1">Timestamp</span>
                            <div className="font-medium text-gray-900">{format(new Date(selectedLog.created_at), 'PPpp')}</div>
                        </div>
                         <div>
                            <span className="block text-xs uppercase text-gray-400 font-semibold mb-1">Log ID</span>
                            <div className="font-mono text-gray-500 text-xs">{selectedLog.id}</div>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <h4 className="text-sm font-bold text-gray-900 mb-3">State Change</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {/* Old Value */}
                             <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                                <span className="block text-xs uppercase text-red-400 font-bold mb-2">Before</span>
                                {selectedLog.old_value ? (
                                    <pre className="text-xs font-mono text-red-800 whitespace-pre-wrap overflow-x-auto">
                                        {formatValue(selectedLog.old_value)}
                                    </pre>
                                ) : (
                                    <span className="text-gray-400 text-xs italic">No previous state (Creation)</span>
                                )}
                             </div>

                             {/* New Value */}
                             <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                <span className="block text-xs uppercase text-green-400 font-bold mb-2">After</span>
                                {selectedLog.new_value ? (
                                    <pre className="text-xs font-mono text-green-800 whitespace-pre-wrap overflow-x-auto">
                                        {formatValue(selectedLog.new_value)}
                                    </pre>
                                ) : (
                                    <span className="text-gray-400 text-xs italic">No new state (Deletion)</span>
                                )}
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
      </div>
    </AdminRoute>
  );
}

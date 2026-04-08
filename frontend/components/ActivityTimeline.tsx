'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/apiClient';
import { ActivityLog, ActivityLogListResponse } from '@/lib/types';
import { format } from 'date-fns';

interface ActivityTimelineProps {
  entityType: 'Task' | 'Project' | 'Event' | 'Document' | 'Company';
  entityId: string;
}

export default function ActivityTimeline({ entityType, entityId }: ActivityTimelineProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    fetchLogs();
  }, [entityType, entityId, page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<ActivityLogListResponse>('/activity-logs', {
        params: {
          entity_type: entityType,
          entity_id: entityId,
          page,
          page_size: pageSize,
        },
      });
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (err: any) {
      console.error('Failed to fetch activity logs:', err);
      setError('Failed to load activity history.');
    } finally {
      setLoading(false);
    }
  };

  const renderDiff = (oldVal: any, newVal: any) => {
    if (!oldVal && !newVal) return null;

    // Flatten keys if possible, or just iterate
    // The backend sends redacted dicts.
    // Let's show changes.
    
    // Merge keys from both to find all changes
    const allKeys = new Set([...Object.keys(oldVal || {}), ...Object.keys(newVal || {})]);
    
    return (
      <div className="mt-2 text-sm bg-gray-50 p-3 rounded-md border border-gray-100 font-mono">
        <ul className="space-y-1">
          {Array.from(allKeys).map((key) => {
            const val1 = oldVal?.[key];
            const val2 = newVal?.[key];
            
            // Skip if strictly equal (though backend should only send diffs for updates, 
            // but Creation has null old_value)
            if (JSON.stringify(val1) === JSON.stringify(val2)) return null;

            return (
              <li key={key} className="break-all">
                <span className="font-semibold text-gray-600">{key}:</span>{' '}
                <span className="text-red-600 line-through mr-2">{formatValue(val1)}</span>
                <span className="text-gray-400">→</span>{' '}
                <span className="text-green-600 font-medium">{formatValue(val2)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return 'null';
    if (val === '[REDACTED]') return '[REDACTED]';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };
  
  const getActionLabel = (action: string) => {
    switch(action) {
      case 'CREATE': return 'Created';
      case 'UPDATE': return 'Updated';
      case 'DELETE': return 'Deleted';
      case 'STATUS_CHANGE': return 'Status Changed';
      case 'TRANSFER': return 'Transferred';
      case 'METADATA_UPDATE': return 'Metadata Updated';
      case 'set_permissions': return 'Permissions Updated';
       case 'create_user': return 'User Created';
       case 'update_user': return 'User Updated';
       case 'deactivate_user': return 'User Deactivated';
       case 'reset_password': return 'Password Reset';
      default: return action;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (loading && logs.length === 0) {
    return <div className="py-4 text-center text-gray-500 text-sm">Loading activity history...</div>;
  }

  if (error) {
    return <div className="py-4 text-center text-red-500 text-sm">{error}</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="py-8 text-center border-t border-gray-100 mt-8">
        <p className="text-gray-400 text-sm">No activity recorded.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-gray-100 pt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Activity History</h3>
      
      <div className="relative border-l-2 border-gray-100 ml-3 space-y-8">
        {logs.map((log) => (
          <div key={log.id} className="relative pl-8">
            {/* Dot */}
            <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-primary-gold" />
            
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-1">
              <p className="text-sm font-semibold text-gray-900">
                {getActionLabel(log.action_type)}
              </p>
              <span className="text-xs text-gray-400">
                {format(new Date(log.created_at), 'd MMM yyyy, HH:mm')}
              </span>
            </div>
            
            <p className="text-sm text-gray-500 mb-2">
              by <span className="font-medium text-gray-700">{log.perform_by_user_name || 'Unknown User'}</span>
            </p>

            {/* Diff Rendering */}
             {(log.old_value || log.new_value) && (
               renderDiff(log.old_value, log.new_value)
             )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8 pt-4 border-t border-dashed border-gray-100">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-sm font-medium text-gray-600 hover:text-primary-gold disabled:opacity-30 disabled:hover:text-gray-600 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-sm font-medium text-gray-600 hover:text-primary-gold disabled:opacity-30 disabled:hover:text-gray-600 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

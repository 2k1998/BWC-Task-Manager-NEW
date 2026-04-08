import type { Task } from '@/lib/types';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, newStatus: string) => Promise<void>;
  onTransferClick?: (task: Task) => void;
}

const urgencyColors = {
  Low: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  High: 'bg-red-100 text-red-800',
};

const statusColors = {
  Pending: 'bg-gray-100 text-gray-800',
  'In Progress': 'bg-primary-gold/15 text-brand-brown',
  'Under Review': 'bg-purple-100 text-purple-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
  'On Hold': 'bg-orange-100 text-orange-800',
};

export default function TaskCard({ task, onStatusChange, onTransferClick }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusUpdate = async (e: React.MouseEvent, newStatus: string) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    
    if (task.status === newStatus || !onStatusChange) return;
    
    try {
      setIsUpdating(true);
      await onStatusChange(task.id, newStatus);
    } catch (error) {
       // Error handled by parent usually, but we stop loading state
       console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTransferClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    if (onTransferClick) {
      onTransferClick(task);
    }
  };

  return (
    <Link href={`/tasks/${task.id}`}>
      <div className={`bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer relative ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-lg">{task.title}</h3>
          <div className="flex items-center gap-2 relative">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                urgencyColors[task.urgency as keyof typeof urgencyColors] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {task.urgency}
            </span>
            
            <div ref={menuRef} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                aria-label="Actions"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Change Status</div>
                  {Object.keys(statusColors).map(status => (
                    status !== task.status && (
                      <button
                        key={status}
                        onClick={(e) => handleStatusUpdate(e, status)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-brown"
                      >
                        {status}
                      </button>
                    )
                  ))}
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    onClick={handleTransferClick}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                  >
                    Transfer
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {task.description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{task.description}</p>
        )}

        <div className="flex items-center justify-between text-sm">
          <span
            className={`px-3 py-1 rounded-full font-medium ${
              statusColors[task.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {task.status}
          </span>
          <span className="text-gray-500">
            Due: {new Date(task.deadline).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
}

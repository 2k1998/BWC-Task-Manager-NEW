import type { Project } from '@/lib/types';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

interface ProjectCardProps {
  project: Project;
  onStatusChange?: (projectId: string, newStatus: string) => Promise<void>;
}

const statusColors = {
  Planning: 'bg-primary-gold/15 text-brand-brown',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  Completed: 'bg-green-100 text-green-800',
  'On Hold': 'bg-orange-100 text-orange-800',
  Cancelled: 'bg-red-100 text-red-800',
};

export default function ProjectCard({ project, onStatusChange }: ProjectCardProps) {
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
    
    if (project.status === newStatus || !onStatusChange) return;
    
    try {
      setIsUpdating(true);
      await onStatusChange(project.id, newStatus);
    } catch (error) {
       console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Link href={`/projects/${project.id}`}>
      <div className={`bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer relative ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-lg">{project.name}</h3>
          <div className="flex items-center gap-2 relative">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                statusColors[project.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {project.status}
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
                    status !== project.status && (
                      <button
                        key={status}
                        onClick={(e) => handleStatusUpdate(e, status)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-brown"
                      >
                        {status}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {project.description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{project.description}</p>
        )}

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{project.project_type}</span>
          <span>
            {new Date(project.start_date).toLocaleDateString()} -{' '}
            {new Date(project.expected_completion_date).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
}

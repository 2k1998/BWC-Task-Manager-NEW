'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ProtectedLayout from '@/components/ProtectedLayout';
import MiniCalendar from '@/components/MiniCalendar';
import { Card, Badge, EmptyState, LoadingSkeleton, ErrorState } from '@/components/ui';
import apiClient from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorHandler';
import { useAuth } from '@/context/AuthContext';
import type { Task, Event } from '@/lib/types';
import Link from 'next/link';

export default function DashboardPage() {
  const t = useTranslations('Dashboard');
  const tTasks = useTranslations('Tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tasksRes, eventsRes] = await Promise.all([
        apiClient.get('/tasks', { params: { page: 1, page_size: 100 } }),
        apiClient.get('/events', { params: { page: 1, page_size: 100 } }),
      ]);
      setTasks(tasksRes.data.tasks || []);
      setEvents(eventsRes.data.events || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  };

  // --- Urgency Buckets Logic --

  // 1. Filter: Assigned to me OR Owned by me AND Not Completed
  const myActiveTasks = tasks.filter(t => {
    if (t.status === 'Completed' || !currentUser) return false;
    // Cast to any to access backend fields that might differ from frontend types
    const taskData = t as any;
    // Check assigned_user_id (backend field) OR owner_user_id
    return (
      taskData.assigned_user_id === currentUser.id || 
      taskData.owner_user_id === currentUser.id
    );
  });

  // 2. Define Buckets
  const buckets = {
    red: [] as Task[],    // Urgent & Important
    orange: [] as Task[], // Same-day auto
    blue: [] as Task[],   // Urgent
    green: [] as Task[],  // Important
    yellow: [] as Task[]  // Not Urgent & Not Important
  };

  // 3. Map Tasks to Buckets
  myActiveTasks.forEach(task => {
    const urgency = (task as any).urgency_label;
    
    switch (urgency) {
      case 'Urgent & Important':
        buckets.red.push(task);
        break;
      case 'Same-day auto':
      case 'Orange': // Handle potential backend naming variation just in case, though requirement says 'Orange'
        buckets.orange.push(task);
        break;
      case 'Urgent':
        buckets.blue.push(task);
        break;
      case 'Important':
        buckets.green.push(task);
        break;
      case 'Not Urgent & Not Important':
        buckets.yellow.push(task);
        break;
      default:
        // If urgency mapping fails, you might want to log it or put it in a default bucket. 
        // For now, based on strict rules, we only map known ones. 
        // Or we could put unknown into yellow? Let's stick to strict map.
        console.warn(`Unknown urgency label: ${urgency} for task ${task.id}`);
        break;
    }
  });

  // Section Config for Rendering
  const sectionConfig = [
    { key: 'red', label: tTasks('urgentImportant'), subtitle: '', color: 'red' as const },
    { key: 'orange', label: tTasks('byEndOfDay'), subtitle: '', color: 'orange' as const },
    { key: 'blue', label: tTasks('urgent'), subtitle: '', color: 'blue' as const },
    { key: 'green', label: tTasks('important'), subtitle: '', color: 'green' as const },
    { key: 'yellow', label: tTasks('notUrgentNotImportant'), subtitle: '', color: 'yellow' as const },
  ];

  // Events
  const upcomingEvents = events
    .filter((e) => new Date(e.event_datetime) >= new Date())
    .sort((a, b) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime())
    .slice(0, 5);

  // Strict strict hierarchy: Loading -> Error -> Empty -> Data
  if (loading) {
    return (
      <ProtectedLayout>
        <div className="max-w-7xl mx-auto space-y-8">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
             <div className="lg:col-span-2 space-y-6 sm:space-y-8">
               <LoadingSkeleton variant="card" count={3} />
             </div>
             <div className="space-y-6">
               <LoadingSkeleton variant="card" count={1} />
             </div>
           </div>
        </div>
      </ProtectedLayout>
    );
  }

  if (error) {
    return (
      <ProtectedLayout>
        <ErrorState message={error} onRetry={fetchData} />
      </ProtectedLayout>
    );
  }

  const hasAnyTasks = Object.values(buckets).some(b => b.length > 0);

  return (
    <ProtectedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          
          {/* LEFT COLUMN: URGENCY SECTIONS */}
          <div className="lg:col-span-2 space-y-8 sm:space-y-12">
            
            {sectionConfig.map(section => {
              // @ts-ignore
              const sectionTasks = buckets[section.key] || [];

              if (sectionTasks.length === 0) return null; 

              // Map colors to Tailwind classes for the box styling
              const colorMap: Record<string, { border: string, bg: string, text: string, header: string }> = {
                red: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-900', header: 'bg-red-100' },
                orange: { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-900', header: 'bg-orange-100' },
                blue: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-900', header: 'bg-blue-100' },
                green: { border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-900', header: 'bg-green-100' },
                yellow: { border: 'border-yellow-200', bg: 'bg-yellow-50', text: 'text-yellow-900', header: 'bg-yellow-100' },
              };

              const styles = colorMap[section.color] || colorMap.yellow;

              return (
                <section key={section.key} className={`rounded-lg border ${styles.border} overflow-hidden mb-8`}>
                  {/* colored label header */}
                  <div className={`${styles.header} px-4 py-3 flex items-center justify-between border-b ${styles.border}`}>
                    <div>
                      <h2 className={`font-bold ${styles.text} text-lg`}>{section.label}</h2>
                      <p className={`text-xs ${styles.text} opacity-80`}>{section.subtitle}</p>
                    </div>
                    <Badge variant="status" color={section.color}>{sectionTasks.length}</Badge>
                  </div>

                  {/* tasks inside the box */}
                  <div className="p-4 space-y-3 bg-white">
                    {sectionTasks.map((task: Task) => (
                      <Link key={task.id} href={`/tasks/${task.id}`} className="block group">
                        <Card 
                          variant="default" 
                          className="hover:bg-gray-50 transition-colors py-3 px-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between group-hover:shadow-sm border border-gray-100"
                        >
                          <div>
                            <span className="font-medium text-gray-900 group-hover:text-primary-dark transition-colors">
                              {task.title}
                            </span>
                             <div className="flex gap-2 mt-1">
                                {new Date(task.deadline) < new Date() && (
                                   <span className="text-xs text-red-600 font-medium">{t('overdue')}</span>
                                )}
                            </div>
                          </div>
                          <div className="flex w-full items-center justify-between gap-4 text-sm text-gray-500 sm:w-auto sm:justify-start">
                            <span>{new Date(task.deadline).toLocaleDateString()}</span>
                            <Badge variant="status" color="gray">{task.status}</Badge>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
            
            {!hasAnyTasks && (
                <EmptyState 
                  title={t('myTasks')} 
                  description={t('recentTasks')} 
                />
            )}

          </div>

          {/* RIGHT COLUMN: CONTEXT */}
          <div className="space-y-8">
            
            {/* Mini Calendar */}
            <section>
              <MiniCalendar tasks={myActiveTasks} events={events} />
            </section>

            {/* Upcoming Events */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4">{t('quickStats')}</h2>
              {upcomingEvents.length > 0 ? (
                <div className="space-y-4">
                  {upcomingEvents.map(event => (
                    <div key={event.id} className="border-l-2 border-primary-gold pl-3 py-1">
                      <p className="font-medium text-gray-900 text-sm">{event.title}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(event.event_datetime).toLocaleDateString()} • {new Date(event.event_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">{t('recentTasks')}</p>
              )}
            </section>

          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}

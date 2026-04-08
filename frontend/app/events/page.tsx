'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import CreateEventModal from '@/components/modals/CreateEventModal';
import apiClient from '@/lib/apiClient';
import type { EventListResponse } from '@/lib/types';
import { Button, EmptyState, ErrorState, LoadingSkeleton } from '@/components/ui';

function EventsPageContent() {
  const [events, setEvents] = useState<EventListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<boolean | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowCreateModal(true);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('action');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchEvents();
  }, [activeFilter, fromDate, toDate]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, page_size: 50 };
      if (activeFilter !== null) params.active = activeFilter;
      if (fromDate) params.from_date = new Date(fromDate).toISOString();
      if (toDate) params.to_date = new Date(toDate).toISOString();

      const response = await apiClient.get<EventListResponse>('/events', { params });
      setEvents(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Events</h1>
            <Button 
                variant="primary" 
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Event
            </Button>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={activeFilter === null ? '' : activeFilter ? 'active' : 'completed'}
                onChange={(e) =>
                  setActiveFilter(e.target.value === '' ? null : e.target.value === 'active')
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none"
              >
                <option value="">All Events</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton variant="list" count={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchEvents} />
        ) : events && events.events.length === 0 ? (
          <EmptyState
            icon={<span className="text-5xl" aria-hidden="true">📅</span>}
            title="No events found"
            description="Try adjusting your filters to see more events."
          />
        ) : (
          <div className="space-y-3">
            {events?.events.map((event) => (
              <div
                key={event.id}
                onClick={() => router.push(`/events/${event.id}`)}
                className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 cursor-pointer hover:border-primary-gold transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">{event.title}</h3>
                    <p className="text-gray-600 text-sm mb-2">📍 {event.location}</p>
                    {event.description && (
                      <p className="text-gray-600 text-sm mb-2 line-clamp-2">{event.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(event.event_datetime).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(event.event_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showCreateModal && (
            <CreateEventModal 
                onClose={() => setShowCreateModal(false)}
                onSuccess={() => {
                    fetchEvents();
                }}
            />
        )}
      </div>
    </ProtectedLayout>
  );
}

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <ProtectedLayout>
          <div className="p-6">
            <LoadingSkeleton variant="list" count={5} />
          </div>
        </ProtectedLayout>
      }
    >
      <EventsPageContent />
    </Suspense>
  );
}

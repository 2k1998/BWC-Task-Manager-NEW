'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import ProtectedLayout from '@/components/ProtectedLayout';
import { Card, Button, EmptyState } from '@/components/ui';
import ActivityTimeline from '@/components/ActivityTimeline';
import apiClient from '@/lib/apiClient';
import type { Event } from '@/lib/types';
import { format } from 'date-fns';
import { extractErrorMessage } from '@/lib/utils';

export default function EventDetailPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('id');
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setEvent(null);
    setError('');

    if (!eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const fetchEvent = async () => {
      try {
        const response = await apiClient.get<Event>(`/events/${encodeURIComponent(eventId)}`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setEvent(response.data);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const message = extractErrorMessage(isAxiosError(err) ? err.response?.data : undefined);
        const resolved = message === 'An error occurred' ? 'Failed to load event' : message;
        setError(resolved);
        toast.error(resolved);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void fetchEvent();
    return () => controller.abort();
  }, [eventId]);

  const backButton = (
    <Button
      variant="ghost"
      onClick={() => router.push('/events')}
      className="text-gray-600 hover:text-gray-900"
    >
      ← Back to Events
    </Button>
  );

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  if (error) {
    return (
      <ProtectedLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          {backButton}
          <Card variant="highlight" urgencyColor="red">
            <p className="text-red-700 font-medium">{error}</p>
          </Card>
        </div>
      </ProtectedLayout>
    );
  }

  if (!event) {
    return (
      <ProtectedLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          {backButton}
          <Card>
            <EmptyState
              icon={<span className="text-6xl">📅</span>}
              title="Event not found"
              description="The event you're looking for doesn't exist"
            />
          </Card>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        {backButton}

        {/* Main Event Card */}
        <Card>
          {/* Header Section */}
          <div className="border-b border-gray-200 pb-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{event.title}</h1>
             <div className="flex items-center text-gray-500 space-x-4 text-sm">
                <span className="flex items-center gap-1">
                    📍 {event.location}
                </span>
                <span className="flex items-center gap-1">
                    🕒 {format(new Date(event.event_datetime), 'PPpp')}
                </span>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <div className="px-4 py-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-900 leading-relaxed">{event.description}</p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
             <div>
                <span className="font-medium">Owner ID:</span> {event.owner_user_id}
             </div>
             <div>
                <span className="font-medium">Created:</span> {format(new Date(event.created_at), 'PPpp')}
             </div>
          </div>
        </Card>

        {/* Activity Timeline */}
        <ActivityTimeline entityType="Event" entityId={event.id} />
      </div>
    </ProtectedLayout>
  );
}

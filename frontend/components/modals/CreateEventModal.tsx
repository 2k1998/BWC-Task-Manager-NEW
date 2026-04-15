'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { Button } from '@/components/ui';
import { extractErrorMessage } from '@/lib/utils';

interface CreateEventModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateEventModal({ onClose, onSuccess }: CreateEventModalProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    event_datetime: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title) {
        toast.error('Event Title is required');
        return;
    }
    if (!formData.location) {
        toast.error('Location is required');
        return;
    }
    if (!formData.event_datetime) {
        toast.error('Date and time are required');
        return;
    }
    
    // Date Validation
    if (new Date(formData.event_datetime) < new Date()) {
         // Allow past events? PRD doesn't explicitly forbid, but usually events are future.
         // For now, let's just warn if it's in the past, or maybe strict block? 
         // PRD doesn't say strict block for past events, so let's allow it but maybe logic resides in backend.
         // Actually, let's keep it simple. Required check is done.
    }

    try {
      setLoading(true);
      
      const payload = {
          title: formData.title,
          location: formData.location,
          event_datetime: new Date(formData.event_datetime).toISOString(),
          description: formData.description,
          // STATUS is NOT sent.
      };

      await apiClient.post('/events', payload);
      toast.success('Event created successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      const message = extractErrorMessage(err?.response?.data);
      toast.error(message === 'An error occurred' ? 'Failed to create event' : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto overflow-x-hidden">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-auto flex flex-col max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white rounded-t-xl z-10">
          <h2 className="text-xl font-bold text-gray-900">Create New Event</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
            
            {/* Title */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
                <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g., Annual Team Meeting"
                />
            </div>

            {/* Location */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="e.g., Conference Room A or Remote Link"
                />
            </div>

             {/* Datetime */}
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
                <input
                    type="datetime-local"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                    value={formData.event_datetime}
                    onChange={e => setFormData({...formData, event_datetime: e.target.value})}
                />
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Event agenda or details..."
                />
            </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-xl z-10">
            <Button variant="outline" onClick={onClose} type="button">
                Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={loading} type="submit">
                {loading ? 'Creating...' : 'Create Event'}
            </Button>
        </div>

      </div>
    </div>
  );
}

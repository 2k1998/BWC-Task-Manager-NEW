'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MiniCalendarProps {
  tasks: Array<{ deadline: string }>;
  events: Array<{ event_datetime: string }>;
}

export default function MiniCalendar({ tasks, events }: MiniCalendarProps) {
  const router = useRouter();
  const [currentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Get dates with tasks or events
  const taskDates = new Set(
    tasks.map((t) => new Date(t.deadline).toISOString().split('T')[0])
  );
  const eventDates = new Set(
    events.map((e) => new Date(e.event_datetime).toISOString().split('T')[0])
  );

  const handleDateClick = (day: number) => {
    const date = new Date(year, month, day);
    const dateStr = date.toISOString().split('T')[0];
    
    if (taskDates.has(dateStr)) {
      router.push(`/tasks?date=${dateStr}`);
    } else if (eventDates.has(dateStr)) {
      router.push(`/events?date=${dateStr}`);
    }
  };

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="h-10"></div>);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = date.toISOString().split('T')[0];
    const hasTask = taskDates.has(dateStr);
    const hasEvent = eventDates.has(dateStr);
    const isToday = new Date().toDateString() === date.toDateString();

    days.push(
      <button
        key={day}
        onClick={() => handleDateClick(day)}
        className={`h-10 flex items-center justify-center rounded-lg text-sm relative transition-colors ${
          isToday
            ? 'bg-primary-gold text-black font-bold'
            : hasTask || hasEvent
            ? 'bg-gray-100 hover:bg-gray-200 cursor-pointer'
            : 'hover:bg-gray-50'
        }`}
      >
        {day}
        {(hasTask || hasEvent) && (
          <div className="absolute bottom-1 flex gap-0.5">
            {hasTask && <div className="w-1 h-1 bg-primary-gold rounded-full"></div>}
            {hasEvent && <div className="w-1 h-1 bg-green-500 rounded-full"></div>}
          </div>
        )}
      </button>
    );
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
      <h3 className="font-semibold text-gray-900 mb-3">
        {monthNames[month]} {year}
      </h3>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-xs font-medium text-gray-500 text-center">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{days}</div>
      <div className="mt-3 pt-3 border-t border-gray-200 flex gap-3 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-primary-gold rounded-full"></div>
          <span>Tasks</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>Events</span>
        </div>
      </div>
    </div>
  );
}

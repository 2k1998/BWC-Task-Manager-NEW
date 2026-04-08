// Urgency label to color mapping
export const URGENCY_COLORS = {
  'Urgent & Important': {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    label: 'Red',
  },
  'Urgent': {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    label: 'Blue',
  },
  'Important': {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    label: 'Green',
  },
  'Not Urgent & Not Important': {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    label: 'Yellow',
  },
  'Same-day auto': {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-200',
    label: 'Orange',
  },
} as const;

export type UrgencyLabel = keyof typeof URGENCY_COLORS;

export function getUrgencyColors(urgencyLabel: string) {
  return URGENCY_COLORS[urgencyLabel as UrgencyLabel] || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
    label: 'Unknown',
  };
}

// Check if task is transferable (Yellow urgency only)
export function isTransferable(urgencyLabel: string): boolean {
  return urgencyLabel === 'Not Urgent & Not Important';
}

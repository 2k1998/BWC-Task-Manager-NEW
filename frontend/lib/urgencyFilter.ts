/** Urgency labels for GET /tasks?urgency= (must match backend urgency_label values). */
export const URGENCY_FILTER_OPTIONS: { value: string; color: string }[] = [
  { value: 'Urgent & Important', color: '#EF4444' },
  { value: 'Urgent', color: '#3B82F6' },
  { value: 'Important', color: '#22C55E' },
  { value: 'Not Urgent & Not Important', color: '#EAB308' },
  { value: 'By the end of day', color: '#F97316' },
];

const COLOR_BY_LABEL: Record<string, string> = Object.fromEntries(
  URGENCY_FILTER_OPTIONS.map((o) => [o.value, o.color])
);

/** Dot color for a task's urgency_label (handles legacy API values). */
export function getUrgencyDotColor(label: string): string | undefined {
  if (COLOR_BY_LABEL[label]) return COLOR_BY_LABEL[label];
  if (label === 'Orange' || label === 'Same-day auto') return '#F97316';
  return undefined;
}

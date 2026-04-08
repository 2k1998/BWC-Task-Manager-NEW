// Task status lifecycle transitions
export const TASK_STATUSES = {
  NEW: 'New',
  RECEIVED: 'Received',
  ON_PROCESS: 'On Process',
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  LOOSE_END: 'Loose End',
} as const;

export type TaskStatus = typeof TASK_STATUSES[keyof typeof TASK_STATUSES];

// Get valid next statuses based on current status
export function getValidNextStatuses(currentStatus: string): string[] {
  const transitions: Record<string, string[]> = {
    [TASK_STATUSES.NEW]: [TASK_STATUSES.RECEIVED],
    [TASK_STATUSES.RECEIVED]: [TASK_STATUSES.ON_PROCESS, TASK_STATUSES.PENDING],
    [TASK_STATUSES.ON_PROCESS]: [
      TASK_STATUSES.PENDING,
      TASK_STATUSES.COMPLETED,
      TASK_STATUSES.LOOSE_END,
    ],
    [TASK_STATUSES.PENDING]: [
      TASK_STATUSES.ON_PROCESS,
      TASK_STATUSES.COMPLETED,
      TASK_STATUSES.LOOSE_END,
    ],
    [TASK_STATUSES.LOOSE_END]: [TASK_STATUSES.ON_PROCESS, TASK_STATUSES.PENDING],
    [TASK_STATUSES.COMPLETED]: [],
  };

  return transitions[currentStatus] || [];
}

// Check if a status is a terminal state
export function isTerminalStatus(status: string): boolean {
  return status === TASK_STATUSES.COMPLETED;
}

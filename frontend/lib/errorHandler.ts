import { AxiosError } from 'axios';

/**
 * Extract a human-readable message from an Axios error.
 * Used ONLY inside local try/catch blocks on pages.
 * Global status handling (403, 404, 500) remains in apiClient interceptors.
 */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred.'): string {
  if (error instanceof Error) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    if (axiosError.response?.data?.detail) {
      return axiosError.response.data.detail;
    }
    if (axiosError.message) {
      return axiosError.message;
    }
  }
  return fallback;
}

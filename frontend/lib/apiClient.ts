import axios from 'axios';
import { toast } from 'sonner';
import { getAccessToken, logout } from './auth';
import { getPublicApiBaseUrl } from './apiBase';

const apiClient = axios.create({
  baseURL: getPublicApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — global error handling (Phase 9)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Unauthorized — session expired, force logout
      logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } else if (status === 403) {
      toast.error('You do not have permission to perform this action.');
    } else if (status === 404) {
      toast.error('The requested resource was not found.');
    } else if (status >= 500) {
      toast.error('A system error occurred. Please try again.');
    } else if (!error.response) {
      // Network error — no response received
      toast.error('Network error. Please check your connection.');
    }

    return Promise.reject(error);
  }
);

export default apiClient;

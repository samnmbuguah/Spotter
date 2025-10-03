import { 
  useQuery, 
  useMutation, 
  useQueryClient, 
  UseQueryOptions, 
  UseMutationOptions, 
  QueryKey,
  UseQueryResult
} from '@tanstack/react-query';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuthStore } from '../stores/useAuthStore';

declare module 'react-toastify' {
  export function toast(message: string, options?: any): void;
  export function toast(message: React.ReactNode, options?: any): void;
  export function toast<T = unknown>(message: string, options?: any): T;
  export function toast<T = unknown>(message: React.ReactNode, options?: any): T;
  
  export namespace toast {
    function success(message: string, options?: any): void;
    function success(message: React.ReactNode, options?: any): void;
    function error(message: string, options?: any): void;
    function error(message: React.ReactNode, options?: any): void;
    function info(message: string, options?: any): void;
    function info(message: React.ReactNode, options?: any): void;
    function warn(message: string, options?: any): void;
    function warn(message: React.ReactNode, options?: any): void;
    function dismiss(toastId?: string | number): void;
    function isActive(toastId: string | number): boolean;
    function update(toastId: string | number, options: any): void;
  }
}

// Create axios instance with base URL and headers
const api = axios.create({
  baseURL: '/api/v1', // This will be relative to the proxy
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
  withCredentials: true, // For CSRF protection if using session auth
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as { message?: string; errors?: Record<string, string[]> };
      
      if (status === 401) {
        // Handle unauthorized error
        useAuthStore.getState().logout();
        toast.error('Your session has expired. Please log in again.');
      } else if (status === 400 && data?.errors) {
        // Handle validation errors
        Object.values(data.errors).forEach((messages) => {
          messages.forEach((message) => toast.error(message));
        });
      } else if (data?.message) {
        // Handle other API errors with messages
        toast.error(data.message);
      } else {
        // Generic error
        toast.error('An error occurred. Please try again.');
      }
    } else {
      toast.error('A network error occurred. Please check your connection.');
    }
    
    return Promise.reject(error);
  }
);

// Generic types for API responses
type ApiResponse<T> = {
  data: T;
  message?: string;
  success: boolean;
};

type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// Generic GET hook with better TypeScript support
const useGet = <T>(
  key: QueryKey,
  url: string,
  config?: AxiosRequestConfig,
  options: Omit<UseQueryOptions<T, AxiosError, T, QueryKey>, 'queryKey' | 'queryFn'> = {}
): UseQueryResult<T, AxiosError> => {
  return useQuery<T, AxiosError>({
    queryKey: key,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<T>>(url, config);
      return data.data;
    },
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors except 408 (Request Timeout) and 429 (Too Many Requests)
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          return false;
        }
      }
      // Retry up to 3 times
      return failureCount < 3;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

// Generic mutation options type
type MutationOptions<T, V> = Omit<
  UseMutationOptions<ApiResponse<T>, AxiosError, V>,
  'mutationFn'
> & {
  invalidateQueries?: QueryKey;
  onSuccess?: (data: T, variables: V, context?: unknown) => void;
  onError?: (error: AxiosError, variables: V, context?: unknown) => void;
};

// Generic POST hook with better TypeScript support
const usePost = <T, V = unknown>(
  url: string,
  options: MutationOptions<T, V> = {}
) => {
  const queryClient = useQueryClient();
  const { invalidateQueries, ...mutationOptions } = options;
  
  return useMutation<ApiResponse<T>, AxiosError, V>({
    mutationFn: async (data: V) => {
      const response = await api.post<ApiResponse<T>>(url, data);
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      if (invalidateQueries) {
        queryClient.invalidateQueries({ queryKey: invalidateQueries });
      }
      options.onSuccess?.(data.data, variables, context);
      
      // Show success message if available
      if (data.message) {
        toast.success(data.message);
      }
    },
    onError: (error, variables, context) => {
      options.onError?.(error, variables, context);
      
      // Error handling is done in the interceptor
      // Just log additional error details if needed
      console.error('Mutation error:', error);
    },
    ...mutationOptions,
  });
};

// Generic PATCH hook for partial updates
const usePatch = <T, V = Partial<unknown>>(
  url: string,
  options: MutationOptions<T, V> = {}
) => {
  const queryClient = useQueryClient();
  const { invalidateQueries, ...mutationOptions } = options;
  
  return useMutation<ApiResponse<T>, AxiosError, V>({
    mutationFn: async (data: V) => {
      const response = await api.patch<ApiResponse<T>>(url, data);
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      if (invalidateQueries) {
        queryClient.invalidateQueries({ queryKey: invalidateQueries });
      }
      options.onSuccess?.(data.data, variables, context);
      
      if (data.message) {
        toast.success(data.message);
      }
    },
    ...mutationOptions,
  });
};

// Generic PUT hook
const useUpdate = <T, V = unknown>(
  url: string,
  options: MutationOptions<T, V> = {}
) => {
  const queryClient = useQueryClient();
  const { invalidateQueries, ...mutationOptions } = options;
  
  return useMutation<ApiResponse<T>, AxiosError, V>({
    mutationFn: async (data: V) => {
      const response = await api.put<ApiResponse<T>>(url, data);
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      if (invalidateQueries) {
        queryClient.invalidateQueries({ queryKey: invalidateQueries });
      }
      options.onSuccess?.(data.data, variables, context);
      
      if (data.message) {
        toast.success(data.message);
      }
    },
    ...mutationOptions,
  });
};

// Generic DELETE hook
const useDelete = <T>(
  url: string,
  options: Omit<MutationOptions<T, void>, 'invalidateQueries'> & {
    invalidateQueries?: QueryKey;
    onSuccess?: (data: T) => void;
  } = {}
) => {
  const queryClient = useQueryClient();
  const { invalidateQueries, ...mutationOptions } = options;
  
  return useMutation<ApiResponse<T>, AxiosError, void>({
    mutationFn: async () => {
      const response = await api.delete<ApiResponse<T>>(url);
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      if (invalidateQueries) {
        queryClient.invalidateQueries({ queryKey: invalidateQueries });
      }
      options.onSuccess?.(data.data);
      
      if (data.message) {
        toast.success(data.message);
      }
    },
    ...mutationOptions,
  });
};

// Export all hooks
export { 
  useGet, 
  usePost, 
  usePatch,
  useUpdate, 
  useDelete,
  // Export API instance for direct use if needed
  api 
};

// Export types
export type { ApiResponse, PaginatedResponse };

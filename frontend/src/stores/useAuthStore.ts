import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '../types';
import api from '../services/api';

interface UserPreferences {
  dutyStatusResetTime: string; // HH:MM format, e.g., "06:00"
  timezone: string;
}

// Extend the User type to include preferences
interface ExtendedUser extends User {
  preferences?: UserPreferences;
}

interface AuthState {
  user: ExtendedUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setLoading: (isLoading: boolean) => void;
  getCsrfToken: () => Promise<string | null>;
  ensureCsrfToken: () => Promise<string | null>;
  login: (email: string, password: string) => Promise<ExtendedUser>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  updateUserPreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
}

interface AuthStorage {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Define the store type
// The AuthStore type is the same as AuthState, but we define it separately
// to make it clear that it's the store type that includes all actions
type AuthStore = AuthState;

const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
            // Function to get CSRF token from cookies or fetch a new one
      getCsrfToken: async () => {
        // First try to get from cookies
        const cookieValue = document.cookie
          .split('; ')
          .find(row => row.startsWith('csrftoken='))
          ?.split('=')[1];
        
        if (cookieValue) return cookieValue;
        
        // If not in cookies, fetch a new one
        try {
          const response = await api.get('/auth/csrf/');
          if (response.status >= 200 && response.status < 300) {
            const data = response.data;
            return data.csrfToken || null;
          }
        } catch (error) {
          console.error('Error fetching CSRF token:', error);
        }
        
        return null;
      },
      
      // Function to ensure we have a valid CSRF token for authenticated requests
      ensureCsrfToken: async () => {
        return get().getCsrfToken();
      },
      
      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true });
          
          // Ensure we have a valid CSRF token
          const csrfToken = await get().ensureCsrfToken();
          
          if (!csrfToken) {
            console.error('CSRF token is required but not available');
            throw new Error('Unable to establish secure connection. Please refresh the page and try again.');
          }

          // Prepare headers
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': csrfToken,
          };
          
          // Include credentials (cookies) with the request
          const credentials: RequestCredentials = 'include';

          // Call the API login endpoint
          const response = await api.post(
            '/auth/login/', 
            { email, password },
            {
              headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json',
              },
              withCredentials: true,
              xsrfCookieName: 'csrftoken',
              xsrfHeaderName: 'X-CSRFToken',
            }
          );

          if (response.status >= 400) {
            const errorData = response.data || {};
            throw new Error(errorData.detail || 'Login failed');
          }

          const data = response.data;

          if (!data.access) {
            throw new Error('No access token received');
          }

          // Store tokens
          localStorage.setItem('access_token', data.access);
          if (data.refresh) {
            localStorage.setItem('refresh_token', data.refresh);
          }

          // Get user profile
          const userResponse = await api.get('/auth/profile/');

          if (userResponse.status >= 400) {
            throw new Error('Failed to fetch user profile');
          }

          const user = userResponse.data;

          set({
            user,
            token: data.access,
            isAuthenticated: true,
            isLoading: false
          });

          return user;
        } catch (error) {
          console.error('Login error:', error);
          // Clear any partial auth state on error
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false
          });
          throw error;
        }
      },
      logout: async () => {
        const token = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');

        try {
          // Try to invalidate the refresh token on the server
          if (refreshToken) {
            await api.post('/auth/logout/', {
              refresh: refreshToken,
            });
          }
        } catch (error) {
          console.error('Logout error:', error);
          // Continue with client-side cleanup even if server logout fails
        } finally {
          // Always clean up client-side state
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      },
      checkAuth: async () => {
        try {
          set({ isLoading: true });
          const token = localStorage.getItem('access_token');

          if (!token) {
            set({ isAuthenticated: false, isLoading: false });
            return false;
          }

          // Use the check-auth endpoint instead of token verify
          // This endpoint uses JWT authentication which is more reliable
          const response = await api.get('/auth/check-auth/');

          if (response.status >= 200 && response.status < 300) {
            const user = response.data;
            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false
            });
            return true;
          } else if (response.status === 401) {
            // Token is invalid, try to refresh it
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              try {
                const refreshResponse = await api.post('/auth/token/refresh/', {
                  refresh: refreshToken,
                });

                if (refreshResponse.status >= 200 && refreshResponse.status < 300) {
                  const { access } = refreshResponse.data;
                  localStorage.setItem('access_token', access);

                  // Retry the auth check with new token
                  const retryResponse = await api.get('/auth/check-auth/');

                  if (retryResponse.status >= 200 && retryResponse.status < 300) {
                    const user = retryResponse.data;
                    set({
                      user,
                      token: access,
                      isAuthenticated: true,
                      isLoading: false
                    });
                    return true;
                  }
                }
              } catch (error) {
                console.error('Failed to refresh token:', error);
              }
            }

            // If we get here, either refresh failed or no refresh token
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false
            });
            return false;
          }
        } catch (error) {
          console.error('Auth check error:', error);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false
          });
          return false;
        }
      },
      setLoading: (isLoading: boolean) => set({ isLoading }),
      updateUserPreferences: async (preferences: Partial<UserPreferences>) => {
        const currentUser = get().user;
        if (!currentUser || !get().isAuthenticated) {
          throw new Error('User must be authenticated to update preferences');
        }

        try {
          const token = localStorage.getItem('access_token');
          if (!token) {
            throw new Error('No authentication token found');
          }

          const response = await api.patch('/auth/preferences/', preferences);

          if (response.status >= 400) {
            const errorData = response.data || {};
            throw new Error(errorData.detail || 'Failed to update preferences');
          }

          const updatedPreferences = response.data;

          // Update local user state with new preferences
          set({
            user: {
              ...currentUser,
              preferences: {
                ...currentUser.preferences,
                ...updatedPreferences,
              },
            },
          });
        } catch (error) {
          console.error('Error updating user preferences:', error);
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state: AuthState) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isLoading: false // Don't persist loading state
      })
    }
  )
);

// Initialize auth state when the store is loaded
const initializeAuth = () => {
  const token = localStorage.getItem('access_token');
  const { isAuthenticated } = useAuthStore.getState();

  if (token && !isAuthenticated) {
    useAuthStore.getState().checkAuth();
  } else if (!token && isAuthenticated) {
    useAuthStore.getState().logout();
  } else {
    useAuthStore.getState().setLoading(false);
  }
};

// Run initialization when the store is first imported
initializeAuth();

export { useAuthStore };

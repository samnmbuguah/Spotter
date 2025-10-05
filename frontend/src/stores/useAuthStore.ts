import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '../types';

interface UserPreferences {
  dutyStatusResetTime: string; // HH:MM format, e.g., "06:00"
  timezone: string;
}

// Extend the User type to include preferences
interface ExtendedUser extends User {
  preferences?: UserPreferences;
}

// API base URL - using relative URL for Vercel deployment
const API_BASE_URL = '/api/v1';

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
  checkAuth: () => Promise<void>;
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
          const response = await fetch(`${API_BASE_URL}/auth/csrf/`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
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
          const response = await fetch(`${API_BASE_URL}/auth/login/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ email, password }),
            credentials,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Login failed');
          }

          const data = await response.json();

          if (!data.access) {
            throw new Error('No access token received');
          }

          // Store tokens
          localStorage.setItem('access_token', data.access);
          if (data.refresh) {
            localStorage.setItem('refresh_token', data.refresh);
          }

          // Get user profile
          const userResponse = await fetch(`${API_BASE_URL}/auth/profile/`, {
            headers: {
              'Authorization': `Bearer ${data.access}`,
              'Accept': 'application/json',
            },
            credentials: 'include',
          });

          if (!userResponse.ok) {
            throw new Error('Failed to fetch user profile');
          }

          const user = await userResponse.json();

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
            await fetch(`${API_BASE_URL}/auth/logout/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ refresh: refreshToken }),
              credentials: 'include',
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
          
          // Ensure we have a valid CSRF token
          const csrfToken = await get().ensureCsrfToken();
          
          if (!csrfToken) {
            console.error('CSRF token is required but not available');
            throw new Error('Unable to establish secure connection. Please refresh the page and try again.');
          }
          
          // Prepare headers
          const headers: HeadersInit = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': csrfToken,
          };
          
          // Verify the token with the backend
          let response = await fetch(`${API_BASE_URL}/auth/verify/`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ token }),
          });

          if (!response.ok) {
            // If we get a 403, it might be due to CSRF, try to get a new token and retry once
            if (response.status === 403) {
              // Clear the existing CSRF token and get a new one
              document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
              const newCsrfToken = await get().ensureCsrfToken();
              
              if (newCsrfToken) {
                headers['X-CSRFToken'] = newCsrfToken;
                const retryResponse = await fetch(`${API_BASE_URL}/auth/verify/`, {
                  method: 'POST',
                  headers,
                  credentials: 'include',
                  body: JSON.stringify({ token }),
                });
                
                if (!retryResponse.ok) {
                  throw new Error('Token verification failed after CSRF retry');
                }
                response = retryResponse;
              } else {
                throw new Error('Failed to get new CSRF token');
              }
            } else {
              throw new Error('Token verification failed');
            }
          }
          
          // If we get here, token verification was successful
          const userResponse = await fetch(`${API_BASE_URL}/auth/profile/`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
            credentials: 'include',
          });

          if (userResponse.ok) {
            const user = await userResponse.json();
            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false
            });
            return true;
          }

          if (response.ok) {
            const user = await response.json();
            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false
            });
            return true;
          } else {
            // If token is invalid, try to refresh it
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              try {
                const refreshResponse = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                  },
                  body: JSON.stringify({ refresh: refreshToken }),
                  credentials: 'include',
                });

                if (refreshResponse.ok) {
                  const { access } = await refreshResponse.json();
                  localStorage.setItem('access_token', access);

                  try {
                    const profileResponse = await fetch(`${API_BASE_URL}/auth/profile/`, {
                      headers: {
                        'Authorization': `Bearer ${access}`,
                        'Accept': 'application/json',
                      },
                      credentials: 'include',
                    });

                    if (profileResponse.ok) {
                      const user = await profileResponse.json();
                      set({
                        user,
                        token: access,
                        isAuthenticated: true,
                        isLoading: false
                      });
                      return true;
                    }
                  } catch (error) {
                    console.error('Failed to fetch user data after token refresh:', error);
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

          const response = await fetch(`${API_BASE_URL}/auth/preferences/`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
            body: JSON.stringify(preferences),
            credentials: 'include',
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Failed to update preferences');
          }

          const updatedPreferences = await response.json();

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

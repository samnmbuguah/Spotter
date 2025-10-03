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
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setLoading: (isLoading: boolean) => void;
  updateUserPreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
}

interface AuthStorage {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true });

          // Call the API login endpoint
          const response = await fetch(`${API_BASE_URL}/auth/login/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include',
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
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false
            });
            return;
          }

          // Verify token and get user data
          const response = await fetch(`${API_BASE_URL}/auth/profile/`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
            credentials: 'include',
          });

          if (response.ok) {
            const user = await response.json();
            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false
            });
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

                  // Retry getting user data with new token
                  const userResponse = await fetch(`${API_BASE_URL}/auth/profile/`, {
                    headers: {
                      'Authorization': `Bearer ${access}`,
                      'Accept': 'application/json',
                    },
                    credentials: 'include',
                  });

                  if (userResponse.ok) {
                    const user = await userResponse.json();
                    set({
                      user,
                      token: access,
                      isAuthenticated: true,
                      isLoading: false
                    });
                    return;
                  }
                }
              } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
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
    })
  ),
  {
    name: 'auth-storage',
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      user: state.user,
      token: state.token,
      isAuthenticated: state.isAuthenticated,
      isLoading: false, // Don't persist loading state
    } as AuthStorage),
  }
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

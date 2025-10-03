import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/useAuthStore';
import { authService } from '../services/api';
import { toast } from 'react-toastify';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData extends LoginCredentials {
  name: string;
}

// Define the User type that matches the API response
type ApiUser = {
  id: number;
  email: string;
  name: string;
  // Add other user properties as needed
};

// Map API user to store user type
const mapApiUserToStoreUser = (apiUser: ApiUser) => ({
  id: apiUser.id.toString(),
  email: apiUser.email,
  name: apiUser.name,
} as const);

export const useAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, token, isAuthenticated, login: storeLogin, logout: storeLogout, setUser } = useAuthStore();

  // Get current user profile
  const { data: userData, isLoading: isLoadingUser } = useQuery<ApiUser>({
    queryKey: ['user', 'me'],
    queryFn: () => authService.getProfile(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update user in store when data is loaded
  useEffect(() => {
    if (userData) {
      setUser(mapApiUserToStoreUser(userData));
    }
  }, [userData, setUser]);

  // Define the login response type
  type LoginResponse = {
    access: string;
    user: ApiUser;
  };

  // Login mutation
  const loginMutation = useMutation<LoginResponse, Error, LoginCredentials>({
    mutationFn: (credentials: LoginCredentials) => 
      authService.login(credentials.email, credentials.password) as Promise<LoginResponse>,
    onSuccess: (data) => {
      // Store the token and user data
      storeLogin(mapApiUserToStoreUser(data.user), data.access);
      
      // Show success message
      toast.success('Login successful!');
      
      // Redirect to the intended page or home
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    },
    onError: (error: Error) => {
      console.error('Login error:', error);
      toast.error('Login failed. Please check your credentials and try again.');
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: (data: RegisterData) => authService.register(data),
    onSuccess: () => {
      // After successful registration, redirect to login
      toast.success('Registration successful! Please log in.');
      navigate('/login', { 
        state: { message: 'Registration successful! Please log in.' } 
      });
    },
    onError: (error: Error) => {
      console.error('Registration error:', error);
      toast.error('Registration failed. Please try again.');
    },
  });

  // Logout function
  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear auth state
      storeLogout();
      // Clear all queries
      queryClient.clear();
      // Show logout message
      toast.info('You have been logged out.');
      // Redirect to login
      navigate('/login');
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading: isLoadingUser || loginMutation.isPending || registerMutation.isPending,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    register: registerMutation.mutateAsync,
    registerError: registerMutation.error,
    logout,
  };
};

// Protected route hook
export const useProtectedRoute = (requiredRole?: string) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Redirect to login if not authenticated
        navigate('/login', { 
          state: { 
            from: location,
            message: 'Please log in to access this page.' 
          } 
        });
      } else if (requiredRole) {
        // If role-based access is needed, implement it here
        // Currently, the User type doesn't include a role, so we'll skip this check
        // You can add role support if needed
      }
    }
  }, [isAuthenticated, isLoading, user, requiredRole, navigate, location]);

  // For now, we're just checking authentication, not roles
  return { isAuthorized: isAuthenticated };
};

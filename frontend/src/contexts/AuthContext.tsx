import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { 
    user, 
    isAuthenticated, 
    isLoading,
    login: loginUser, 
    logout: logoutUser,
    checkAuth 
  } = useAuthStore();
  
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await checkAuth();
      } finally {
        setInitialized(true);
      }
    };

    initializeAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    await loginUser(email, password);
  };

  const logout = () => {
    logoutUser();
  };

  // Only render children after initial auth check is complete
  if (!initialized) {
    return null; // Or a loading spinner
  }

  const value = {
    user,
    loading: isLoading,
    login,
    logout,
    isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

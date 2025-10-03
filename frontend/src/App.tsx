import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ToastProvider } from './components/ui/use-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import DashboardSkeleton from './components/DashboardSkeleton';
import { queryClient } from './config/queryClient';
import { useAuthStore } from './stores/useAuthStore';

// Lazy load components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const TripPlanner = lazy(() => import('./pages/TripPlanner'));
const LogBook = lazy(() => import('./pages/LogBook'));
const Settings = lazy(() => import('./pages/Settings'));

// AuthInitializer component to handle initial auth state
const AuthInitializer = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to login if not authenticated and not on auth pages
    const isAuthPage = ['/login', '/register'].includes(window.location.pathname);
    if (!isAuthenticated && !isAuthPage) {
      navigate('/login');
    } else if (isAuthenticated && isAuthPage) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return <>{children}</>;
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <Router future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}>
              <AuthInitializer>
              <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
                <Header />
                <main className="container mx-auto px-4 py-8">
                  <Suspense fallback={<DashboardSkeleton />}>
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route
                        path="/"
                        element={
                          <ProtectedRoute>
                            <Dashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/trips"
                        element={
                          <ProtectedRoute>
                            <TripPlanner />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/logs"
                        element={
                          <ProtectedRoute>
                            <LogBook />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <ProtectedRoute>
                            <Settings />
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </Suspense>
                </main>
              </div>
              <ReactQueryDevtools initialIsOpen={false} position="bottom" buttonPosition="bottom-left" />
            </AuthInitializer>
          </Router>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

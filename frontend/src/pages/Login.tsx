import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../stores/useAuthStore';
import { useToast } from '../components/ui/use-toast';

interface LoginFormData {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuthStore();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      addToast({
        title: 'Validation Error',
        description: 'Please provide both email and password',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setLoading(true);
      await login(formData.email, formData.password, rememberMe);
      addToast({
        title: 'Success',
        description: 'Login successful! Welcome back.',
      });
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (error: any) {
      const errorMessage = error?.message || 'Login failed. Please check your credentials.';
      addToast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 sm:p-10">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="bg-primary-100 dark:bg-primary-900 p-3 rounded-full">
              <Truck className="h-10 w-10 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to Spotter HOS
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
            >
              Sign up now
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 
                  placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white 
                  rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 
                  dark:bg-gray-700 dark:focus:ring-primary-400 dark:focus:border-primary-400 transition-colors"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <Link 
                  to="/forgot-password" 
                  className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 
                  placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white 
                  rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 
                  dark:bg-gray-700 dark:focus:ring-primary-400 dark:focus:border-primary-400 transition-colors"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-primary-600 dark:text-primary-400 focus:ring-primary-500 dark:focus:ring-primary-400 
                  border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Remember me
              </label>
            </div>
          </div>

          <div>
            <Button
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

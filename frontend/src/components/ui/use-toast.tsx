import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils';

type ToastVariant = 'default' | 'destructive' | 'success';

interface ToastProps {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss?: () => void;
}

interface ToastContextType {
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const addToast = React.useCallback((toast: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prevToasts) => [...prevToasts, { ...toast, id }]);

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration);
    }
  }, [removeToast]);

  const value = React.useMemo<ToastContextType>(
    () => ({
      toasts,
      addToast,
      removeToast,
    }),
    [toasts, addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: ToastProps[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-full max-w-xs">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 flex items-start justify-between',
            {
              'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800': toast.variant === 'destructive',
              'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800': toast.variant === 'success',
            }
          )}
        >
          <Toast
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            onDismiss={() => onDismiss(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};

interface ToastComponentProps {
  title: string;
  description?: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
}

const Toast: React.FC<ToastComponentProps> = ({
  title,
  description,
  variant = 'default',
  onDismiss,
}) => {
  // Styling is handled by className props directly

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">{title}</h3>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-500 focus:outline-none"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {description && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {description}
        </p>
      )}
    </div>
  );
};

export function useToast() {
  const context = React.useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export { Toast };

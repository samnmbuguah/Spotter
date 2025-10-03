import React from 'react';
import { AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface HOSStatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  status?: 'good' | 'warning' | 'danger';
  icon?: 'clock' | 'check' | 'alert' | 'trend';
}

const HOSStatusCard: React.FC<HOSStatusCardProps> = ({
  title,
  value,
  subtitle,
  status = 'good',
  icon = 'clock',
}) => {
  const statusColors = {
    good: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300',
    danger: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
  };

  const iconComponents = {
    clock: Clock,
    check: CheckCircle,
    alert: AlertCircle,
    trend: TrendingUp,
  };

  const Icon = iconComponents[icon];

  return (
    <div className={`rounded-lg border-2 p-6 ${statusColors[status]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          {subtitle && <p className="mt-1 text-sm opacity-75">{subtitle}</p>}
        </div>
        <Icon className="h-8 w-8 opacity-50" />
      </div>
    </div>
  );
};

export default HOSStatusCard;

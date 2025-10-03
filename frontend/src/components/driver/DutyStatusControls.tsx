import React from 'react';
import { DutyStatus, DUTY_STATUS_OPTIONS } from './types';

interface DutyStatusControlsProps {
  currentStatus: DutyStatus;
  loading?: boolean;
  onStatusChange: (status: DutyStatus) => void;
}

export const DutyStatusControls: React.FC<DutyStatusControlsProps> = ({
  currentStatus,
  loading,
  onStatusChange,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
      {DUTY_STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onStatusChange(option.value)}
          disabled={loading || currentStatus === option.value}
          className={`flex items-center justify-center p-4 rounded-lg transition-colors font-medium ${
            currentStatus === option.value
              ? `${option.color} text-white shadow-md`
              : 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
          }`}
        >
          {currentStatus === option.value ? 'Current Status' : option.label}
        </button>
      ))}
    </div>
  );
};

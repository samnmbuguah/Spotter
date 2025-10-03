import React from 'react';
import { format } from 'date-fns';
import { TimePicker } from '../ui/time-picker';
import { Button } from '../ui/button';

interface TimeEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newTime: string) => Promise<void>;
  currentTime: string;
  loading: boolean;
  title?: string;
}

export const TimeEditDialog: React.FC<TimeEditDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  currentTime,
  loading,
  title = 'Edit Time',
}) => {
  const [time, setTime] = React.useState(currentTime);

  React.useEffect(() => {
    setTime(currentTime);
  }, [currentTime]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(time);
  };

  const setPresetTime = (minutesToSubtract: number) => {
    const currentDateTime = new Date();
    const newDateTime = new Date(currentDateTime.getTime() - (minutesToSubtract * 60 * 1000));
    const timeString = format(newDateTime, 'HH:mm');
    setTime(timeString);
  };

  const presetButtons = [
    { label: 'Now', minutes: 0 },
    { label: '15m ago', minutes: 15 },
    { label: '30m ago', minutes: 30 },
    { label: '1h ago', minutes: 60 },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
        
        {/* Preset Time Buttons */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quick Times
          </label>
          <div className="grid grid-cols-2 gap-2">
            {presetButtons.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPresetTime(preset.minutes)}
                className="text-xs"
                disabled={loading}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time
            </label>
            <TimePicker
              value={time}
              onChange={setTime}
              className="w-full"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-md"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
              disabled={loading || !time}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

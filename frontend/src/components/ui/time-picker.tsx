import * as React from 'react';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';

import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '../../utils';

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  className?: string;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  // Safely parse the time value
  const parseTime = (timeValue: string) => {
    if (!timeValue || typeof timeValue !== 'string') {
      return [0, 0];
    }

    const parts = timeValue.split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const hours = isNaN(h) || h < 0 || h > 23 ? 0 : h;
    const minutes = isNaN(m) || m < 0 || m > 59 ? 0 : m;

    return [hours, minutes];
  };

  const [hours, minutes] = parseTime(value);
  
  const handleHourChange = (newHour: number) => {
    const newTime = `${String(newHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    onChange(newTime);
  };
  
  const handleMinuteChange = (newMinute: number) => {
    const newTime = `${String(hours).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}:00`;
    onChange(newTime);
  };
  
  const formatTime = (time: string) => {
    if (!time || typeof time !== 'string') {
      return 'Invalid time';
    }

    const parts = time.split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;

    // Validate that we have valid numbers
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      return 'Invalid time';
    }

    const date = new Date();
    date.setHours(h, m);
    return format(date, 'h:mm a');
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {value ? formatTime(value) : <span>Pick a time</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 bg-white dark:bg-gray-800">
        <div className="flex items-center space-x-2">
          <div className="flex flex-col items-center">
            <div className="text-sm font-medium mb-1">Hours</div>
            <div className="flex flex-col overflow-y-auto max-h-48 p-1 border rounded-md">
              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                <Button
                  key={h}
                  variant="ghost"
                  className={cn(
                    'h-8 w-12',
                    hours === h && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => handleHourChange(h)}
                >
                  {String(h).padStart(2, '0')}
                </Button>
              ))}
            </div>
          </div>
          <div className="text-2xl mt-6">:</div>
          <div className="flex flex-col items-center">
            <div className="text-sm font-medium mb-1">Minutes</div>
            <div className="flex flex-col overflow-y-auto max-h-48 p-1 border rounded-md">
              {[0, 15, 30, 45].map((m) => (
                <Button
                  key={m}
                  variant="ghost"
                  className={cn(
                    'h-8 w-12',
                    minutes === m && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => handleMinuteChange(m)}
                >
                  {String(m).padStart(2, '0')}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

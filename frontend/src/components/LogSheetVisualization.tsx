import React from 'react';

interface LogEntry {
  id: number;
  date: string;
  start_time: string;
  end_time?: string;
  duty_status: 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving';
  location: string;
  notes?: string;
  total_hours: number;
  current_duration: number;
  latitude?: number;
  longitude?: number;
}

interface LogSheetVisualizationProps {
  entries: LogEntry[];
  date: string;
}

interface TimeSlot {
  hour: number;
  status: 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving' | null;
  entry?: LogEntry;
}

const DUTY_STATUS_COLORS = {
  off_duty: 'bg-gray-400',
  sleeper_berth: 'bg-blue-500',
  driving: 'bg-green-500',
  on_duty_not_driving: 'bg-yellow-500',
} as const;

const DUTY_STATUS_LABELS = {
  off_duty: 'Off Duty',
  sleeper_berth: 'Sleeper',
  driving: 'Driving',
  on_duty_not_driving: 'On Duty',
} as const;

// Create 24 time slots for the day
const createTimeSlots = (entries: LogEntry[]): TimeSlot[] => {
  const slots: TimeSlot[] = [];

  // Sort entries by start time
  const sortedEntries = [...entries].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  // Create 24 slots (0-23 hours)
  for (let hour = 0; hour < 24; hour++) {
    const slot: TimeSlot = {
      hour,
      status: null,
    };

    // Find the entry that covers this hour
    for (const entry of sortedEntries) {
      const startHour = parseInt(entry.start_time.split(':')[0]);
      const endHour = entry.end_time ? parseInt(entry.end_time.split(':')[0]) : 23;

      if (hour >= startHour && hour <= endHour) {
        slot.status = entry.duty_status;
        slot.entry = entry;
        break;
      }
    }

    slots.push(slot);
  }

  return slots;
};

const LogSheetVisualization: React.FC<LogSheetVisualizationProps> = ({
  entries,
  date,
}) => {
  const timeSlots = createTimeSlots(entries);

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  const getStatusForSlot = (slot: TimeSlot) => {
    return slot.status || 'off_duty';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Daily Log Sheet - {new Date(date).toLocaleDateString()}
        </h3>
        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
          <span>Total Entries: {entries.length}</span>
          <span>•</span>
          <span>Driver: _______________</span>
          <span>•</span>
          <span>Truck #: _______________</span>
        </div>
      </div>

      {/* 24-Hour Grid */}
      <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-300 dark:border-gray-600">
          <div className="grid grid-cols-25 gap-0">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center">
              Time
            </div>
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center">
                {formatHour(i)}
              </div>
            ))}
          </div>
        </div>

        {/* Status Row */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
          <div className="grid grid-cols-25 gap-0">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center">
              Status
            </div>
            {timeSlots.map((slot, index) => (
              <div
                key={index}
                className={`h-8 border-l border-gray-200 dark:border-gray-600 ${
                  slot.status ? DUTY_STATUS_COLORS[slot.status] : 'bg-gray-100 dark:bg-gray-700'
                }`}
                title={slot.entry ? `${DUTY_STATUS_LABELS[getStatusForSlot(slot)]} - ${slot.entry.location || 'No location'}` : 'No activity'}
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-400 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Off Duty</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Sleeper Berth</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Driving</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">On Duty</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Entries Table */}
      <div className="mt-6">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Detailed Log Entries
        </h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Time Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Duty Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {entry.start_time}
                    {entry.end_time && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {' '}- {entry.end_time}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full text-white ${DUTY_STATUS_COLORS[entry.duty_status] || 'bg-gray-400'}`}>
                      {DUTY_STATUS_LABELS[entry.duty_status] || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {entry.location || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {entry.total_hours}h
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {entry.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Certification Section */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              I certify that the information contained in this log is true and correct to the best of my knowledge.
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-900 dark:text-white mb-2">
              Driver's Signature: _______________________
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Date: {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogSheetVisualization;

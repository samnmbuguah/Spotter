import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/ui/use-toast';
import { logService } from '../services/api';
import { Calendar, MapPin, FileText, Download, CheckCircle } from 'lucide-react';

interface LogEntry {
  id: number;
  date: string;
  start_time: string;
  end_time?: string;
  duty_status: 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving';
  location: string;
  notes?: string;
  total_hours: number;
  latitude?: number;
  longitude?: number;
}

interface DailyLog {
  id: number;
  date: string;
  total_on_duty_hours: number;
  total_driving_hours: number;
  total_off_duty_hours: number;
  total_sleeper_berth_hours: number;
  is_certified: boolean;
  certified_at?: string;
}

const DUTY_STATUS_LABELS = {
  off_duty: 'Off Duty',
  sleeper_berth: 'Sleeper Berth',
  driving: 'Driving',
  on_duty_not_driving: 'On Duty (Not Driving)',
} as const;

const DUTY_STATUS_COLORS = {
  off_duty: 'bg-gray-500',
  sleeper_berth: 'bg-blue-500',
  driving: 'bg-green-500',
  on_duty_not_driving: 'bg-yellow-500',
} as const;

const LogBook: React.FC = () => {
  const { addToast } = useToast();
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const loadLogData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesData, dailyData] = await Promise.all([
        logService.getLogEntries(),
        logService.getDailyLogs(),
      ]);

      setLogEntries(Array.isArray(entriesData) ? entriesData : []);
      setDailyLogs(Array.isArray(dailyData) ? dailyData : []);
    } catch (error) {
      console.error('Error loading log data:', error);
      addToast({
        title: 'Error',
        description: 'Failed to load log data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadLogData();
  }, [selectedDate, loadLogData]);

  const formatTime = (timeString: string) => {
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  const getTodaysEntries = () => {
    return logEntries.filter(entry => entry.date === selectedDate);
  };

  const getTodaysDailyLog = () => {
    return dailyLogs.find(log => log.date === selectedDate);
  };

  const generateDailyLog = async () => {
    setLoading(true);
    try {
      await logService.generateDailyLog(selectedDate);
      await loadLogData();
      addToast({
        title: 'Daily Log Generated',
        description: 'Your daily log has been generated successfully.',
      });
    } catch (error) {
      console.error('Error generating daily log:', error);
      addToast({
        title: 'Error',
        description: 'Failed to generate daily log',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const certifyLog = async (logId: number) => {
    setLoading(true);
    try {
      await logService.certifyDailyLog(logId);
      await loadLogData();
      addToast({
        title: 'Log Certified',
        description: 'Your daily log has been certified.',
      });
    } catch (error) {
      console.error('Error certifying log:', error);
      addToast({
        title: 'Error',
        description: 'Failed to certify log',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    if (!todaysDailyLog) {
      addToast({
        title: 'No Log to Export',
        description: 'Please generate a daily log first.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Generate PDF content (simplified version)
      const pdfContent = generateLogPDFContent(todaysEntries, todaysDailyLog);

      // Create blob and download
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `drivers-log-${selectedDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast({
        title: 'PDF Exported',
        description: 'Your driver\'s log has been exported successfully.',
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      addToast({
        title: 'Error',
        description: 'Failed to export PDF',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateLogPDFContent = (entries: LogEntry[], dailyLog: DailyLog) => {
    // Simple PDF-like text content (in a real implementation, you'd use jsPDF or similar)
    const content = `
DRIVER'S DAILY LOG
Date: ${new Date(selectedDate).toLocaleDateString()}
Driver: Driver Name

DAILY SUMMARY:
- Off Duty: ${formatDuration(dailyLog.total_off_duty_hours)}
- Sleeper Berth: ${formatDuration(dailyLog.total_sleeper_berth_hours)}
- Driving: ${formatDuration(dailyLog.total_driving_hours)}
- On Duty (Not Driving): ${formatDuration(dailyLog.total_on_duty_hours)}
- Status: ${dailyLog.is_certified ? 'CERTIFIED' : 'NOT CERTIFIED'}

LOG ENTRIES:
${entries.map((entry, index) =>
  `${index + 1}. ${DUTY_STATUS_LABELS[entry.duty_status]} - ${formatTime(entry.start_time)}${entry.end_time ? ` to ${formatTime(entry.end_time)}` : ''} (${formatDuration(entry.total_hours)})${entry.location ? ` at ${entry.location}` : ''}${entry.notes ? ` - ${entry.notes}` : ''}`
).join('\n')}

Generated on: ${new Date().toLocaleString()}
    `.trim();

    return content;
  };

  const todaysEntries = getTodaysEntries();
  const todaysDailyLog = getTodaysDailyLog();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Driver's Log Book</h1>
          <p className="text-gray-600 dark:text-gray-300">View and manage your Hours of Service logs</p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={generateDailyLog}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md transition-colors"
          >
            <FileText className="w-4 h-4 mr-2 inline" />
            Generate Log
          </button>
          {todaysDailyLog && (
            <button
              onClick={exportToPDF}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-md transition-colors ml-2"
            >
              <Download className="w-4 h-4 mr-2 inline" />
              Export PDF
            </button>
          )}
        </div>
      </div>

      {/* Daily Summary */}
      {todaysDailyLog && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Daily Summary - {new Date(selectedDate).toLocaleDateString()}
            </h2>
            <div className="flex items-center space-x-2">
              {todaysDailyLog.is_certified ? (
                <span className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Certified
                </span>
              ) : (
                <button
                  onClick={() => certifyLog(todaysDailyLog.id)}
                  disabled={loading}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-full transition-colors"
                >
                  Certify Log
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatDuration(todaysDailyLog.total_off_duty_hours)}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Off Duty</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatDuration(todaysDailyLog.total_sleeper_berth_hours)}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Sleeper Berth</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatDuration(todaysDailyLog.total_driving_hours)}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Driving</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatDuration(todaysDailyLog.total_on_duty_hours)}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">On Duty</div>
            </div>
          </div>
        </div>
      )}

      {/* Log Entries */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Log Entries - {new Date(selectedDate).toLocaleDateString()}
          </h2>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : todaysEntries.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No log entries</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No log entries found for {new Date(selectedDate).toLocaleDateString()}.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {todaysEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <div className="flex items-center space-x-4">
                    <div className={`w-4 h-4 rounded-full ${DUTY_STATUS_COLORS[entry.duty_status]}`} />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {DUTY_STATUS_LABELS[entry.duty_status]}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatTime(entry.start_time)}
                          {entry.end_time && ` - ${formatTime(entry.end_time)}`}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {formatDuration(entry.total_hours)}
                      </div>
                      {entry.location && (
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <MapPin className="w-3 h-3 mr-1" />
                          {entry.location}
                        </div>
                      )}
                      {entry.notes && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {entry.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Entry #{entry.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log Grid View (Traditional Format) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Log Grid - {new Date(selectedDate).toLocaleDateString()}
          </h2>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white">Time</th>
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white">Duty Status</th>
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white">Location</th>
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white">Hours</th>
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white">Notes</th>
                </tr>
              </thead>
              <tbody>
                {todaysEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 px-3 text-gray-900 dark:text-white">
                      {formatTime(entry.start_time)}
                      {entry.end_time && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          to {formatTime(entry.end_time)}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${DUTY_STATUS_COLORS[entry.duty_status]}`}>
                        {DUTY_STATUS_LABELS[entry.duty_status]}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-300">
                      {entry.location || '-'}
                    </td>
                    <td className="py-2 px-3 text-gray-900 dark:text-white font-medium">
                      {formatDuration(entry.total_hours)}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-300">
                      {entry.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogBook;

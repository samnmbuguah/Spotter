import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/ui/use-toast';
import { tripService, logService } from '../services/api';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { useAuthStore } from '../stores/useAuthStore';
import { MapPin, Play, CheckCircle, AlertCircle, FileText, Navigation, Download } from 'lucide-react';

// Types and Interfaces
type DutyStatus = 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving';

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

interface Trip {
  id: number;
  name: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  current_location?: LocationData;
  pickup_location?: LocationData;
  dropoff_location?: LocationData;
  current_cycle: string;
  start_time?: string;
  end_time?: string;
}

interface DutyStatusData {
  status: DutyStatus;
  startTime: string;
  location?: string;
  endTime?: string;
  notes?: string;
  vehicleInfo?: string;
  trailerInfo?: string;
  odometerStart?: number;
  odometerEnd?: number;
  duration?: number;
}

interface DutyStatusFormData {
  location: string;
  notes: string;
  vehicleInfo: string;
  trailerInfo: string;
  odometerStart: string;
  odometerEnd: string;
}

const DUTY_STATUS_OPTIONS = [
  { value: 'off_duty' as const, label: 'Off Duty', color: 'bg-gray-500' },
  { value: 'sleeper_berth' as const, label: 'Sleeper Berth', color: 'bg-blue-500' },
  { value: 'driving' as const, label: 'Driving', color: 'bg-green-500' },
  { value: 'on_duty_not_driving' as const, label: 'On Duty (Not Driving)', color: 'bg-yellow-500' },
] as const;

const DriverDashboard: React.FC = () => {
  // Hooks
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { currentLocation, startTracking, stopTracking } = useLocationTracking();
  
  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [dutyStatus, setDutyStatus] = useState<DutyStatusData>(() => {
    // Initialize with user's reset time preference
    const resetTime = user?.preferences?.dutyStatusResetTime || '06:00';
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const startTime = `${today}T${resetTime}:00`;

    return {
      status: 'off_duty',
      startTime,
      location: '',
    };
  });
  
  const [showDutyDialog, setShowDutyDialog] = useState<boolean>(false);
  const [pendingDutyStatus, setPendingDutyStatus] = useState<DutyStatusData | null>(null);
  const [showTimeEditDialog, setShowTimeEditDialog] = useState<boolean>(false);
  const [editedTime, setEditedTime] = useState<string>('');
  const [showDurationEditDialog, setShowDurationEditDialog] = useState<boolean>(false);
  const [editedDuration, setEditedDuration] = useState<number>(0);
  const [formData, setFormData] = useState<DutyStatusFormData>({
    location: '',
    notes: '',
    vehicleInfo: '',
    trailerInfo: '',
    odometerStart: '',
    odometerEnd: '',
  });

  // Toast helper function
  const addToast = useCallback(({ title, description, variant = 'default' }: { 
    title: string; 
    description: string; 
    variant?: 'default' | 'destructive' 
  }) => {
    toast({
      title,
      description,
      variant,
    });
  }, [toast]);

  // Utility Functions
  const formatTimeForAPI = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // API Call Handlers
  const updateLocationInLog = useCallback(async (location: { latitude: number; longitude: number }) => {
    if (!dutyStatus.status) return;
    try {
      const logEntries = await logService.getLogEntries();
      const currentEntry = logEntries.find((entry: any) => 
        !entry.end_time && entry.duty_status === dutyStatus.status
      );

      if (currentEntry) {
        await logService.updateLogEntry(currentEntry.id, {
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }
    } catch (error) {
      console.error('Error updating location in log:', error);
      addToast({
        title: 'Location Update Failed',
        description: 'Could not update your current location in the log.',
        variant: 'destructive',
      });
    }
  }, [dutyStatus.status, addToast]);

  const loadCurrentDutyStatus = useCallback(async () => {
    if (!user) return;
    try {
      const status = await logService.getCurrentHOSStatus();
      if (status) {
        // Construct a full datetime from the time string and today's date
        let startTime = new Date().toISOString(); // Default to now
        if (status.start_time) {
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          startTime = `${today}T${status.start_time}`;
        } else {
          // If no start time from backend, use user's reset time preference
          const resetTime = user?.preferences?.dutyStatusResetTime || '06:00';
          const today = new Date().toISOString().split('T')[0];
          startTime = `${today}T${resetTime}:00`;
        }

        setDutyStatus(prev => ({
          ...prev,
          status: status.current_status,
          startTime: startTime,
          location: status.location || prev.location,
        }));
      }
    } catch (error) {
      console.error('Error loading duty status:', error);
      addToast({
        title: 'Error Loading Status',
        description: 'Failed to load your current duty status.',
        variant: 'destructive',
      });
    }
  }, [user?.preferences?.dutyStatusResetTime, addToast]);

  const loadCurrentTrip = useCallback(async () => {
    if (!user) return;
    try {
      const trip = await tripService.getCurrentTrip();
      setCurrentTrip(trip);
    } catch (error) {
      console.error('Error loading current trip:', error);
      addToast({
        title: 'Error Loading Trip',
        description: 'Failed to load your current trip information.',
        variant: 'destructive',
      });
    }
  }, [addToast]);

  // Effects
  useEffect(() => {
    // Load initial data
    const initialize = async () => {
      await Promise.all([
        loadCurrentTrip(),
        loadCurrentDutyStatus()
      ]);
      
      // Start location tracking
      startTracking();
    };

    initialize();

    // Set up interval to update location in log entries
    const interval = setInterval(() => {
      if (currentLocation && dutyStatus.status !== 'off_duty') {
        updateLocationInLog(currentLocation);
      }
    }, 60000); // Update every minute

    // Cleanup
    return () => {
      clearInterval(interval);
      stopTracking();
    };
  }, [
    currentLocation, 
    dutyStatus.status, 
    loadCurrentDutyStatus, 
    loadCurrentTrip, 
    startTracking, 
    stopTracking, 
    updateLocationInLog
  ]);

  // Handle duty status changes
  const handleDutyStatusChange = useCallback(async (newStatus: DutyStatus) => {
    try {
      setLoading(true);
      
      // Update the current log entry with location data
      if (currentLocation) {
        await updateLocationInLog(currentLocation);
      }
      
      // Show confirmation dialog
      setPendingDutyStatus({
        ...dutyStatus,
        status: newStatus,
        startTime: new Date().toISOString(),
      });
      
      setShowDutyDialog(true);
    } catch (error) {
      console.error('Error updating duty status:', error);
      addToast({
        title: 'Status Update Failed',
        description: 'Failed to update your duty status.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

    setFormData(prefilledFormData);

    // Use current start time, or user's reset time if not available
    let startTime = dutyStatus.startTime;
    if (!startTime || startTime === new Date().toISOString()) {
      const resetTime = user?.preferences?.dutyStatusResetTime || '06:00';
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      startTime = `${today}T${resetTime}:00`;
    }

    const newDutyStatus: DutyStatusData = {
      status: newStatus,
      startTime: startTime,
      location: prefilledFormData.location,
      notes: prefilledFormData.notes,
      vehicleInfo: prefilledFormData.vehicleInfo,
      trailerInfo: prefilledFormData.trailerInfo,
      odometerStart: prefilledFormData.odometerStart ? parseFloat(prefilledFormData.odometerStart) : undefined,
      odometerEnd: prefilledFormData.odometerEnd ? parseFloat(prefilledFormData.odometerEnd) : undefined,
    };

    setPendingDutyStatus(newDutyStatus);
    setShowDutyDialog(true);
  };

  const confirmDutyStatusChange = async () => {
    if (!pendingDutyStatus) return;

    setLoading(true);
    try {
      // End current duty status
      if (dutyStatus.status !== 'off_duty') {
        const currentStartTime = new Date(dutyStatus.startTime);
        const pendingStartTime = new Date(pendingDutyStatus.startTime);

        // Validate that start times are valid before proceeding
        if (isNaN(currentStartTime.getTime()) || isNaN(pendingStartTime.getTime())) {
          console.error('Invalid start time for duty status change:', dutyStatus.startTime, pendingDutyStatus.startTime);
          addToast({
            title: 'Error',
            description: 'Invalid start time data. Please refresh the page.',
            variant: 'destructive',
          });
          return;
        }

        await logService.createLogEntry({
          duty_status: dutyStatus.status,
          start_time: formatTimeForAPI(currentStartTime),
          end_time: formatTimeForAPI(pendingStartTime),
          location: dutyStatus.location,
          notes: dutyStatus.notes,
          vehicle_info: dutyStatus.vehicleInfo,
          trailer_info: dutyStatus.trailerInfo,
          odometer_start: dutyStatus.odometerStart,
          odometer_end: dutyStatus.odometerEnd,
        });
      }

      // Start new duty status
      await logService.createLogEntry({
        duty_status: pendingDutyStatus.status,
        start_time: formatTimeForAPI(new Date(pendingDutyStatus.startTime)),
        location: formData.location,
        notes: formData.notes,
        vehicle_info: formData.vehicleInfo,
        trailer_info: formData.trailerInfo,
        odometer_start: formData.odometerStart ? parseFloat(formData.odometerStart) : undefined,
        odometer_end: formData.odometerEnd ? parseFloat(formData.odometerEnd) : undefined,
      });

      setDutyStatus({
        ...pendingDutyStatus,
        location: formData.location,
        notes: formData.notes,
        vehicleInfo: formData.vehicleInfo,
        trailerInfo: formData.trailerInfo,
        odometerStart: formData.odometerStart ? parseFloat(formData.odometerStart) : undefined,
        odometerEnd: formData.odometerEnd ? parseFloat(formData.odometerEnd) : undefined,
      });
      setShowDutyDialog(false);
      setPendingDutyStatus(null);

      // Reset form data
      setFormData({
        location: '',
        notes: '',
        vehicleInfo: '',
        trailerInfo: '',
        odometerStart: '',
        odometerEnd: '',
      });

      addToast({
        title: 'Duty Status Updated',
        description: `Changed to ${DUTY_STATUS_OPTIONS.find(opt => opt.value === pendingDutyStatus.status)?.label}`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error updating duty status:', error);
      addToast({
        title: 'Error',
        description: 'Failed to update duty status',
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const editTimeEntry = async () => {
    if (!editedTime) return;

    setLoading(true);
    try {
      // Update the current log entry with edited time
      console.log('Fetching log entries...');
      const logEntries = await logService.getLogEntries();
      console.log('Log entries response:', logEntries);

      const currentEntry = logEntries.find((entry: any) =>
        !entry.end_time && entry.duty_status === dutyStatus.status
      );

      console.log('Looking for current entry:', {
        duty_status: dutyStatus.status,
        has_end_time: false
      });
      console.log('Found current entry:', currentEntry);

      if (currentEntry) {
        const newStartTime = new Date(editedTime);

        // Validate that editedTime is valid before proceeding
        if (isNaN(newStartTime.getTime())) {
          console.error('Invalid edited time:', editedTime);
          addToast({
            title: 'Error',
            description: 'Invalid time value entered. Please check your input.',
            variant: 'destructive',
            duration: 5000,
          });
          return;
        }

        console.log('Updating log entry:', currentEntry.id, 'with new start time:', formatTimeForAPI(newStartTime));
        await logService.updateLogEntry(currentEntry.id, {
          start_time: formatTimeForAPI(newStartTime),
          notes: `${dutyStatus.notes || ''} (Time edited by user)`.trim(),
        });

        setDutyStatus(prev => ({
          ...prev,
          startTime: newStartTime.toISOString(),
        }));

        addToast({
          title: 'Time Updated',
          description: 'Duty status time has been updated',
          duration: 3000,
        });
      } else {
        console.warn('No current log entry found to update');
        addToast({
          title: 'Warning',
          description: 'No active log entry found. Please ensure you have an active duty status.',
          variant: 'destructive',
          duration: 5000,
        });
      }

      setShowTimeEditDialog(false);
      setEditedTime('');
    } catch (error) {
      console.error('Error updating time:', error);
      addToast({
        title: 'Error',
        description: 'Failed to update time',
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const editDurationEntry = async () => {
    if (!editedDuration) return;

    setLoading(true);
    try {
      // Update the current log entry with edited duration
      console.log('Fetching log entries for duration edit...');
      const logEntries = await logService.getLogEntries();
      console.log('Log entries response:', logEntries);

      const currentEntry = logEntries.find((entry: any) =>
        !entry.end_time && entry.duty_status === dutyStatus.status
      );

      console.log('Looking for current entry for duration edit:', {
        duty_status: dutyStatus.status,
        has_end_time: false
      });
      console.log('Found current entry:', currentEntry);

      if (currentEntry) {
        const duration = parseFloat(editedDuration);
        const startTime = new Date(dutyStatus.startTime);

        // Validate that startTime is valid before proceeding
        if (isNaN(startTime.getTime())) {
          console.error('Invalid start time for duration edit:', dutyStatus.startTime);
          addToast({
            title: 'Error',
            description: 'Invalid start time data. Please refresh the page.',
            variant: 'destructive',
            duration: 5000,
          });
          return;
        }

        const endTime = new Date(startTime.getTime() + (duration * 60 * 60 * 1000));

        console.log('Updating log entry:', currentEntry.id, 'with new duration:', duration, 'end time:', formatTimeForAPI(endTime));
        await logService.updateLogEntry(currentEntry.id, {
          end_time: formatTimeForAPI(endTime),
          total_hours: duration,
          notes: `${dutyStatus.notes || ''} (Duration edited by user: ${duration}h)`.trim(),
        });

        // Update local state to reflect the new duration
        // Calculate the new start time based on the edited duration
        const now = new Date();
        const newStartTime = new Date(now.getTime() - (duration * 60 * 60 * 1000));

        setDutyStatus(prev => ({
          ...prev,
          startTime: newStartTime.toISOString(),
        }));

        addToast({
          title: 'Duration Updated',
          description: 'Duty status duration has been updated',
          duration: 3000,
        });
      } else {
        console.warn('No current log entry found to update duration');
        addToast({
          title: 'Warning',
          description: 'No active log entry found. Please ensure you have an active duty status.',
          variant: 'destructive',
          duration: 5000,
        });
      }

      setShowDurationEditDialog(false);
      setEditedDuration('');
    } catch (error) {
      console.error('Error updating duration:', error);
      addToast({
        title: 'Error',
        description: 'Failed to update duration',
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const startTrip = async () => {
    if (!currentTrip) {
      // Get or create current trip
      await loadCurrentTrip();
      return;
    }

    setLoading(true);
    try {
      // Trip is already active, just refresh the data
      await loadCurrentTrip();

      // Automatically set duty status to driving when trip starts
      handleDutyStatusChange('driving');
    } catch (error) {
      console.error('Error starting trip:', error);
      addToast({
        title: 'Error',
        description: 'Failed to start trip',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const completeTrip = async () => {
    if (!currentTrip) return;

    setLoading(true);
    try {
      await tripService.completeTrip(currentTrip.id);
      await loadCurrentTrip();

      // Set duty status back to off duty when trip completes
      handleDutyStatusChange('off_duty');

      addToast({
        title: 'Trip Completed',
        description: 'Great job! Your trip has been completed.',
      });
    } catch (error) {
      console.error('Error completing trip:', error);
      addToast({
        title: 'Error',
        description: 'Failed to complete trip',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadDailyLogPDF = async () => {
    setLoading(true);
    try {
      const pdfBlob = await logService.downloadDailyLogPDF();
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hos_log_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addToast({
        title: 'PDF Downloaded',
        description: 'Your HOS log has been downloaded successfully.',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      addToast({
        title: 'Error',
        description: 'Failed to download PDF. Please try again.',
      });
    }
  };

  const getCurrentStatusColor = () => {
    const option = DUTY_STATUS_OPTIONS.find(opt => opt.value === dutyStatus.status);
    return option?.color || 'bg-gray-500';
  };
  const formatDuration = (startTime: string) => {
    if (!startTime) {
      return '0m';
    }

    const start = new Date(startTime);

    // Check if the start time is valid
    if (isNaN(start.getTime())) {
      console.warn('Invalid start time for duration calculation:', startTime);
      return '0m';
    }

    const now = new Date();
    const diffMs = now.getTime() - start.getTime();

    if (diffMs < 0) {
      console.warn('Start time is in the future:', startTime);
      return '0m';
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Driver Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage your trips and duty status</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${getCurrentStatusColor()}`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {DUTY_STATUS_OPTIONS.find(opt => opt.value === dutyStatus.status)?.label}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({formatDuration(dutyStatus.startTime)})
          </span>
          <button
            onClick={() => {
              // Validate that startTime is a valid date before processing
              const startTimeDate = new Date(dutyStatus.startTime);
              if (isNaN(startTimeDate.getTime())) {
                console.error('Invalid start time:', dutyStatus.startTime);
                addToast({
                  title: 'Error',
                  description: 'Invalid start time data. Please refresh the page.',
                  variant: 'destructive',
                });
                return;
              }

              setEditedTime(startTimeDate.toISOString().slice(0, 16));
              setShowTimeEditDialog(true);
            }}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Edit Time
          </button>
          <button
            onClick={() => {
              // Validate that startTime is a valid date before processing duration edit
              if (!dutyStatus.startTime) {
                console.error('No start time available for duration edit');
                addToast({
                  title: 'Error',
                  description: 'No start time available. Please refresh the page.',
                  variant: 'destructive',
                });
                return;
              }

              const startTimeDate = new Date(dutyStatus.startTime);
              if (isNaN(startTimeDate.getTime())) {
                console.error('Invalid start time for duration edit:', dutyStatus.startTime);
                addToast({
                  title: 'Error',
                  description: 'Invalid start time data. Please refresh the page.',
                  variant: 'destructive',
                });
                return;
              }

              const currentDuration = formatDuration(dutyStatus.startTime);
              const hours = parseFloat(currentDuration.split('h')[0]);
              if (isNaN(hours)) {
                console.error('Could not parse duration:', currentDuration);
                addToast({
                  title: 'Error',
                  description: 'Could not calculate duration. Please refresh the page.',
                  variant: 'destructive',
                });
                return;
              }

              setEditedDuration(hours.toFixed(1));
              setShowDurationEditDialog(true);
            }}
            className="text-xs text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 ml-2"
          >
            Edit Duration
          </button>
          <button
            onClick={downloadDailyLogPDF}
            disabled={loading}
            className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 ml-2 disabled:opacity-50"
            title="Download Today's HOS Log PDF"
          >
            <Download className="h-4 w-4 inline mr-1" />
            PDF
          </button>
        </div>
      </div>

      {/* Current Trip Status */}
      {currentTrip ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Trip</h2>
            <div className="flex items-center space-x-2">
              {currentTrip.status === 'planning' && (
                <span className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
                  Planning
                </span>
              )}
              {currentTrip.status === 'active' && (
                <span className="px-3 py-1 text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                  Active
                </span>
              )}
              {currentTrip.status === 'completed' && (
                <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                  Completed
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">{currentTrip.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                HOS Cycle: {currentTrip.current_cycle === '70_8' ? '70 hours / 8 days' : '60 hours / 7 days'}
              </p>
            </div>

            {/* Trip Actions */}
            <div className="flex space-x-3">
              {currentTrip.status === 'planning' && (
                <button
                  onClick={startTrip}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-md transition-colors"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Trip
                </button>
              )}

              {currentTrip.status === 'active' && (
                <>
                  <button
                    onClick={completeTrip}
                    disabled={loading}
                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete Trip
                  </button>
                </>
              )}

              <button className="flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors">
                <FileText className="w-4 h-4 mr-2" />
                View Log
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Trip</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">Trips are automatically created each day. Please wait or refresh the page.</p>
        </div>
      )}

      {/* Duty Status Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Duty Status</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DUTY_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleDutyStatusChange(option.value)}
              disabled={dutyStatus.status === option.value || loading}
              className={`p-3 rounded-lg border-2 transition-all ${
                dutyStatus.status === option.value
                  ? `${option.color} border-transparent text-white`
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="text-sm font-medium">{option.label}</div>
            </button>
          ))}
        </div>

        {dutyStatus.location && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
              <MapPin className="w-4 h-4 mr-2" />
              Current Location: {dutyStatus.location}
            </div>
          </div>
        )}

        {/* Location Tracking Status */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-gray-600 dark:text-gray-300">
              <Navigation className="w-4 h-4 mr-2" />
              Location Tracking: {isTracking ? 'Active' : 'Inactive'}
            </div>
            {error && (
              <div className="text-red-600 dark:text-red-400 text-xs">
                {error}
              </div>
            )}
          </div>
          {currentLocation && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Lat: {currentLocation.latitude.toFixed(6)}, Lng: {currentLocation.longitude.toFixed(6)}
            </div>
          )}
        </div>
      </div>

      {/* Duty Status Change Confirmation Dialog */}
      {showDutyDialog && pendingDutyStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Confirm Duty Status Change
            </h3>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  Changing from <strong className="text-gray-900 dark:text-white">{DUTY_STATUS_OPTIONS.find(opt => opt.value === dutyStatus.status)?.label}</strong> to{' '}
                  <strong className="text-gray-900 dark:text-white">{DUTY_STATUS_OPTIONS.find(opt => opt.value === pendingDutyStatus.status)?.label}</strong>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Start Time: <span className="font-medium text-gray-900 dark:text-white">{new Date(pendingDutyStatus.startTime).toLocaleTimeString()}</span>
                </p>
              </div>

              {/* Form fields based on transition type */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter location or leave blank for auto-detection"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Additional notes (optional)"
                    rows={2}
                  />
                </div>

                {/* Show additional fields when starting duty (from off-duty) */}
                {dutyStatus.status === 'off_duty' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Vehicle Information
                      </label>
                      <input
                        type="text"
                        value={formData.vehicleInfo}
                        onChange={(e) => setFormData(prev => ({ ...prev, vehicleInfo: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Vehicle ID or description"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Trailer Information
                      </label>
                      <input
                        type="text"
                        value={formData.trailerInfo}
                        onChange={(e) => setFormData(prev => ({ ...prev, trailerInfo: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Trailer ID or description (optional)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Starting Odometer
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.odometerStart}
                        onChange={(e) => setFormData(prev => ({ ...prev, odometerStart: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Starting odometer reading"
                      />
                    </div>
                  </>
                )}

                {/* Show ending odometer when going to off-duty */}
                {pendingDutyStatus.status === 'off_duty' && dutyStatus.status !== 'off_duty' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Ending Odometer
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.odometerEnd}
                      onChange={(e) => setFormData(prev => ({ ...prev, odometerEnd: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Ending odometer reading"
                    />
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={confirmDutyStatusChange}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  {loading ? 'Updating...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowDutyDialog(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-md transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Edit Dialog */}
      {showTimeEditDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Edit Duty Status Time
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={editedTime}
                  onChange={(e) => setEditedTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={editTimeEntry}
                  disabled={loading || !editedTime}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-md transition-colors"
                >
                  {loading ? 'Updating...' : 'Update Time'}
                </button>
                <button
                  onClick={() => setShowTimeEditDialog(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duration Edit Dialog */}
      {showDurationEditDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Edit Duty Status Duration
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Duration (hours)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editedDuration}
                  onChange={(e) => setEditedDuration(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., 8.5"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter duration in hours with 1 decimal place (e.g., 8.5 for 8 hours 30 minutes)
{{ ... }}
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={editDurationEntry}
                  disabled={loading || !editedDuration}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-md transition-colors"
                >
                  {loading ? 'Updating...' : 'Update Duration'}
                </button>
                <button
                  onClick={() => setShowDurationEditDialog(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;

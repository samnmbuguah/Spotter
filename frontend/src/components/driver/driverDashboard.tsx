import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { tripService } from '../../services/api';
import { logService } from '../../services/api';
import { useToast } from '../../components/ui/use-toast';
import { useLocationTracking } from '../../hooks/useLocationTracking';
import { DutyStatus, DutyStatusData, DutyStatusFormData, Trip } from './types';
import { DutyStatusControls } from './DutyStatusControls';
import { DutyStatusDialog } from './DutyStatusDialog';
import { TimeEditDialog } from './TimeEditDialog';

const DriverDashboard: React.FC = () => {
  const { addToast } = useToast();
  const { user } = useAuthStore();
  const { currentLocation, startTracking, stopTracking } = useLocationTracking();
  
  // State management
  const [loading, setLoading] = useState<boolean>(false);
  const [dutyStatus, setDutyStatus] = useState<DutyStatusData>({
    status: 'off_duty',
    startTime: new Date().toISOString(),
  });
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [showDutyDialog, setShowDutyDialog] = useState<boolean>(false);
  const [pendingDutyStatus, setPendingDutyStatus] = useState<DutyStatusData | null>(null);
  const [existingEntryId, setExistingEntryId] = useState<number | null>(null);
  const [showTimeEditDialog, setShowTimeEditDialog] = useState<boolean>(false);
  const [editedTime, setEditedTime] = useState<string>(new Date().toTimeString().substring(0, 5));
  const [pickupDropoffTimer, setPickupDropoffTimer] = useState<NodeJS.Timeout | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  
  // Removed duplicate form state as it's managed by DutyStatusDialog

  // Load current duty status
  const loadCurrentDutyStatus = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const status = await logService.getDailyLogs(); // Using getDailyLogs instead of getCurrentHOSStatus
      if (status) {
        setDutyStatus(prev => ({
          ...prev,
          ...status,
        }));
      }
    } catch (error) {
      console.error('Error loading duty status:', error);
      addToast({
        title: 'Error',
        description: 'Failed to load duty status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load current trip
  const loadCurrentTrip = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const trip = await tripService.getCurrentTrip();
      setCurrentTrip(trip || null);
    } catch (error) {
      console.error('Error loading current trip:', error);
      addToast({
        title: 'Error',
        description: 'Failed to load current trip',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, addToast]);

  // Handle duty status change
  const handleDutyStatusChange = useCallback(async (status: DutyStatus) => {
    setLoading(true);

    try {
      // Get today's log entries to find existing entry to edit
      const todaysEntries = await logService.getLogEntries();
      const today = new Date().toISOString().split('T')[0];
      const existingEntry = todaysEntries
        .filter(entry => entry.date === today)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0];

      setPendingDutyStatus({
        status,
        startTime: new Date().toISOString(),
      });
      setExistingEntryId(existingEntry ? existingEntry.id : null);

      setShowDutyDialog(true);
    } catch (error) {
      console.error('Error loading existing entries:', error);
      addToast({
        title: 'Error',
        description: 'Failed to load existing log entries',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);
  
  // Confirm duty status change
  const confirmDutyStatusChange = useCallback(async (formData: DutyStatusFormData, passedExistingEntryId?: number) => {
    if (!pendingDutyStatus) return;

    try {
      setLoading(true);

      const locationString = formData.location ? formData.location.address : '';

      // Prepare the data for API submission
      const submissionData = {
        driver: user?.id, // Add the current user's ID
        date: new Date().toISOString().split('T')[0], // Add current date
        duty_status: pendingDutyStatus.status, // Use duty_status instead of status
        location: locationString,
        latitude: formData.location?.lat,
        longitude: formData.location?.lng,
        notes: formData.notes,
        vehicle_info: formData.vehicleInfo,
        trailer_info: formData.trailerInfo,
        odometer_start: formData.odometerStart ? parseFloat(formData.odometerStart) : undefined,
        odometer_end: formData.odometerEnd ? parseFloat(formData.odometerEnd) : undefined,
        start_time: new Date().toTimeString().substring(0, 8), // Add current time as start_time
      };

      // If editing existing entry, end it first, then create new entry
      if (passedExistingEntryId) {
        // End the existing entry by setting its end_time
        await logService.updateLogEntry(passedExistingEntryId, {
          ...submissionData,
          end_time: new Date().toTimeString().substring(0, 8), // Set end time for the old entry
        });
      }

      // Always create a new entry for the new status
      // Add a small delay to ensure unique start_time
      const newStartTime = new Date();
      newStartTime.setSeconds(newStartTime.getSeconds() + 1); // Add 1 second to avoid constraint violation
      const finalSubmissionData = {
        ...submissionData,
        start_time: newStartTime.toTimeString().substring(0, 8),
      };

      await logService.createLogEntry(finalSubmissionData);

      setDutyStatus(pendingDutyStatus);
      setShowDutyDialog(false);

      // Start pickup/dropoff timer if this is a pickup/dropoff activity
      if (pendingDutyStatus.status === 'on_duty_not_driving' && formData.isPickupDropoff) {
        startPickupDropoffTimer();
      }

      addToast({
        title: 'Status Updated',
        description: `You are now ${pendingDutyStatus.status.replace(/_/g, ' ')}`,
      });
    } catch (error) {
      console.error('Error confirming duty status:', error);
      addToast({
        title: 'Update Failed',
        description: 'Failed to update duty status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [pendingDutyStatus, user?.id, addToast]);
  
  // Handle time update
  const handleTimeUpdate = useCallback(async (newTime: string) => {
    try {
      setLoading(true);
      await logService.updateDutyStatusTime(dutyStatus.status, newTime);

      // Convert time-only string back to ISO format for consistent state management
      const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
      const isoTimeString = `${today}T${newTime}`;

      setDutyStatus(prev => ({
        ...prev,
        startTime: isoTimeString,
      }));
      setShowTimeEditDialog(false);
      addToast({
        title: 'Success',
        description: 'Duty status time updated successfully',
      });
    } catch (error) {
      console.error('Error updating time:', error);
      addToast({
        title: 'Error',
        description: 'Failed to update duty status time',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [dutyStatus.status]);

  // Cleanup timer on unmount or status change
  useEffect(() => {
    return () => {
      if (pickupDropoffTimer) {
        clearInterval(pickupDropoffTimer);
      }
    };
  }, [pickupDropoffTimer]);

  // Start pickup/dropoff timer when entering on_duty_not_driving with pickup/dropoff flag
  useEffect(() => {
    if (dutyStatus.status === 'on_duty_not_driving' && timeRemaining > 0) {
      startPickupDropoffTimer();
    }
  }, [dutyStatus.status, timeRemaining]);

  // Start pickup/dropoff timer
  const startPickupDropoffTimer = useCallback(() => {
    // Clear any existing timer
    if (pickupDropoffTimer) {
      clearInterval(pickupDropoffTimer);
    }

    // Set initial time remaining (1 hour = 3600000ms)
    setTimeRemaining(3600000);

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1000) {
          // Timer expired, auto-switch to driving
          clearInterval(timer);
          setPickupDropoffTimer(null);
          handleAutoSwitchToDriving();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    setPickupDropoffTimer(timer);
  }, [pickupDropoffTimer]);

  // Auto-switch back to driving after pickup/dropoff timer expires
  const handleAutoSwitchToDriving = useCallback(async () => {
    try {
      setLoading(true);

      // Get today's log entries to find existing entry to end
      const todaysEntries = await logService.getLogEntries();
      const today = new Date().toISOString().split('T')[0];
      const existingEntry = todaysEntries
        .filter(entry => entry.date === today)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0];

      // End the current on_duty_not_driving entry
      if (existingEntry) {
        await logService.updateLogEntry(existingEntry.id, {
          end_time: new Date().toTimeString().substring(0, 8),
        });
      }

      // Create new driving entry
      // Add a small delay to ensure unique start_time
      const drivingStartTime = new Date();
      drivingStartTime.setSeconds(drivingStartTime.getSeconds() + 1);
      await logService.createLogEntry({
        driver: user?.id,
        date: new Date().toISOString().split('T')[0], // Add current date
        duty_status: 'driving',
        start_time: drivingStartTime.toTimeString().substring(0, 8),
      });

      // Update local state
      setDutyStatus({
        status: 'driving',
        startTime: new Date().toISOString(),
      });

      addToast({
        title: 'Auto-Switched to Driving',
        description: 'Pickup/dropoff activity completed. You are now in driving mode.',
      });
    } catch (error) {
      console.error('Error auto-switching to driving:', error);
      addToast({
        title: 'Auto-Switch Failed',
        description: 'Failed to auto-switch to driving mode',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, addToast]);

  // Render the component
  if (loading) {
    return <div className="p-4">Loading...</div>;
  }
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Driver Dashboard</h1>
      
      {/* Duty Status Controls */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Duty Status</h2>
        <DutyStatusControls
          currentStatus={dutyStatus.status}
          onStatusChange={handleDutyStatusChange}
          loading={loading}
        />
        
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-medium">Current Status: </span>
              <span className="capitalize">{dutyStatus.status.replace(/_/g, ' ')}</span>
              {dutyStatus.startTime && (
                <span className="text-sm text-gray-500 ml-2">
                  (since {new Date(dutyStatus.startTime).toLocaleTimeString()})
                </span>
              )}
              {timeRemaining > 0 && dutyStatus.status === 'on_duty_not_driving' && (
                <div className="mt-2 text-sm text-orange-600 dark:text-orange-400">
                  ⏰ Pickup/Dropoff Timer: {Math.floor(timeRemaining / 60000)}:{String(Math.floor((timeRemaining % 60000) / 1000)).padStart(2, '0')} remaining
                </div>
              )}
            </div>
            <button
              onClick={() => {
                // Extract time portion from ISO string if needed and ensure seconds are included
                const timeValue = dutyStatus.startTime;
                let timeOnly = '';

                if (timeValue && timeValue.includes('T')) {
                  // Extract HH:MM:SS from ISO format or add seconds if missing
                  const timePart = timeValue.split('T')[1];
                  if (timePart) {
                    const parts = timePart.split(':');
                    if (parts.length === 2) {
                      timeOnly = parts[0] + ':' + parts[1] + ':00'; // Add seconds if missing
                    } else if (parts.length === 3) {
                      timeOnly = timePart; // Already has seconds
                    } else {
                      timeOnly = timePart + ':00'; // Fallback
                    }
                  }
                } else if (timeValue) {
                  // Handle non-ISO time format (fallback)
                  if (timeValue.includes(':')) {
                    const parts = timeValue.split(':');
                    if (parts.length === 2) {
                      timeOnly = parts[0] + ':' + parts[1] + ':00'; // Add seconds if missing
                    } else {
                      timeOnly = timeValue; // Already has seconds or use as-is
                    }
                  } else {
                    timeOnly = timeValue + ':00';
                  }
                } else {
                  timeOnly = '';
                }

                setEditedTime(timeOnly);
                setShowTimeEditDialog(true);
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-all duration-200"
            >
              Edit Time
            </button>
          </div>
        </div>
      </div>
      
      {/* Current Trip */}
      {currentTrip && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Current Trip</h2>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="font-medium">{currentTrip.name}</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Status: {currentTrip.status}
            </p>
          </div>
        </div>
      )}
      
      {/* Location Info */}
      {currentLocation && (
        <div className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Current Location</h2>
          <p>Latitude: {currentLocation.latitude.toFixed(6)}</p>
          <p>Longitude: {currentLocation.longitude.toFixed(6)}</p>
        </div>
      )}
      
      {/* Duty Status Dialog */}
      {pendingDutyStatus && (
        <DutyStatusDialog
          isOpen={showDutyDialog}
          onClose={() => setShowDutyDialog(false)}
          onSubmit={confirmDutyStatusChange}
          status={pendingDutyStatus.status}
          loading={loading}
          currentLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
          existingEntryId={existingEntryId || undefined}
        />
      )}
      
      {/* Time Edit Dialog */}
      <TimeEditDialog
        isOpen={showTimeEditDialog}
        onClose={() => setShowTimeEditDialog(false)}
        onSave={handleTimeUpdate}
        currentTime={editedTime}
        loading={loading}
        title="Edit Start Time"
      />
    </div>
  );
};

export default DriverDashboard;

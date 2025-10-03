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
  const [showTimeEditDialog, setShowTimeEditDialog] = useState<boolean>(false);
  const [editedTime, setEditedTime] = useState<string>(new Date().toTimeString().substring(0, 5));
  
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
  }, [user]);

  // Initialize - Load data when user changes
  useEffect(() => {
    if (user) {
      loadCurrentDutyStatus();
      loadCurrentTrip();
    }
  }, [user]); // Only depend on user, not the functions

  // Start/stop location tracking based on duty status
  useEffect(() => {
    if (!dutyStatus) return;
    
    if (dutyStatus.status === 'driving') {
      startTracking();
    } else {
      stopTracking();
    }
    
    return () => {
      stopTracking();
    };
  }, [dutyStatus, startTracking, stopTracking]);
  
  // Handle duty status change
  const handleDutyStatusChange = useCallback((status: DutyStatus) => {
    setPendingDutyStatus({
      status,
      startTime: new Date().toISOString(),
    });
    setShowDutyDialog(true);
  }, []);
  
  // Confirm duty status change
  const confirmDutyStatusChange = useCallback(async (formData: DutyStatusFormData) => {
    if (!pendingDutyStatus) return;

    try {
      setLoading(true);

      // Convert LocationData to string format for API
      const locationString = formData.location ? formData.location.address : '';

      await logService.updateLogEntry(0, {
        ...pendingDutyStatus,
        location: locationString,
        latitude: formData.location?.lat,
        longitude: formData.location?.lng,
        ...formData,
        odometerStart: formData.odometerStart ? parseFloat(formData.odometerStart) : undefined,
        odometerEnd: formData.odometerEnd ? parseFloat(formData.odometerEnd) : undefined,
      });

      setDutyStatus(pendingDutyStatus);
      setShowDutyDialog(false);

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
  }, [pendingDutyStatus]);
  
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
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
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
          currentLocation={currentLocation || undefined}
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

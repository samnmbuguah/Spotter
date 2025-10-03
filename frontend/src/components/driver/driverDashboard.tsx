import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
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
  const [editedTime, setEditedTime] = useState<string>('');
  
  // Removed duplicate form state as it's managed by DutyStatusDialog

  // Load current duty status
  const loadCurrentDutyStatus = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const status = await logService.getCurrentHOSStatus();
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
  }, [user, addToast]);

  // Load current trip
  const loadCurrentTrip = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const trip = await logService.getCurrentTrip();
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

  // Initialize
  useEffect(() => {
    loadCurrentDutyStatus();
    loadCurrentTrip();
  }, [loadCurrentDutyStatus, loadCurrentTrip]);

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
      
      await logService.updateLogEntry(0, {
        ...pendingDutyStatus,
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
  }, [pendingDutyStatus, addToast]);
  
  // Handle time update
  const handleTimeUpdate = useCallback(async (newTime: string) => {
    try {
      setLoading(true);
      await logService.updateDutyStatusTime(dutyStatus.status, newTime);
      setDutyStatus(prev => ({
        ...prev,
        startTime: newTime,
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
  }, [dutyStatus.status, addToast]);

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
                setEditedTime(dutyStatus.startTime);
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
          currentLocation={currentLocation}
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

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../ui/use-toast';
import { tripService, logService } from '../../services/api';
import { useLocationTracking } from '../../hooks/useLocationTracking';
import { useAuthStore } from '../../stores/useAuthStore';
import { DutyStatus, DutyStatusData, DutyStatusFormData, Trip } from './types';
import { DutyStatusControls } from './DutyStatusControls';
import { DutyStatusDialog } from './DutyStatusDialog';
import { TimeEditDialog } from './TimeEditDialog';

export const DriverDashboard: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { currentLocation, startTracking, stopTracking } = useLocationTracking();
  
  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [dutyStatus, setDutyStatus] = useState<DutyStatusData>(() => ({
    status: 'off_duty',
    startTime: new Date().toISOString(),
  }));
  
  // Dialog states
  const [showDutyDialog, setShowDutyDialog] = useState<boolean>(false);
  const [pendingDutyStatus, setPendingDutyStatus] = useState<DutyStatusData | null>(null);
  const [showTimeEditDialog, setShowTimeEditDialog] = useState<boolean>(false);
  const [editedTime, setEditedTime] = useState<string>('');
  const [showDurationEditDialog] = useState<boolean>(false);
  
  // Form data
  const [, setFormData] = useState<DutyStatusFormData>({
    location: '',
    notes: '',
    vehicleInfo: '',
    trailerInfo: '',
    odometerStart: '',
    odometerEnd: '',
  });

  // Load current duty status and trip
  const loadCurrentDutyStatus = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const status = await logService.getCurrentHOSStatus();
      if (status) {
        setDutyStatus(prev => ({
          ...prev,
          ...status,
          startTime: status.startTime || prev.startTime,
        }));
      }
    } catch (error) {
      console.error('Error loading duty status:', error);
      toast({
        title: 'Error',
        description: 'Failed to load duty status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Load current trip
  const loadCurrentTrip = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const trip = await tripService.getCurrentTrip();
      setCurrentTrip(trip);
    } catch (error) {
      console.error('Error loading current trip:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Update location in log
  const updateLocationInLog = useCallback(async (location: { latitude: number; longitude: number }) => {
    if (!user || !dutyStatus.status) return;
    
    try {
      // Use updateLogEntry or appropriate method from logService
      await logService.updateLogEntry(0, {
        status: dutyStatus.status,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating location in log:', error);
    }
  }, [user, dutyStatus.status]);

  // Handle duty status change
  const handleDutyStatusChange = useCallback(async (newStatus: DutyStatus) => {
    try {
      setLoading(true);
      
      if (currentLocation) {
        await updateLocationInLog(currentLocation);
      }
      
      setPendingDutyStatus({
        ...dutyStatus,
        status: newStatus,
        startTime: new Date().toISOString(),
      });
      
      setShowDutyDialog(true);
    } catch (error) {
      console.error('Error updating duty status:', error);
      toast({
        title: 'Status Update Failed',
        description: 'Failed to update your duty status.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [currentLocation, dutyStatus, updateLocationInLog, toast]);

  // Confirm duty status change
  const confirmDutyStatusChange = async (formData: DutyStatusFormData) => {
    if (!pendingDutyStatus) return;
    
    try {
      setLoading(true);
      
      // Use updateLogEntry or appropriate method from logService
      await logService.updateLogEntry(0, {
        ...pendingDutyStatus,
        ...formData,
        odometerStart: formData.odometerStart ? parseFloat(formData.odometerStart) : undefined,
        odometerEnd: formData.odometerEnd ? parseFloat(formData.odometerEnd) : undefined,
      });
      
      setDutyStatus(pendingDutyStatus);
      setShowDutyDialog(false);
      
      // Use the toast function from the context
      const { toast: showToast } = useToast();
      showToast({
        title: 'Status Updated',
        description: `You are now ${pendingDutyStatus.status.replace(/_/g, ' ')}`,
      });
    } catch (error) {
      console.error('Error confirming duty status:', error);
      const { toast: showToast } = useToast();
      showToast({
        title: 'Update Failed',
        description: 'Failed to update duty status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Initialize
  useEffect(() => {
    loadCurrentDutyStatus();
    loadCurrentTrip();
  }, [loadCurrentDutyStatus, loadCurrentTrip]);

  // Update location when it changes
  useEffect(() => {
    if (currentLocation && dutyStatus.status) {
      updateLocationInLog(currentLocation);
    }
  }, [currentLocation, dutyStatus.status, updateLocationInLog]);

  // Start/stop location tracking based on duty status
  useEffect(() => {
    if (dutyStatus.status === 'driving') {
      startTracking();
    } else {
      stopTracking();
    }
    
    return () => {
      stopTracking();
    };
  }, [dutyStatus.status, startTracking, stopTracking]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Driver Dashboard</h1>
      
      {/* Duty Status Controls */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Duty Status</h2>
        <DutyStatusControls
          currentStatus={dutyStatus.status}
          loading={loading}
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
        <div className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Current Trip</h2>
          <p>{currentTrip.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Status: <span className="capitalize">{currentTrip.status}</span>
          </p>
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
        onSave={async (newTime) => {
          try {
            setLoading(true);
            await logService.updateDutyStatusTime(dutyStatus.status, newTime);
            setDutyStatus(prev => ({
              ...prev,
              startTime: newTime,
            }));
            setShowTimeEditDialog(false);
          } catch (error) {
            console.error('Error updating time:', error);
            toast({
              title: 'Update Failed',
              description: 'Failed to update time',
              variant: 'destructive',
            });
          } finally {
            setLoading(false);
          }
        }}
        currentTime={editedTime}
        loading={loading}
        title="Edit Start Time"
      />
      
      {/* Duration Edit Dialog - Temporarily disabled until implemented */}
      {showDurationEditDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <p>Duration edit functionality will be implemented soon.</p>
            <button 
              onClick={() => {}}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;

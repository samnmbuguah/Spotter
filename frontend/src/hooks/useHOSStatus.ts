import { useState, useEffect, useCallback, useRef } from 'react';
import { logService } from '../services/api';
import { useToast } from '../components/ui/use-toast';
import { formatDuration } from '../utils/dateTime';

export type HOSStatusType = 
  | 'off_duty' 
  | 'sleeper_berth' 
  | 'driving' 
  | 'on_duty';

export interface HOSStatus {
  current_status: HOSStatusType;
  current_status_duration: number; // in minutes
  driving_hours_today: number; // in minutes
  on_duty_hours_today: number; // in minutes
  remaining_driving_hours: number; // in minutes
  remaining_on_duty_hours: number; // in minutes
  is_compliant_today: boolean;
  next_required_break: number | null; // in minutes
  violations: Array<{
    type: string;
    description: string;
    severity: 'warning' | 'critical';
    timestamp: string;
  }>;
  last_updated: string;
}

interface UseHOSStatusOptions {
  /**
   * Whether to automatically poll for status updates
   * @default true
   */
  autoPoll?: boolean;
  
  /**
   * Polling interval in milliseconds
   * @default 300000 (5 minutes)
   */
  pollInterval?: number;
  
  /**
   * Whether to show toast notifications for status changes
   * @default true
   */
  showNotifications?: boolean;
}

const DEFAULT_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to manage Hours of Service (HOS) status and compliance
 */
export const useHOSStatus = (options: UseHOSStatusOptions = {}) => {
  const {
    autoPoll = true,
    pollInterval = DEFAULT_POLL_INTERVAL,
    showNotifications = true,
  } = options;
  
  const [hosStatus, setHosStatus] = useState<HOSStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();
  const prevStatusRef = useRef<HOSStatusType | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format status for display
  const formatStatus = (status: HOSStatusType): string => {
    const statusMap: Record<HOSStatusType, string> = {
      off_duty: 'Off Duty',
      sleeper_berth: 'Sleeper Berth',
      driving: 'Driving',
      on_duty: 'On Duty',
    };
    return statusMap[status] || status;
  };

  // Fetch HOS status from the server
  const fetchHOSStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await logService.getCurrentHOSStatus();
      
      // Check for status changes
      if (showNotifications && prevStatusRef.current && prevStatusRef.current !== data.current_status) {
        addToast({
          title: 'Status Changed',
          description: `Status changed to: ${formatStatus(data.current_status)}`,
          variant: 'default',
        });
      }
      
      prevStatusRef.current = data.current_status;
      setHosStatus(data);
      return data;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 'Failed to fetch HOS status';
      setError(errorMessage);
      
      if (showNotifications) {
        addToast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showNotifications, addToast]);

  // Start polling for status updates
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(() => {
      fetchHOSStatus().catch(console.error);
    }, pollInterval);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchHOSStatus, pollInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Set up polling on mount and clean up on unmount
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      try {
        await fetchHOSStatus();
        
        if (autoPoll && mounted) {
          startPolling();
        }
      } catch (error) {
        console.error('Error initializing HOS status:', error);
      }
    };
    
    init();
    
    return () => {
      mounted = false;
      stopPolling();
    };
  }, [autoPoll, fetchHOSStatus, startPolling, stopPolling]);

  // Format the current status duration
  const formatStatusDuration = (): string => {
    if (!hosStatus) return '--:--';
    return formatDuration(hosStatus.current_status_duration);
  };

  // Check if driver is in violation
  const isInViolation = (): boolean => {
    if (!hosStatus) return false;
    return !hosStatus.is_compliant_today || hosStatus.violations.length > 0;
  };

  // Get the next required break time
  const getNextBreakTime = (): string | null => {
    if (!hosStatus?.next_required_break) return null;
    return formatDuration(hosStatus.next_required_break);
  };

  // Get formatted driving time for today
  const getFormattedDrivingTime = (): string => {
    if (!hosStatus) return '--:--';
    return formatDuration(hosStatus.driving_hours_today);
  };

  // Get formatted on-duty time for today
  const getFormattedOnDutyTime = (): string => {
    if (!hosStatus) return '--:--';
    return formatDuration(hosStatus.on_duty_hours_today);
  };

  return {
    // State
    hosStatus,
    loading,
    error,
    
    // Status info
    currentStatus: hosStatus?.current_status || null,
    currentStatusFormatted: hosStatus ? formatStatus(hosStatus.current_status) : '--',
    currentStatusDuration: formatStatusDuration(),
    drivingTimeToday: getFormattedDrivingTime(),
    onDutyTimeToday: getFormattedOnDutyTime(),
    remainingDrivingTime: hosStatus ? formatDuration(hosStatus.remaining_driving_hours) : '--:--',
    remainingOnDutyTime: hosStatus ? formatDuration(hosStatus.remaining_on_duty_hours) : '--:--',
    nextBreakTime: getNextBreakTime(),
    isInViolation: isInViolation(),
    violations: hosStatus?.violations || [],
    
    // Methods
    refetch: fetchHOSStatus,
    startPolling,
    stopPolling,
    
    // Utility functions
    formatStatus,
  };
};

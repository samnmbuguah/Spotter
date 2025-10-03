import { useState, useEffect, useRef, useCallback } from 'react';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

interface LocationTrackingState {
  currentLocation: LocationData | null;
  isTracking: boolean;
  error: string | null;
  watchId: number | null;
}

export const useLocationTracking = () => {
  const [state, setState] = useState<LocationTrackingState>({
    currentLocation: null,
    isTracking: false,
    error: null,
    watchId: null,
  });

  const lastLocationRef = useRef<LocationData | null>(null);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by this browser',
      }));
      return;
    }

    setState(prev => ({ ...prev, isTracking: true, error: null }));

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };

        // Only update if location has changed significantly (more than 10 meters)
        if (
          !lastLocationRef.current ||
          calculateDistance(
            lastLocationRef.current.latitude,
            lastLocationRef.current.longitude,
            newLocation.latitude,
            newLocation.longitude
          ) > 0.01 // 10 meters in kilometers
        ) {
          lastLocationRef.current = newLocation;
          setState(prev => ({
            ...prev,
            currentLocation: newLocation,
            error: null,
          }));
        }
      },
      (error) => {
        let errorMessage = 'Unknown location error';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }

        setState(prev => ({
          ...prev,
          error: errorMessage,
          isTracking: false,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );

    setState(prev => ({ ...prev, watchId }));
  }, []);

  const stopTracking = useCallback(() => {
    if (state.watchId !== null) {
      navigator.geolocation.clearWatch(state.watchId);
    }

    setState(prev => ({
      ...prev,
      currentLocation: null,
      isTracking: false,
      error: null,
      watchId: null,
    }));

    lastLocationRef.current = null;
  }, [state.watchId]);

  // Calculate distance between two coordinates in kilometers
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
  };

  const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180);
  };

  // Get current location once (not continuously)
  const getCurrentLocation = (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          let errorMessage = 'Unknown location error';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
    });
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount - use current state.watchId value when cleanup runs
      if (state.watchId !== null) {
        navigator.geolocation.clearWatch(state.watchId);
      }
    };
  }, []); // Remove state.watchId dependency to prevent infinite loop

  return {
    ...state,
    startTracking,
    stopTracking,
    getCurrentLocation,
  };
};

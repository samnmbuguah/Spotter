import { useState, useEffect, useCallback } from 'react';
import { loadGoogleMaps } from '../../services/googleMaps';

type Location = {
  lat: number;
  lng: number;
};

type Address = {
  address: string;
  placeId?: string;
};

type MapInstance = google.maps.Map;
type MarkerInstance = google.maps.Marker;
type GeocoderResult = google.maps.GeocoderResult;
type GeocoderStatus = google.maps.GeocoderStatus;

export const useGoogleMaps = (mapContainerRef: React.RefObject<HTMLDivElement>, initialLocation?: Location) => {
  const [map, setMap] = useState<MapInstance | null>(null);
  const [marker, setMarker] = useState<MarkerInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize the map
  useEffect(() => {
    let mapInstance: MapInstance | null = null;
    let markerInstance: MarkerInstance | null = null;

    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        await loadGoogleMaps();
        
        if (!mapContainerRef.current) return;

        // Create map instance
        mapInstance = new window.google.maps.Map(mapContainerRef.current, {
          center: initialLocation || { lat: 0, lng: 0 },
          zoom: initialLocation ? 12 : 2,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          clickableIcons: false,
        });

        // Add marker if initial location is provided
        if (initialLocation) {
          markerInstance = new window.google.maps.Marker({
            position: initialLocation,
            map: mapInstance,
            draggable: true,
          });
        }

        setMap(mapInstance);
        setMarker(markerInstance);
      } catch (err) {
        console.error('Failed to initialize Google Maps:', err);
        setError('Failed to load Google Maps. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      if (markerInstance) {
        markerInstance.setMap(null);
      }
    };
  }, [mapContainerRef, initialLocation]);

  // Update marker position
  const updateMarker = useCallback((location: Location) => {
    if (!map) return;

    setMarker(prevMarker => {
      if (prevMarker) {
        prevMarker.setPosition(location);
        return prevMarker;
      }
      
      // Create new marker if it doesn't exist
      const newMarker = new window.google.maps.Marker({
        position: location,
        map,
        draggable: true,
      });
      
      return newMarker;
    });

    // Center the map on the new location
    map.panTo(location);
  }, [map]);

  // Geocode coordinates to address
  const geocodeLocation = useCallback((location: Location): Promise<Address> => {
    return new Promise((resolve, reject) => {
      if (!window.google?.maps) {
        reject(new Error('Google Maps not loaded'));
        return;
      }

      const geocoder = new window.google.maps.Geocoder();
      
      geocoder.geocode({ location }, (results: GeocoderResult[] | null, status: GeocoderStatus) => {
        if (status === 'OK' && results?.[0]) {
          resolve({
            address: results[0].formatted_address,
            placeId: results[0].place_id,
          });
        } else {
          reject(new Error('Geocoding failed'));
        }
      });
    });
  }, []);

  // Get current location using geolocation API
  const getCurrentLocation = useCallback((): Promise<Location> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          let errorMessage = 'Unable to retrieve your location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location services.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'The request to get user location timed out.';
              break;
          }
          reject(new Error(errorMessage));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  return {
    map,
    marker,
    isLoading,
    error,
    updateMarker,
    geocodeLocation,
    getCurrentLocation,
  };
};

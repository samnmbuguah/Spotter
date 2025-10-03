import React, { useEffect, useRef, useState } from 'react';

// Define the Google Maps types we'll be using
declare global {
  interface Window {
    google: any;
    googleMapsLoaded: boolean;
    isGoogleMapsLoading: boolean;
    googleMapsCallbacks: (() => void)[];
  }
}

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

interface TripMapProps {
  origin: LocationData | null;
  destination: LocationData | null;
  waypoints?: LocationData[];
  height?: string;
  zoom?: number;
}

// Global state for Google Maps loading (shared with LocationSearch)
const loadGoogleMaps = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    if (window.googleMapsLoaded && window.google?.maps) {
      resolve();
      return;
    }

    // If currently loading, add callback to queue
    if (window.isGoogleMapsLoading) {
      window.googleMapsCallbacks.push(() => resolve());
      return;
    }

    // Start loading
    window.isGoogleMapsLoading = true;

    // Check if script already exists
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      // Script exists, but might not be loaded yet
      if (window.google?.maps) {
        window.googleMapsLoaded = true;
        window.isGoogleMapsLoading = false;
        resolve();
      } else {
        // Script exists but not loaded, wait for it
        window.googleMapsCallbacks.push(() => resolve());
      }
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      window.googleMapsLoaded = true;
      window.isGoogleMapsLoading = false;

      // Execute all queued callbacks
      window.googleMapsCallbacks.forEach((callback: () => void) => callback());
      window.googleMapsCallbacks.length = 0;

      resolve();
    };

    script.onerror = () => {
      window.isGoogleMapsLoading = false;
      reject(new Error('Failed to load Google Maps'));
    };

    document.head.appendChild(script);
  });
};

const TripMap: React.FC<TripMapProps> = ({
  origin,
  destination,
  waypoints = [],
  height = '400px',
  zoom = 5,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);

  useEffect(() => {
    // Only initialize map in browser environment
    if (typeof window === 'undefined' || !mapRef.current) return;

    const initMap = async () => {
      try {
        if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
          console.warn('Google Maps API key not found');
          return;
        }

        // Check if Google Maps is already loaded
        if (window.google && window.google.maps) {
          createMap();
          return;
        }

        // Load Google Maps script if not already loaded
        await loadGoogleMaps();
        createMap();
      } catch (error) {
        console.error('Error initializing Google Maps:', error);
        setIsLoading(false);
      }
    };

    const createMap = () => {
      if (!window.google || !window.google.maps || !mapRef.current) {
        console.error('Google Maps not available');
        setIsLoading(false);
        return;
      }

      // Create map instance
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 39.8283, lng: -98.5795 }, // Center of USA
        zoom: zoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      });

      // Initialize directions renderer
      directionsRenderer.current = new window.google.maps.DirectionsRenderer({
        draggable: false,
        panel: null,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#2563eb',
          strokeWeight: 4,
          strokeOpacity: 0.8,
        },
      });

      directionsRenderer.current.setMap(mapInstance.current);
      setIsLoading(false);
    };

    initMap();
  }, [zoom]);

  // Update route when locations change
  useEffect(() => {
    if (!mapInstance.current || !directionsRenderer.current || !origin || !destination) {
      return;
    }

    const updateRoute = async () => {
      try {
        const directionsService = new window.google.maps.DirectionsService();

        // Set the waypoints if any
        const waypointsList = waypoints.map(waypoint => ({
          location: new window.google.maps.LatLng(waypoint.lat, waypoint.lng),
          stopover: true,
        }));

        const results = await directionsService.route({
          origin: new window.google.maps.LatLng(origin.lat, origin.lng),
          destination: new window.google.maps.LatLng(destination.lat, destination.lng),
          waypoints: waypointsList,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: true,
        });

        directionsRenderer.current.setDirections(results);

        // Adjust map bounds to show the entire route
        const bounds = new window.google.maps.LatLngBounds();
        results.routes[0].legs.forEach((leg: any) => {
          if (leg.start_location) bounds.extend(leg.start_location);
          if (leg.end_location) bounds.extend(leg.end_location);
        });
        mapInstance.current.fitBounds(bounds);
      } catch (error) {
        console.error('Error calculating route:', error);
      }
    };

    updateRoute();
  }, [origin, destination, waypoints]);

  // Clean up
  useEffect(() => {
    return () => {
      if (directionsRenderer.current) {
        directionsRenderer.current.setMap(null);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div ref={mapRef} style={{ height, width: '100%', borderRadius: '0.5rem' }} />
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading map...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripMap;

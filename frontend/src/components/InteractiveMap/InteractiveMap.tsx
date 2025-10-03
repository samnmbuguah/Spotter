import React, { useRef, useEffect, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MapPin, Crosshair, Loader2, X, Route, MapPinOff } from 'lucide-react';
import { useMapState, MapPoint, PointType } from '../../hooks/maps/useMapState';
import { useGoogleMaps } from '../../hooks/maps/useGoogleMaps';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

const POINT_TYPES: PointType[] = ['origin', 'pickup', 'destination'];
const POINT_COLORS = {
  origin: '#10B981', // Green
  pickup: '#3B82F6', // Blue
  destination: '#EF4444', // Red
};

interface InteractiveMapProps {
  apiKey: string;
  className?: string;
  onPointSelect?: (point: MapPoint) => void;
  onDirectionsChange?: (directions: google.maps.DirectionsResult | null) => void;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  apiKey,
  className = '',
  onPointSelect,
  onDirectionsChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [selectedType, setSelectedType] = React.useState<PointType | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [mapInstance, setMapInstance] = React.useState<google.maps.Map | null>(null);
  
  // Initialize map state
  const {
    points,
    selectedPoint,
    directions,
    addPoint,
    removePoint,
    updatePoint,
    setSelectedPoint,
    setDirections,
  } = useMapState();

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      try {
        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry', 'routes'],
        });

        const google = await loader.load();
        const map = new google.maps.Map(mapContainerRef.current!, {
          center: { lat: 39.8283, lng: -98.5795 }, // Center of US
          zoom: 4,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        setMapInstance(map);
        setIsLoading(false);

        // Add click listener for adding points
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (selectedType && e.latLng) {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            addPoint(lat, lng, selectedType);
          }
        });

        return () => {
          // Cleanup
          google.maps.event.clearInstanceListeners(map);
        };
      } catch (error) {
        console.error('Error initializing map:', error);
        setIsLoading(false);
      }
    };

    initMap();
  }, [apiKey, selectedType]);

  // Update directions when points change
  useEffect(() => {
    if (!mapInstance || points.length < 2) return;

    const calculateRoute = async () => {
      const directionsService = new google.maps.DirectionsService();
      const waypoints = points
        .filter(p => p.type === 'pickup')
        .map(p => ({
          location: { lat: p.lat, lng: p.lng },
          stopover: true,
        }));

      const origin = points.find(p => p.type === 'origin');
      const destination = points.find(p => p.type === 'destination');

      if (!origin || !destination) return;

      setDirections({ loading: true, error: null });

      try {
        const results = await directionsService.route({
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: true,
        });

        setDirections({
          route: results,
          loading: false,
          error: null,
        });
        
        onDirectionsChange?.(results);
      } catch (error) {
        console.error('Error calculating directions:', error);
        setDirections({
          route: undefined,
          loading: false,
          error: 'Failed to calculate route. Please try again.',
        });
        onDirectionsChange?.(null);
      }
    };

    calculateRoute();
  }, [points, mapInstance]);

  // Render markers for points
  useEffect(() => {
    if (!mapInstance) return;

    const markers: google.maps.Marker[] = [];

    points.forEach(point => {
      const marker = new google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        map: mapInstance,
        title: point.type,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: POINT_COLORS[point.type],
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#ffffff',
          scale: 10,
        },
      });

      marker.addListener('click', () => {
        setSelectedPoint(point);
        onPointSelect?.(point);
      });

      markers.push(marker);
    });

    // Fit bounds to show all markers
    if (markers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach(marker => bounds.extend(marker.getPosition()!));
      mapInstance.fitBounds(bounds);
    }

    return () => {
      markers.forEach(marker => marker.setMap(null));
    };
  }, [points, mapInstance]);

  // Handle point selection
  const handlePointSelect = (type: PointType) => {
    setSelectedType(prev => (prev === type ? null : type));
  };

  // Handle current location
  const handleCurrentLocation = useCallback(() => {
    if (!mapInstance) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          
          mapInstance.setCenter(pos);
          mapInstance.setZoom(15);
          
          if (selectedType) {
            addPoint(pos.lat, pos.lng, selectedType);
          }
        },
        error => {
          console.error('Error getting current location:', error);
        }
      );
    } else {
      console.error('Geolocation is not supported by this browser');
    }
  }, [mapInstance, selectedType, addPoint]);

  return (
    <div className={cn('relative h-full w-full', className)}>
      {/* Map container */}
      <div ref={mapContainerRef} className="h-full w-full rounded-lg overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Map controls */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleCurrentLocation}
          title="Use current location"
          className="bg-white dark:bg-gray-800 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Crosshair className="h-4 w-4" />
        </Button>
      </div>

      {/* Point type selector */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {POINT_TYPES.map(type => (
          <Button
            key={type}
            type="button"
            variant={selectedType === type ? 'default' : 'outline'}
            className={cn(
              'capitalize flex items-center space-x-2',
              selectedType === type && `bg-${POINT_COLORS[type]}-500 hover:bg-${POINT_COLORS[type]}-600`
            )}
            onClick={() => handlePointSelect(type)}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: POINT_COLORS[type] }}
            />
            <span>{type}</span>
          </Button>
        ))}
      </div>

      {/* Directions panel */}
      {directions.loading && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-xs">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Calculating route...</span>
          </div>
        </div>
      )}

      {directions.error && (
        <div className="absolute top-4 left-4 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 p-4 rounded-lg shadow-lg max-w-xs">
          <div className="flex items-center space-x-2">
            <X className="h-4 w-4" />
            <span>{directions.error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;

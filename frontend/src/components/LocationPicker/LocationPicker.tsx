import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MapPin, Crosshair, Loader2, X } from 'lucide-react';
import { useGoogleMaps } from '../../hooks/maps/useGoogleMaps';
import { useLocationSearch } from '../../hooks/maps/useLocationSearch';

export interface Location {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

interface LocationPickerProps {
  onLocationSelect: (location: Location) => void;
  initialLocation?: Location | null;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
  showMapByDefault?: boolean;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationSelect,
  initialLocation = null,
  placeholder = 'Search for a location or click on the map',
  className = '',
  label = 'Location',
  required = false,
  showMapByDefault = false,
}) => {
  const [address, setAddress] = useState(initialLocation?.address || '');
  const [showMap, setShowMap] = useState(showMapByDefault);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize hooks
  const {
    map,
    marker,
    isLoading: isMapLoading,
    error: mapError,
    updateMarker,
    geocodeLocation,
    getCurrentLocation: getCurrentLocationFromHook,
  } = useGoogleMaps(mapContainerRef, initialLocation || undefined);

  const {
    suggestions,
    isLoading: isSearching,
    error: searchError,
    handleInputChange,
    getPlaceDetails,
    clearSuggestions,
  } = useLocationSearch(inputRef);

  // Handle location selection
  const handleLocationSelect = useCallback(async (location: Omit<Location, 'address'>, placeId?: string) => {
    try {
      // Update marker on the map
      updateMarker(location);
      
      // Get address from coordinates if not provided
      let address = '';
      if (placeId) {
        const place = await getPlaceDetails(placeId);
        address = place?.formatted_address || '';
      } else {
        const result = await geocodeLocation(location);
        address = result.address;
      }
      
      // Update the input field
      setAddress(address);
      
      // Notify parent component
      onLocationSelect({
        ...location,
        address,
        placeId,
      });
      
      // Close suggestions
      clearSuggestions();
    } catch (err) {
      console.error('Error handling location selection:', err);
    }
  }, [updateMarker, onLocationSelect, geocodeLocation, getPlaceDetails, clearSuggestions]);

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAddress(value);
    handleInputChange(value);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion: google.maps.places.AutocompletePrediction) => {
    setAddress(suggestion.description);
    
    const place = await getPlaceDetails(suggestion.place_id);
    if (place?.geometry?.location) {
      handleLocationSelect(
        {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        },
        place.place_id
      );
      
      // Show the map if it's hidden
      if (!showMap) {
        setShowMap(true);
      }
    }
  };

  // Handle map click
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      handleLocationSelect({
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      });
    }
  }, [handleLocationSelect]);

  // Handle current location button click
  const handleCurrentLocation = async () => {
    try {
      const location = await getCurrentLocationFromHook();
      await handleLocationSelect(location);
      
      if (!showMap) {
        setShowMap(true);
      }
    } catch (err) {
      console.error('Error getting current location:', err);
      alert(err instanceof Error ? err.message : 'Failed to get current location');
    }
  };

  // Toggle map visibility
  const toggleMap = () => {
    setShowMap(!showMap);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  // Add click listener to map when it's loaded
  useEffect(() => {
    if (map && !isInitialized) {
      map.addListener('click', handleMapClick);
      setIsInitialized(true);
      
      return () => {
        window.google.maps.event.clearListeners(map, 'click');
      };
    }
  }, [map, handleMapClick, isInitialized]);

  // Handle marker drag end
  useEffect(() => {
    if (!marker) return;
    
    const listener = marker.addListener('dragend', () => {
      const position = marker.getPosition();
      if (position) {
        handleLocationSelect({
          lat: position.lat(),
          lng: position.lng(),
        });
      }
    });
    
    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [marker, handleLocationSelect]);

  // Handle initial location
  useEffect(() => {
    if (initialLocation && map) {
      updateMarker(initialLocation);
    }
  }, [initialLocation, map, updateMarker]);

  const isLoading = isMapLoading || isSearching;
  const error = mapError || searchError;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={address}
            onChange={handleSearchChange}
            placeholder={placeholder}
            className="block w-full px-4 py-2 pr-24 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
            onFocus={() => setShowMap(true)}
            disabled={isLoading}
          />
          
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 space-x-1">
            {address && (
              <button
                type="button"
                onClick={() => {
                  setAddress('');
                  onLocationSelect({
                    address: '',
                    lat: 0,
                    lng: 0,
                  });
                }}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1"
                title="Clear location"
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </button>
            )}
            
            <button
              type="button"
              onClick={handleCurrentLocation}
              className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 p-1"
              title="Use current location"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Crosshair className="h-5 w-5" />
              )}
            </button>
            
            <button
              type="button"
              onClick={toggleMap}
              className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 p-1"
              title={showMap ? 'Hide map' : 'Show on map'}
              disabled={isLoading}
            >
              <MapPin className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Search suggestions */}
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.place_id}
                className="px-4 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => handleSuggestionSelect(suggestion)}
              >
                {suggestion.description}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      
      {/* Map container */}
      {showMap && (
        <div className="mt-2 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden">
          <div ref={mapContainerRef} className="w-full h-64">
            {isLoading && (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;

import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Crosshair, Loader2 } from 'lucide-react';

interface LocationInputProps {
  onLocationSelect: (location: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  initialValue?: string;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
  autoDetect?: boolean;
  showCoordinates?: boolean;
  disableForm?: boolean; // New prop to disable form wrapper
}

const LocationInput: React.FC<LocationInputProps> = ({
  onLocationSelect,
  initialValue = '',
  placeholder = 'Search for a location or use current location',
  className = '',
  label = 'Location',
  required = false,
  autoDetect = true,
  showCoordinates = true,
  disableForm = false, // New prop with default false for backward compatibility
}) => {
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAutoDetected, setHasAutoDetected] = useState(false);
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);

  // Detect current location
  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          setCoordinates({ lat: latitude, lng: longitude });

          const address = await getAddressFromCoords(latitude, longitude);

          setSearchQuery(address);
          setHasAutoDetected(true);

          onLocationSelect({
            address,
            lat: latitude,
            lng: longitude,
          });
        } catch (error) {
          console.error('Error getting address:', error);
          alert('Found your location but could not get the address. Please enter it manually.');
        } finally {
          setIsLoading(false);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to retrieve your location. Please enter it manually.');
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [onLocationSelect]);

  // Auto-detect location on mount if enabled
  useEffect(() => {
    if (autoDetect && !hasAutoDetected && navigator.geolocation) {
      detectCurrentLocation();
    }
  }, [autoDetect, hasAutoDetected, detectCurrentLocation]);

  // Get address from coordinates using Google Maps API
  const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch address');
      }

      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      }

      throw new Error('No address found');
    } catch (error) {
      console.error('Error in getAddressFromCoords:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  // Handle manual location input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle form submission for search
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      alert('Please enter a location');
      return;
    }

    try {
      setIsLoading(true);

      // Use Google Maps API for geocoding
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch location');
      }

      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        const address = data.results[0].formatted_address;

        setCoordinates({ lat: location.lat, lng: location.lng });

        onLocationSelect({
          address,
          lat: location.lat,
          lng: location.lng,
        });
      } else {
        throw new Error('Location not found');
      }
    } catch (error) {
      console.error('Error searching location:', error);
      alert('Could not find the specified location. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {disableForm ? (
        // Render without form wrapper when used inside another form
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              placeholder={placeholder}
              className="block w-full pl-10 pr-32 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              disabled={isLoading}
            />

            {/* Location pin icon */}
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />

            {/* Right side buttons */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
              <button
                type="button"
                onClick={detectCurrentLocation}
                className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-md mr-1"
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
                onClick={handleSubmit}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white text-sm font-medium rounded-md transition-colors"
                disabled={isLoading || !searchQuery.trim()}
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {/* Show coordinates above input when available */}
          {showCoordinates && coordinates && (
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              📍 {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
            </div>
          )}
        </div>
      ) : (
        // Original form wrapper for standalone usage
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              placeholder={placeholder}
              className="block w-full pl-10 pr-32 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              disabled={isLoading}
            />

            {/* Location pin icon */}
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />

            {/* Right side buttons */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
              <button
                type="button"
                onClick={detectCurrentLocation}
                className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-md mr-1"
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
                type="submit"
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white text-sm font-medium rounded-md transition-colors"
                disabled={isLoading || !searchQuery.trim()}
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {/* Show coordinates above input when available */}
          {showCoordinates && coordinates && (
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              📍 {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
            </div>
          )}
        </form>
      )}

      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
        <MapPin className="h-3.5 w-3.5 mr-1" />
        <span>Click the crosshair to use your current location</span>
      </div>
    </div>
  );
};

export default LocationInput;

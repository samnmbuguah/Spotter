import React, { useState, useRef, useEffect } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';
import { cn } from '../../utils';

// Type declarations for Google Maps
declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
    googleMapsLoaded: boolean;
  }
}

interface LocationSuggestion {
  placePrediction: {
    placeId: string;
    text: {
      text: string;
    };
  };
}

interface LocationSearchProps {
  onSelect: (location: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  value?: string;
  onClear?: () => void;
  autoFocus?: boolean;
}

// Global state for Google Maps loading
let isGoogleMapsLoading = false;
let googleMapsLoaded = false;
const googleMapsCallbacks: (() => void)[] = [];

const loadGoogleMaps = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    if (googleMapsLoaded && window.google?.maps?.places) {
      resolve();
      return;
    }

    // If currently loading, add callback to queue
    if (isGoogleMapsLoading) {
      googleMapsCallbacks.push(() => resolve());
      return;
    }

    // Start loading
    isGoogleMapsLoading = true;

    // Check if script already exists
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      // Script exists, but might not be loaded yet
      if (window.google?.maps?.places) {
        googleMapsLoaded = true;
        isGoogleMapsLoading = false;
        resolve();
      } else {
        // Script exists but not loaded, wait for it
        googleMapsCallbacks.push(() => resolve());
      }
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      googleMapsLoaded = true;
      isGoogleMapsLoading = false;

      // Execute all queued callbacks
      googleMapsCallbacks.forEach(callback => callback());
      googleMapsCallbacks.length = 0;

      resolve();
    };

    script.onerror = () => {
      isGoogleMapsLoading = false;
      reject(new Error('Failed to load Google Maps'));
    };

    document.head.appendChild(script);
  });
};

const LocationSearch: React.FC<LocationSearchProps> = ({
  onSelect,
  placeholder = 'Search for a location...',
  label = 'Location',
  className = '',
  value = '',
  onClear,
  autoFocus = false,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMapsLoading, setIsMapsLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionToken = useRef<any>(null);

  useEffect(() => {
    loadGoogleMaps().then(() => setIsMapsLoading(false));
  }, []);

  const fetchSuggestions = async (input: string) => {
    if (!input || input.length < 2 || !window.google?.maps?.places) return;

    setIsLoading(true);

    try {
      // Create a new session token for this request
      if (!sessionToken.current) {
        sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
      }

      const request = {
        input,
        sessionToken: sessionToken.current,
        locationBias: {
          // Bias towards US locations
          west: -125.0,
          north: 49.0,
          east: -67.0,
          south: 25.0,
        },
      };

      const { suggestions } = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      setSuggestions(suggestions);
      setShowDropdown(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: LocationSuggestion) => {
    try {
      setIsLoading(true);

      // Get place details using Place Details API
      const placeService = new window.google.maps.places.PlacesService(document.createElement('div'));
      const request = {
        placeId: suggestion.placePrediction.placeId,
        fields: ['formatted_address', 'geometry'],
      };

      placeService.getDetails(request, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          setInputValue(suggestion.placePrediction.text.text);
          setShowDropdown(false);

          if (place.formatted_address && place.geometry?.location) {
            onSelect({
              address: place.formatted_address,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          }
        }
      });

      // Create a new session token for the next request
      sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
    } catch (error) {
      console.error('Error getting place details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.length > 2) {
      fetchSuggestions(value);
    } else {
      setSuggestions([]);
    }
  };

  const handleClear = () => {
    setInputValue('');
    setSuggestions([]);
    onClear?.();
    inputRef.current?.focus();
  };

  const handleBlur = () => {
    // Use setTimeout to allow click events to fire on dropdown items
    setTimeout(() => {
      setShowDropdown(false);
    }, 200);
  };

  return (
    <div className={cn('relative w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        <div className="relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MapPin className="h-5 w-5 text-gray-400" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setShowDropdown(true)}
            onBlur={handleBlur}
            placeholder={isMapsLoading ? 'Loading maps...' : placeholder}
            autoComplete="off"
            autoFocus={autoFocus}
            disabled={isMapsLoading}
            className={`block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white ${
              isMapsLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />

          {(isLoading || inputValue) && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dropdown with suggestions */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm max-h-60 overflow-auto">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.placePrediction.placeId}
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onMouseDown={(e) => {
                  // Use onMouseDown instead of onClick to prevent input blur from firing first
                  e.preventDefault();
                  handleSelectSuggestion(suggestion);
                }}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {suggestion.placePrediction.text.text}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Click to get coordinates
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationSearch;

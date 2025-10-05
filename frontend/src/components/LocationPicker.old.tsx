import React, { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MapPin, Crosshair, Loader2 } from 'lucide-react';
import { loadGoogleMaps } from '../services/googleMaps';

interface LocationPickerProps {
  onLocationSelect: (location: {
    address: string;
    lat: number;
    lng: number;
    placeId?: string;
  }) => void;
  initialLocation?: {
    address: string;
    lat: number;
    lng: number;
  } | null;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
}

const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationSelect,
  initialLocation = null,
  placeholder = 'Search for a location or click on the map',
  className = '',
  label = 'Location',
  required = false,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialLocation?.address || '');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(
    initialLocation ? { lat: initialLocation.lat, lng: initialLocation.lng } : null
  );
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  // Initialize Google Maps and services
  useEffect(() => {
    const initGoogleMaps = async () => {
      try {
        setIsLoading(true);
        await loadGoogleMaps();
        
        // Initialize autocomplete service
        const autocomplete = new window.google.maps.places.AutocompleteService();
        autocompleteServiceRef.current = autocomplete;
        setAutocompleteService(autocomplete);
        
        // Initialize places service
        if (mapRef.current) {
          const mapInstance = new window.google.maps.Map(mapRef.current, {
            center: currentLocation || { lat: 0, lng: 0 },
            zoom: currentLocation ? 12 : 2,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            clickableIcons: false,
          });
          
          // Add click listener to the map
          mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              updateMarker(e.latLng.lat(), e.latLng.lng());
            }
          });
          
          setMap(mapInstance);
          
          // Initialize places service
          placesServiceRef.current = new window.google.maps.places.PlacesService(mapInstance);
          
          // Set initial marker if location is provided
          if (currentLocation) {
            const newMarker = new window.google.maps.Marker({
              position: currentLocation,
              map: mapInstance,
              draggable: true,
            });
            
            // Update location when marker is dragged
            newMarker.addListener('dragend', () => {
              const position = newMarker.getPosition();
              if (position) {
                updateMarker(position.lat(), position.lng());
              }
            });
            
            setMarker(newMarker);
            mapInstance.panTo(currentLocation);
          }
        }
      } catch (error) {
        console.error('Error initializing Google Maps:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (showMap) {
      initGoogleMaps();
    }
    
    return () => {
      // Cleanup
      if (marker) {
        marker.setMap(null);
      }
    };
  }, [showMap]);

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length > 2 && autocompleteServiceRef.current) {
      autocompleteServiceRef.current.getPlacePredictions(
        { input: query, types: ['geocode', 'establishment'] },
        (predictions, status) => {
          if (status === 'OK' && predictions) {
            setSuggestions(predictions);
          } else {
            setSuggestions([]);
          }
        }
      );
    } else {
      setSuggestions([]);
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: google.maps.places.AutocompletePrediction) => {
    setSearchQuery(suggestion.description);
    setSuggestions([]);
    
    if (placesServiceRef.current) {
      const request = {
        placeId: suggestion.place_id,
        fields: ['geometry', 'formatted_address', 'name']
      };
      
      placesServiceRef.current?.getDetails(
        {
          placeId: suggestion.place_id,
          fields: ['geometry', 'formatted_address', 'name']
        },
        (placeResult, status) => {
          if (status === 'OK' && placeResult?.geometry?.location) {
            const location = {
              lat: placeResult.geometry.location.lat(),
              lng: placeResult.geometry.location.lng(),
              address: placeResult.formatted_address || suggestion.description,
              placeId: suggestion.place_id,
            };
          
          updateMarker(location.lat, location.lng);
          onLocationSelect(location);
          
          if (map) {
            map.panTo({ lat: location.lat, lng: location.lng });
            map.setZoom(15);
          }
        }
      });
    }
  };

  // Update marker position and get address
  const updateMarker = (lat: number, lng: number) => {
    const location = { lat, lng };
    setCurrentLocation(location);
    
    if (marker) {
      marker.setPosition(location);
    } else if (map) {
      const newMarker = new window.google.maps.Marker({
        position: location,
        map,
        draggable: true,
      });
      
      newMarker.addListener('dragend', () => {
        const position = newMarker.getPosition();
        if (position) {
          updateMarker(position.lat(), position.lng());
        }
      });
      
      setMarker(newMarker);
    }
    
    // Get address from coordinates
    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const address = results[0].formatted_address;
          setSearchQuery(address);
          onLocationSelect({
            address,
            lat,
            lng,
            placeId: results[0].place_id,
          });
        }
      });
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          updateMarker(latitude, longitude);
          
          if (map) {
            map.panTo({ lat: latitude, lng: longitude });
            map.setZoom(15);
          }
          
          setIsLoading(false);
        },
        (error) => {
          console.error('Error getting current location:', error);
          alert('Unable to retrieve your location. Please make sure location services are enabled.');
          setIsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  // Toggle map visibility
  const toggleMap = () => {
    setShowMap(!showMap);
    if (!showMap && inputRef.current) {
      inputRef.current.blur();
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
      
      <div className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={placeholder}
            className="block w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
            onFocus={() => setShowMap(true)}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
            <button
              type="button"
              onClick={getCurrentLocation}
              className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
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
              className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
              title={showMap ? 'Hide map' : 'Show on map'}
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
                onClick={() => handleSelectSuggestion(suggestion)}
              >
                {suggestion.description}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Map container */}
      {showMap && (
        <div className="mt-2 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden">
          <div ref={mapRef} className="w-full h-64">
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

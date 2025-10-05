import { useState, useCallback, useEffect } from 'react';
import { loadGoogleMaps } from '../../services/googleMaps';

type Suggestion = google.maps.places.AutocompletePrediction;
type PlaceResult = google.maps.places.PlaceResult;

export const useLocationSearch = (inputRef: React.RefObject<HTMLInputElement>) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

  // Initialize services
  useEffect(() => {
    const initServices = async () => {
      try {
        await loadGoogleMaps();
        
        if (!window.google?.maps?.places) {
          throw new Error('Google Maps Places library not loaded');
        }

        setAutocompleteService(new window.google.maps.places.AutocompleteService());
        
        // Create a dummy map for PlacesService
        const dummyMap = new window.google.maps.Map(
          document.createElement('div')
        );
        setPlacesService(new window.google.maps.places.PlacesService(dummyMap));
      } catch (err) {
        console.error('Failed to initialize location search:', err);
        setError('Failed to initialize location search. Please try again later.');
      }
    };

    initServices();
  }, []);

  // Get place predictions based on input
  const getPlacePredictions = useCallback(async (input: string) => {
    if (!autocompleteService || input.length < 2) {
      setSuggestions([]);
      return [];
    }

    try {
      setIsLoading(true);
      setError(null);
      
      return new Promise<Suggestion[]>((resolve) => {
        autocompleteService.getPlacePredictions(
          { 
            input,
            types: ['geocode', 'establishment'],
            componentRestrictions: { country: 'us' } // Optional: restrict to US
          },
          (predictions, status) => {
            if (status === 'OK' && predictions) {
              setSuggestions(predictions);
              resolve(predictions);
            } else {
              setSuggestions([]);
              resolve([]);
            }
            setIsLoading(false);
          }
        );
      });
    } catch (err) {
      console.error('Error getting place predictions:', err);
      setError('Failed to get location suggestions');
      setIsLoading(false);
      return [];
    }
  }, [autocompleteService]);

  // Get place details by place ID
  const getPlaceDetails = useCallback(async (placeId: string): Promise<PlaceResult | null> => {
    if (!placesService) return null;

    return new Promise((resolve) => {
      placesService.getDetails(
        {
          placeId,
          fields: ['geometry', 'formatted_address', 'name', 'place_id'],
        },
        (place, status) => {
          if (status === 'OK' && place) {
            resolve(place);
          } else {
            console.error('Error getting place details:', status);
            resolve(null);
          }
        }
      );
    });
  }, [placesService]);

  // Handle input change with debounce
  const handleInputChange = useCallback(
    async (input: string) => {
      await getPlacePredictions(input);
    },
    [getPlacePredictions]
  );

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    getPlacePredictions,
    getPlaceDetails,
    handleInputChange,
    clearSuggestions,
  };
};

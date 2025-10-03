// Google Maps Loader Utility
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

declare global {
  interface Window {
    google: typeof google;
    initMap: () => void;
  }
}

let googleMaps: typeof google.maps | null = null;
let mapsApiLoaded = false;

const loadGoogleMapsScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (mapsApiLoaded) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&callback=initMap`;
    script.async = true;
    script.defer = true;
    
    window.initMap = () => {
      mapsApiLoaded = true;
      resolve();
    };

    script.onerror = (error) => {
      reject(new Error('Failed to load Google Maps API'));
    };

    document.head.appendChild(script);
  });
};

export const loadGoogleMaps = async (): Promise<typeof google.maps> => {
  if (googleMaps) {
    return googleMaps;
  }

  try {
    await loadGoogleMapsScript();
    googleMaps = window.google?.maps || null;
    
    if (!googleMaps) {
      throw new Error('Google Maps not available');
    }
    
    return googleMaps;
  } catch (error) {
    console.error('Error loading Google Maps:', error);
    throw new Error('Failed to load Google Maps API');
  }
};

export const getGoogleMaps = (): typeof google.maps | null => {
  return googleMaps || window.google?.maps || null;
};

export default loadGoogleMaps;

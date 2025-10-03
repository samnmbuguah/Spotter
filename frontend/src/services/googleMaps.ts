// Google Maps Loader Utility
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

let googleMaps: any = null;
let mapsApiLoaded = false;

const loadGoogleMapsScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (mapsApiLoaded) {
      resolve();
      return;
    }

    // Skip loading if no API key is provided (build-time safety)
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      console.warn('Google Maps API key not configured. Maps functionality will not work.');
      mapsApiLoaded = true;
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
      console.warn('Failed to load Google Maps API, continuing without maps functionality');
      mapsApiLoaded = true;
      resolve(); // Don't reject, just continue without maps
    };

    document.head.appendChild(script);
  });
};

export const loadGoogleMaps = async (): Promise<any> => {
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

export const getGoogleMaps = (): any => {
  return googleMaps || window.google?.maps || null;
};

export default loadGoogleMaps;

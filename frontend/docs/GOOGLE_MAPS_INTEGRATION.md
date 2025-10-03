# Google Maps Integration Guide for Spotter HOS Application

This guide explains how to set up and use the Google Maps integration in the Spotter HOS application.

## Prerequisites

1. **Google Cloud Account**
   - Create a Google Cloud account at [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Required APIs**
   - Google Maps JavaScript API
   - Geocoding API
   - Places API
   - Directions API (optional, for future route planning)

## Setup Instructions

### 1. Get a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" and select "API key"
5. Copy the generated API key

### 2. Configure Environment Variables

1. Copy the `.env.example` file to `.env` in the frontend directory:
   ```bash
   cp .env.example .env
   ```
2. Open the `.env` file and replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` with your actual API key
3. Save the file

### 3. Install Dependencies

Make sure you have the required dependencies installed:

```bash
npm install @googlemaps/js-api-loader @types/google.maps
```

## Components

### 1. LocationInput

A simple input field with geolocation detection that works without loading the full Google Maps library.

**Props:**
- `onLocationSelect`: Callback function that receives the selected location
- `initialValue`: Initial address value (optional)
- `placeholder`: Input placeholder text (optional)
- `label`: Input label (optional)
- `required`: Whether the field is required (optional, default: false)
- `autoDetect`: Whether to automatically detect location on mount (optional, default: true)

**Usage:**
```tsx
import LocationInput from './components/LocationInput';

const MyComponent = () => {
  const handleLocationSelect = (location) => {
    console.log('Selected location:', location);
  };

  return (
    <LocationInput 
      onLocationSelect={handleLocationSelect}
      placeholder="Enter a location"
      label="Pickup Location"
      required
    />
  );
};
```

### 2. LocationPicker (Advanced)

A more advanced component with an interactive map for selecting locations.

**Props:**
- `onLocationSelect`: Callback function that receives the selected location
- `initialLocation`: Initial location object with address, lat, lng (optional)
- `placeholder`: Input placeholder text (optional)
- `className`: Additional CSS classes (optional)
- `label`: Input label (optional)
- `required`: Whether the field is required (optional, default: false)

**Usage:**
```tsx
import LocationPicker from './components/LocationPicker';

const MyComponent = () => {
  const handleLocationSelect = (location) => {
    console.log('Selected location:', location);
  };

  return (
    <LocationPicker 
      onLocationSelect={handleLocationSelect}
      placeholder="Search for a location or click on the map"
      label="Destination"
    />
  );
};
```

## Best Practices

1. **API Key Security**
   - Never expose your API key in client-side code
   - Restrict your API key to specific domains in the Google Cloud Console
   - Consider using a backend service to make API calls with the key

2. **Error Handling**
   - Always handle errors when working with the Geolocation API
   - Provide fallback UI when location services are unavailable

3. **Performance**
   - Use the `LocationInput` component when you don't need the interactive map
   - The `LocationPicker` component loads the full Google Maps library, so use it sparingly

## Troubleshooting

1. **API Key Not Working**
   - Make sure the required APIs are enabled in the Google Cloud Console
   - Check that your API key is properly restricted
   - Verify that your domain is allowed in the API key restrictions

2. **Map Not Loading**
   - Check the browser console for any JavaScript errors
   - Verify that your API key has the correct permissions
   - Make sure you're using HTTPS in production (required by most browsers for geolocation)

3. **Geolocation Not Working**
   - Ensure the user has granted location permissions
   - Check that the device supports geolocation
   - Provide a fallback for when geolocation is not available

## License

This integration requires a valid Google Maps API key, which is subject to Google's terms of service and pricing. Make sure to review the [Google Maps Platform Terms of Service](https://cloud.google.com/maps-platform/terms/) and [Pricing](https://cloud.google.com/maps-platform/pricing/) before deploying to production.

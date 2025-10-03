# Interactive Map Component

A reusable, interactive map component built with React and Google Maps JavaScript API that allows users to set origin, pickup, and destination points with route calculation.

## Features

- **Interactive Point Selection**: Click on the map to set origin, pickup, and destination points
- **Visual Feedback**: Color-coded points for different location types
- **Route Calculation**: Automatic route calculation between points
- **Responsive Design**: Works on all screen sizes
- **Dark Mode Support**: Automatically adapts to the application's theme
- **Current Location**: One-click access to the user's current location

## Installation

1. Install the required dependencies:

```bash
npm install @googlemaps/js-api-loader lucide-react
```

2. Add your Google Maps API key to your `.env.local` file:

```env
REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Usage

```tsx
import React, { useState } from 'react';
import InteractiveMap from './InteractiveMap';

const MapContainer = () => {
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [directions, setDirections] = useState(null);

  return (
    <div style={{ height: '80vh', width: '100%' }}>
      <InteractiveMap
        apiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
        onPointSelect={setSelectedPoint}
        onDirectionsChange={setDirections}
        className="w-full h-full"
      />
    </div>
  );
};

export default MapContainer;
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `apiKey` | string | Yes | Google Maps API key |
| `onPointSelect` | (point: MapPoint \| null) => void | No | Callback when a point is selected |
| `onDirectionsChange` | (directions: DirectionsResult \| null) => void | No | Callback when directions are calculated |
| `className` | string | No | Additional CSS classes for the map container |

## Types

### MapPoint

```typescript
interface MapPoint {
  lat: number;
  lng: number;
  address?: string;
  type: 'origin' | 'pickup' | 'destination';
  id: string;
  timestamp: number;
}
```

## Styling

The component uses Tailwind CSS for styling. You can customize the appearance by:

1. Overriding the default styles using the `className` prop
2. Using the `theme` context to support dark/light mode
3. Modifying the color variables in the component

## Local Development

1. Start the development server:

```bash
npm start
```

2. The map component will be available at `http://localhost:3000/map-demo`

## Dependencies

- `@googlemaps/js-api-loader`: For loading the Google Maps JavaScript API
- `lucide-react`: For icons
- `react`: ^17.0.0 || ^18.0.0

## License

MIT

import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import InteractiveMap from '../components/InteractiveMap/InteractiveMap';
import LocationInfo from '../components/InteractiveMap/LocationInfo';
import { MapPoint } from '../hooks/maps/useMapState';

const MapDemo: React.FC = () => {
  const { theme } = useTheme();
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  // Get the Google Maps API key from environment variables
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Google Maps API Key Missing
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Please add your Google Maps API key to the <code>.env.local</code> file:
          </p>
          <pre className="bg-gray-800 text-green-400 p-4 rounded-md overflow-x-auto text-sm">
            REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key_here
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
          Interactive Map Demo
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              Route Planner
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click on the map to set origin, pickup, and destination points
            </p>
          </div>
          
          <div className="relative" style={{ height: '70vh' }}>
            <InteractiveMap
              apiKey={apiKey}
              onPointSelect={setSelectedPoint}
              onDirectionsChange={setDirections}
              className="w-full h-full"
            />
            
            {selectedPoint && (
              <LocationInfo
                point={selectedPoint}
                onClose={() => setSelectedPoint(null)}
                onRemove={(id) => {
                  // Handle point removal
                  setSelectedPoint(null);
                }}
              />
            )}
          </div>
          
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Route Information</h3>
                {directions ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Distance: {directions.routes[0].legs[0].distance?.text || 'N/A'}, 
                    Duration: {directions.routes[0].legs[0].duration?.text || 'N/A'}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Add at least two points to see route information
                  </p>
                )}
              </div>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Save Route
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              How to Use
            </h3>
            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 text-green-800 text-sm font-medium mr-3">1</span>
                <span>Click on the map to set points (origin, pickup, destination)</span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mr-3">2</span>
                <span>Click on a point to view details or remove it</span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-purple-100 text-purple-800 text-sm font-medium mr-3">3</span>
                <span>View the calculated route and distance information</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Features
            </h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                Interactive map with click-to-add points
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                Real-time route calculation
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
                Responsive design for all screen sizes
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
                Dark mode support
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                Current location detection
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MapDemo;

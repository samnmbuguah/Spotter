import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ui/use-toast';
import { tripService } from '../services/api';
import { Route } from 'lucide-react';
import TripMap from '../components/TripMap';
import LocationSearch from '../components/LocationSearch/LocationSearch';

interface FormData {
  name: string;
  current_cycle: string;
}

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

interface SelectedLocations {
  origin?: LocationData;
  destination?: LocationData;
  pickup?: LocationData;
}

const TripPlanner: React.FC = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    current_cycle: '70_8',
  });
  const [selectedLocations, setSelectedLocations] = useState<SelectedLocations>({});

  const updateSelectedLocations = useCallback((
    location: LocationData,
    type: 'origin' | 'destination' | 'pickup'
  ) => {
    setSelectedLocations(prev => {
      if (type === 'origin') {
        return { ...prev, origin: location };
      } else if (type === 'destination') {
        return { ...prev, destination: location };
      } else {
        return { ...prev, pickup: location };
      }
    });
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newValue = name.includes('_id') ? parseInt(value) : value;

    setFormData(prev => ({
      ...prev,
      [name]: newValue,
    }));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Trip Planner</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">Plan your trips with HOS compliance in mind.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Trip Form - Now appears first */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Create New Trip</h2>

          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedLocations.origin || !selectedLocations.pickup || !selectedLocations.destination) {
              addToast({
                title: 'Missing required fields',
                description: 'Please fill in all required location fields',
                variant: 'destructive',
              });
              return;
            }

            setLoading(true);
            try {
              // Send location data instead of IDs - backend will create Location records
              // We don't need the trip data right now, so we'll just await the promise
              await tripService.createTrip({
                name: formData.name,
                current_location_data: selectedLocations.origin ? {
                  address: selectedLocations.origin.address,
                  lat: selectedLocations.origin.lat,
                  lng: selectedLocations.origin.lng,
                } : null,
                pickup_location_data: selectedLocations.pickup ? {
                  address: selectedLocations.pickup.address,
                  lat: selectedLocations.pickup.lat,
                  lng: selectedLocations.pickup.lng,
                } : null,
                dropoff_location_data: selectedLocations.destination ? {
                  address: selectedLocations.destination.address,
                  lat: selectedLocations.destination.lat,
                  lng: selectedLocations.destination.lng,
                } : null,
                current_cycle: formData.current_cycle,
                route_stop_ids: [],
              });

              // Reset form
              setFormData({
                name: '',
                current_cycle: '70_8',
              });
              setSelectedLocations({});

              addToast({
                title: 'Trip created successfully!',
                description: 'Your trip has been planned successfully.',
              });

              // Navigate to dashboard for trip execution
              navigate('/');

            } catch (error) {
              console.error('Error creating trip:', error);
              addToast({
                title: 'Error',
                description: 'Failed to create trip. Please try again.',
                variant: 'destructive',
              });
            } finally {
              setLoading(false);
            }
          }} className="space-y-6">
            {/* Trip Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Trip Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., NYC to Chicago Delivery"
              />
            </div>

            {/* Current Location */}
            <div>
              <label htmlFor="current_location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Current Location
              </label>
              <LocationSearch
                onSelect={(location) => {
                  updateSelectedLocations(location, 'origin');
                }}
                placeholder="Enter current location"
                value={selectedLocations.origin?.address || ''}
                onClear={() => setSelectedLocations(prev => ({ ...prev, origin: undefined }))}
                className="mt-1"
              />
            </div>

            {/* Pickup Location */}
            <div>
              <label htmlFor="pickup_location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Pickup Location
              </label>
              <LocationSearch
                onSelect={(location) => {
                  updateSelectedLocations(location, 'pickup');
                }}
                placeholder="Enter pickup location"
                value={selectedLocations.pickup?.address || ''}
                onClear={() => setSelectedLocations(prev => ({ ...prev, pickup: undefined }))}
                className="mt-1"
              />
            </div>

            {/* Dropoff Location */}
            <div>
              <label htmlFor="dropoff_location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Drop-off Location
              </label>
              <LocationSearch
                onSelect={(location) => {
                  updateSelectedLocations(location, 'destination');
                }}
                placeholder="Enter drop-off location"
                value={selectedLocations.destination?.address || ''}
                onClear={() => setSelectedLocations(prev => ({ ...prev, destination: undefined }))}
                className="mt-1"
              />
            </div>

            {/* Cycle Selection */}
            <div>
              <label htmlFor="current_cycle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                HOS Cycle
              </label>
              <select
                id="current_cycle"
                name="current_cycle"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={formData.current_cycle}
                onChange={handleChange}
              >
                <option value="70_8">70 hours / 8 days</option>
                <option value="60_7">60 hours / 7 days</option>
              </select>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading || !selectedLocations.origin || !selectedLocations.pickup || !selectedLocations.destination}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating Trip...' : 'Create Trip'}
              </button>
            </div>
          </form>
        </div>

        {/* Map - Now appears second */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Route className="h-5 w-5 mr-2 text-primary-600 dark:text-primary-400" />
            Trip Route
          </h2>
          <div className="h-96 w-full rounded-md overflow-hidden">
            <TripMap 
              origin={selectedLocations.origin || null}
              destination={selectedLocations.destination || null}
              waypoints={[]}
              height="100%"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripPlanner;

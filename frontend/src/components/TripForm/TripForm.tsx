import React, { useState, useEffect } from 'react';
import { MapPin, Plus, X, Loader2, Route, Map, Clock, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '../ui/use-toast';
import { format } from 'date-fns';
import { DatePicker } from '../ui/date-picker';
import { TimePicker } from '../ui/time-picker';
import LocationSearch from '../LocationSearch/LocationSearch';
import { useTheme } from '../../contexts/ThemeContext';

interface Location {
  address: string;
  lat: number;
  lng: number;
}

interface TripFormProps {
  onSubmit: (tripData: {
    name: string;
    origin: Location;
    destination: Location;
    waypoints: Location[];
    departureDate: Date;
    departureTime: string;
  }) => Promise<void>;
  loading?: boolean;
  initialData?: any;
}

const TripForm: React.FC<TripFormProps> = ({ onSubmit, loading = false, initialData }) => {
  const { theme } = useTheme();
  const { toast } = useToast();
  
  // Form state
  const [step, setStep] = useState(1);
  const [tripName, setTripName] = useState(initialData?.name || '');
  const [origin, setOrigin] = useState<Location | null>(initialData?.origin || null);
  const [destination, setDestination] = useState<Location | null>(initialData?.destination || null);
  const [waypoints, setWaypoints] = useState<Location[]>(initialData?.waypoints || []);
  const [departureDate, setDepartureDate] = useState<Date>(initialData?.departureDate || new Date());
  const [departureTime, setDepartureTime] = useState<string>(
    initialData?.departureTime || format(new Date(), 'HH:mm')
  );
  const [newWaypoint, setNewWaypoint] = useState<Location | null>(null);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!origin || !destination) {
      toast({
        title: 'Missing required fields',
        description: 'Please select both origin and destination',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onSubmit({
        name: tripName || `Trip ${format(new Date(), 'MMM d, yyyy')}`,
        origin,
        destination,
        waypoints,
        departureDate,
        departureTime,
      });
    } catch (error) {
      console.error('Error submitting trip:', error);
      toast({
        title: 'Error',
        description: 'Failed to create trip. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Add a new waypoint
  const addWaypoint = () => {
    if (newWaypoint) {
      setWaypoints([...waypoints, newWaypoint]);
      setNewWaypoint(null);
    }
  };

  // Remove a waypoint
  const removeWaypoint = (index: number) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  // Go to next step
  const nextStep = () => {
    if (step === 1 && (!origin || !destination)) {
      toast({
        title: 'Missing locations',
        description: 'Please select both origin and destination',
        variant: 'destructive',
      });
      return;
    }
    setStep(step + 1);
  };

  // Go to previous step
  const prevStep = () => {
    setStep(step - 1);
  };

  // Render step 1: Trip details
  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Trip Details</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Provide basic information about your trip
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="tripName">Trip Name</Label>
          <Input
            id="tripName"
            placeholder="e.g., Summer Road Trip"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Departure Date</Label>
            <DatePicker
              date={departureDate}
              onSelect={setDepartureDate}
              className="mt-1 w-full"
            />
          </div>
          <div>
            <Label>Departure Time</Label>
            <TimePicker
              value={departureTime}
              onChange={setDepartureTime}
              className="mt-1 w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Render step 2: Locations
  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Trip Route</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Set your starting point, destination, and any stops along the way
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label>Starting Point</Label>
          <LocationSearch
            onSelect={(location) => setOrigin(location)}
            placeholder="Enter starting location"
            value={origin?.address || ''}
            onClear={() => setOrigin(null)}
            className="mt-1"
            autoFocus
          />
        </div>
        
        <div>
          <Label>Destination</Label>
          <LocationSearch
            onSelect={(location) => setDestination(location)}
            placeholder="Enter destination"
            value={destination?.address || ''}
            onClear={() => setDestination(null)}
            className="mt-1"
          />
        </div>
        
        <div>
          <div className="flex justify-between items-center">
            <Label>Add Stops (Optional)</Label>
            <span className="text-sm text-gray-500">
              {waypoints.length} {waypoints.length === 1 ? 'stop' : 'stops'}
            </span>
          </div>
          
          <div className="flex space-x-2 mt-1">
            <div className="flex-1">
              <LocationSearch
                onSelect={setNewWaypoint}
                placeholder="Add a stop"
                value={newWaypoint?.address || ''}
                onClear={() => setNewWaypoint(null)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={addWaypoint}
              disabled={!newWaypoint}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {waypoints.length > 0 && (
            <div className="mt-2 space-y-1">
              {waypoints.map((waypoint, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md text-sm"
                >
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="truncate">{waypoint.address}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeWaypoint(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render step 3: Review and confirm
  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Review Your Trip</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Please review your trip details before confirming
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white">
            {tripName || 'Unnamed Trip'}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {format(new Date(departureDate), 'MMMM d, yyyy')} at {departureTime}
          </p>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-start">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">From</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {origin?.address || 'Not specified'}
              </p>
            </div>
          </div>
          
          {waypoints.map((waypoint, index) => (
            <div key={index} className="flex items-start">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Stop {index + 1}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {waypoint.address}
                </p>
              </div>
            </div>
          ))}
          
          <div className="flex items-start">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">To</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {destination?.address || 'Not specified'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render step indicators
  const renderStepIndicators = () => (
    <div className="flex items-center justify-between mb-8">
      {[1, 2, 3].map((stepNumber) => (
        <React.Fragment key={stepNumber}>
          <div className="flex flex-col items-center">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center ${
                step === stepNumber
                  ? 'bg-indigo-600 text-white'
                  : step > stepNumber
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
              }`}
            >
              {step > stepNumber ? (
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                stepNumber
              )}
            </div>
            <span
              className={`mt-2 text-xs font-medium ${
                step === stepNumber
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {stepNumber === 1 ? 'Details' : stepNumber === 2 ? 'Route' : 'Review'}
            </span>
          </div>
          
          {stepNumber < 3 && (
            <div className="flex-1 mx-2">
              <div className="h-0.5 bg-gray-200 dark:bg-gray-700"></div>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // Render the current step
  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Plan a New Trip</CardTitle>
        <CardDescription>
          Fill in the details below to create a new trip
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit}>
          {renderStepIndicators()}
          
          <div className="space-y-6">
            {renderCurrentStep()}
            
            <div className="flex justify-between pt-4 border-t dark:border-gray-800">
              <div>
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={loading}
                  >
                    Back
                  </Button>
                )}
              </div>
              
              <div className="flex space-x-2">
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={loading || (step === 2 && (!origin || !destination))}
                  >
                    Next
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Trip'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default TripForm;

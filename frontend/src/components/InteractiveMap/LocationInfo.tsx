import React from 'react';
import { X, MapPin, Clock, Navigation, Compass } from 'lucide-react';
import { Button } from '../ui/button';
import { MapPoint } from '../../hooks/maps/useMapState';
import { cn } from '../../lib/utils';

const POINT_LABELS = {
  origin: 'Origin',
  pickup: 'Pickup',
  destination: 'Destination',
};

const POINT_ICONS = {
  origin: <MapPin className="h-4 w-4 text-green-500" />,
  pickup: <Navigation className="h-4 w-4 text-blue-500" />,
  destination: <Compass className="h-4 w-4 text-red-500" />,
};

interface LocationInfoProps {
  point: MapPoint | null;
  onClose: () => void;
  onRemove: (id: string) => void;
  className?: string;
}

const LocationInfo: React.FC<LocationInfoProps> = ({
  point,
  onClose,
  onRemove,
  className = '',
}) => {
  if (!point) return null;

  return (
    <div
      className={cn(
        'absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-64',
        className
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          {POINT_ICONS[point.type]}
          <h3 className="font-medium text-gray-900 dark:text-white">
            {POINT_LABELS[point.type]}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
        {point.address ? (
          <p className="flex items-start">
            <MapPin className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            <span>{point.address}</span>
          </p>
        ) : (
          <p className="text-gray-400 italic">No address available</p>
        )}

        <p className="flex items-center">
          <Clock className="h-4 w-4 mr-2" />
          <span>
            {new Date(point.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </p>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
        </p>
      </div>

      <div className="mt-4 flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRemove(point.id)}
          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          Remove
        </Button>
        <Button size="sm" className="ml-2">
          Save Location
        </Button>
      </div>
    </div>
  );
};

export default LocationInfo;

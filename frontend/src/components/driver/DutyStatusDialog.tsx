import React, { useState, useEffect } from 'react';
import { DutyStatus, DutyStatusFormData, LocationData } from './types';
import LocationInput from '../LocationInput';

interface DutyStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: DutyStatusFormData) => Promise<void>;
  status: DutyStatus;
  loading: boolean;
  currentLocation?: { lat: number; lng: number };
}

export const DutyStatusDialog: React.FC<DutyStatusDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  status,
  loading,
  currentLocation,
}) => {
  const [formData, setFormData] = useState<DutyStatusFormData>({
    location: null,
    notes: '',
    vehicleInfo: '',
    trailerInfo: '',
    odometerStart: '',
    odometerEnd: '',
  });

  useEffect(() => {
    if (currentLocation) {
      setFormData(prev => ({
        ...prev,
        location: {
          address: `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`,
          lat: currentLocation.lat,
          lng: currentLocation.lng
        }
      }));
    }
  }, [currentLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleLocationSelect = (location: { address: string; lat: number; lng: number }) => {
    setFormData(prev => ({
      ...prev,
      location: location
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Confirm {status.replace(/_/g, ' ')}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <LocationInput
              onLocationSelect={handleLocationSelect}
              initialValue={formData.location?.address || ''}
              placeholder="Search for location or use current location"
              label="Location"
              required
              showCoordinates={true}
              disableForm={true}
            />
          </div>

          {status === 'driving' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Vehicle Info
                </label>
                <input
                  type="text"
                  name="vehicleInfo"
                  value={formData.vehicleInfo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
                  required={status === 'driving'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Odometer Start
                </label>
                <input
                  type="number"
                  name="odometerStart"
                  value={formData.odometerStart}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
                  required={status === 'driving'}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-md"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

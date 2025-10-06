import React, { useState, useEffect } from 'react';
import { DutyStatus, DutyStatusFormData, LocationData } from './types';
import LocationInput from '../LocationInput';

interface DutyStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: DutyStatusFormData, existingEntryId?: number) => Promise<void>;
  status: DutyStatus;
  loading: boolean;
  currentLocation?: { lat: number; lng: number };
  existingEntryId?: number; // Add this to handle editing existing entries
}

export const DutyStatusDialog: React.FC<DutyStatusDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  status,
  loading,
  currentLocation,
  existingEntryId,
}) => {
  const [formData, setFormData] = useState<DutyStatusFormData>({
    location: null,
    notes: '',
    vehicleInfo: '',
    trailerInfo: '',
    odometerStart: '',
    odometerEnd: '',
    isPickupDropoff: false,
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
    const entryId = existingEntryId; // Capture the value for the callback
    onSubmit(formData, entryId);
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

          {/* Vehicle and Trailer Info - Required for all status changes from off_duty */}
          {(status !== 'off_duty') && (
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
                  placeholder="Enter vehicle identification"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Trailer Info
                </label>
                <input
                  type="text"
                  name="trailerInfo"
                  value={formData.trailerInfo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
                  placeholder="Enter trailer identification"
                />
              </div>
            </>
          )}

          {/* Odometer fields based on status change */}
          {(status === 'driving') && (
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
                placeholder="Enter starting odometer reading"
                required={status === 'driving'}
              />
            </div>
          )}

          {(status === 'off_duty') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Odometer End
              </label>
              <input
                type="number"
                name="odometerEnd"
                value={formData.odometerEnd}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
                placeholder="Enter ending odometer reading"
              />
            </div>
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

          {/* Pickup/Dropoff checkbox for on_duty_not_driving status */}
          {status === 'on_duty_not_driving' && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPickupDropoff"
                name="isPickupDropoff"
                checked={formData.isPickupDropoff || false}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  isPickupDropoff: e.target.checked
                }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isPickupDropoff" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                This is a pickup or dropoff activity (1-hour timer will auto-switch back to driving)
              </label>
            </div>
          )}

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

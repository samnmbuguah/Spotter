import React, { useState } from 'react';
import { Calendar, User, Truck, MapPin, FileText } from 'lucide-react';
import LogSheetCanvas from './LogSheetCanvas';
import { LogSheetData } from '../../types';

interface LogSheetEditorProps {
  initialData?: Partial<LogSheetData>;
  onSave?: (data: LogSheetData) => void;
  onCancel?: () => void;
}

const LogSheetEditor: React.FC<LogSheetEditorProps> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [logSheetData, setLogSheetData] = useState<LogSheetData>({
    date: new Date().toISOString().split('T')[0],
    driver_name: '',
    truck_number: '',
    trailer_number: '',
    starting_location: '',
    grid: [],
    total_miles: 0,
    signatures: {},
    ...initialData,
  });

  const [activeTab, setActiveTab] = useState<'form' | 'canvas'>('form');

  const handleInputChange = (field: keyof LogSheetData, value: string | number) => {
    setLogSheetData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    if (onSave) {
      onSave(logSheetData);
    }
  };

  const isFormValid = () => {
    return logSheetData.driver_name.trim() !== '' &&
           logSheetData.date.trim() !== '';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Daily Log Sheet</h2>
        <p className="text-gray-600">Fill out the driver information and create your HOS log sheet.</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('form')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'form'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="inline h-4 w-4 mr-2" />
            Driver Information
          </button>
          <button
            onClick={() => setActiveTab('canvas')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'canvas'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="inline h-4 w-4 mr-2" />
            Log Sheet Canvas
          </button>
        </nav>
      </div>

      {/* Form Tab */}
      {activeTab === 'form' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={logSheetData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Driver Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={logSheetData.driver_name}
                  onChange={(e) => handleInputChange('driver_name', e.target.value)}
                  placeholder="Enter driver name"
                  className="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Starting Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={logSheetData.starting_location || ''}
                  onChange={(e) => handleInputChange('starting_location', e.target.value)}
                  placeholder="Enter starting location"
                  className="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Miles
              </label>
              <input
                type="number"
                value={logSheetData.total_miles || ''}
                onChange={(e) => handleInputChange('total_miles', parseInt(e.target.value) || 0)}
                placeholder="Enter total miles driven"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                min="0"
              />
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Vehicle Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Truck Number
              </label>
              <div className="relative">
                <Truck className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={logSheetData.truck_number || ''}
                  onChange={(e) => handleInputChange('truck_number', e.target.value)}
                  placeholder="Enter truck number"
                  className="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trailer Number
              </label>
              <input
                type="text"
                value={logSheetData.trailer_number || ''}
                onChange={(e) => handleInputChange('trailer_number', e.target.value)}
                placeholder="Enter trailer number"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Instructions</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Fill in all required fields marked with *</li>
                <li>• Click "Continue to Canvas" to draw your duty status</li>
                <li>• Use the colored buttons to select duty status</li>
                <li>• Click and drag on the grid to mark time periods</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Canvas Tab */}
      {activeTab === 'canvas' && (
        <div>
          <LogSheetCanvas
            logSheetData={logSheetData}
            onDataChange={setLogSheetData}
            width={800}
            height={600}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8 flex justify-between">
        <div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="flex space-x-3">
          {activeTab === 'form' && (
            <button
              onClick={() => setActiveTab('canvas')}
              disabled={!isFormValid()}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Canvas
            </button>
          )}

          {activeTab === 'canvas' && onSave && (
            <>
              <button
                onClick={() => setActiveTab('form')}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Back to Form
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Save Log Sheet
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogSheetEditor;

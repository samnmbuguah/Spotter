import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LocationInput from '../LocationInput';

// Mock navigator.geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
};

Object.defineProperty(navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

// Mock fetch for geocoding
global.fetch = jest.fn();

// Mock process.env for Google Maps API key
Object.defineProperty(process, 'env', {
  value: {
    REACT_APP_GOOGLE_MAPS_API_KEY: 'test-api-key',
  },
  writable: true,
});

describe('LocationInput', () => {
  const mockOnLocationSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  it('renders with default props', () => {
    render(<LocationInput onLocationSelect={mockOnLocationSelect} />);

    expect(screen.getByPlaceholderText('Search for a location or use current location')).toBeInTheDocument();
    expect(screen.getByText('Click the crosshair to use your current location')).toBeInTheDocument();
    expect(screen.getByTitle('Use current location')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('renders with custom label and placeholder', () => {
    render(
      <LocationInput
        onLocationSelect={mockOnLocationSelect}
        label="Pickup Location"
        placeholder="Enter pickup location"
      />
    );

    expect(screen.getByText('Pickup Location')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter pickup location')).toBeInTheDocument();
  });

  it('shows required indicator when required prop is true', () => {
    render(
      <LocationInput
        onLocationSelect={mockOnLocationSelect}
        label="Required Location"
        required={true}
      />
    );

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('auto-detects location on mount when autoDetect is true', () => {
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
      });
    });

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'New York, NY, USA',
          },
        ],
      }),
    });

    render(<LocationInput onLocationSelect={mockOnLocationSelect} />);

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      })
    );
  });

  it('handles successful geolocation', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
      });
    });

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'New York, NY, USA',
          },
        ],
      }),
    });

    render(<LocationInput onLocationSelect={mockOnLocationSelect} />);

    await waitFor(() => {
      expect(mockOnLocationSelect).toHaveBeenCalledWith({
        address: 'New York, NY, USA',
        lat: 40.7128,
        lng: -74.0060,
      });
    });
  });

  it('handles geolocation error', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
      error({
        code: 1,
        message: 'User denied geolocation',
      });
    });

    render(<LocationInput onLocationSelect={mockOnLocationSelect} />);

    expect(alertSpy).toHaveBeenCalledWith('Unable to retrieve your location. Please enter it manually.');

    alertSpy.mockRestore();
  });

  it('handles manual location search', async () => {
    const user = userEvent.setup();

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'Los Angeles, CA, USA',
            geometry: {
              location: {
                lat: 34.0522,
                lng: -118.2437,
              },
            },
          },
        ],
      }),
    });

    render(<LocationInput onLocationSelect={mockOnLocationSelect} />);

    const input = screen.getByPlaceholderText('Search for a location or use current location');
    const searchButton = screen.getByRole('button', { name: 'Search' });

    await user.type(input, 'Los Angeles');
    await user.click(searchButton);

    await waitFor(() => {
      expect(mockOnLocationSelect).toHaveBeenCalledWith({
        address: 'Los Angeles, CA, USA',
        lat: 34.0522,
        lng: -118.2437,
      });
    });
  });

  it('disables search button when input is empty', async () => {
    render(<LocationInput onLocationSelect={mockOnLocationSelect} />);

    const searchButton = screen.getByRole('button', { name: 'Search' });

    expect(searchButton).toBeDisabled();
  });

  it('shows loading state during location detection', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation(() => {
      // Don't call success or error to keep it loading
    });

    render(<LocationInput onLocationSelect={mockOnLocationSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });

    const locationButton = screen.getByTitle('Use current location');
    expect(locationButton).toBeDisabled();
  });

  it('handles geocoding API error', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ZERO_RESULTS',
      }),
    });

    const user = userEvent.setup();
    render(<LocationInput onLocationSelect={mockOnLocationSelect} />);

    const input = screen.getByPlaceholderText('Search for a location or use current location');
    const searchButton = screen.getByRole('button', { name: 'Search' });

    await user.type(input, 'Invalid Location');
    await user.click(searchButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Could not find the specified location. Please try again.');
    });

    alertSpy.mockRestore();
  });

  it('prevents auto-detection when autoDetect is false', () => {
    render(<LocationInput onLocationSelect={mockOnLocationSelect} autoDetect={false} />);

    expect(mockGeolocation.getCurrentPosition).not.toHaveBeenCalled();
  });
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TripForm from '../TripForm/TripForm';

// Mock the UI components that TripForm depends on
jest.mock('../ui/button', () => ({
  Button: ({ children, onClick, disabled, type, variant }: any) => (
    <button onClick={onClick} disabled={disabled} type={type} data-variant={variant}>
      {children}
    </button>
  ),
}));

jest.mock('../ui/card', () => ({
  Card: ({ children, className }: any) => <div className={`card ${className || ''}`} data-testid="card">{children}</div>,
  CardContent: ({ children, className }: any) => <div className={`card-content ${className || ''}`} data-testid="card-content">{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={`card-header ${className || ''}`} data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={`card-title ${className || ''}`} data-testid="card-title">{children}</h3>,
  CardDescription: ({ children, className }: any) => <p className={`card-description ${className || ''}`} data-testid="card-description">{children}</p>,
}));

jest.mock('../ui/input', () => ({
  Input: ({ value, onChange, placeholder, type, disabled }: any) => (
    <input
      type={type || 'text'}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      data-testid="input"
    />
  ),
}));

jest.mock('../ui/label', () => ({
  Label: ({ children, className }: any) => <label className={`label ${className || ''}`} data-testid="label">{children}</label>,
}));

jest.mock('../ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange && onValueChange('70_8')}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value} data-testid="select-item">{children}</option>,
  SelectTrigger: ({ children, className }: any) => <div className={`select-trigger ${className || ''}`} data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
}));

jest.mock('../ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('../ui/date-picker', () => ({
  DatePicker: ({ selected, onSelect, placeholderText }: any) => (
    <input
      type="date"
      value={selected ? selected.toISOString().split('T')[0] : ''}
      onChange={(e) => onSelect && onSelect(new Date(e.target.value))}
      placeholder={placeholderText}
      data-testid="date-picker"
    />
  ),
}));

jest.mock('../ui/time-picker', () => ({
  TimePicker: ({ value, onChange }: any) => (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      data-testid="time-picker"
    />
  ),
}));

jest.mock('../LocationSearch/LocationSearch', () => {
  return function MockLocationSearch({ onLocationSelect, placeholder }: any) {
    return (
      <div data-testid="location-search">
        <input
          placeholder={placeholder}
          onChange={(e) => {
            if (e.target.value === 'New York') {
              onLocationSelect({
                address: 'New York, NY, USA',
                lat: 40.7128,
                lng: -74.0060,
              });
            } else if (e.target.value === 'Los Angeles') {
              onLocationSelect({
                address: 'Los Angeles, CA, USA',
                lat: 34.0522,
                lng: -118.2437,
              });
            }
          }}
        />
      </div>
    );
  };
});

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
  }),
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: (date: Date, formatStr: string) => {
    if (formatStr === 'MMM d, yyyy') return 'Jan 1, 2024';
    if (formatStr === 'HH:mm') return '10:00';
    return '2024-01-01';
  },
}));

describe('TripForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form with initial state', () => {
    render(<TripForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText('Plan Your Trip')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter trip name')).toBeInTheDocument();
  });

  it('allows setting trip name', async () => {
    const user = userEvent.setup();

    render(<TripForm onSubmit={mockOnSubmit} />);

    const nameInput = screen.getByPlaceholderText('Enter trip name');
    await user.type(nameInput, 'My Test Trip');

    expect(nameInput).toHaveValue('My Test Trip');
  });

  it('allows selecting origin location', async () => {
    const user = userEvent.setup();

    render(<TripForm onSubmit={mockOnSubmit} />);

    const originInput = screen.getAllByTestId('location-search')[0];
    const input = originInput.querySelector('input')!;

    await user.type(input, 'New York');

    expect(input).toHaveValue('New York');
  });

  it('allows selecting destination location', async () => {
    const user = userEvent.setup();

    render(<TripForm onSubmit={mockOnSubmit} />);

    const destinationInput = screen.getAllByTestId('location-search')[1];
    const input = destinationInput.querySelector('input')!;

    await user.type(input, 'Los Angeles');

    expect(input).toHaveValue('Los Angeles');
  });

  it('shows validation error when submitting without required fields', async () => {
    const user = userEvent.setup();

    render(<TripForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByText('Create Trip');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Missing required fields')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    const user = userEvent.setup();

    render(<TripForm onSubmit={mockOnSubmit} />);

    // Fill in trip name
    const nameInput = screen.getByPlaceholderText('Enter trip name');
    await user.type(nameInput, 'Test Trip');

    // Select origin (simulate location selection)
    const originInput = screen.getAllByTestId('location-search')[0];
    const originTextInput = originInput.querySelector('input')!;
    await user.type(originTextInput, 'New York');

    // Select destination (simulate location selection)
    const destinationInput = screen.getAllByTestId('location-search')[1];
    const destinationTextInput = destinationInput.querySelector('input')!;
    await user.type(destinationTextInput, 'Los Angeles');

    const submitButton = screen.getByText('Create Trip');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'Test Trip',
        origin: {
          address: 'New York, NY, USA',
          lat: 40.7128,
          lng: -74.0060,
        },
        destination: {
          address: 'Los Angeles, CA, USA',
          lat: 34.0522,
          lng: -118.2437,
        },
        waypoints: [],
        departureDate: expect.any(Date),
        departureTime: expect.any(String),
      });
    });
  });

  it('shows loading state during submission', async () => {
    mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    const user = userEvent.setup();

    render(<TripForm onSubmit={mockOnSubmit} />);

    // Fill in required fields quickly
    const nameInput = screen.getByPlaceholderText('Enter trip name');
    await user.type(nameInput, 'Test Trip');

    const submitButton = screen.getByText('Create Trip');
    await user.click(submitButton);

    expect(screen.getByText('Creating Trip...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('uses default trip name when none provided', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    const user = userEvent.setup();

    render(<TripForm onSubmit={mockOnSubmit} />);

    // Select origin and destination without setting name
    const originInput = screen.getAllByTestId('location-search')[0];
    const originTextInput = originInput.querySelector('input')!;
    await user.type(originTextInput, 'New York');

    const destinationInput = screen.getAllByTestId('location-search')[1];
    const destinationTextInput = destinationInput.querySelector('input')!;
    await user.type(destinationTextInput, 'Los Angeles');

    const submitButton = screen.getByText('Create Trip');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Trip Jan 1, 2024', // Default name based on current date
        })
      );
    });
  });
});

export type DutyStatus = 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving';

export interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

export interface Trip {
  id: number;
  name: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  current_location?: LocationData;
  pickup_location?: LocationData;
  dropoff_location?: LocationData;
  current_cycle: string;
  start_time?: string;
  end_time?: string;
}

export interface DutyStatusData {
  status: DutyStatus;
  startTime: string;
  location?: string;
  endTime?: string;
  notes?: string;
  vehicleInfo?: string;
  trailerInfo?: string;
  odometerStart?: number;
  odometerEnd?: number;
  duration?: number;
}

export interface DutyStatusFormData {
  location: LocationData | null;
  notes: string;
  vehicleInfo: string;
  trailerInfo: string;
  odometerStart: string;
  odometerEnd: string;
}

export const DUTY_STATUS_OPTIONS = [
  { value: 'off_duty' as const, label: 'Off Duty', color: 'bg-gray-500' },
  { value: 'sleeper_berth' as const, label: 'Sleeper Berth', color: 'bg-blue-500' },
  { value: 'driving' as const, label: 'Driving', color: 'bg-green-500' },
  { value: 'on_duty_not_driving' as const, label: 'On Duty (Not Driving)', color: 'bg-yellow-500' },
] as const;

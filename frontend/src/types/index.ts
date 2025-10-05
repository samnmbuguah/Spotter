// User types
export interface User {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  date_joined: string;
}

// Authentication types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user: User;
}

// Location types
export interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
}

// Trip types
export interface RouteStop {
  id: number;
  name: string;
  location: Location;
  stop_type: 'rest' | 'fuel' | 'pickup' | 'dropoff';
  estimated_duration: number;
  order: number;
}

export interface Trip {
  id: number;
  name: string;
  driver: User;
  current_location: Location;
  pickup_location: Location;
  dropoff_location: Location;
  current_cycle: '70_8' | '60_7';
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  start_time?: string;
  end_time?: string;
  total_distance?: number;
  available_hours: number;
  used_hours: number;
  route_stops: RouteStop[];
  created_at: string;
  updated_at: string;
}

// HOS Log types
export interface LogEntry {
  id: number;
  driver: User;
  date: string;
  start_time: string;
  end_time?: string;
  duty_status: 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving';
  location?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  total_hours: number;
  created_at: string;
  updated_at: string;
}

export interface DailyLog {
  id: number;
  driver: User;
  date: string;
  total_on_duty_hours: number;
  total_driving_hours: number;
  total_off_duty_hours: number;
  total_sleeper_berth_hours: number;
  cycle_start_date?: string;
  available_hours_next_day: number;
  is_certified: boolean;
  certified_at?: string;
  certified_by?: User;
  has_supporting_documents: boolean;
  document_count: number;
  log_entries: LogEntry[];
  is_compliant?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Violation {
  id: number;
  driver: User;
  log_entry?: LogEntry;
  daily_log?: DailyLog;
  violation_type: string;
  description: string;
  detected_at: string;
  severity: 'minor' | 'major' | 'critical';
  is_resolved: boolean;
  resolved_at?: string;
  resolution_notes?: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success?: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

// HOS Status types
export interface HOSStatus {
  driver: string;
  current_status: string;
  driving_hours_today: number;
  on_duty_hours_today: number;
  is_compliant_today: boolean;
  remaining_driving_hours: number;
  remaining_on_duty_hours: number;
}

// Form types
export interface TripFormData {
  name: string;
  current_location_id: number;
  pickup_location_id: number;
  dropoff_location_id: number;
  current_cycle: '70_8' | '60_7';
  route_stop_ids?: number[];
}

export interface LogSheetGridCell {
  hour: number;
  status: 'off_duty' | 'sleeper_berth' | 'driving' | 'on_duty_not_driving';
  location?: string;
  notes?: string;
}

export interface LogSheetData {
  date: string;
  driver_name: string;
  truck_number?: string;
  trailer_number?: string;
  starting_location?: string;
  grid: LogSheetGridCell[];
  total_miles?: number;
  signatures?: {
    driver?: string;
    co_driver?: string;
  };
}

export interface LogSheetDrawEvent {
  hour: number;
  status: LogSheetGridCell['status'];
  location?: string;
  notes?: string;
}

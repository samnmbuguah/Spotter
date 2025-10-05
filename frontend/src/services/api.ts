import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// API base URL - use relative path for proper nginx proxying
const API_BASE_URL = '/api/v1';

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
  },
  timeout: 10000, // 10 seconds
  withCredentials: false, // Don't send cookies by default for API calls
});

  // Request interceptor to add auth token and proper headers
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: any) => {
    if (error.response?.status === 401) {
      // Token expired, try to refresh
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);

          // Retry the original request
          error.config.headers.Authorization = `Bearer ${access}`;
          return axios(error.config);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Authentication services
export const authService = {
  async login(email: string, password: string) {
    const response = await api.post('/auth/login/', { email, password });
    return response.data;
  },

  async register(userData: { email: string; password: string; name: string }) {
    const response = await api.post('/auth/register/', userData);
    return response.data;
  },

  async updateProfile(profileData: any) {
    const response = await api.patch('/auth/profile/', profileData);
    return response.data;
  },

  async updateDriverProfile(profileData: any) {
    const response = await api.patch('/auth/driver-profile/', profileData);
    return response.data;
  },

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};

// Trip services
export const tripService = {
  async getCurrentTrip() {
    const response = await api.get('/trips/current/');
    return response.data;
  },

  async getTrip(id: number) {
    const response = await api.get(`/trips/${id}/`);
    return response.data;
  },

  async createTrip(tripData: any) {
    const response = await api.post('/trips/', tripData);
    return response.data;
  },

  async updateTrip(id: number, tripData: any) {
    const response = await api.put(`/trips/${id}/`, tripData);
    return response.data;
  },

  async deleteTrip(id: number) {
    const response = await api.delete(`/trips/${id}/`);
    return response.data;
  },

  async startTrip(id: number) {
    const response = await api.post(`/trips/${id}/start/`);
    return response.data;
  },

  async completeTrip(id: number) {
    const response = await api.post(`/trips/${id}/complete/`);
    return response.data;
  },

  async checkCompliance(id: number) {
    const response = await api.get(`/trips/${id}/compliance-check/`);
    return response.data;
  },
};

// HOS Log services - defined first to avoid circular dependencies
const logService = {
  async getLogEntries() {
    const response = await api.get('/logs/entries/');
    return response.data.results || response.data || [];
  },

  async createLogEntry(entryData: any) {
    const response = await api.post('/logs/entries/', entryData);
    return response.data;
  },

  async updateLogEntry(id: number, entryData: any) {
    const response = await api.put(`/logs/entries/${id}/`, entryData);
    return response.data;
  },

  async deleteLogEntry(id: number) {
    const response = await api.delete(`/logs/entries/${id}/`);
    return response.data;
  },

  async getDailyLogs() {
    const response = await api.get('/logs/daily/');
    return response.data.results || response.data || [];
  },

  async generateDailyLog(date?: string) {
    const url = date ? `/logs/daily/generate/${date}/` : '/logs/daily/generate/';
    const response = await api.post(url);
    return response.data;
  },

  async certifyDailyLog(id: number) {
    const response = await api.post(`/logs/daily/${id}/certify/`);
    return response.data;
  },

  async updateDutyStatusTime(status: string, newTime: string) {
    const response = await api.post('/logs/update-duty-time/', {
      status,
      time: newTime,
    });
    return response.data;
  },

  async downloadDailyLogPDF(date?: string) {
    const url = date ? `/logs/pdf/${date}/` : '/logs/pdf/';
    const response = await api.get(url, { responseType: 'blob' });
    return response.data;
  },
};

// Export logService after definition
export { logService };

// Location services
export const locationService = {
  async getLocations() {
    const response = await api.get('/trips/locations/');
    // Handle paginated response from Django REST Framework
    return response.data.results || response.data || [];
  },

  async createLocation(locationData: any) {
    const response = await api.post('/trips/locations/', locationData);
    return response.data;
  },
};

export default api;

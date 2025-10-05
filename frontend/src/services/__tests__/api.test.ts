import { authService } from '../services/api';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockResponse = {
        data: {
          access: 'mock-access-token',
          refresh: 'mock-refresh-token',
          user: {
            id: 1,
            email: 'test@example.com',
            name: 'Test User'
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await authService.login('test@example.com', 'password');

      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/login/', {
        email: 'test@example.com',
        password: 'password'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle login errors', async () => {
      const errorMessage = 'Invalid credentials';
      mockedAxios.post.mockRejectedValue(new Error(errorMessage));

      await expect(authService.login('test@example.com', 'wrongpassword'))
        .rejects.toThrow(errorMessage);
    });
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User'
      };

      const mockResponse = {
        data: {
          id: 2,
          email: userData.email,
          name: userData.name
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await authService.register(userData);

      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/register/', userData);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('logout', () => {
    it('should clear tokens from localStorage', () => {
      // Set up localStorage with tokens
      localStorage.setItem('access_token', 'mock-access-token');
      localStorage.setItem('refresh_token', 'mock-refresh-token');

      authService.logout();

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });
  });
});

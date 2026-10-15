import { api } from './api';
import { ApiError } from './api';

// Mock fetch globally
global.fetch = vi.fn();

describe('API Service', () => {
  const mockEmail = 'test@example.com';
  const mockPassword = 'password123';
  const mockResponse = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage before each test
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('bantai-access-token');
    }
  });

  describe('login', () => {
    it('should call the correct endpoint with correct parameters', async () => {
      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      await api.login(mockEmail, mockPassword);

      expect(fetch).toHaveBeenCalledWith(
        'https://www.bantai.online/api/v1/auth/local/signin',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ email: mockEmail, password: mockPassword }),
          credentials: 'include'
        })
      );
    });

    it('should return the access token and refresh token on success', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      const result = await api.login(mockEmail, mockPassword);

      expect(result).toEqual(mockResponse);
    });

    it('should store the access token in localStorage', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      await api.login(mockEmail, mockPassword);

      expect(typeof window !== 'undefined' && window.localStorage.getItem('bantai-access-token'))
        .toBe(mockResponse.accessToken);
    });

    it('should throw an ApiError on HTTP error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' }),
        status: 401
      } as Response);

      await expect(api.login(mockEmail, mockPassword))
        .rejects
        .toEqual(new ApiError('Invalid credentials', 401));
    });

    it('should throw an ApiError on network error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.login(mockEmail, mockPassword))
        .rejects
        .toEqual(new ApiError('Request failed.', 0)); // ApiError sets status to 0 for non-HTTP errors
    });
  });

  describe('devLogin', () => {
    it('should call the correct dev login endpoint', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response);

      await api.devLogin();

      expect(fetch).toHaveBeenCalledWith(
        'https://www.bantai.online/api/v1/auth/dev-login',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  describe('logout', () => {
    it('should call the logout endpoint and clear token', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
        status: 200
      } as Response);

      // First set a token
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('bantai-access-token', 'test-token');
      }

      await api.logout();

      expect(fetch).toHaveBeenCalledWith(
        'https://www.bantai.online/api/v1/auth/logout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include'
        })
      );

      // Token should be cleared after logout
      expect(typeof window !== 'undefined' && window.localStorage.getItem('bantai-access-token'))
        .toBeNull();
    });
  });
});
import { authApi } from '../api/authApi';
import { setAuthToken } from '../api/client';
import { storageService } from './storageService';
import { LoginCredentials, AuthResponse } from '../types/auth';

const TOKEN_KEY = 'auth_token';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await authApi.login(credentials);
      const token = response.access_token;
      
      // Save token to storage
      await storageService.setItem(TOKEN_KEY, token);
      
      // Update axios client headers
      setAuthToken(token);
      
      return response;
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    }
  },

  async logout(): Promise<void> {
    try {
      // Remove token from storage
      await storageService.removeItem(TOKEN_KEY);
      
      // Clear axios client headers
      setAuthToken(null);
    } catch (error) {
      console.error('Logout failed', error);
      throw error;
    }
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await storageService.getItem(TOKEN_KEY);
    return !!token;
  },

  async loadStoredToken(): Promise<void> {
    const token = await storageService.getItem(TOKEN_KEY);
    if (token) {
      setAuthToken(token);
    }
  }
};

import client from './client';
import { LoginCredentials, AuthResponse, RegisterData } from '../types/auth';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);
    
    const response = await client.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },
  
  register: async (data: RegisterData): Promise<any> => {
    const response = await client.post('/auth/register', data);
    return response.data;
  },
  
  getMe: async (): Promise<any> => {
    const response = await client.get('/users/me');
    return response.data;
  },
};

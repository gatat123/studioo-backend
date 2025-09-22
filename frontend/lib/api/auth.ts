/**
 * Authentication API Service
 * Handles all auth-related API calls
 */

import api from './client';
import { User, AuthResponse, LoginCredentials, RegisterData } from '@/types';

export const authAPI = {
  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post('/api/auth/register', data) as AuthResponse;
    
    // Store auth data - backend returns accessToken, not token
    const token = response.accessToken || response.token;
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('userId', response.user.id);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    
    return response;
  },

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post('/api/auth/login', credentials) as AuthResponse;
    
    // Store auth data - backend returns accessToken, not token
    const token = response.accessToken || response.token;
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('userId', response.user.id);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    
    return response;
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout');
    } finally {
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('user');
      
      // Redirect to login
      window.location.href = '/auth/login';
    }
  },

  /**
   * Get current session
   */
  async getSession(): Promise<User | null> {
    try {
      const response = await api.get('/api/auth/session') as { user: User };
      return response.user;
    } catch (error) {
      return null;
    }
  },

  /**
   * Refresh auth token
   */
  async refreshToken(): Promise<string> {
    const response = await api.post('/api/auth/refresh') as { token: string };
    
    if (response.token) {
      localStorage.setItem('token', response.token);
    }
    
    return response.token;
  },

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    return api.post('/api/auth/verify-email', { token });
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    return api.post('/api/auth/forgot-password', { email });
  },

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    return api.post('/api/auth/reset-password', { token, newPassword });
  },

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return api.post('/api/auth/change-password', { currentPassword, newPassword });
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },

  /**
   * Get current user from local storage
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  /**
   * Get auth token
   */
  getToken(): string | null {
    return localStorage.getItem('token');
  },
};
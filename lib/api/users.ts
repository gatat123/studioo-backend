/**
 * Users API Service  
 * Handles all user-related API calls
 */

import api from './client';
import { User, Project } from '@/types';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface UpdateUserDto {
  nickname?: string;
  email?: string;
  profileImageUrl?: string;
}

export const usersAPI = {
  /**
   * Get user profile
   */
  async getProfile(): Promise<User> {
    return api.get('/api/users/profile');
  },

  /**
   * Update user profile
   */
  async updateProfile(data: UpdateUserDto): Promise<User> {
    return api.put('/api/users/profile', data);
  },

  /**
   * Upload profile image
   */
  async uploadProfileImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('image', file);
    
    return api.upload('/api/users/profile/image', formData);
  },

  /**
   * Delete profile image
   */
  async deleteProfileImage(): Promise<void> {
    return api.delete('/api/users/profile/image');
  },

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User> {
    return api.get(`/api/users/${id}`);
  },

  /**
   * Search users
   */
  async searchUsers(query: string): Promise<User[]> {
    return api.get('/api/users/search', { params: { q: query } });
  },

  /**
   * Get user's projects
   */
  async getUserProjects(userId?: string): Promise<Project[]> {
    const endpoint = userId ? `/api/users/${userId}/projects` : '/api/users/projects';
    return api.get(endpoint);
  },

  /**
   * Get user's notifications
   */
  async getNotifications(): Promise<Notification[]> {
    return api.get('/api/users/notifications');
  },

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    return api.patch(`/api/notifications/${notificationId}`, { isRead: true });
  },

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead(): Promise<void> {
    return api.post('/api/notifications/mark-all-read');
  },

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    return api.delete(`/api/notifications/${notificationId}`);
  },
};
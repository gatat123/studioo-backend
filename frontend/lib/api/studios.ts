/**
 * Studios API Service
 * Handles all studio-related API calls
 */

import api from './client';
import { Studio, Project } from '@/types';

export interface UpdateStudioDto {
  name?: string;
  description?: string;
}

export const studiosAPI = {
  /**
   * Get current user's studio
   */
  async getMyStudio(): Promise<Studio> {
    return api.get('/api/studios');
  },

  /**
   * Get studio by ID
   */
  async getStudio(id: string): Promise<Studio> {
    return api.get(`/api/studios/${id}`);
  },

  /**
   * Update studio
   */
  async updateStudio(id: string, data: UpdateStudioDto): Promise<Studio> {
    return api.put(`/api/studios/${id}`, data);
  },

  /**
   * Get studio projects
   */
  async getStudioProjects(studioId?: string): Promise<Project[]> {
    const endpoint = studioId ? `/api/studios/${studioId}/projects` : '/api/studios/projects';
    return api.get(endpoint);
  },

  /**
   * Get studio statistics
   */
  async getStudioStats(studioId?: string): Promise<{
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalParticipants: number;
    totalScenes: number;
    totalImages: number;
    storageUsed: number;
  }> {
    const endpoint = studioId ? `/api/studios/${studioId}/stats` : '/api/studios/stats';
    return api.get(endpoint);
  },

  /**
   * Get studio activity log
   */
  async getStudioActivity(studioId?: string, limit: number = 20): Promise<Array<{
    id: string;
    type: string;
    description: string;
    projectId?: string;
    projectName?: string;
    userId: string;
    userName: string;
    createdAt: string;
  }>> {
    const endpoint = studioId ? `/api/studios/${studioId}/activity` : '/api/studios/activity';
    return api.get(endpoint, { params: { limit } });
  },
};
/**
 * Projects API Service
 * Handles all project-related API calls
 */

import api from './client';
import { Project, ProjectParticipant } from '@/types';

export interface CreateProjectDto {
  name: string;
  description?: string;
  deadline?: string;
  tag?: 'illustration' | 'storyboard';
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  deadline?: string;
  tag?: 'illustration' | 'storyboard';
  status?: 'active' | 'completed' | 'archived';
}

export interface ProjectWithParticipants extends Project {
  participants: ProjectParticipant[];
  _count?: {
    scenes: number;
    participants: number;
    comments: number;
  };
}

export const projectsAPI = {
  /**
   * Get all projects for current user
   */
  async getProjects(): Promise<Project[]> {
    return api.get('/api/projects');
  },

  /**
   * Get project by ID with full details
   */
  async getProject(id: string): Promise<ProjectWithParticipants> {
    return api.get(`/api/projects/${id}`);
  },

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectDto): Promise<Project> {
    return api.post('/api/projects', data);
  },

  /**
   * Update project
   */
  async updateProject(id: string, data: UpdateProjectDto): Promise<Project> {
    return api.put(`/api/projects/${id}`, data);
  },

  /**
   * Delete project (owner only)
   */
  async deleteProject(id: string): Promise<void> {
    return api.delete(`/api/projects/${id}`);
  },

  /**
   * Generate invite code for project
   */
  async generateInviteCode(id: string): Promise<{ inviteCode: string }> {
    return api.post(`/api/projects/${id}/invite`);
  },

  /**
   * Join project with invite code
   */
  async joinProject(inviteCode: string): Promise<Project> {
    return api.post('/api/projects/join', { inviteCode });
  },

  /**
   * Get project participants
   */
  async getParticipants(id: string): Promise<ProjectParticipant[]> {
    return api.get(`/api/projects/${id}/participants`);
  },

  /**
   * Remove participant from project
   */
  async removeParticipant(projectId: string, userId: string): Promise<void> {
    return api.delete(`/api/projects/${projectId}/participants/${userId}`);
  },

  /**
   * Update participant role
   */
  async updateParticipantRole(
    projectId: string,
    userId: string,
    role: 'owner' | 'editor' | 'viewer' | 'member'
  ): Promise<ProjectParticipant> {
    return api.patch(`/api/projects/${projectId}/participants/${userId}`, { role });
  },

  /**
   * Get project statistics
   */
  async getProjectStats(id: string): Promise<{
    scenes: number;
    images: number;
    comments: number;
    participants: number;
    lastActivity: string;
  }> {
    return api.get(`/api/projects/${id}/stats`);
  },
};
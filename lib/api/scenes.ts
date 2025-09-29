/**
 * Scenes API Service
 * Handles all scene-related API calls
 */

import api from './client';
import { Scene, Image } from '@/types';

export interface CreateSceneDto {
  sceneNumber?: number;
  description?: string;
  notes?: string;
}

export interface UpdateSceneDto {
  description?: string;
  notes?: string;
}

export interface SceneWithImages extends Scene {
  images: Image[];
  _count?: {
    images: number;
    comments: number;
  };
}

export const scenesAPI = {
  /**
   * Get all scenes for a project
   */
  async getScenes(projectId: string, includeImages: boolean = true): Promise<Scene[]> {
    const params = includeImages ? '?include_images=true' : '';
    const response = await api.get(`/api/projects/${projectId}/scenes${params}`);
    // Backend returns { scenes: [...] }
    return response.scenes || [];
  },

  /**
   * Get scene by ID with images
   */
  async getScene(projectId: string, sceneId: string): Promise<SceneWithImages> {
    return api.get(`/api/projects/${projectId}/scenes/${sceneId}`);
  },

  /**
   * Create a new scene
   */
  async createScene(projectId: string, data: CreateSceneDto): Promise<Scene> {
    const response = await api.post(`/api/projects/${projectId}/scenes`, data);
    // Backend returns { message: "...", scene: {...} }
    return response.scene || response;
  },

  /**
   * Update scene
   */
  async updateScene(
    projectId: string,
    sceneId: string,
    data: UpdateSceneDto
  ): Promise<Scene> {
    return api.put(`/api/projects/${projectId}/scenes/${sceneId}`, data);
  },

  /**
   * Delete scene
   */
  async deleteScene(projectId: string, sceneId: string): Promise<void> {
    return api.delete(`/api/projects/${projectId}/scenes/${sceneId}`);
  },

  /**
   * Reorder scenes
   */
  async reorderScenes(
    projectId: string,
    sceneIds: string[]
  ): Promise<Scene[]> {
    return api.put(`/api/projects/${projectId}/scenes/reorder`, { sceneIds });
  },

  /**
   * Duplicate scene
   */
  async duplicateScene(projectId: string, sceneId: string): Promise<Scene> {
    return api.post(`/api/projects/${projectId}/scenes/${sceneId}/duplicate`);
  },

  /**
   * Get scene activity log
   */
  async getSceneActivity(
    projectId: string,
    sceneId: string
  ): Promise<{
    activities: Array<{
      id: string;
      type: string;
      description: string;
      userId: string;
      userName: string;
      createdAt: string;
    }>;
  }> {
    return api.get(`/api/projects/${projectId}/scenes/${sceneId}/activity`);
  },
};
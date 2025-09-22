/**
 * Comments API Service
 * Handles all comment-related API calls
 */

import api from './client';
import { Comment } from '@/types';

export interface CreateCommentDto {
  projectId?: string;
  sceneId?: string;
  content: string;
  parentCommentId?: string;
}

export interface UpdateCommentDto {
  content: string;
}

export const commentsAPI = {
  /**
   * Get project comments
   */
  async getProjectComments(projectId: string): Promise<Comment[]> {
    try {
      return await api.get(`/api/comments?projectId=${projectId}`);
    } catch (error) {
      console.error('Failed to get project comments:', error);
      return [];
    }
  },

  /**
   * Get scene comments
   */
  async getSceneComments(sceneId: string): Promise<Comment[]> {
    return api.get(`/api/scenes/${sceneId}/comments`);
  },

  /**
   * Create comment
   */
  async createComment(data: CreateCommentDto): Promise<Comment> {
    return api.post(`/api/comments`, data);
  },

  /**
   * Update comment
   */
  async updateComment(id: string, data: UpdateCommentDto): Promise<Comment> {
    return api.put(`/api/comments/${id}`, data);
  },

  /**
   * Delete comment
   */
  async deleteComment(id: string): Promise<void> {
    return api.delete(`/api/comments/${id}`);
  },

  /**
   * Get comment replies
   */
  async getCommentReplies(commentId: string): Promise<Comment[]> {
    return api.get(`/api/comments/${commentId}/replies`);
  },
};
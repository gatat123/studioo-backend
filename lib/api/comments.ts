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
  metadata?: unknown;
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
      const response = await api.get(`/api/comments?projectId=${projectId}`);
      // Backend returns { success: true, data: { comments: [...] } }
      return response.data?.comments || response.comments || [];
    } catch {
      
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
    const response = await api.post(`/api/comments`, data);
    // Backend returns { success: true, data: { comment: {...} } }
    return response.data?.comment || response.comment || response;
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
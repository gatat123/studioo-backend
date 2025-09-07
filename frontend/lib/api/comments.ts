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
    return api.get(`/api/projects/${projectId}/comments`);
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
    if (data.projectId) {
      return api.post(`/api/projects/${data.projectId}/comments`, {
        content: data.content,
        parentCommentId: data.parentCommentId
      });
    } else if (data.sceneId) {
      return api.post(`/api/scenes/${data.sceneId}/comments`, {
        content: data.content,
        parentCommentId: data.parentCommentId
      });
    }
    throw new Error('Either projectId or sceneId is required');
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
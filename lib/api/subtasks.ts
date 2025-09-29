/**
 * SubTasks API Service
 * Handles all subtask-related API calls
 */

import api from './client';
import { SubTask } from '@/types';

export interface CreateSubTaskDto {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string | Date;
  assigneeId?: string;
}

export interface UpdateSubTaskDto {
  title?: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'review' | 'done';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string | Date | null;
  completedAt?: string | Date | null;
  assigneeId?: string | null;
}

export const subTasksAPI = {
  /**
   * Get all subtasks for a project (WorkTask)
   */
  async getSubTasks(projectId: string): Promise<SubTask[]> {
    const response = await api.get(`/api/works/${projectId}/subtasks`);
    return response.subTasks || response.data?.subTasks || [];
  },

  /**
   * Get subtask by ID
   */
  async getSubTask(projectId: string, subTaskId: string): Promise<SubTask> {
    const response = await api.get(`/api/works/${projectId}/subtasks/${subTaskId}`);
    return response.subTask || response.data?.subTask || response;
  },

  /**
   * Create a new subtask
   */
  async createSubTask(projectId: string, data: CreateSubTaskDto): Promise<SubTask> {
    const response = await api.post(`/api/works/${projectId}/subtasks`, data);
    return response.subTask || response.data?.subTask || response;
  },

  /**
   * Update subtask
   */
  async updateSubTask(projectId: string, subTaskId: string, data: UpdateSubTaskDto): Promise<SubTask> {
    const response = await api.put(`/api/works/${projectId}/subtasks/${subTaskId}`, data);
    return response.subTask || response.data?.subTask || response;
  },

  /**
   * Delete subtask
   */
  async deleteSubTask(projectId: string, subTaskId: string): Promise<void> {
    await api.delete(`/api/works/${projectId}/subtasks/${subTaskId}`);
  },

  /**
   * Update subtask status
   */
  async updateSubTaskStatus(
    projectId: string,
    subTaskId: string,
    status: SubTask['status']
  ): Promise<SubTask> {
    const updateData: UpdateSubTaskDto = {
      status,
      completedAt: status === 'done' ? new Date() : null
    };

    return this.updateSubTask(projectId, subTaskId, updateData);
  },
};
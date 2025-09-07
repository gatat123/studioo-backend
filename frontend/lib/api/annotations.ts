/**
 * Annotations API Service
 * Handles all annotation-related API calls
 */

import api from './client';
import { Annotation } from '@/types';

export interface CreateAnnotationDto {
  type: 'drawing' | 'text' | 'arrow' | 'rectangle';
  positionX: number;
  positionY: number;
  width?: number;
  height?: number;
  content?: string;
  drawingData?: any;
  color?: string;
}

export interface UpdateAnnotationDto {
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  content?: string;
  drawingData?: any;
  color?: string;
}

export const annotationsAPI = {
  /**
   * Get annotations for an image
   */
  async getImageAnnotations(imageId: string): Promise<Annotation[]> {
    return api.get(`/api/images/${imageId}/annotations`);
  },

  /**
   * Create annotation on image
   */
  async createAnnotation(
    imageId: string,
    data: CreateAnnotationDto
  ): Promise<Annotation> {
    return api.post(`/api/images/${imageId}/annotations`, data);
  },

  /**
   * Update annotation
   */
  async updateAnnotation(
    id: string,
    data: UpdateAnnotationDto
  ): Promise<Annotation> {
    return api.put(`/api/annotations/${id}`, data);
  },

  /**
   * Delete annotation
   */
  async deleteAnnotation(id: string): Promise<void> {
    return api.delete(`/api/annotations/${id}`);
  },

  /**
   * Batch create annotations
   */
  async batchCreateAnnotations(
    imageId: string,
    annotations: CreateAnnotationDto[]
  ): Promise<Annotation[]> {
    return api.post(`/api/images/${imageId}/annotations/batch`, { annotations });
  },

  /**
   * Clear all annotations on image
   */
  async clearImageAnnotations(imageId: string): Promise<void> {
    return api.delete(`/api/images/${imageId}/annotations`);
  },
};
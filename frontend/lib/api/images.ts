/**
 * Images API Service
 * Handles all image-related API calls including upload and version management
 */

import api from './client';
import { Image, ImageHistory } from '@/types';

export interface UploadImageDto {
  sceneId: string;
  type: 'lineart' | 'art';
  file: File;
}

export interface ImageWithHistory extends Image {
  history: ImageHistory[];
}

export const imagesAPI = {
  /**
   * Upload image to scene
   */
  async uploadImage(
    sceneId: string,
    file: File,
    type: 'lineart' | 'art',
    onProgress?: (progress: number) => void
  ): Promise<Image> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', type);

    // Create XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload failed'));

      xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/scenes/${sceneId}/images`);
      
      // Add auth token if available
      const token = localStorage.getItem('token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
    });
  },

  /**
   * Get all images for a scene
   */
  async getSceneImages(sceneId: string): Promise<Image[]> {
    return api.get(`/api/scenes/${sceneId}/images`);
  },

  /**
   * Get image by ID with history
   */
  async getImage(sceneId: string, imageId: string): Promise<ImageWithHistory> {
    return api.get(`/api/scenes/${sceneId}/images/${imageId}`);
  },

  /**
   * Delete image
   */
  async deleteImage(sceneId: string, imageId: string): Promise<void> {
    return api.delete(`/api/scenes/${sceneId}/images/${imageId}`);
  },

  /**
   * Get image history
   */
  async getImageHistory(sceneId: string, imageId: string): Promise<ImageHistory[]> {
    return api.get(`/api/scenes/${sceneId}/images/${imageId}/history`);
  },

  /**
   * Restore previous version of image
   */
  async restoreImageVersion(
    sceneId: string,
    imageId: string,
    historyId: string
  ): Promise<Image> {
    return api.post(`/api/scenes/${sceneId}/images/${imageId}/restore`, { historyId });
  },

  /**
   * Set image as current version
   */
  async setCurrentImage(sceneId: string, imageId: string): Promise<Image> {
    return api.patch(`/api/scenes/${sceneId}/images/${imageId}`, { isCurrent: true });
  },

  /**
   * Download image
   */
  async downloadImage(imageUrl: string, filename: string): Promise<void> {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Get image comparison data
   */
  async getImageComparison(
    sceneId: string,
    imageId1: string,
    imageId2: string
  ): Promise<{
    image1: Image;
    image2: Image;
    differences: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      type: 'added' | 'removed' | 'modified';
    }>;
  }> {
    return api.get(`/api/scenes/${sceneId}/images/compare`, {
      params: { id1: imageId1, id2: imageId2 }
    });
  },

  /**
   * Batch upload multiple images
   */
  async batchUpload(
    sceneId: string,
    files: File[],
    type: 'lineart' | 'art',
    onProgress?: (progress: number, fileIndex: number) => void
  ): Promise<Image[]> {
    const results: Image[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const image = await this.uploadImage(
        sceneId,
        files[i],
        type,
        (progress) => onProgress?.(progress, i)
      );
      results.push(image);
    }
    
    return results;
  },
};
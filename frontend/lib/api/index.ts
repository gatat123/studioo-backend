/**
 * API Service Exports
 * Central export point for all API services
 */

export { default as api, apiClient, APIError } from './client';
export { projectsAPI } from './projects';
export { scenesAPI } from './scenes';
export { imagesAPI } from './images';
export { commentsAPI } from './comments';
export { annotationsAPI } from './annotations';
export { authAPI } from './auth';
export { usersAPI } from './users';
export { studiosAPI } from './studios';

// Re-export types
export type {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectWithParticipants
} from './projects';

export type {
  CreateSceneDto,
  UpdateSceneDto,
  SceneWithImages
} from './scenes';

export type {
  UploadImageDto,
  ImageWithHistory
} from './images';

export type {
  CreateCommentDto,
  UpdateCommentDto
} from './comments';
/**
 * Type definitions for Studio Collaboration Platform
 */

// User types
export interface User {
  id: string;
  username: string;
  email: string;
  nickname: string;
  profileImage?: string | null;
  profileImageUrl?: string | null;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
  studio?: Studio;
}

// Studio types
export interface Studio {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  projects?: Project[];
}

// Project types
export interface Project {
  id: string;
  studioId: string;
  creatorId: string;
  name: string;
  description?: string | null;
  deadline?: string | Date | null;
  tag?: 'illustration' | 'storyboard' | null;
  inviteCode?: string | null;
  status: 'active' | 'completed' | 'archived';
  hasUpdates: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  studio?: Studio;
  creator?: User;
  participants?: ProjectParticipant[];
  scenes?: Scene[];
  comments?: Comment[];
  _count?: {
    scenes: number;
    participants: number;
    comments: number;
  };
}

// Project Participant types
export interface ProjectParticipant {
  id: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer' | 'member';
  joinedAt: string | Date;
  lastViewedAt?: string | Date | null;
  project?: Project;
  user?: User;  // Optional as it may not always be included
}

// Scene types
export interface Scene {
  id: string;
  projectId: string;
  sceneNumber: number;
  description?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  project?: Project;
  creator?: User;
  images?: Image[];
  comments?: Comment[];
  _count?: {
    images: number;
    comments: number;
  };
}

// Image types
export interface Image {
  id: string;
  sceneId: string;
  type: 'lineart' | 'art';
  fileUrl: string;
  fileSize?: bigint | string | number | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  isCurrent: boolean;
  uploadedBy: string;
  uploadedAt: string | Date;
  metadata?: any;
  scene?: Scene;
  uploader?: User;
  history?: ImageHistory[];
  annotations?: Annotation[];
}

// Image History types
export interface ImageHistory {
  id: string;
  imageId: string;
  sceneId: string;
  versionNumber: number;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  changeDescription?: string | null;
  image?: Image;
  scene?: Scene;
  uploader?: User;
}

// Comment types
export interface Comment {
  id: string;
  projectId?: string | null;
  sceneId?: string | null;
  parentCommentId?: string | null;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  isDeleted: boolean;
  project?: Project;
  scene?: Scene;
  parentComment?: Comment;
  user?: User;
  replies?: Comment[];
}

// Annotation types
export interface Annotation {
  id: string;
  imageId: string;
  userId: string;
  type: 'drawing' | 'text' | 'arrow' | 'rectangle';
  positionX: number;
  positionY: number;
  width?: number | null;
  height?: number | null;
  content?: string | null;
  drawingData?: any;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  image?: Image;
  user?: User;
}

// User Presence types
export interface UserPresence {
  id: string;
  userId: string;
  projectId?: string | null;
  sceneId?: string | null;
  status?: 'online' | 'away' | 'offline' | null;
  cursorX?: number | null;
  cursorY?: number | null;
  isTyping: boolean;
  lastActivity: string;
  socketId?: string | null;
  user?: User;
  project?: Project;
  scene?: Scene;
}

// Notification types
export interface Notification {
  id: string;
  userId: string;
  projectId?: string | null;
  type: string;
  title: string;
  content?: string | null;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
  user?: User;
  project?: Project;
}

// Collaboration Log types
export interface CollaborationLog {
  id: string;
  projectId: string;
  userId: string;
  actionType: string;
  targetType?: string | null;
  targetId?: string | null;
  description?: string | null;
  metadata?: any;
  createdAt: string;
  project?: Project;
  user?: User;
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  nickname: string;
}

export interface AuthResponse {
  user: User;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  studio?: {
    id: string;
    name: string;
    description?: string;
  };
}

// Session types
export interface Session {
  user: User;
  token: string;
  expiresAt: string;
}
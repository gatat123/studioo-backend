import { User as PrismaUser, Project, Scene, Image, Comment, Annotation, ProjectParticipant, CollaborationLog } from '@prisma/client';

// Export User type for frontend use (without sensitive fields)
export type User = Omit<PrismaUser, 'passwordHash'>;

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  nickname: string;
  isAdmin: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationResult {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface FileUpload {
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  userId?: string;
  timestamp: Date;
}

// Base types
export type UserWithoutPassword = User; // User is already without passwordHash
export type UserPublic = Pick<User, 'id' | 'username' | 'nickname' | 'profileImageUrl'>;

// Project types
export type ProjectWithRelations = Project & {
  studio?: {
    id: string;
    name: string;
  };
  creator?: UserPublic;
  participants?: ProjectParticipantWithUser[];
  scenes?: SceneBasic[];
  _count?: {
    scenes: number;
    comments: number;
    participants: number;
  };
};

export type ProjectParticipantWithUser = ProjectParticipant & {
  user: UserPublic;
};

// ProjectInvite is not in the schema, using Project with inviteCode instead
export type ProjectInviteInfo = {
  inviteCode: string;
  project: {
    id: string;
    name: string;
    description?: string | null;
  };
  creator?: UserPublic;
};

// Scene types
export type SceneBasic = Pick<Scene, 'id' | 'sceneNumber' | 'description' | 'createdAt' | 'updatedAt'> & {
  _count?: {
    images: number;
    comments: number;
  };
};

export type SceneWithRelations = Scene & {
  project?: ProjectWithRelations;
  images?: ImageWithRelations[];
  comments?: CommentWithRelations[];
  _count?: {
    images: number;
    comments: number;
  };
};

// Image types
export type ImageWithRelations = Image & {
  scene?: SceneWithRelations;
  uploader?: UserPublic;
  annotations?: AnnotationWithUser[];
  _count?: {
    annotations: number;
  };
};

export type AnnotationWithUser = Annotation & {
  user: UserPublic;
};

// Comment types
export type CommentWithRelations = Comment & {
  user: UserPublic;
  replies?: CommentWithRelations[];
  _count?: {
    replies: number;
  };
};

// Collaboration types
export type CollaborationLogWithUser = CollaborationLog & {
  user: UserPublic;
};

// API Request/Response types
export interface ProjectsListResponse {
  projects: ProjectWithRelations[];
  pagination: PaginationResult;
}

export interface ScenesListResponse {
  scenes: SceneWithRelations[];
  pagination: PaginationResult;
}

export interface CommentsListResponse {
  comments: CommentWithRelations[];
  pagination: PaginationResult;
}

export interface ImageHistoryResponse {
  currentImage: ImageWithRelations;
  history: (ImageWithRelations & {
    changes: string[];
    isCurrentVersion: boolean;
  })[];
  activityLogs: CollaborationLogWithUser[];
  statistics: {
    totalVersions: number;
    totalAnnotations: number;
    firstUpload: Date;
    lastUpdate: Date;
  };
}

// Validation schemas types
export interface CreateProjectRequest {
  name: string;
  description?: string;
  deadline?: string;
  tag?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  deadline?: string | null;
  tag?: string | null;
  status?: 'active' | 'completed' | 'archived';
}

export interface CreateSceneRequest {
  projectId: string;
  sceneNumber: number;
  description?: string;
  notes?: string;
}

export interface UpdateSceneRequest {
  sceneNumber?: number;
  description?: string;
  notes?: string;
}

export interface CreateCommentRequest {
  content: string;
  projectId?: string;
  sceneId?: string;
  imageId?: string;
  parentCommentId?: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface GenerateInviteCodeRequest {
  expiresInDays?: number;
  maxUses?: number;
}

export interface JoinProjectRequest {
  inviteCode: string;
}

export interface ImageUploadRequest {
  file: File;
  sceneId: string;
  description?: string;
}
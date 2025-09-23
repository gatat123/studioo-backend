import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  nickname: z.string().min(2).max(100),
});

export const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

// Project schemas
export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  projectType: z.enum(['studio', 'work']).default('studio').optional(),
  deadline: z.string().datetime().optional(),
  tag: z.string().max(50).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  deadline: z.string().datetime().nullable().optional(),
  tag: z.string().max(50).nullable().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
});

export const generateInviteCodeSchema = z.object({
  expiresInDays: z.number().min(1).max(30).default(7),
  maxUses: z.number().min(1).max(100).optional(),
});

export const joinProjectSchema = z.object({
  inviteCode: z.string().length(8, '초대 코드는 8자리여야 합니다.'),
});

// Scene schemas
export const createSceneSchema = z.object({
  projectId: z.string().uuid('유효한 프로젝트 ID가 필요합니다.'),
  sceneNumber: z.number().int().positive('씬 번호는 양수여야 합니다.'),
  description: z.string().max(1000, '설명은 1000자를 초과할 수 없습니다.').optional(),
  notes: z.string().max(2000, '노트는 2000자를 초과할 수 없습니다.').optional(),
});

export const updateSceneSchema = z.object({
  sceneNumber: z.number().int().positive('씬 번호는 양수여야 합니다.').optional(),
  description: z.string().max(1000, '설명은 1000자를 초과할 수 없습니다.').optional(),
  notes: z.string().max(2000, '노트는 2000자를 초과할 수 없습니다.').optional(),
});

// Image schemas
export const uploadImageSchema = z.object({
  sceneId: z.string().uuid('유효한 씬 ID가 필요합니다.'),
  description: z.string().max(500, '설명은 500자를 초과할 수 없습니다.').optional(),
});

// Comment schemas
export const createCommentSchema = z.object({
  content: z.string().min(1, '댓글 내용이 필요합니다.').max(2000, '댓글은 2000자를 초과할 수 없습니다.'),
  projectId: z.string().uuid('유효한 프로젝트 ID가 필요합니다.').optional(),
  sceneId: z.string().uuid('유효한 씬 ID가 필요합니다.').optional(),
  imageId: z.string().uuid('유효한 이미지 ID가 필요합니다.').optional(),
  parentCommentId: z.string().uuid('유효한 부모 댓글 ID가 필요합니다.').optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, '댓글 내용이 필요합니다.').max(2000, '댓글은 2000자를 초과할 수 없습니다.'),
});

// Annotation schemas
export const createAnnotationSchema = z.object({
  imageId: z.string().uuid(),
  type: z.enum(['drawing', 'text', 'arrow', 'rectangle', 'circle', 'highlight']),
  positionX: z.number().min(0, 'X 좌표는 0 이상이어야 합니다.'),
  positionY: z.number().min(0, 'Y 좌표는 0 이상이어야 합니다.'),
  width: z.number().positive('너비는 양수여야 합니다.').optional(),
  height: z.number().positive('높이는 양수여야 합니다.').optional(),
  content: z.string().max(1000, '내용은 1000자를 초과할 수 없습니다.').optional(),
  drawingData: z.any().optional(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, '올바른 색상 코드를 입력하세요.').optional(),
  strokeWidth: z.number().positive('선 두께는 양수여야 합니다.').optional(),
});

export const updateAnnotationSchema = z.object({
  type: z.enum(['drawing', 'text', 'arrow', 'rectangle', 'circle', 'highlight']).optional(),
  positionX: z.number().min(0, 'X 좌표는 0 이상이어야 합니다.').optional(),
  positionY: z.number().min(0, 'Y 좌표는 0 이상이어야 합니다.').optional(),
  width: z.number().positive('너비는 양수여야 합니다.').optional(),
  height: z.number().positive('높이는 양수여야 합니다.').optional(),
  content: z.string().max(1000, '내용은 1000자를 초과할 수 없습니다.').optional(),
  drawingData: z.any().optional(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, '올바른 색상 코드를 입력하세요.').optional(),
  strokeWidth: z.number().positive('선 두께는 양수여야 합니다.').optional(),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().positive('페이지는 1 이상이어야 합니다.').default(1),
  limit: z.number().int().positive('제한 개수는 1 이상이어야 합니다.').max(100, '최대 100개까지만 조회할 수 있습니다.').default(20),
  orderBy: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Search schema
export const searchSchema = z.object({
  q: z.string().min(1, '검색어는 최소 1자 이상이어야 합니다.').max(100, '검색어는 100자를 초과할 수 없습니다.'),
  type: z.enum(['projects', 'scenes', 'images', 'comments', 'all']).default('all'),
});

// File validation
export const validateImageFile = (file: File) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error('지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF만 지원)');
  }

  if (file.size > maxSize) {
    throw new Error('파일 크기가 너무 큽니다. (최대 10MB)');
  }

  return true;
};

// Query parameter validation helpers
export const parseIntParam = (value: string | null, defaultValue: number = 0): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const parseBooleanParam = (value: string | null, defaultValue: boolean = false): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

export const parseUUIDParam = (value: string | null): string | null => {
  if (!value) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value) ? value : null;
};
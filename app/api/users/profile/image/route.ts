import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, ApiResponse } from '@/lib/middleware/auth';
import sharp from 'sharp';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * POST /api/users/profile/image
 * 프로필 이미지 업로드 (Base64로 저장)
 */
async function handleUploadProfileImage(request: NextRequest) {
  try {
    const user = (request as any).user;
    
    console.log('[Profile Image Upload] Starting upload for user:', user?.id);
    console.log('[Profile Image Upload] Content-Type:', request.headers.get('content-type'));
    
    let formData: FormData;
    try {
      formData = await request.formData();
      console.log('[Profile Image Upload] FormData parsed successfully');
      
      // Log all form data entries
      const entries = Array.from(formData.entries());
      console.log('[Profile Image Upload] FormData entries count:', entries.length);
      entries.forEach(([key, value]) => {
        // Check if it's a file-like object (has name, type, size properties)
        if (value && typeof value === 'object' && 'name' in value && 'type' in value && 'size' in value) {
          console.log(`[Profile Image Upload] FormData entry - ${key}: File(name=${(value as any).name}, type=${(value as any).type}, size=${(value as any).size})`);
        } else {
          console.log(`[Profile Image Upload] FormData entry - ${key}:`, value);
        }
      });
    } catch (parseError) {
      console.error('[Profile Image Upload] Failed to parse FormData:', parseError);
      return ApiResponse.badRequest('Failed to parse form data');
    }
    
    // Try both 'file' and 'image' keys as different clients might use different names
    let file = formData.get('file') as any;
    if (!file) {
      file = formData.get('image') as any;
      if (file) {
        console.log('[Profile Image Upload] File found under "image" key');
      }
    } else {
      console.log('[Profile Image Upload] File found under "file" key');
    }
    
    console.log('[Profile Image Upload] File from FormData:', {
      exists: !!file,
      type: typeof file,
      constructor: file?.constructor?.name,
      hasFileProperties: file && typeof file === 'object' && 'name' in file && 'type' in file && 'size' in file
    });

    // Check if it's a file-like object (Blob/File in Node.js)
    if (!file || typeof file !== 'object' || !('arrayBuffer' in file) || !('type' in file)) {
      console.error('[Profile Image Upload] No valid file in FormData');
      return ApiResponse.badRequest('No file provided');
    }

    console.log('[Profile Image Upload] File details:', {
      name: file.name || 'unknown',
      type: file.type,
      size: file.size
    });

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.error('[Profile Image Upload] Invalid file type:', file.type);
      return ApiResponse.badRequest('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed');
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      console.error('[Profile Image Upload] File too large:', file.size);
      return ApiResponse.badRequest('File size exceeds 5MB limit');
    }

    console.log('[Profile Image Upload] File validation passed');

    // 파일을 버퍼로 변환
    let buffer: Buffer;
    try {
      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
      console.log('[Profile Image Upload] File converted to buffer, size:', buffer.length);
    } catch (error) {
      console.error('[Profile Image Upload] Failed to convert file to buffer:', error);
      return ApiResponse.badRequest('Failed to process file');
    }

    // Sharp로 이미지 처리 (리사이즈 및 최적화)
    const processedImage = await sharp(buffer)
      .resize(400, 400, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Base64로 변환
    const base64Image = `data:image/jpeg;base64,${processedImage.toString('base64')}`;

    // 데이터베이스에 저장
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        profileImageUrl: base64Image,
        updatedAt: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        profileImageUrl: true,
        bio: true,
        isAdmin: true,
        updatedAt: true
      }
    });

    return ApiResponse.success({
      message: 'Profile image uploaded successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile image upload error:', error);
    return ApiResponse.serverError('Failed to upload profile image');
  }
}

/**
 * DELETE /api/users/profile/image
 * 프로필 이미지 삭제 (기본 이미지로 복원)
 */
async function handleDeleteProfileImage(request: NextRequest) {
  try {
    const user = (request as any).user;

    // 프로필 이미지를 null로 설정 (기본 이미지 사용)
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        profileImageUrl: null,
        updatedAt: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        profileImageUrl: true,
        bio: true,
        isAdmin: true,
        updatedAt: true
      }
    });

    return ApiResponse.success({
      message: 'Profile image removed successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile image delete error:', error);
    return ApiResponse.serverError('Failed to delete profile image');
  }
}

/**
 * GET /api/users/profile/image/:userId
 * 프로필 이미지 조회
 */
async function handleGetProfileImage(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return ApiResponse.badRequest('User ID is required');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profileImageUrl: true }
    });

    if (!user) {
      return ApiResponse.notFound('User not found');
    }

    return ApiResponse.success({
      profileImageUrl: user.profileImageUrl
    });

  } catch (error) {
    console.error('Get profile image error:', error);
    return ApiResponse.serverError('Failed to get profile image');
  }
}

import { handleOptions } from '@/lib/utils/cors';

export const POST = withAuth(handleUploadProfileImage);
export const DELETE = withAuth(handleDeleteProfileImage);
export const GET = handleGetProfileImage;
export const OPTIONS = handleOptions;
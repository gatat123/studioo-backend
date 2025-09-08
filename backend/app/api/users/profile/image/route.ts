import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, ApiResponse } from '@/lib/middleware/auth';
import { uploadService } from '@/lib/services/upload';
import { unlink } from 'fs/promises';
import path from 'path';

/**
 * POST /api/users/profile/image
 * 프로필 이미지 업로드
 */
async function handleUploadProfileImage(request: NextRequest) {
  try {
    const user = (request as any).user;

    // 이미지 업로드 처리
    const uploadResult = await uploadService.uploadProfileImage(request, user.id);

    if (!uploadResult.success) {
      return ApiResponse.error(uploadResult.error || 'Failed to upload image');
    }

    // 현재 프로필 이미지 URL 조회 (이전 이미지 삭제를 위함)
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { profileImageUrl: true }
    });

    // 데이터베이스에 새 프로필 이미지 URL 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        profileImageUrl: uploadResult.fileUrl,
        updatedAt: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        profileImageUrl: true,
        isAdmin: true,
        updatedAt: true
      }
    });

    // 이전 프로필 이미지 파일 삭제 (기본 이미지가 아닌 경우)
    if (currentUser?.profileImageUrl && 
        currentUser.profileImageUrl !== uploadResult.fileUrl &&
        currentUser.profileImageUrl.includes('/uploads/profiles/')) {
      try {
        const oldImagePath = path.join(
          process.cwd(), 
          'public', 
          currentUser.profileImageUrl
        );
        await unlink(oldImagePath);

        // 썸네일도 삭제
        const thumbnailPath = path.join(
          path.dirname(oldImagePath),
          'thumb_' + path.basename(oldImagePath)
        );
        try {
          await unlink(thumbnailPath);
        } catch (thumbError) {
          // 썸네일 삭제 실패는 무시
          console.warn('Thumbnail deletion failed:', thumbError);
        }
      } catch (deleteError) {
        console.warn('Old profile image deletion failed:', deleteError);
      }
    }

    return ApiResponse.success({
      message: 'Profile image uploaded successfully',
      user: updatedUser,
      fileDetails: {
        url: uploadResult.fileUrl,
        filename: uploadResult.filename,
        size: uploadResult.fileSize,
        dimensions: uploadResult.dimensions
      }
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

    // 현재 프로필 이미지 URL 조회
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { profileImageUrl: true }
    });

    if (!currentUser?.profileImageUrl) {
      return ApiResponse.error('No profile image to delete');
    }

    // 프로필 이미지 URL을 null로 업데이트
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
        isAdmin: true,
        updatedAt: true
      }
    });

    // 업로드된 이미지 파일 삭제 (기본 이미지가 아닌 경우)
    if (currentUser.profileImageUrl.includes('/uploads/profiles/')) {
      try {
        const imagePath = path.join(
          process.cwd(), 
          'public', 
          currentUser.profileImageUrl
        );
        await unlink(imagePath);

        // 썸네일도 삭제
        const thumbnailPath = path.join(
          path.dirname(imagePath),
          'thumb_' + path.basename(imagePath)
        );
        try {
          await unlink(thumbnailPath);
        } catch (thumbError) {
          console.warn('Thumbnail deletion failed:', thumbError);
        }
      } catch (deleteError) {
        console.warn('Profile image file deletion failed:', deleteError);
      }
    }

    return ApiResponse.success({
      message: 'Profile image deleted successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile image deletion error:', error);
    return ApiResponse.serverError('Failed to delete profile image');
  }
}

/**
 * GET /api/users/profile/image
 * 프로필 이미지 정보 조회
 */
async function handleGetProfileImageInfo(request: NextRequest) {
  try {
    const user = (request as any).user;

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        profileImageUrl: true,
        updatedAt: true
      }
    });

    if (!userData) {
      return ApiResponse.notFound('User not found');
    }

    const hasCustomImage = userData.profileImageUrl && 
                          userData.profileImageUrl.includes('/uploads/profiles/');

    return ApiResponse.success({
      profileImageUrl: userData.profileImageUrl,
      hasCustomImage,
      lastUpdated: userData.updatedAt
    });

  } catch (error) {
    console.error('Profile image info error:', error);
    return ApiResponse.serverError('Failed to get profile image info');
  }
}

// Route handlers with authentication
export const POST = withAuth(handleUploadProfileImage, {
  requiredRoles: ['user']
});

export const DELETE = withAuth(handleDeleteProfileImage, {
  requiredRoles: ['user']
});

export const GET = withAuth(handleGetProfileImageInfo, {
  requiredRoles: ['user']
});
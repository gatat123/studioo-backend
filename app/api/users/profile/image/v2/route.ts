import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, ApiResponse } from '@/lib/middleware/auth';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * POST /api/users/profile/image/v2
 * 프로필 이미지 업로드 (파일 시스템 저장)
 */
async function handleUploadProfileImage(request: NextRequest) {
  try {
    const user = (request as any).user;
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return ApiResponse.badRequest('No file provided');
    }

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return ApiResponse.badRequest('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed');
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return ApiResponse.badRequest('File size exceeds 5MB limit');
    }

    // 파일을 버퍼로 변환
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sharp로 이미지 처리 (리사이즈 및 최적화)
    const processedImage = await sharp(buffer)
      .resize(400, 400, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // 파일명 생성
    const filename = `${Date.now()}-${uuidv4().substring(0, 8)}.jpg`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profiles', user.id);
    const filePath = path.join(uploadDir, filename);

    // 디렉토리 생성
    await fs.mkdir(uploadDir, { recursive: true });

    // 파일 저장
    await fs.writeFile(filePath, processedImage);

    // 데이터베이스에 URL 저장
    const profileImageUrl = `/uploads/profiles/${user.id}/${filename}`;
    
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        profileImageUrl,
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
 * DELETE /api/users/profile/image/v2
 * 프로필 이미지 삭제 (기본 이미지로 복원)
 */
async function handleDeleteProfileImage(request: NextRequest) {
  try {
    const user = (request as any).user;

    // 이전 이미지가 파일 시스템에 저장된 경우 삭제 로직 추가 가능

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

export const POST = withAuth(handleUploadProfileImage);
export const DELETE = withAuth(handleDeleteProfileImage);
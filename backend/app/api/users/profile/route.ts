import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hash, compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { withAuth, ApiResponse } from '@/lib/middleware/auth';

// 프로필 업데이트 스키마
const updateProfileSchema = z.object({
  nickname: z.string()
    .min(2, 'Nickname must be at least 2 characters')
    .max(100, 'Nickname must be less than 100 characters')
    .optional(),
  email: z.string()
    .email('Invalid email format')
    .optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .optional(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
}).refine((data) => {
  // 비밀번호 변경 시 현재 비밀번호 필요
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  message: "Current password is required to change password",
  path: ["currentPassword"]
});

/**
 * GET /api/users/profile
 * 현재 사용자 프로필 조회
 */
async function handleGetProfile(request: NextRequest) {
  try {
    const user = (request as any).user;

    // 사용자 정보 조회 (패스워드 제외)
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        profileImageUrl: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        isActive: true,
        studio: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true
          }
        },
        // 참여 중인 프로젝트 수
        _count: {
          select: {
            participations: true,
            createdProjects: true
          }
        }
      }
    });

    if (!profile) {
      return ApiResponse.notFound('User profile not found');
    }

    // 추가 통계 정보
    const stats = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        _count: {
          select: {
            uploadedImages: true,
            comments: true,
            annotations: true
          }
        }
      }
    });

    return ApiResponse.success({
      ...profile,
      stats: {
        totalProjects: profile._count.participations + profile._count.createdProjects,
        createdProjects: profile._count.createdProjects,
        participatingProjects: profile._count.participations,
        uploadedImages: stats?._count.uploadedImages || 0,
        comments: stats?._count.comments || 0,
        annotations: stats?._count.annotations || 0
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return ApiResponse.serverError('Failed to retrieve profile');
  }
}

/**
 * PUT /api/users/profile
 * 현재 사용자 프로필 수정
 */
async function handleUpdateProfile(request: NextRequest) {
  try {
    const user = (request as any).user;
    const body = await request.json();

    // 입력값 검증
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return ApiResponse.error(
        'Validation failed',
        400,
        validation.error.issues
      );
    }

    const data = validation.data;
    const updateData: any = {};

    // 현재 사용자 정보 조회
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        username: true,
        email: true,
        passwordHash: true
      }
    });

    if (!currentUser) {
      return ApiResponse.notFound('User not found');
    }

    // 닉네임 업데이트
    if (data.nickname) {
      updateData.nickname = data.nickname;
    }

    // 사용자명 업데이트 (중복 검사)
    if (data.username && data.username !== currentUser.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: data.username,
          id: { not: user.id }
        }
      });

      if (existingUser) {
        return ApiResponse.error('Username already taken');
      }

      updateData.username = data.username;
    }

    // 이메일 업데이트 (중복 검사)
    if (data.email && data.email !== currentUser.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          id: { not: user.id }
        }
      });

      if (existingUser) {
        return ApiResponse.error('Email already taken');
      }

      updateData.email = data.email;
    }

    // 비밀번호 업데이트
    if (data.newPassword) {
      // 현재 비밀번호 확인
      if (!data.currentPassword) {
        return ApiResponse.error('Current password is required');
      }

      const isCurrentPasswordValid = await compare(
        data.currentPassword,
        currentUser.passwordHash
      );

      if (!isCurrentPasswordValid) {
        return ApiResponse.error('Current password is incorrect');
      }

      // 새 비밀번호 해시
      updateData.passwordHash = await hash(data.newPassword, 12);
    }

    // 업데이트할 내용이 없는 경우
    if (Object.keys(updateData).length === 0) {
      return ApiResponse.error('No updates provided');
    }

    // 프로필 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        profileImageUrl: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });

    return ApiResponse.success({
      message: 'Profile updated successfully',
      profile: updatedUser
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return ApiResponse.serverError('Failed to update profile');
  }
}

/**
 * DELETE /api/users/profile
 * 계정 비활성화 (소프트 삭제)
 */
async function handleDeactivateAccount(request: NextRequest) {
  try {
    const user = (request as any).user;
    const body = await request.json();

    // 비밀번호 확인 스키마
    const deactivateSchema = z.object({
      password: z.string().min(1, 'Password is required'),
      confirmDeactivation: z.literal(true).refine(val => val === true, {
        message: 'Account deactivation confirmation required'
      })
    });

    const validation = deactivateSchema.safeParse(body);
    if (!validation.success) {
      return ApiResponse.error(
        'Validation failed',
        400,
        validation.error.issues
      );
    }

    // 현재 사용자 정보 및 비밀번호 확인
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        passwordHash: true,
        isAdmin: true
      }
    });

    if (!currentUser) {
      return ApiResponse.notFound('User not found');
    }

    // 관리자 계정은 비활성화 불가
    if (currentUser.isAdmin) {
      return ApiResponse.forbidden('Admin accounts cannot be deactivated');
    }

    // 비밀번호 확인
    const isPasswordValid = await compare(
      validation.data.password,
      currentUser.passwordHash
    );

    if (!isPasswordValid) {
      return ApiResponse.error('Password is incorrect');
    }

    // 계정 비활성화
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    return ApiResponse.success({
      message: 'Account has been deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate account error:', error);
    return ApiResponse.serverError('Failed to deactivate account');
  }
}

// Route handlers with authentication
export const GET = withAuth(handleGetProfile, {
  requiredRoles: ['user']
});

export const PUT = withAuth(handleUpdateProfile, {
  requiredRoles: ['user']
});

export const DELETE = withAuth(handleDeactivateAccount, {
  requiredRoles: ['user']
});
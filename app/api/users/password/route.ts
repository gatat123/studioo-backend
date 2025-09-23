import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, ApiResponse } from '@/lib/middleware/auth';
import bcrypt from 'bcryptjs';

/**
 * PUT /api/users/password
 * 비밀번호 변경
 */
async function handleChangePassword(request: NextRequest) {
  try {
    const user = (request as any).user;
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // 필수 필드 검증
    if (!currentPassword || !newPassword) {
      return ApiResponse.badRequest('Current password and new password are required');
    }

    // 비밀번호 길이 검증
    if (newPassword.length < 6) {
      return ApiResponse.badRequest('New password must be at least 6 characters long');
    }

    // 사용자 정보 조회 (비밀번호 포함)
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true }
    });

    if (!existingUser) {
      return ApiResponse.notFound('User not found');
    }

    // 현재 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(currentPassword, existingUser.passwordHash);
    if (!isPasswordValid) {
      return ApiResponse.badRequest('Current password is incorrect');
    }

    // 새 비밀번호와 현재 비밀번호가 같은지 확인
    const isSamePassword = await bcrypt.compare(newPassword, existingUser.passwordHash);
    if (isSamePassword) {
      return ApiResponse.badRequest('New password must be different from current password');
    }

    // 새 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 비밀번호 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        updatedAt: new Date()
      }
    });

    return ApiResponse.success({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    return ApiResponse.serverError('Failed to change password');
  }
}

export const PUT = withAuth(handleChangePassword);
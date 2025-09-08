import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export interface AuthenticatedRequest extends NextRequest {
  user: {
    id: string;
    username: string;
    nickname: string;
    email: string;
    profileImageUrl: string | null;
    isAdmin: boolean;
  };
}

/**
 * JWT 토큰 검증 미들웨어
 */
export async function verifyJWT(token: string) {
  try {
    if (!process.env.NEXTAUTH_SECRET) {
      throw new Error('NEXTAUTH_SECRET is not defined');
    }

    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET) as any;
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * 세션 기반 인증 미들웨어
 */
export async function authenticateUser(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return {
        success: false,
        error: 'Unauthorized - No valid session',
        status: 401
      };
    }

    // 사용자 활성 상태 확인
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        profileImageUrl: true,
        isAdmin: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return {
        success: false,
        error: 'Unauthorized - User not found or inactive',
        status: 401
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
        isAdmin: user.isAdmin
      }
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Internal server error during authentication',
      status: 500
    };
  }
}

/**
 * 역할 기반 접근 제어 (RBAC) 미들웨어
 */
export function requireRole(allowedRoles: ('admin' | 'user')[]) {
  return async (request: NextRequest, user: any) => {
    if (allowedRoles.includes('admin') && user.isAdmin) {
      return { success: true };
    }

    if (allowedRoles.includes('user')) {
      return { success: true };
    }

    return {
      success: false,
      error: 'Forbidden - Insufficient permissions',
      status: 403
    };
  };
}

/**
 * 스튜디오 소유자 검증
 */
export async function verifyStudioOwnership(userId: string, studioId?: string) {
  try {
    let studio;
    
    if (studioId) {
      // 특정 스튜디오 ID로 검증
      studio = await prisma.studio.findUnique({
        where: { id: studioId },
        select: { userId: true }
      });
    } else {
      // 사용자의 스튜디오 검증
      studio = await prisma.studio.findUnique({
        where: { userId },
        select: { userId: true }
      });
    }

    if (!studio || studio.userId !== userId) {
      return {
        success: false,
        error: 'Forbidden - Not the studio owner',
        status: 403
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Studio ownership verification error:', error);
    return {
      success: false,
      error: 'Internal server error during ownership verification',
      status: 500
    };
  }
}

/**
 * 프로젝트 접근 권한 검증
 */
export async function verifyProjectAccess(userId: string, projectId: string) {
  try {
    // 프로젝트 생성자이거나 참여자인지 확인
    const access = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: userId },
          {
            participants: {
              some: { userId }
            }
          }
        ]
      }
    });

    if (!access) {
      return {
        success: false,
        error: 'Forbidden - No access to this project',
        status: 403
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Project access verification error:', error);
    return {
      success: false,
      error: 'Internal server error during project access verification',
      status: 500
    };
  }
}

/**
 * 통합 인증 미들웨어 래퍼
 */
export function withAuth(handler: Function, options?: {
  requiredRoles?: ('admin' | 'user')[];
  requireStudioOwnership?: boolean;
  requireProjectAccess?: boolean;
}) {
  return async (request: NextRequest, context?: any) => {
    // 1. 기본 인증 확인
    const authResult = await authenticateUser(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const user = authResult.user!;

    // 2. 역할 기반 접근 제어
    if (options?.requiredRoles) {
      const roleCheck = await requireRole(options.requiredRoles)(request, user);
      if (!roleCheck.success) {
        return NextResponse.json(
          { error: roleCheck.error },
          { status: roleCheck.status }
        );
      }
    }

    // 3. 스튜디오 소유권 확인
    if (options?.requireStudioOwnership && context?.params?.id) {
      const ownershipCheck = await verifyStudioOwnership(user.id, context.params.id);
      if (!ownershipCheck.success) {
        return NextResponse.json(
          { error: ownershipCheck.error },
          { status: ownershipCheck.status }
        );
      }
    }

    // 4. 프로젝트 접근 권한 확인
    if (options?.requireProjectAccess && context?.params?.id) {
      const projectCheck = await verifyProjectAccess(user.id, context.params.id);
      if (!projectCheck.success) {
        return NextResponse.json(
          { error: projectCheck.error },
          { status: projectCheck.status }
        );
      }
    }

    // 인증된 사용자 정보를 request에 추가
    (request as any).user = user;

    // 핸들러 실행
    return handler(request, context);
  };
}

/**
 * API 응답 헬퍼
 */
export class ApiResponse {
  static success(data: any, status: number = 200) {
    return NextResponse.json(data, { status });
  }

  static error(message: string, status: number = 400, details?: any) {
    return NextResponse.json(
      { error: message, details },
      { status }
    );
  }

  static unauthorized(message: string = 'Unauthorized') {
    return NextResponse.json(
      { error: message },
      { status: 401 }
    );
  }

  static forbidden(message: string = 'Forbidden') {
    return NextResponse.json(
      { error: message },
      { status: 403 }
    );
  }

  static notFound(message: string = 'Not found') {
    return NextResponse.json(
      { error: message },
      { status: 404 }
    );
  }

  static serverError(message: string = 'Internal server error') {
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
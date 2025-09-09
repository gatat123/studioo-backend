import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, ApiResponse } from '@/lib/middleware/auth';

// 스튜디오 생성 스키마
const createStudioSchema = z.object({
  name: z.string()
    .min(2, 'Studio name must be at least 2 characters')
    .max(255, 'Studio name must be less than 255 characters'),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional()
});

// 스튜디오 검색 쿼리 스키마
const studioQuerySchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'projects']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

/**
 * GET /api/studios
 * 스튜디오 목록 조회 (관리자는 모든 스튜디오, 일반 사용자는 자신의 스튜디오만)
 */
async function handleGetStudios(request: NextRequest) {
  try {
    const user = (request as any).user;
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    // 쿼리 파라미터 검증
    const validation = studioQuerySchema.safeParse(queryParams);
    if (!validation.success) {
      return ApiResponse.error(
        'Invalid query parameters',
        400,
        validation.error.issues
      );
    }

    const { search, sortBy, sortOrder, page, limit } = validation.data;
    const skip = (page - 1) * limit;

    // 기본 where 조건
    let whereCondition: any = {};

    // 일반 사용자는 자신의 스튜디오만 조회
    if (!user.isAdmin) {
      whereCondition.userId = user.id;
    }

    // 검색 조건 추가
    if (search) {
      whereCondition.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // 정렬 조건 설정
    let orderBy: any = {};
    switch (sortBy) {
      case 'projects':
        orderBy = { projects: { _count: sortOrder } };
        break;
      default:
        orderBy[sortBy] = sortOrder;
        break;
    }

    // 스튜디오 목록 조회
    const [studios, totalCount] = await Promise.all([
      prisma.studio.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true
            }
          },
          projects: {
            select: {
              id: true,
              name: true,
              status: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: {
                  participants: true
                }
              }
            },
            orderBy: {
              updatedAt: 'desc'
            },
            take: 5 // 최근 프로젝트 5개만
          },
          _count: {
            select: {
              projects: true
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.studio.count({ where: whereCondition })
    ]);

    // 각 스튜디오에 대한 추가 통계 정보
    const studiosWithStats = await Promise.all(
      studios.map(async (studio) => {
        const stats = await prisma.studio.findUnique({
          where: { id: studio.id },
          select: {
            _count: {
              select: {
                projects: {
                  where: { status: 'active' }
                }
              }
            }
          }
        });

        // 최근 활동 정보
        const latestActivity = await prisma.project.findFirst({
          where: { studioId: studio.id },
          orderBy: { updatedAt: 'desc' },
          select: {
            updatedAt: true,
            name: true
          }
        });

        return {
          ...studio,
          stats: {
            totalProjects: studio._count.projects,
            activeProjects: stats?._count.projects || 0,
            latestActivity: latestActivity ? {
              projectName: latestActivity.name,
              lastUpdated: latestActivity.updatedAt
            } : null
          }
        };
      })
    );

    const totalPages = Math.ceil(totalCount / limit);

    return ApiResponse.success({
      studios: studiosWithStats,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get studios error:', error);
    return ApiResponse.serverError('Failed to retrieve studios');
  }
}

/**
 * POST /api/studios
 * 새 스튜디오 생성
 */
async function handleCreateStudio(request: NextRequest) {
  try {
    const user = (request as any).user;
    const body = await request.json();

    // 입력값 검증
    const validation = createStudioSchema.safeParse(body);
    if (!validation.success) {
      return ApiResponse.error(
        'Validation failed',
        400,
        validation.error.issues
      );
    }

    const { name, description } = validation.data;

    // 이미 스튜디오가 있는지 확인 (사용자당 하나의 스튜디오만 허용)
    const existingStudio = await prisma.studio.findUnique({
      where: { userId: user.id }
    });

    if (existingStudio) {
      return ApiResponse.error('User already has a studio');
    }

    // 스튜디오 이름 중복 검사
    const studioWithSameName = await prisma.studio.findFirst({
      where: { name }
    });

    if (studioWithSameName) {
      return ApiResponse.error('Studio name already exists');
    }

    // 새 스튜디오 생성
    const newStudio = await prisma.studio.create({
      data: {
        userId: user.id,
        name,
        description
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        _count: {
          select: {
            projects: true
          }
        }
      }
    });

    return ApiResponse.success({
      message: 'Studio created successfully',
      studio: {
        ...newStudio,
        stats: {
          totalProjects: 0,
          activeProjects: 0,
          latestActivity: null
        }
      }
    }, 201);

  } catch (error) {
    console.error('Create studio error:', error);
    return ApiResponse.serverError('Failed to create studio');
  }
}

// Route handlers with authentication
export const GET = withAuth(handleGetStudios, {
  requiredRoles: ['user']
});

export const POST = withAuth(handleCreateStudio, {
  requiredRoles: ['user']
});
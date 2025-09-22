import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, ApiResponse } from '@/lib/middleware/auth';

// 스튜디오 업데이트 스키마
const updateStudioSchema = z.object({
  name: z.string()
    .min(2, 'Studio name must be at least 2 characters')
    .max(255, 'Studio name must be less than 255 characters')
    .optional(),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional()
});

/**
 * GET /api/studios/[id]
 * 스튜디오 상세 정보 조회
 */
async function handleGetStudio(request: NextRequest, context: any) {
  try {
    const user = (request as any).user;
    const studioId = context.params.id;

    if (!studioId) {
      return ApiResponse.error('Studio ID is required');
    }

    // 스튜디오 조회
    const studio = await prisma.studio.findUnique({
      where: { id: studioId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
            createdAt: true
          }
        },
        projects: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            deadline: true,
            tag: true,
            hasUpdates: true,
            createdAt: true,
            updatedAt: true,
            creator: {
              select: {
                id: true,
                username: true,
                nickname: true
              }
            },
            _count: {
              select: {
                participants: true,
                scenes: true
              }
            }
          },
          orderBy: {
            updatedAt: 'desc'
          }
        },
        _count: {
          select: {
            projects: true
          }
        }
      }
    });

    if (!studio) {
      return ApiResponse.notFound('Studio not found');
    }

    // 권한 확인: 관리자가 아닌 경우 자신의 스튜디오만 조회 가능
    if (!user.isAdmin && studio.userId !== user.id) {
      return ApiResponse.forbidden('Access denied to this studio');
    }

    // 추가 통계 정보 계산
    const stats = {
      totalProjects: studio._count.projects,
      activeProjects: studio.projects.filter(p => p.status === 'active').length,
      completedProjects: studio.projects.filter(p => p.status === 'completed').length,
      onHoldProjects: studio.projects.filter(p => p.status === 'on_hold').length,
      totalScenes: studio.projects.reduce((sum, p) => sum + p._count.scenes, 0),
      // totalComments: 0, // Project model doesn't have comments relation
      totalParticipants: studio.projects.reduce((sum, p) => sum + p._count.participants, 0)
    };

    // 최근 활동
    const recentActivity = await prisma.collaborationLog.findMany({
      where: {
        project: {
          studioId: studio.id
        }
      },
      include: {
        user: {
          select: {
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        project: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    // 월별 프로젝트 생성 통계 (최근 12개월)
    const monthlyStats = await prisma.project.groupBy({
      by: ['createdAt'],
      where: {
        studioId: studio.id,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1)
        }
      },
      _count: {
        id: true
      }
    });

    return ApiResponse.success({
      studio: {
        ...studio,
        stats,
        recentActivity,
        monthlyStats
      }
    });

  } catch (error) {
    console.error('Get studio error:', error);
    return ApiResponse.serverError('Failed to retrieve studio');
  }
}

/**
 * PUT /api/studios/[id]
 * 스튜디오 정보 수정
 */
async function handleUpdateStudio(request: NextRequest, context: any) {
  try {
    const user = (request as any).user;
    const studioId = context.params.id;
    const body = await request.json();

    if (!studioId) {
      return ApiResponse.error('Studio ID is required');
    }

    // 입력값 검증
    const validation = updateStudioSchema.safeParse(body);
    if (!validation.success) {
      return ApiResponse.error(
        'Validation failed',
        400,
        validation.error.issues
      );
    }

    const { name, description } = validation.data;

    // 스튜디오 존재 여부 및 권한 확인
    const existingStudio = await prisma.studio.findUnique({
      where: { id: studioId },
      select: {
        userId: true,
        name: true
      }
    });

    if (!existingStudio) {
      return ApiResponse.notFound('Studio not found');
    }

    // 소유자 또는 관리자만 수정 가능
    if (!user.isAdmin && existingStudio.userId !== user.id) {
      return ApiResponse.forbidden('Only the studio owner can update this studio');
    }

    // 업데이트할 데이터 준비
    const updateData: any = {};

    if (name && name !== existingStudio.name) {
      // 스튜디오 이름 중복 검사
      const studioWithSameName = await prisma.studio.findFirst({
        where: {
          name,
          id: { not: studioId }
        }
      });

      if (studioWithSameName) {
        return ApiResponse.error('Studio name already exists');
      }

      updateData.name = name;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    // 업데이트할 내용이 없는 경우
    if (Object.keys(updateData).length === 0) {
      return ApiResponse.error('No updates provided');
    }

    // 스튜디오 업데이트
    const updatedStudio = await prisma.studio.update({
      where: { id: studioId },
      data: {
        ...updateData,
        updatedAt: new Date()
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

    // 협업 로그 기록 (스튜디오 레벨이므로 첫 번째 프로젝트를 사용)
    const firstProject = await prisma.project.findFirst({
      where: { studioId }
    });

    if (firstProject) {
      await prisma.collaborationLog.create({
        data: {
          projectId: firstProject.id,
          userId: user.id,
          action: 'studio_update',
          details: `Updated studio: ${name ? 'name changed' : ''}${description !== undefined ? ', description updated' : ''}`,
        }
      });
    }

    return ApiResponse.success({
      message: 'Studio updated successfully',
      studio: updatedStudio
    });

  } catch (error) {
    console.error('Update studio error:', error);
    return ApiResponse.serverError('Failed to update studio');
  }
}

/**
 * DELETE /api/studios/[id]
 * 스튜디오 삭제 (소프트 삭제)
 */
async function handleDeleteStudio(request: NextRequest, context: any) {
  try {
    const user = (request as any).user;
    const studioId = context.params.id;
    const body = await request.json();

    if (!studioId) {
      return ApiResponse.error('Studio ID is required');
    }

    // 삭제 확인 스키마
    const deleteSchema = z.object({
      confirmDelete: z.literal(true).refine(val => val === true, {
        message: 'Studio deletion confirmation required'
      })
    });

    const validation = deleteSchema.safeParse(body);
    if (!validation.success) {
      return ApiResponse.error(
        'Deletion confirmation required',
        400,
        validation.error.issues
      );
    }

    // 스튜디오 존재 여부 및 권한 확인
    const studio = await prisma.studio.findUnique({
      where: { id: studioId },
      select: {
        userId: true,
        name: true,
        _count: {
          select: {
            projects: true
          }
        }
      }
    });

    if (!studio) {
      return ApiResponse.notFound('Studio not found');
    }

    // 소유자 또는 관리자만 삭제 가능
    if (!user.isAdmin && studio.userId !== user.id) {
      return ApiResponse.forbidden('Only the studio owner can delete this studio');
    }

    // 활성 프로젝트가 있는 경우 삭제 방지
    const activeProjects = await prisma.project.count({
      where: {
        studioId,
        status: 'active'
      }
    });

    if (activeProjects > 0) {
      return ApiResponse.error(
        `Cannot delete studio with ${activeProjects} active project(s). Please complete or archive all projects first.`
      );
    }

    // 트랜잭션으로 스튜디오와 관련 데이터 삭제
    await prisma.$transaction(async (tx) => {
      // 프로젝트 참여자 정보 삭제
      await tx.projectParticipant.deleteMany({
        where: {
          project: {
            studioId
          }
        }
      });

      // UserPresence는 사용자별 전역 상태이므로 스튜디오 삭제 시에는 삭제하지 않음
      // await tx.userPresence.deleteMany() - 스킵

      // 협업 로그 삭제
      await tx.collaborationLog.deleteMany({
        where: {
          project: {
            studioId
          }
        }
      });

      // 알림 삭제
      await tx.notification.deleteMany({
        where: {
          project: {
            studioId
          }
        }
      });

      // 프로젝트 삭제 (CASCADE로 관련 데이터 자동 삭제)
      await tx.project.deleteMany({
        where: { studioId }
      });

      // 스튜디오 삭제
      await tx.studio.delete({
        where: { id: studioId }
      });
    });

    return ApiResponse.success({
      message: 'Studio deleted successfully'
    });

  } catch (error) {
    console.error('Delete studio error:', error);
    return ApiResponse.serverError('Failed to delete studio');
  }
}

// Route handlers with authentication
export const GET = withAuth(handleGetStudio, {
  requiredRoles: ['user']
});

export const PUT = withAuth(handleUpdateStudio, {
  requiredRoles: ['user'],
  requireStudioOwnership: true
});

export const DELETE = withAuth(handleDeleteStudio, {
  requiredRoles: ['user'],
  requireStudioOwnership: true
});
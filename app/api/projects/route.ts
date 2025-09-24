import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { createProjectSchema } from '@/lib/utils/validation';
import { generateInviteCode } from '@/lib/utils/inviteCode';
import { ApiResponse } from '@/types';
import { handleOptions } from '@/lib/utils/cors';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');
      const tag = searchParams.get('tag');
      const status = searchParams.get('status');
      const projectType = searchParams.get('type') || 'studio'; // 기본값은 'studio'

      console.log('[Backend API] GET /api/projects - Request params:', {
        page,
        limit,
        tag,
        status,
        projectType,
        userId: req.user.userId
      });

      // 사용자/참가자 필터링만 Prisma에서 처리 (projectType 필터링은 JavaScript로 이동)
      const where: any = {
        OR: [
          { creatorId: req.user.userId },
          {
            participants: {
              some: { userId: req.user.userId }
            }
          }
        ]
      };

      console.log('[Backend API] Prisma where clause:', JSON.stringify(where, null, 2));

      if (tag) where.tag = tag;
      if (status) where.status = status;

      // 먼저 모든 사용자 프로젝트를 가져옴 (페이지네이션 없이)
      const allUserProjects = await prisma.project.findMany({
        where,
        include: {
          studio: true,
          creator: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                  profileImageUrl: true,
                }
              }
            }
          },
          _count: {
            select: {
              scenes: true,
              comments: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      // JavaScript에서 projectType 필터링 수행
      let filteredProjects = allUserProjects;
      if (projectType === 'studio') {
        // Studio 타입: 'studio', null, 또는 빈 값인 프로젝트만
        filteredProjects = allUserProjects.filter(project =>
          project.projectType === 'studio' ||
          project.projectType === null ||
          project.projectType === ''
        );
      } else if (projectType === 'work') {
        // Work 타입: 정확히 'work'인 경우만
        filteredProjects = allUserProjects.filter(project => project.projectType === 'work');
      } else {
        // 기타 경우: 해당 타입과 일치하는 경우만
        filteredProjects = allUserProjects.filter(project => project.projectType === projectType);
      }

      // 필터링된 결과에서 페이지네이션 적용
      const total = filteredProjects.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const projects = filteredProjects.slice(startIndex, endIndex);

      // Debug: 필터링 과정 로깅
      console.log('[Backend API] All user projects count:', allUserProjects.length);
      console.log('[Backend API] Filtered projects count:', filteredProjects.length);
      console.log('[Backend API] Projects on current page:', projects.length);

      console.log('[Backend API] Found projects:', projects.map(p => ({
        id: p.id,
        name: p.name,
        projectType: p.projectType
      })));
      console.log('[Backend API] Total filtered projects:', total);

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          projects,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error('Projects fetch error:', error);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }
});

export const POST = withAuth(async (req: AuthenticatedRequest) => {
    try {
      const body = await req.json();

      // Convert snake_case to camelCase for validation
      const validationBody = {
        ...body,
        projectType: body.project_type || body.projectType || 'studio'
      };
      delete validationBody.project_type; // Remove snake_case version

      console.log('[Backend API] POST /api/projects - Request body:', body);
      console.log('[Backend API] Validation body:', validationBody);

      const validationResult = createProjectSchema.safeParse(validationBody);

      if (!validationResult.success) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: 'Validation failed',
            message: validationResult.error.issues[0].message,
          },
          { status: 400 }
        );
      }

      const { name, description, deadline, tag, projectType = 'studio' } = validationResult.data;

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { studio: true },
      });

      if (!user?.studio) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Studio not found' },
          { status: 404 }
        );
      }

      console.log('[Backend API] Creating project with data:', {
        name,
        description,
        projectType,
        deadline,
        tag,
      });

      const project = await prisma.project.create({
        data: {
          studioId: user.studio.id,
          creatorId: req.user.userId,
          name,
          description,
          projectType,
          deadline: deadline ? new Date(deadline) : undefined,
          tag,
          inviteCode: generateInviteCode(),
        },
        include: {
          studio: true,
          creator: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            }
          },
        },
      });

      console.log('[Backend API] Created project:', {
        id: project.id,
        name: project.name,
        projectType: project.projectType,
      });

      await prisma.projectParticipant.create({
        data: {
          projectId: project.id,
          userId: req.user.userId,
          role: 'owner',
        },
      });

      await prisma.collaborationLog.create({
        data: {
          projectId: project.id,
          userId: req.user.userId,
          actionType: 'PROJECT_CREATED',
          targetType: 'project',
          targetId: project.id,
          description: `Created project: ${name}`,
        },
      });

      return NextResponse.json<ApiResponse>(
        {
          success: true,
          data: project,
          message: 'Project created successfully',
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Project creation error:', error);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to create project' },
        { status: 500 }
      );
    }
});

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
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

      if (tag) where.tag = tag;
      if (status) where.status = status;

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
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
              }
            }
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.project.count({ where }),
      ]);

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
      const validationResult = createProjectSchema.safeParse(body);

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

      const { name, description, deadline, tag } = validationResult.data;

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

      const project = await prisma.project.create({
        data: {
          studioId: user.studio.id,
          creatorId: req.user.userId,
          name,
          description,
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
          action: 'PROJECT_CREATED',
          details: `Created project: ${name}`,
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
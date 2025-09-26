import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { handleOptions } from '@/lib/utils/cors';
import { generateInviteCode } from '@/lib/utils/inviteCode';
import { ApiResponse } from '@/types';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    console.log('[Work Tasks API] GET /api/work-tasks - Request params:', {
      page,
      limit,
      status,
      priority,
      userId: req.user.userId
    });

    // Only show work tasks where user is creator or participant
    const where: any = {
      OR: [
        { createdById: req.user.userId },
        {
          participants: {
            some: { userId: req.user.userId }
          }
        }
      ]
    };

    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [workTasks, total] = await Promise.all([
      prisma.workTask.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          createdBy: {
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
          comments: {
            orderBy: { createdAt: 'desc' },
            take: 5,
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
          subTasks: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                  profileImageUrl: true,
                }
              },
              assignee: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                  profileImageUrl: true,
                }
              }
            },
            orderBy: [
              { position: 'asc' },
              { createdAt: 'asc' }
            ]
          },
          _count: {
            select: {
              comments: true,
              participants: true,
              subTasks: true,
            }
          }
        },
        orderBy: [
          { position: 'asc' },
          { createdAt: 'desc' }
        ],
      }),
      prisma.workTask.count({ where })
    ]);

    console.log('[Work Tasks API] Found work tasks:', workTasks.length);

    // Debug: Log subtasks for each work task
    workTasks.forEach(wt => {
      console.log(`[Work Tasks API] WorkTask ${wt.id} has ${wt.subTasks?.length || 0} subtasks`);
      if (wt.subTasks && wt.subTasks.length > 0) {
        wt.subTasks.forEach(st => {
          console.log(`  - SubTask: ${st.id} - ${st.title} (${st.status})`);
        });
      }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        workTasks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Work tasks fetch error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch work tasks' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();

    console.log('[Work Tasks API] POST /api/work-tasks - Request body:', body);

    const {
      title,
      description,
      priority = 'medium',
      dueDate,
      assigneeId,
      tags
    } = body;

    if (!title) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    // Get the current max position
    const maxPosition = await prisma.workTask.aggregate({
      _max: { position: true }
    });

    const workTask = await prisma.workTask.create({
      data: {
        title,
        description,
        status: 'pending',
        priority,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        createdById: req.user.userId,
        assigneeId: assigneeId || req.user.userId,
        position: (maxPosition._max.position || 0) + 1,
        inviteCode: generateInviteCode(),
        tags: tags || [],
      },
      include: {
        createdBy: {
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
        subTasks: {
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true,
              }
            },
            assignee: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true,
              }
            }
          },
          orderBy: [
            { position: 'asc' },
            { createdAt: 'asc' }
          ]
        },
      },
    });

    // Add creator as participant
    await prisma.workTaskParticipant.create({
      data: {
        workTaskId: workTask.id,
        userId: req.user.userId,
        role: 'creator',
      },
    });

    // Add assignee as participant if different from creator
    if (assigneeId && assigneeId !== req.user.userId) {
      await prisma.workTaskParticipant.create({
        data: {
          workTaskId: workTask.id,
          userId: assigneeId,
          role: 'assignee',
        },
      });
    }

    console.log('[Work Tasks API] Created work task:', {
      id: workTask.id,
      title: workTask.title,
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: workTask,
        message: 'Work task created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Work task creation error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to create work task' },
      { status: 500 }
    );
  }
});

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
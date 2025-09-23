import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';

// GET /api/tasks/[projectId] - Get all tasks for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is a participant of the project
    const participant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: params.projectId,
          userId: user.id,
        },
      },
    });

    if (!participant && !user.isAdmin) {
      return NextResponse.json(
        { error: 'You are not a member of this project' },
        { status: 403 }
      );
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const assigneeId = searchParams.get('assigneeId');
    const parentTaskId = searchParams.get('parentTaskId');
    const includeSubtasks = searchParams.get('includeSubtasks') === 'true';

    // Build where clause
    const where: any = {
      projectId: params.projectId,
    };

    if (status) {
      where.status = status;
    }

    if (assigneeId) {
      where.assignments = {
        some: {
          userId: assigneeId,
        },
      };
    }

    if (parentTaskId === 'null') {
      where.parentTaskId = null;
    } else if (parentTaskId) {
      where.parentTaskId = parentTaskId;
    } else if (!includeSubtasks) {
      where.parentTaskId = null;
    }

    // Fetch tasks
    const tasks = await prisma.task.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true,
              },
            },
          },
        },
        parentTask: {
          select: {
            id: true,
            title: true,
          },
        },
        subTasks: includeSubtasks ? {
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true,
              },
            },
            assignments: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    nickname: true,
                    profileImageUrl: true,
                  },
                },
              },
            },
            _count: {
              select: {
                todos: true,
                comments: true,
              },
            },
          },
        } : false,
        _count: {
          select: {
            todos: true,
            comments: true,
            subTasks: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { position: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Group tasks by status for kanban board
    const tasksByStatus = {
      todo: tasks.filter(t => t.status === 'todo'),
      in_progress: tasks.filter(t => t.status === 'in_progress'),
      review: tasks.filter(t => t.status === 'review'),
      done: tasks.filter(t => t.status === 'done'),
    };

    return NextResponse.json({
      data: {
        tasks,
        tasksByStatus,
        total: tasks.length,
      },
    });
  } catch (error) {
    console.error('[Tasks API] Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
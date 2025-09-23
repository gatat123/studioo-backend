import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { emitToRoom, TASK_EVENTS } from '@/lib/socket/emit';

// Validation schema for updating a task
const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

// GET /api/tasks/[id] - Get a specific task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
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
        subTasks: {
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
                nickname: true,
              },
            },
            assignments: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    nickname: true,
                  },
                },
              },
            },
          },
        },
        todos: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
              },
            },
          },
          orderBy: {
            position: 'asc',
          },
        },
        comments: {
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
          orderBy: {
            createdAt: 'desc',
          },
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
        },
        _count: {
          select: {
            todos: true,
            comments: true,
            subTasks: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if user is a participant of the project
    const participant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
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

    return NextResponse.json({ data: task });
  } catch (error) {
    console.error('[Tasks API] Error fetching task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/tasks/[id] - Update a task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: id },
      select: {
        id: true,
        projectId: true,
        status: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if user is a participant of the project
    const participant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
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

    const body = await request.json();
    const validatedData = updateTaskSchema.parse(body);

    const oldStatus = task.status;
    const updatedTask = await prisma.task.update({
      where: { id: id },
      data: {
        title: validatedData.title,
        description: validatedData.description,
        status: validatedData.status,
        priority: validatedData.priority,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : undefined,
        tags: validatedData.tags,
        completedAt: validatedData.status === 'done' && oldStatus !== 'done'
          ? new Date()
          : validatedData.status !== 'done'
          ? null
          : undefined,
      },
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
        subTasks: true,
        _count: {
          select: {
            todos: true,
            comments: true,
          },
        },
      },
    });

    // Create activity log
    const changes: any = {};
    if (validatedData.title) changes.title = validatedData.title;
    if (validatedData.status && validatedData.status !== oldStatus) {
      changes.status = { from: oldStatus, to: validatedData.status };
    }
    if (validatedData.priority) changes.priority = validatedData.priority;

    await prisma.taskActivity.create({
      data: {
        taskId: id,
        userId: user.id,
        action: 'updated',
        details: changes,
      },
    });

    // Emit socket event
    emitToRoom(`project:${task.projectId}`, TASK_EVENTS.UPDATED, updatedTask);

    if (validatedData.status && validatedData.status !== oldStatus) {
      emitToRoom(`project:${task.projectId}`, TASK_EVENTS.STATUS_CHANGED, {
        taskId: id,
        oldStatus,
        newStatus: validatedData.status,
        task: updatedTask,
      });
    }

    return NextResponse.json({ data: updatedTask });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[Tasks API] Error updating task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] - Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: id },
      select: {
        id: true,
        projectId: true,
        createdById: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if user is the creator or admin
    if (task.createdById !== user.id && !user.isAdmin) {
      // Check if user is a project admin
      const participant = await prisma.projectParticipant.findUnique({
        where: {
          projectId_userId: {
            projectId: task.projectId,
            userId: user.id,
          },
        },
      });

      if (!participant || participant.role !== 'admin') {
        return NextResponse.json(
          { error: 'You do not have permission to delete this task' },
          { status: 403 }
        );
      }
    }

    // Delete the task (cascade will handle related records)
    await prisma.task.delete({
      where: { id: id },
    });

    // Emit socket event
    emitToRoom(`project:${task.projectId}`, TASK_EVENTS.DELETED, { taskId: id });

    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('[Tasks API] Error deleting task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
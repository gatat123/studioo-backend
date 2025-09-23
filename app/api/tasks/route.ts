import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { emitToRoom, TASK_EVENTS } from '@/lib/socket/emit';

// Validation schema for creating a task
const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().datetime().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  tags: z.array(z.string()).default([]),
  assigneeIds: z.array(z.string().uuid()).optional(),
  parentTaskId: z.string().uuid().optional(),
});

// POST /api/tasks - Create new task
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createTaskSchema.parse(body);

    // Check if user is a participant of the project
    const participant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: validatedData.projectId,
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

    // Get the highest position for ordering
    const highestPosition = await prisma.task.findFirst({
      where: {
        projectId: validatedData.projectId,
        status: validatedData.status,
      },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const newPosition = (highestPosition?.position ?? -1) + 1;

    // Create the task
    const task = await prisma.task.create({
      data: {
        projectId: validatedData.projectId,
        title: validatedData.title,
        description: validatedData.description,
        status: validatedData.status,
        priority: validatedData.priority,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        tags: validatedData.tags,
        position: newPosition,
        createdById: user.id,
        parentTaskId: validatedData.parentTaskId,
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

    // Create task assignments if assigneeIds provided
    if (validatedData.assigneeIds && validatedData.assigneeIds.length > 0) {
      await prisma.taskAssignment.createMany({
        data: validatedData.assigneeIds.map((userId) => ({
          taskId: task.id,
          userId,
          role: 'assignee',
        })),
      });

      // Fetch updated task with assignments
      const updatedTask = await prisma.task.findUnique({
        where: { id: task.id },
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

      // Create task activity log
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          userId: user.id,
          action: 'created',
          details: {
            title: task.title,
            status: task.status,
            priority: task.priority,
          },
        },
      });

      // Emit socket event
      emitToRoom(`project:${validatedData.projectId}`, TASK_EVENTS.CREATED, updatedTask);

      return NextResponse.json({ data: updatedTask }, { status: 201 });
    }

    // Create task activity log
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId: user.id,
        action: 'created',
        details: {
          title: task.title,
          status: task.status,
          priority: task.priority,
        },
      },
    });

    // Emit socket event
    emitToRoom(`project:${validatedData.projectId}`, TASK_EVENTS.CREATED, task);

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Tasks API] Error creating task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
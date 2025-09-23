import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { emitToRoom, TASK_EVENTS } from '@/lib/socket/emit';

const updateStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'review', 'done']),
});

// PATCH /api/tasks/[id]/status - Update task status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status } = updateStatusSchema.parse(body);

    const task = await prisma.task.findUnique({
      where: { id: id },
      select: {
        id: true,
        projectId: true,
        status: true,
        title: true,
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

    const oldStatus = task.status;

    // Update the task status
    const updatedTask = await prisma.task.update({
      where: { id: id },
      data: {
        status,
        completedAt: status === 'done' && oldStatus !== 'done'
          ? new Date()
          : status !== 'done'
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
        _count: {
          select: {
            todos: true,
            comments: true,
            subTasks: true,
          },
        },
      },
    });

    // Create activity log
    await prisma.taskActivity.create({
      data: {
        taskId: id,
        userId: user.id,
        action: 'status_changed',
        details: {
          from: oldStatus,
          to: status,
          taskTitle: task.title,
        },
      },
    });

    // Emit socket events
    emitToRoom(`project:${task.projectId}`, TASK_EVENTS.STATUS_CHANGED, {
      taskId: id,
      oldStatus,
      newStatus: status,
      task: updatedTask,
    });

    return NextResponse.json({ data: updatedTask });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid status value', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[Tasks API] Error updating task status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
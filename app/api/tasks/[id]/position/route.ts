import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { emitToRoom, TASK_EVENTS } from '@/lib/socket/emit';

const updatePositionSchema = z.object({
  position: z.number().int().min(0),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
});

// PATCH /api/tasks/[id]/position - Update task position (for drag and drop)
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
    const { position, status } = updatePositionSchema.parse(body);

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        position: true,
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

    const targetStatus = status || task.status;
    const oldPosition = task.position;
    const oldStatus = task.status;

    // Begin transaction to update positions
    const updatedTask = await prisma.$transaction(async (tx) => {
      // If status is changing, we need to reorder tasks in both columns
      if (status && status !== task.status) {
        // Reorder tasks in the old column
        await tx.task.updateMany({
          where: {
            projectId: task.projectId,
            status: task.status,
            position: {
              gt: oldPosition,
            },
          },
          data: {
            position: {
              decrement: 1,
            },
          },
        });

        // Make room in the new column
        await tx.task.updateMany({
          where: {
            projectId: task.projectId,
            status: status,
            position: {
              gte: position,
            },
          },
          data: {
            position: {
              increment: 1,
            },
          },
        });
      } else {
        // Moving within the same column
        if (position > oldPosition) {
          // Moving down
          await tx.task.updateMany({
            where: {
              projectId: task.projectId,
              status: targetStatus,
              position: {
                gt: oldPosition,
                lte: position,
              },
            },
            data: {
              position: {
                decrement: 1,
              },
            },
          });
        } else if (position < oldPosition) {
          // Moving up
          await tx.task.updateMany({
            where: {
              projectId: task.projectId,
              status: targetStatus,
              position: {
                gte: position,
                lt: oldPosition,
              },
            },
            data: {
              position: {
                increment: 1,
              },
            },
          });
        }
      }

      // Update the task itself
      return await tx.task.update({
        where: { id },
        data: {
          position,
          status: targetStatus,
          completedAt: targetStatus === 'done' && oldStatus !== 'done'
            ? new Date()
            : targetStatus !== 'done' && oldStatus === 'done'
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
    });

    // Create activity log
    const details: any = {
      fromPosition: oldPosition,
      toPosition: position,
    };

    if (status && status !== oldStatus) {
      details.fromStatus = oldStatus;
      details.toStatus = status;
    }

    await prisma.taskActivity.create({
      data: {
        taskId: id,
        userId: user.id,
        action: 'position_changed',
        details,
      },
    });

    // Emit socket event
    emitToRoom(`project:${task.projectId}`, TASK_EVENTS.POSITION_CHANGED, {
      taskId: id,
      oldPosition,
      newPosition: position,
      oldStatus,
      newStatus: targetStatus,
      task: updatedTask,
    });

    return NextResponse.json({ data: updatedTask });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Tasks API] Error updating task position:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
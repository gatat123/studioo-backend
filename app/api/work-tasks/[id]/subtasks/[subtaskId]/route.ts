import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


// PATCH /api/work-tasks/[id]/subtasks/[subtaskId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: workTaskId, subtaskId } = await params;
    const body = await request.json();

    // Verify subtask exists and user has access
    const subtask = await prisma.subTask.findFirst({
      where: {
        id: subtaskId,
        workTaskId,
        workTask: {
          OR: [
            { createdById: session.user.id },
            {
              participants: {
                some: { userId: session.user.id }
              }
            }
          ]
        }
      }
    });

    if (!subtask) {
      return NextResponse.json(
        { error: 'Subtask not found' },
        { status: 404 }
      );
    }

    // Handle position update for drag and drop
    if (body.status !== undefined && body.position !== undefined) {
      // If status changed, update positions in both columns
      if (subtask.status !== body.status) {
        // Update positions in old column
        await prisma.subTask.updateMany({
          where: {
            workTaskId,
            status: subtask.status,
            position: { gt: subtask.position }
          },
          data: {
            position: { decrement: 1 }
          }
        });

        // Update positions in new column
        await prisma.subTask.updateMany({
          where: {
            workTaskId,
            status: body.status,
            position: { gte: body.position }
          },
          data: {
            position: { increment: 1 }
          }
        });
      } else {
        // Same column, just reorder
        if (body.position < subtask.position) {
          await prisma.subTask.updateMany({
            where: {
              workTaskId,
              status: subtask.status,
              position: {
                gte: body.position,
                lt: subtask.position
              }
            },
            data: {
              position: { increment: 1 }
            }
          });
        } else if (body.position > subtask.position) {
          await prisma.subTask.updateMany({
            where: {
              workTaskId,
              status: subtask.status,
              position: {
                gt: subtask.position,
                lte: body.position
              }
            },
            data: {
              position: { decrement: 1 }
            }
          });
        }
      }
    }

    // Update subtask
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.position !== undefined) updateData.position = body.position;
    if (body.assigneeId !== undefined) updateData.assigneeId = body.assigneeId;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.status === 'done' && !subtask.completedAt) {
      updateData.completedAt = new Date();
    } else if (body.status !== 'done' && subtask.completedAt) {
      updateData.completedAt = null;
    }

    const updatedSubtask = await prisma.subTask.update({
      where: { id: subtaskId },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        assignee: {
          select: {
            id: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        comments: {
          select: { id: true }
        }
      }
    });

    // Socket events removed - can be added later if needed

    return NextResponse.json(updatedSubtask);
  } catch (error) {
    console.error('Error updating subtask:', error);
    return NextResponse.json(
      { error: 'Failed to update subtask' },
      { status: 500 }
    );
  }
}

// DELETE /api/work-tasks/[id]/subtasks/[subtaskId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: workTaskId, subtaskId } = await params;

    // Verify subtask exists and user has access
    const subtask = await prisma.subTask.findFirst({
      where: {
        id: subtaskId,
        workTaskId,
        workTask: {
          OR: [
            { createdById: session.user.id },
            {
              participants: {
                some: { userId: session.user.id }
              }
            }
          ]
        }
      }
    });

    if (!subtask) {
      return NextResponse.json(
        { error: 'Subtask not found' },
        { status: 404 }
      );
    }

    // Delete subtask
    await prisma.subTask.delete({
      where: { id: subtaskId }
    });

    // Update positions of remaining subtasks
    await prisma.subTask.updateMany({
      where: {
        workTaskId,
        status: subtask.status,
        position: { gt: subtask.position }
      },
      data: {
        position: { decrement: 1 }
      }
    });

    // Socket events removed - can be added later if needed

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subtask:', error);
    return NextResponse.json(
      { error: 'Failed to delete subtask' },
      { status: 500 }
    );
  }
}
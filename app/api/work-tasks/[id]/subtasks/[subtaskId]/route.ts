import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { handleOptions } from '@/lib/utils/cors';
import { getSocketInstance } from '@/lib/socket/server';

// PATCH /api/work-tasks/[id]/subtasks/[subtaskId]
export const PATCH = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { id: string; subtaskId: string } }
) => {
  try {
    const { id: workTaskId, subtaskId } = params;
    const body = await req.json();

    // Verify subtask exists and user has access
    const subtask = await prisma.subTask.findFirst({
      where: {
        id: subtaskId,
        workTaskId,
        workTask: {
          OR: [
            { createdById: req.user.userId },
            {
              participants: {
                some: { userId: req.user.userId }
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

    // Store previous status for status change events
    const previousStatus = subtask.status;

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

    // Emit socket event for real-time updates
    const io = getSocketInstance();
    if (io) {
      const roomId = `work-task:${workTaskId}`;

      // Check how many clients are in the room
      const room = io.sockets.adapter.rooms.get(roomId);
      const clientCount = room ? room.size : 0;
      console.log(`[Socket] Room ${roomId} has ${clientCount} clients`);

      // Emit general update event
      const updateEventData = {
        subtask: updatedSubtask,
        workTaskId,
        timestamp: new Date()
      };

      io.to(roomId).emit('subtask:updated', updateEventData);
      console.log(`[Socket] Emitted subtask:updated to room ${roomId}:`, {
        subtaskId: updatedSubtask.id,
        title: updatedSubtask.title,
        status: updatedSubtask.status,
        position: updatedSubtask.position,
        clientCount
      });

      // If status changed, emit specific status change event
      if (body.status && body.status !== previousStatus) {
        const statusEventData = {
          subtask: updatedSubtask,
          previousStatus,
          newStatus: body.status,
          workTaskId,
          timestamp: new Date()
        };

        io.to(roomId).emit('subtask:status-changed', statusEventData);
        console.log(`[Socket] Emitted subtask:status-changed to room ${roomId}:`, {
          subtaskId: updatedSubtask.id,
          previousStatus,
          newStatus: body.status,
          clientCount
        });
      }
    } else {
      console.error('[Socket] Socket.IO instance not available');
    }

    return NextResponse.json({
      success: true,
      data: updatedSubtask
    });
  } catch (error) {
    console.error('Error updating subtask:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update subtask' },
      { status: 500 }
    );
  }
});

// DELETE /api/work-tasks/[id]/subtasks/[subtaskId]
export const DELETE = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { id: string; subtaskId: string } }
) => {
  try {
    const { id: workTaskId, subtaskId } = params;

    // Verify subtask exists and user has access
    const subtask = await prisma.subTask.findFirst({
      where: {
        id: subtaskId,
        workTaskId,
        workTask: {
          OR: [
            { createdById: req.user.userId },
            {
              participants: {
                some: { userId: req.user.userId }
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

    // Emit socket event for real-time updates
    const io = getSocketInstance();
    if (io) {
      const roomId = `work-task:${workTaskId}`;

      // Check how many clients are in the room
      const room = io.sockets.adapter.rooms.get(roomId);
      const clientCount = room ? room.size : 0;

      const deleteEventData = {
        subtaskId,
        workTaskId,
        timestamp: new Date()
      };

      io.to(roomId).emit('subtask:deleted', deleteEventData);
      console.log(`[Socket] Emitted subtask:deleted to room ${roomId}:`, {
        subtaskId,
        workTaskId,
        clientCount
      });
    } else {
      console.error('[Socket] Socket.IO instance not available for deletion');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subtask:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete subtask' },
      { status: 500 }
    );
  }
});

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
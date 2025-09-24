import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { handleOptions } from '@/lib/utils/cors';
import { getSocketInstance } from '@/lib/socket/server';
import { ApiResponse } from '@/types';

// PATCH /api/work-tasks/[id]/subtasks/[subtaskId]/comments/[commentId]
export const PATCH = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { id: string; subtaskId: string; commentId: string } }
) => {
  try {
    const { id: workTaskId, subtaskId, commentId } = params;
    const body = await req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    // Verify comment exists, user owns it, and has access to the work task
    const comment = await prisma.subTaskComment.findFirst({
      where: {
        id: commentId,
        subTaskId: subtaskId,
        userId: req.user.userId, // Only comment owner can edit
        isDeleted: false,
        subTask: {
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
      },
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
    });

    if (!comment) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Comment not found or access denied' },
        { status: 404 }
      );
    }

    // Update comment
    const updatedComment = await prisma.subTaskComment.update({
      where: { id: commentId },
      data: {
        content: content.trim(),
        isEdited: true,
        updatedAt: new Date(),
      },
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
    });

    // Emit socket event for real-time updates
    const io = getSocketInstance();
    if (io) {
      const roomId = `work-task:${workTaskId}`;
      io.to(roomId).emit('subtask-comment:updated', {
        comment: updatedComment,
        subtaskId,
        workTaskId,
        timestamp: new Date()
      });
      console.log(`[Socket] Emitted subtask-comment:updated to room ${roomId}`);
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedComment,
      message: 'Subtask comment updated successfully',
    });
  } catch (error) {
    console.error('Subtask comment update error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to update subtask comment' },
      { status: 500 }
    );
  }
});

// DELETE /api/work-tasks/[id]/subtasks/[subtaskId]/comments/[commentId]
export const DELETE = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { id: string; subtaskId: string; commentId: string } }
) => {
  try {
    const { id: workTaskId, subtaskId, commentId } = params;

    // Verify comment exists and user owns it or has admin rights
    const comment = await prisma.subTaskComment.findFirst({
      where: {
        id: commentId,
        subTaskId: subtaskId,
        isDeleted: false,
        subTask: {
          workTaskId,
          workTask: {
            OR: [
              { createdById: req.user.userId }, // Work task creator can delete any comment
              {
                participants: {
                  some: { userId: req.user.userId }
                }
              }
            ]
          }
        }
      },
      include: {
        subTask: {
          include: {
            workTask: {
              select: { createdById: true }
            }
          }
        }
      }
    });

    if (!comment) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Comment not found or access denied' },
        { status: 404 }
      );
    }

    // Check if user can delete this comment (owner or work task creator)
    const canDelete = comment.userId === req.user.userId ||
                     comment.subTask.workTask.createdById === req.user.userId;

    if (!canDelete) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Soft delete comment
    await prisma.subTaskComment.update({
      where: { id: commentId },
      data: {
        isDeleted: true,
        content: '[deleted]',
        updatedAt: new Date(),
      }
    });

    // Emit socket event for real-time updates
    const io = getSocketInstance();
    if (io) {
      const roomId = `work-task:${workTaskId}`;
      io.to(roomId).emit('subtask-comment:deleted', {
        commentId,
        subtaskId,
        workTaskId,
        timestamp: new Date()
      });
      console.log(`[Socket] Emitted subtask-comment:deleted to room ${roomId}`);
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Subtask comment deleted successfully',
    });
  } catch (error) {
    console.error('Subtask comment deletion error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to delete subtask comment' },
      { status: 500 }
    );
  }
});

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
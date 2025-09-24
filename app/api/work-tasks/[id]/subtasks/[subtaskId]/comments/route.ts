import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { handleOptions } from '@/lib/utils/cors';
import { getSocketInstance } from '@/lib/socket/server';
import { ApiResponse } from '@/types';

// GET /api/work-tasks/[id]/subtasks/[subtaskId]/comments
export const GET = withAuth(async (
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
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Subtask not found or access denied' },
        { status: 404 }
      );
    }

    // Fetch comments for this subtask
    const comments = await prisma.subTaskComment.findMany({
      where: {
        subTaskId: subtaskId,
        isDeleted: false
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
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error('Subtask comments fetch error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch subtask comments' },
      { status: 500 }
    );
  }
});

// POST /api/work-tasks/[id]/subtasks/[subtaskId]/comments
export const POST = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { id: string; subtaskId: string } }
) => {
  try {
    const { id: workTaskId, subtaskId } = params;
    const body = await req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

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
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Subtask not found or access denied' },
        { status: 404 }
      );
    }

    // Create comment
    const comment = await prisma.subTaskComment.create({
      data: {
        subTaskId: subtaskId,
        userId: req.user.userId,
        content: content.trim(),
        isEdited: false,
        isDeleted: false,
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
      io.to(roomId).emit('subtask-comment:created', {
        comment,
        subtaskId,
        workTaskId,
        timestamp: new Date()
      });
      console.log(`[Socket] Emitted subtask-comment:created to room ${roomId}`);
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: comment,
      message: 'Subtask comment added successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Subtask comment creation error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to create subtask comment' },
      { status: 500 }
    );
  }
});

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
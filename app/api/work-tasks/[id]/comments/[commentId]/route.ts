import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { handleOptions } from '@/lib/utils/cors';
import { ApiResponse } from '@/types';

export const PATCH = withAuth(async (req: AuthenticatedRequest, { params }: { params: { id: string, commentId: string } }) => {
  try {
    const body = await req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    const comment = await prisma.workTaskComment.findUnique({
      where: { id: params.commentId },
    });

    if (!comment) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Only comment owner can edit
    if (comment.userId !== req.user.userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the comment author can edit this comment' },
        { status: 403 }
      );
    }

    const updatedComment = await prisma.workTaskComment.update({
      where: { id: params.commentId },
      data: {
        content: content.trim(),
        isEdited: true,
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

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedComment,
      message: 'Comment updated successfully',
    });
  } catch (error) {
    console.error('Comment update error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to update comment' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (req: AuthenticatedRequest, { params }: { params: { id: string, commentId: string } }) => {
  try {
    const comment = await prisma.workTaskComment.findUnique({
      where: { id: params.commentId },
    });

    if (!comment) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Check if user can delete (comment owner or work task creator)
    const workTask = await prisma.workTask.findUnique({
      where: { id: params.id },
    });

    if (!workTask) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Work task not found' },
        { status: 404 }
      );
    }

    const canDelete = comment.userId === req.user.userId ||
                      workTask.createdById === req.user.userId;

    if (!canDelete) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Soft delete
    await prisma.workTaskComment.update({
      where: { id: params.commentId },
      data: { isDeleted: true }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Comment deletion error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
});

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { handleOptions } from '@/lib/utils/cors';
import { ApiResponse } from '@/types';

export const GET = withAuth(async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const workTask = await prisma.workTask.findUnique({
      where: { id: params.id },
      include: {
        participants: true,
      }
    });

    if (!workTask) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Work task not found' },
        { status: 404 }
      );
    }

    // Check if user has access
    const hasAccess = workTask.createdById === req.user.userId ||
      workTask.participants.some(p => p.userId === req.user.userId);

    if (!hasAccess) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const comments = await prisma.workTaskComment.findMany({
      where: {
        workTaskId: params.id,
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
    console.error('Comments fetch error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const body = await req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    const workTask = await prisma.workTask.findUnique({
      where: { id: params.id },
      include: {
        participants: true,
      }
    });

    if (!workTask) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Work task not found' },
        { status: 404 }
      );
    }

    // Check if user has access
    const hasAccess = workTask.createdById === req.user.userId ||
      workTask.participants.some(p => p.userId === req.user.userId);

    if (!hasAccess) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const comment = await prisma.workTaskComment.create({
      data: {
        workTaskId: params.id,
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

    return NextResponse.json<ApiResponse>({
      success: true,
      data: comment,
      message: 'Comment added successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Comment creation error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to create comment' },
      { status: 500 }
    );
  }
});

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
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
        createdBy: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          }
        },
        participants: {
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
        },
        comments: {
          orderBy: { createdAt: 'desc' },
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
        },
        subTasks: {
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true,
              }
            },
            assignee: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true,
              }
            }
          },
          orderBy: [
            { position: 'asc' },
            { createdAt: 'asc' }
          ]
        },
        _count: {
          select: {
            comments: true,
            participants: true,
            subTasks: true,
          }
        }
      },
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

    return NextResponse.json<ApiResponse>({
      success: true,
      data: workTask,
    });
  } catch (error) {
    console.error('Work task fetch error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch work task' },
      { status: 500 }
    );
  }
});

export const PATCH = withAuth(async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const body = await req.json();

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

    // Check if user has access to update
    const hasAccess = workTask.createdById === req.user.userId ||
      workTask.participants.some(p => p.userId === req.user.userId && p.role !== 'viewer');

    if (!hasAccess) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assigneeId,
      tags,
      position
    } = body;

    const updatedWorkTask = await prisma.workTask.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(tags !== undefined && { tags }),
        ...(position !== undefined && { position }),
        ...(status === 'completed' && { completedAt: new Date() }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          }
        },
        participants: {
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
        },
      },
    });

    // If assignee changed, update participants
    if (assigneeId && assigneeId !== workTask.assigneeId) {
      // Check if new assignee is already a participant
      const existingParticipant = await prisma.workTaskParticipant.findFirst({
        where: {
          workTaskId: params.id,
          userId: assigneeId,
        }
      });

      if (!existingParticipant) {
        await prisma.workTaskParticipant.create({
          data: {
            workTaskId: params.id,
            userId: assigneeId,
            role: 'assignee',
          }
        });
      } else {
        // Update role to assignee if needed
        await prisma.workTaskParticipant.update({
          where: { id: existingParticipant.id },
          data: { role: 'assignee' }
        });
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedWorkTask,
      message: 'Work task updated successfully',
    });
  } catch (error) {
    console.error('Work task update error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to update work task' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const workTask = await prisma.workTask.findUnique({
      where: { id: params.id },
    });

    if (!workTask) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Work task not found' },
        { status: 404 }
      );
    }

    // Only creator can delete
    if (workTask.createdById !== req.user.userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the creator can delete this work task' },
        { status: 403 }
      );
    }

    // Delete related data first
    await prisma.workTaskComment.deleteMany({
      where: { workTaskId: params.id }
    });

    await prisma.workTaskParticipant.deleteMany({
      where: { workTaskId: params.id }
    });

    // Delete the work task
    await prisma.workTask.delete({
      where: { id: params.id }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Work task deleted successfully',
    });
  } catch (error) {
    console.error('Work task deletion error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to delete work task' },
      { status: 500 }
    );
  }
});

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { handleOptions } from '@/lib/utils/cors';
import { ApiResponse } from '@/types';

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { inviteCode } = body;

    if (!inviteCode) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invite code is required' },
        { status: 400 }
      );
    }

    console.log('[Work Tasks API] JOIN - Invite code:', inviteCode);

    // Find work task by invite code
    const workTask = await prisma.workTask.findFirst({
      where: { inviteCode },
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
        }
      }
    });

    if (!workTask) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid invite code' },
        { status: 404 }
      );
    }

    // Check if user is already a participant
    const existingParticipant = await prisma.workTaskParticipant.findFirst({
      where: {
        workTaskId: workTask.id,
        userId: req.user.userId,
      }
    });

    if (existingParticipant) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: workTask,
        message: 'Already a participant of this work task',
      });
    }

    // Add user as participant
    await prisma.workTaskParticipant.create({
      data: {
        workTaskId: workTask.id,
        userId: req.user.userId,
        role: 'member',
      }
    });

    // Fetch updated work task
    const updatedWorkTask = await prisma.workTask.findUnique({
      where: { id: workTask.id },
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
        _count: {
          select: {
            comments: true,
            participants: true,
          }
        }
      }
    });

    console.log('[Work Tasks API] User joined work task:', {
      workTaskId: workTask.id,
      userId: req.user.userId,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedWorkTask,
      message: 'Successfully joined work task',
    });
  } catch (error) {
    console.error('Work task join error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to join work task' },
      { status: 500 }
    );
  }
});

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
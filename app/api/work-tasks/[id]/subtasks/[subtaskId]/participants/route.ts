import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { handleOptions } from '@/lib/utils/cors';
import { subtaskEvents } from '@/lib/socket/emit-helper';

// POST /api/work-tasks/[id]/subtasks/[subtaskId]/participants
export const POST = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { id: string; subtaskId: string } }
) => {
  try {
    const { id: workTaskId, subtaskId } = params;
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
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
      return NextResponse.json(
        { error: 'Subtask not found' },
        { status: 404 }
      );
    }

    // Check if user to be added exists
    const userToAdd = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        profileImageUrl: true
      }
    });

    if (!userToAdd) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is already a participant
    const existingParticipant = await prisma.subTaskParticipant.findUnique({
      where: {
        subtaskId_userId: {
          subtaskId,
          userId
        }
      }
    });

    if (existingParticipant) {
      return NextResponse.json(
        { error: 'User is already a participant' },
        { status: 409 }
      );
    }

    // Add participant
    const participant = await prisma.subTaskParticipant.create({
      data: {
        subtaskId,
        userId
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            profileImageUrl: true
          }
        }
      }
    });

    // Emit socket event for real-time updates
    await subtaskEvents.participantAdded(workTaskId, subtaskId, participant);
    console.log(`[Socket] Emitted subtask:participant-added for work-task:${workTaskId}`, {
      subtaskId,
      participantId: participant.id,
      userId: participant.userId
    });

    return NextResponse.json({
      success: true,
      data: participant,
      message: 'Participant added successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding participant:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add participant' },
      { status: 500 }
    );
  }
});

// DELETE /api/work-tasks/[id]/subtasks/[subtaskId]/participants?userId=...
export const DELETE = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { id: string; subtaskId: string } }
) => {
  try {
    const { id: workTaskId, subtaskId } = params;
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
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
      return NextResponse.json(
        { error: 'Subtask not found' },
        { status: 404 }
      );
    }

    // Check if participant exists
    const participant = await prisma.subTaskParticipant.findUnique({
      where: {
        subtaskId_userId: {
          subtaskId,
          userId
        }
      }
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    // Remove participant
    await prisma.subTaskParticipant.delete({
      where: {
        subtaskId_userId: {
          subtaskId,
          userId
        }
      }
    });

    // Emit socket event for real-time updates
    await subtaskEvents.participantRemoved(workTaskId, subtaskId, userId);
    console.log(`[Socket] Emitted subtask:participant-removed for work-task:${workTaskId}`, {
      subtaskId,
      userId
    });

    return NextResponse.json({
      success: true,
      message: 'Participant removed successfully'
    });
  } catch (error) {
    console.error('Error removing participant:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove participant' },
      { status: 500 }
    );
  }
});

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { handleOptions } from '@/lib/utils/cors';

// GET /api/work-tasks/[id]/subtasks
export const GET = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const workTaskId = params.id;

    // Verify work task exists and user has access
    const workTask = await prisma.workTask.findFirst({
      where: {
        id: workTaskId,
        OR: [
          { createdById: req.user.userId },
          {
            participants: {
              some: { userId: req.user.userId }
            }
          }
        ]
      }
    });

    if (!workTask) {
      return NextResponse.json(
        { error: 'Work task not found' },
        { status: 404 }
      );
    }

    // Get all subtasks for this work task
    const subtasks = await prisma.subTask.findMany({
      where: { workTaskId },
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
      },
      orderBy: [
        { status: 'asc' },
        { position: 'asc' }
      ]
    });

    return NextResponse.json({
      success: true,
      data: subtasks
    });
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subtasks' },
      { status: 500 }
    );
  }
});

// POST /api/work-tasks/[id]/subtasks
export const POST = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const workTaskId = params.id;
    const body = await req.json();

    // Verify work task exists and user has access
    const workTask = await prisma.workTask.findFirst({
      where: {
        id: workTaskId,
        OR: [
          { createdById: req.user.userId },
          {
            participants: {
              some: { userId: req.user.userId }
            }
          }
        ]
      }
    });

    if (!workTask) {
      return NextResponse.json(
        { error: 'Work task not found' },
        { status: 404 }
      );
    }

    // Get the maximum position for the status column
    const maxPosition = await prisma.subTask.findFirst({
      where: {
        workTaskId,
        status: body.status || 'todo'
      },
      orderBy: { position: 'desc' },
      select: { position: true }
    });

    // Create subtask
    const subtask = await prisma.subTask.create({
      data: {
        workTaskId,
        title: body.title,
        description: body.description,
        status: body.status || 'todo',
        priority: body.priority || 'medium',
        position: (maxPosition?.position || 0) + 1,
        createdById: req.user.userId,
        assigneeId: body.assigneeId,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        tags: body.tags || []
      },
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

    return NextResponse.json({
      success: true,
      data: subtask,
      message: 'Subtask created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating subtask:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subtask' },
      { status: 500 }
    );
  }
});

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
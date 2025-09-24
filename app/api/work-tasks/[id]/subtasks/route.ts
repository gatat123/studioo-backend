import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSocketIO } from '@/lib/socket';

// GET /api/work-tasks/[id]/subtasks
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const workTaskId = params.id;

    // Verify work task exists and user has access
    const workTask = await prisma.workTask.findFirst({
      where: {
        id: workTaskId,
        OR: [
          { createdById: session.user.id },
          {
            participants: {
              some: { userId: session.user.id }
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

    return NextResponse.json(subtasks);
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subtasks' },
      { status: 500 }
    );
  }
}

// POST /api/work-tasks/[id]/subtasks
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const workTaskId = params.id;
    const body = await request.json();

    // Verify work task exists and user has access
    const workTask = await prisma.workTask.findFirst({
      where: {
        id: workTaskId,
        OR: [
          { createdById: session.user.id },
          {
            participants: {
              some: { userId: session.user.id }
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
        createdById: session.user.id,
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

    // Emit socket event for real-time updates
    const io = getSocketIO();
    io.to(`work-task-${workTaskId}`).emit('subtask:created', {
      workTaskId,
      subtask
    });

    return NextResponse.json(subtask);
  } catch (error) {
    console.error('Error creating subtask:', error);
    return NextResponse.json(
      { error: 'Failed to create subtask' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { emitToRoom, TASK_EVENTS } from '@/lib/socket/emit';

const assignTaskSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['assignee', 'reviewer']).default('assignee'),
});

// POST /api/tasks/[id]/assign - Assign user to task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, role } = assignTaskSchema.parse(body);

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        title: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if user is a participant of the project
    const participant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
          userId: user.id,
        },
      },
    });

    if (!participant && !user.isAdmin) {
      return NextResponse.json(
        { error: 'You are not a member of this project' },
        { status: 403 }
      );
    }

    // Check if the user to be assigned is a project participant
    const assigneeParticipant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
          userId: userId,
        },
      },
    });

    if (!assigneeParticipant) {
      return NextResponse.json(
        { error: 'User is not a member of this project' },
        { status: 400 }
      );
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.taskAssignment.findUnique({
      where: {
        taskId_userId_role: {
          taskId: id,
          userId: userId,
          role: role,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'User is already assigned to this task with the same role' },
        { status: 400 }
      );
    }

    // Create the assignment
    const assignment = await prisma.taskAssignment.create({
      data: {
        taskId: id,
        userId: userId,
        role: role,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
      },
    });

    // Get assignee details for activity log
    const assignee = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        nickname: true,
      },
    });

    // Create activity log
    await prisma.taskActivity.create({
      data: {
        taskId: id,
        userId: user.id,
        action: 'assigned',
        details: {
          assignedTo: assignee?.nickname || assignee?.username,
          role: role,
          taskTitle: task.title,
        },
      },
    });

    // Get updated task with all assignments
    const updatedTask = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            todos: true,
            comments: true,
            subTasks: true,
          },
        },
      },
    });

    // Emit socket event
    emitToRoom(`project:${task.projectId}`, TASK_EVENTS.ASSIGNED, {
      taskId: params.id,
      assignment,
      task: updatedTask,
    });

    return NextResponse.json({ data: assignment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Tasks API] Error assigning task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id]/assign - Remove assignment from task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const role = searchParams.get('role') || 'assignee';

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        title: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if user is a participant of the project
    const participant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
          userId: user.id,
        },
      },
    });

    if (!participant && !user.isAdmin) {
      return NextResponse.json(
        { error: 'You are not a member of this project' },
        { status: 403 }
      );
    }

    // Check if assignment exists
    const assignment = await prisma.taskAssignment.findUnique({
      where: {
        taskId_userId_role: {
          taskId: id,
          userId: userId,
          role: role as 'assignee' | 'reviewer',
        },
      },
      include: {
        user: {
          select: {
            username: true,
            nickname: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Delete the assignment
    await prisma.taskAssignment.delete({
      where: {
        taskId_userId_role: {
          taskId: id,
          userId: userId,
          role: role as 'assignee' | 'reviewer',
        },
      },
    });

    // Create activity log
    await prisma.taskActivity.create({
      data: {
        taskId: id,
        userId: user.id,
        action: 'unassigned',
        details: {
          unassignedFrom: assignment.user.nickname || assignment.user.username,
          role: role,
          taskTitle: task.title,
        },
      },
    });

    // Get updated task
    const updatedTask = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            todos: true,
            comments: true,
            subTasks: true,
          },
        },
      },
    });

    // Emit socket event
    emitToRoom(`project:${task.projectId}`, TASK_EVENTS.UNASSIGNED, {
      taskId: params.id,
      userId,
      role,
      task: updatedTask,
    });

    return NextResponse.json({ message: 'Assignment removed successfully' });
  } catch (error) {
    console.error('[Tasks API] Error removing assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
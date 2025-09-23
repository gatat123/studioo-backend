import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { emitToRoom, TODO_EVENTS } from '@/lib/socket/emit';

// Validation schema for updating a todo
const updateTodoSchema = z.object({
  content: z.string().min(1).optional(),
  isCompleted: z.boolean().optional(),
  taskId: z.string().uuid().optional().nullable(),
});

// GET /api/todos/[id] - Get a specific todo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todo = await prisma.todo.findUnique({
      where: { id: id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // Check if user is a participant of the project
    const participant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: todo.projectId,
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

    return NextResponse.json({ data: todo });
  } catch (error) {
    console.error('[Todos API] Error fetching todo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/todos/[id] - Update a todo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todo = await prisma.todo.findUnique({
      where: { id: id },
      select: {
        id: true,
        projectId: true,
        userId: true,
        isCompleted: true,
      },
    });

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // Check if user is the owner or a project participant
    const participant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: todo.projectId,
          userId: user.id,
        },
      },
    });

    if (todo.userId !== user.id && !participant && !user.isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to update this todo' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateTodoSchema.parse(body);

    // If taskId is changing, verify the new task belongs to the project
    if (validatedData.taskId !== undefined) {
      if (validatedData.taskId) {
        const task = await prisma.task.findUnique({
          where: { id: validatedData.taskId },
          select: { projectId: true },
        });

        if (!task || task.projectId !== todo.projectId) {
          return NextResponse.json(
            { error: 'Invalid task ID for this project' },
            { status: 400 }
          );
        }
      }
    }

    const wasCompleted = todo.isCompleted;
    const updatedTodo = await prisma.todo.update({
      where: { id: id },
      data: {
        content: validatedData.content,
        isCompleted: validatedData.isCompleted,
        completedAt: validatedData.isCompleted === true && !wasCompleted
          ? new Date()
          : validatedData.isCompleted === false
          ? null
          : undefined,
        taskId: validatedData.taskId,
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
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Emit socket event
    emitToRoom(`project:${todo.projectId}`, TODO_EVENTS.UPDATED, updatedTodo);

    if (validatedData.isCompleted !== undefined && validatedData.isCompleted !== wasCompleted) {
      emitToRoom(
        `project:${todo.projectId}`,
        validatedData.isCompleted ? TODO_EVENTS.COMPLETED : TODO_EVENTS.UNCOMPLETED,
        updatedTodo
      );
    }

    return NextResponse.json({ data: updatedTodo });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Todos API] Error updating todo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/todos/[id] - Delete a todo
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

    const todo = await prisma.todo.findUnique({
      where: { id: id },
      select: {
        id: true,
        projectId: true,
        userId: true,
      },
    });

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // Check if user is the owner or admin
    if (todo.userId !== user.id && !user.isAdmin) {
      // Check if user is a project admin
      const participant = await prisma.projectParticipant.findUnique({
        where: {
          projectId_userId: {
            projectId: todo.projectId,
            userId: user.id,
          },
        },
      });

      if (!participant || participant.role !== 'admin') {
        return NextResponse.json(
          { error: 'You do not have permission to delete this todo' },
          { status: 403 }
        );
      }
    }

    // Delete the todo
    await prisma.todo.delete({
      where: { id: id },
    });

    // Emit socket event
    emitToRoom(`project:${todo.projectId}`, TODO_EVENTS.DELETED, { todoId: id });

    return NextResponse.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    console.error('[Todos API] Error deleting todo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { emitToRoom, TODO_EVENTS } from '@/lib/socket/emit';

// Validation schema for creating a todo
const createTodoSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid().optional().nullable(),
  content: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

// POST /api/todos - Create new todo
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createTodoSchema.parse(body);

    // Check if user is a participant of the project
    const participant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: validatedData.projectId,
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

    // If taskId is provided, verify the task belongs to the project
    if (validatedData.taskId) {
      const task = await prisma.task.findUnique({
        where: { id: validatedData.taskId },
        select: { projectId: true },
      });

      if (!task || task.projectId !== validatedData.projectId) {
        return NextResponse.json(
          { error: 'Invalid task ID for this project' },
          { status: 400 }
        );
      }
    }

    // Get the position for the new todo
    let position = validatedData.position;
    if (position === undefined) {
      const lastTodo = await prisma.todo.findFirst({
        where: {
          projectId: validatedData.projectId,
          taskId: validatedData.taskId,
        },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (lastTodo?.position ?? -1) + 1;
    }

    // Create the todo
    const todo = await prisma.todo.create({
      data: {
        projectId: validatedData.projectId,
        taskId: validatedData.taskId,
        userId: user.id,
        content: validatedData.content,
        position,
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
    emitToRoom(`project:${validatedData.projectId}`, TODO_EVENTS.CREATED, todo);

    return NextResponse.json({ data: todo }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Todos API] Error creating todo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
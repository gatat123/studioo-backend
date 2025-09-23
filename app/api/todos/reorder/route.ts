import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { emitToRoom, TODO_EVENTS } from '@/lib/socket/emit';

// Validation schema for reordering todos
const reorderTodosSchema = z.object({
  projectId: z.string().uuid(),
  todos: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
    })
  ).min(1),
});

// PATCH /api/todos/reorder - Reorder todos
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, todos } = reorderTodosSchema.parse(body);

    // Check if user is a participant of the project
    const participant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId,
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

    // Verify all todos belong to the project
    const todoIds = todos.map(t => t.id);
    const existingTodos = await prisma.todo.findMany({
      where: {
        id: { in: todoIds },
        projectId,
      },
      select: { id: true },
    });

    if (existingTodos.length !== todoIds.length) {
      return NextResponse.json(
        { error: 'Some todos do not belong to this project' },
        { status: 400 }
      );
    }

    // Update positions in a transaction
    const updatedTodos = await prisma.$transaction(
      todos.map(({ id, position }) =>
        prisma.todo.update({
          where: { id },
          data: { position },
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
        })
      )
    );

    // Emit socket event
    emitToRoom(`project:${projectId}`, TODO_EVENTS.REORDERED, {
      todos: updatedTodos,
      order: todos,
    });

    return NextResponse.json({
      data: {
        todos: updatedTodos,
        message: `${todos.length} todos reordered successfully`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[Todos API] Error reordering todos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
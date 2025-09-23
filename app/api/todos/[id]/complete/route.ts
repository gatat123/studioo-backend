import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { emitToRoom, TODO_EVENTS } from '@/lib/socket/emit';

// PATCH /api/todos/[id]/complete - Toggle todo completion status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todo = await prisma.todo.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        projectId: true,
        userId: true,
        isCompleted: true,
        content: true,
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

    // Toggle the completion status
    const newCompletionStatus = !todo.isCompleted;
    const updatedTodo = await prisma.todo.update({
      where: { id: params.id },
      data: {
        isCompleted: newCompletionStatus,
        completedAt: newCompletionStatus ? new Date() : null,
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

    // If the todo is associated with a task, update task completion metrics
    if (updatedTodo.taskId) {
      const taskTodos = await prisma.todo.findMany({
        where: { taskId: updatedTodo.taskId },
        select: { isCompleted: true },
      });

      const totalTodos = taskTodos.length;
      const completedTodos = taskTodos.filter(t => t.isCompleted).length;
      const completionPercentage = totalTodos > 0
        ? Math.round((completedTodos / totalTodos) * 100)
        : 0;

      // Create task activity log
      await prisma.taskActivity.create({
        data: {
          taskId: updatedTodo.taskId,
          userId: user.id,
          action: 'todo_toggled',
          details: {
            todoContent: todo.content,
            completed: newCompletionStatus,
            completionStats: {
              completed: completedTodos,
              total: totalTodos,
              percentage: completionPercentage,
            },
          },
        },
      });
    }

    // Emit socket events
    emitToRoom(
      `project:${todo.projectId}`,
      newCompletionStatus ? TODO_EVENTS.COMPLETED : TODO_EVENTS.UNCOMPLETED,
      updatedTodo
    );

    return NextResponse.json({ data: updatedTodo });
  } catch (error) {
    console.error('[Todos API] Error toggling todo completion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
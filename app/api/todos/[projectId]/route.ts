import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';

// GET /api/todos/[projectId] - Get all todos for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is a participant of the project
    const participant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: params.projectId,
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

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');
    const userId = searchParams.get('userId');
    const isCompleted = searchParams.get('isCompleted');

    // Build where clause
    const where: any = {
      projectId: params.projectId,
    };

    if (taskId === 'null') {
      where.taskId = null;
    } else if (taskId) {
      where.taskId = taskId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (isCompleted !== null) {
      where.isCompleted = isCompleted === 'true';
    }

    // Fetch todos
    const todos = await prisma.todo.findMany({
      where,
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
      },
      orderBy: [
        { isCompleted: 'asc' },
        { position: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Calculate statistics
    const stats = {
      total: todos.length,
      completed: todos.filter(t => t.isCompleted).length,
      pending: todos.filter(t => !t.isCompleted).length,
      completionRate: todos.length > 0
        ? Math.round((todos.filter(t => t.isCompleted).length / todos.length) * 100)
        : 0,
    };

    // Group todos by task for better organization
    const todosByTask = new Map();
    const standaloneTodos = [];

    todos.forEach(todo => {
      if (todo.taskId) {
        if (!todosByTask.has(todo.taskId)) {
          todosByTask.set(todo.taskId, {
            task: todo.task,
            todos: [],
          });
        }
        todosByTask.get(todo.taskId).todos.push(todo);
      } else {
        standaloneTodos.push(todo);
      }
    });

    return NextResponse.json({
      data: {
        todos,
        todosByTask: Array.from(todosByTask.values()),
        standaloneTodos,
        stats,
      },
    });
  } catch (error) {
    console.error('[Todos API] Error fetching todos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
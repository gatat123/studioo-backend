import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';

// GET /api/todos/project/[projectId]/user/[userId] - Get todos for a specific user in a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; userId: string }> }
) {
  const { projectId, userId } = await params;
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is a participant of the project
    const participant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: projectId,
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

    // Fetch todos for the specific user
    const todos = await prisma.todo.findMany({
      where: {
        projectId: projectId,
        userId: userId,
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
            status: true,
          },
        },
      },
      orderBy: [
        { isCompleted: 'asc' },
        { order: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(todos);
  } catch (error) {
    console.error('[Todos API] Error fetching user todos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
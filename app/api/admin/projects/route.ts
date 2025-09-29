import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET /api/admin/projects - Get all projects (Admin only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    const isAdmin = currentUser?.isAdmin || currentUser?.username === "gatat123";
    if (!currentUser || !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        inviteCode: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            username: true,
            nickname: true
          }
        },
        _count: {
          select: {
            participants: true,
            scenes: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
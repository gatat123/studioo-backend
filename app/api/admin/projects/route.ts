import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET /api/admin/projects - Get all projects (Admin only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      include: {
        studio: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                email: true,
                profileImageUrl: true
              }
            }
          }
        },
        creator: {
          select: {
            id: true,
            username: true,
            nickname: true,
            email: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            }
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
    // Log error appropriately in production
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
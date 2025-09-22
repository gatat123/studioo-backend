import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET /api/admin/users - Get all users (Admin only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        profileImageUrl: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            createdProjects: true,
            createdChannels: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data
    const transformedUsers = users.map(user => ({
      ...user,
      _count: {
        projects: user._count.createdProjects,
        channels: user._count.createdChannels
      }
    }));

    return NextResponse.json({ users: transformedUsers });
  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
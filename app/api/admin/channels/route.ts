import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET /api/admin/channels - Get all channels (Admin only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const channels = await prisma.channel.findMany({
      where: {},
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            nickname: true,
            email: true,
            profileImageUrl: true
          }
        },
        members: {
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
            members: true,
            messages: true,
            files: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ channels });
  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}
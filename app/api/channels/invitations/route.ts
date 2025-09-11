import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';

// GET: 받은 초대 목록 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 받은 초대 목록 조회 (pending 상태만)
    const invitations = await prisma.channelInvite.findMany({
      where: {
        inviteeId: currentUser.id,
        status: 'pending',
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            _count: {
              select: {
                members: true
              }
            }
          }
        },
        inviter: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
  }
}
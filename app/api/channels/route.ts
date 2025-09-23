import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { z } from 'zod';

// GET: 사용자의 채널 목록 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자가 속한 채널 목록 조회
    const channels = await prisma.channel.findMany({
      where: {
        OR: [
          { creatorId: currentUser.id },
          { members: { some: { userId: currentUser.id } } }
        ],
        isArchived: false
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            nickname: true,
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
                profileImageUrl: true,
                lastLoginAt: true
              }
            }
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                nickname: true
              }
            }
          }
        },
        _count: {
          select: {
            messages: true,
            members: true,
            files: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // 읽지 않은 메시지 수 계산
    const channelsWithUnread = await Promise.all(
      channels.map(async (channel) => {
        const membership = channel.members.find(m => m.userId === currentUser.id);
        const lastReadAt = membership?.lastReadAt || new Date(0);
        
        const unreadCount = await prisma.channelMessage.count({
          where: {
            channelId: channel.id,
            createdAt: { gt: lastReadAt },
            senderId: { not: currentUser.id }
          }
        });

        return {
          ...channel,
          unreadCount,
          lastMessage: channel.messages[0] || null
        };
      })
    );

    return NextResponse.json({ channels: channelsWithUnread });
  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
  }
}

// POST: 새 채널 생성
const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(['public', 'private']).default('public'),
  studioId: z.string().uuid().optional()
});

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createChannelSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, description, type, studioId } = validation.data;

    // 스튜디오 권한 확인 (선택적)
    if (studioId) {
      const studio = await prisma.studio.findFirst({
        where: {
          id: studioId,
          userId: currentUser.id
        }
      });

      if (!studio) {
        return NextResponse.json({ error: 'Studio not found or unauthorized' }, { status: 403 });
      }
    }

    // 채널 생성
    const channel = await prisma.channel.create({
      data: {
        name,
        description,
        type,
        creatorId: currentUser.id,
        studioId,
        members: {
          create: {
            userId: currentUser.id,
            role: 'admin'
          }
        }
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            nickname: true,
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
        }
      }
    });

    // 시스템 메시지 생성
    await prisma.channelMessage.create({
      data: {
        channelId: channel.id,
        senderId: currentUser.id,
        content: `${currentUser.nickname}님이 채널을 생성했습니다.`,
        type: 'system'
      }
    });

    return NextResponse.json({ channel });
  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 });
  }
}
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
        ]
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
          orderBy: { sentAt: 'desc' },
          include: {
            user: {
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
            members: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 읽지 않은 메시지 수 계산 (간소화된 버전)
    const channelsWithUnread = channels.map((channel) => {
      // 현재는 lastReadAt 필드가 없어서 0으로 설정
      const unreadCount = 0;

      return {
        ...channel,
        unreadCount,
        lastMessage: channel.messages[0] || null
      };
    });

    // 대기 중인 초대 조회
    const pendingInvites = await prisma.channelInvite.findMany({
      where: {
        inviteeId: currentUser.id,
        status: 'pending'
      },
      include: {
        channel: {
          include: {
            creator: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            },
            _count: {
              select: {
                messages: true,
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
      orderBy: { sentAt: 'desc' }
    });

    return NextResponse.json({ 
      channels: channelsWithUnread,
      pendingInvites 
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
  }
}

// POST: 새 채널 생성
const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
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

    const { name, description, studioId } = validation.data;

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
        userId: currentUser.id,
        content: `${currentUser.nickname}님이 채널을 생성했습니다.`
      }
    });

    return NextResponse.json({ channel });
  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 });
  }
}
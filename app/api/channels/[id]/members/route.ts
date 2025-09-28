import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { z } from 'zod';
import { channelEvents } from '@/lib/socket/emit-helper';

// GET: 채널 멤버 목록 조회
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 채널 멤버십 확인
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.id,
          userId: currentUser.id
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 });
    }

    // 멤버 목록 조회
    const members = await prisma.channelMember.findMany({
      where: {
        channelId: params.id
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
            bio: true,
            lastLoginAt: true,
            isActive: true
          }
        }
      },
      orderBy: [
        { role: 'asc' }, // admin > moderator > member
        { joinedAt: 'asc' }
      ]
    });

    // 온라인 상태 확인 (최근 5분 이내 활동)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const membersWithStatus = members.map(member => ({
      ...member,
      user: {
        ...member.user,
        status: member.user.lastLoginAt && member.user.lastLoginAt > fiveMinutesAgo 
          ? 'online' 
          : member.user.isActive 
            ? 'away' 
            : 'offline'
      }
    }));

    return NextResponse.json({ members: membersWithStatus });
  } catch (error) {
    console.error('Error fetching channel members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

// POST: 채널에 멤버 초대
const inviteMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  message: z.string().optional()
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 초대자의 권한 확인 (admin 또는 moderator만 가능)
    const inviterMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.id,
          userId: currentUser.id
        }
      }
    });

    if (!inviterMembership || inviterMembership.role === 'member') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    console.log('Invite member request body:', body);
    const validation = inviteMemberSchema.safeParse(body);

    if (!validation.success) {
      console.error('Validation failed:', validation.error.issues);
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { userId, message } = validation.data;

    // 이미 멤버인지 확인
    const existingMember = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.id,
          userId
        }
      }
    });

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
    }

    // 이미 보류 중인 초대가 있는지 확인
    const existingInvite = await prisma.channelInvite.findFirst({
      where: {
        channelId: params.id,
        inviteeId: userId,
        status: 'pending'
      }
    });

    if (existingInvite) {
      return NextResponse.json({ error: 'Invitation already sent to this user' }, { status: 400 });
    }

    // 초대 생성
    const invite = await prisma.channelInvite.create({
      data: {
        channelId: params.id,
        inviterId: currentUser.id,
        inviteeId: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7일 후 만료
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        inviter: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        invitee: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        }
      }
    });

    // 시스템 메시지 생성
    await prisma.channelMessage.create({
      data: {
        channelId: params.id,
        senderId: currentUser.id,
        content: message || `${currentUser.nickname}님이 새 멤버를 초대했습니다.`,
        type: 'system'
      }
    });

    // 실시간 초대 알림 전송
    try {
      await channelEvents.inviteSent(params.id, userId, invite);
      console.log(`[Channel Invite] Realtime notification sent to user ${userId} for channel ${params.id}`);
    } catch (socketError) {
      console.error('[Channel Invite] Failed to send realtime notification:', socketError);
      // Socket 오류는 초대 생성을 실패시키지 않음
    }

    return NextResponse.json({ invite });
  } catch (error) {
    console.error('Error inviting member:', error);
    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 });
  }
}

// DELETE: 채널 나가기
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 멤버십 확인
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.id,
          userId: currentUser.id
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this channel' }, { status: 404 });
    }

    // 채널 생성자는 나갈 수 없음
    const channel = await prisma.channel.findUnique({
      where: { id: params.id },
      select: { creatorId: true }
    });

    if (channel?.creatorId === currentUser.id) {
      return NextResponse.json({ error: 'Channel creator cannot leave' }, { status: 400 });
    }

    // 멤버십 삭제
    await prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId: params.id,
          userId: currentUser.id
        }
      }
    });

    // 시스템 메시지 생성
    await prisma.channelMessage.create({
      data: {
        channelId: params.id,
        senderId: currentUser.id,
        content: `${currentUser.nickname}님이 채널을 나갔습니다.`,
        type: 'system'
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error leaving channel:', error);
    return NextResponse.json({ error: 'Failed to leave channel' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { z } from 'zod';

// GET: 받은 채널 초대 목록
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invites = await prisma.channelInvite.findMany({
      where: {
        inviteeId: currentUser.id,
        status: 'pending',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
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
                members: true,
                messages: true
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
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('Error fetching invites:', error);
    return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
  }
}

// PUT: 초대 수락/거절
const respondInviteSchema = z.object({
  inviteId: z.string().uuid(),
  action: z.enum(['accept', 'reject'])
});

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = respondInviteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { inviteId, action } = validation.data;

    // 초대 확인
    const invite = await prisma.channelInvite.findFirst({
      where: {
        id: inviteId,
        inviteeId: currentUser.id,
        status: 'pending'
      },
      include: {
        channel: true
      }
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 });
    }

    // 만료 확인
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      await prisma.channelInvite.update({
        where: { id: inviteId },
        data: { status: 'expired' }
      });
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
    }

    if (action === 'accept') {
      // 이미 멤버인지 확인
      const existingMember = await prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: invite.channelId,
            userId: currentUser.id
          }
        }
      });

      if (!existingMember) {
        // 채널 멤버로 추가
        await prisma.channelMember.create({
          data: {
            channelId: invite.channelId,
            userId: currentUser.id,
            role: 'member'
          }
        });

        // 시스템 메시지 생성
        await prisma.channelMessage.create({
          data: {
            channelId: invite.channelId,
            senderId: currentUser.id,
            content: `${currentUser.nickname}님이 채널에 참여했습니다.`,
            type: 'system'
          }
        });
      }

      // 초대 상태 업데이트
      await prisma.channelInvite.update({
        where: { id: inviteId },
        data: {
          status: 'accepted',
          acceptedAt: new Date()
        }
      });

      return NextResponse.json({ 
        success: true, 
        channel: invite.channel,
        message: 'Successfully joined the channel' 
      });
    } else {
      // 초대 거절
      await prisma.channelInvite.update({
        where: { id: inviteId },
        data: { status: 'rejected' }
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Invite rejected' 
      });
    }
  } catch (error) {
    console.error('Error responding to invite:', error);
    return NextResponse.json({ error: 'Failed to respond to invite' }, { status: 500 });
  }
}
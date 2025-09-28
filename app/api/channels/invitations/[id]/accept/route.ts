import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { emitSocketEvent } from '@/lib/socket/emit-helper';

// POST: 초대 수락
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

    // 초대 확인
    const invitation = await prisma.channelInvite.findUnique({
      where: { id: params.id },
      include: {
        channel: true,
        inviter: {
          select: {
            nickname: true
          }
        }
      }
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.inviteeId !== currentUser.id) {
      return NextResponse.json({ error: 'Not your invitation' }, { status: 403 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation already processed' }, { status: 400 });
    }

    // 만료 확인
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      await prisma.channelInvite.update({
        where: { id: params.id },
        data: { status: 'expired' }
      });
      return NextResponse.json({ error: 'Invitation expired' }, { status: 400 });
    }

    // 트랜잭션으로 초대 수락 처리
    const result = await prisma.$transaction(async (tx) => {
      // 초대 상태 업데이트
      const updatedInvite = await tx.channelInvite.update({
        where: { id: params.id },
        data: {
          status: 'accepted',
          acceptedAt: new Date()
        }
      });

      // 채널 멤버로 추가
      const membership = await tx.channelMember.create({
        data: {
          channelId: invitation.channelId,
          userId: currentUser.id,
          role: 'member',
          joinedAt: new Date()
        },
        include: {
          channel: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        }
      });

      // 시스템 메시지 생성
      await tx.channelMessage.create({
        data: {
          channelId: invitation.channelId,
          senderId: currentUser.id,
          content: `${currentUser.nickname}님이 채널에 참여했습니다.`,
          type: 'system'
        }
      });

      // 알림 생성 (초대한 사람에게)
      await tx.notification.create({
        data: {
          userId: invitation.inviterId,
          type: 'channel_invite_accepted',
          title: '채널 초대 수락',
          content: `${currentUser.nickname}님이 #${invitation.channel.name} 채널 초대를 수락했습니다.`
        }
      });

      return membership;
    });

    // Socket.io 이벤트 발생 - 채널 참여 성공 알림
    try {
      // 1. 초대 수락한 사용자에게 채널 참여 성공 알림
      await emitSocketEvent({
        room: `user:${currentUser.id}`,
        event: 'channel_joined',
        data: {
          channelId: invitation.channelId,
          channel: result.channel,
          message: '채널에 성공적으로 참여했습니다.',
          timestamp: new Date()
        }
      });

      // 2. 채널의 모든 멤버들에게 새 멤버 참여 알림
      await emitSocketEvent({
        room: `channel:${invitation.channelId}`,
        event: 'member_joined_channel',
        data: {
          userId: currentUser.id,
          user: {
            id: currentUser.id,
            username: currentUser.username,
            nickname: currentUser.nickname,
            profileImageUrl: currentUser.profileImageUrl
          },
          timestamp: new Date()
        }
      });

      // 3. 초대한 사람에게 수락 알림
      await emitSocketEvent({
        room: `user:${invitation.inviterId}`,
        event: 'channel_invite_accepted_notification',
        data: {
          acceptedBy: {
            id: currentUser.id,
            username: currentUser.username,
            nickname: currentUser.nickname,
            profileImageUrl: currentUser.profileImageUrl
          },
          channel: result.channel,
          timestamp: new Date()
        }
      });

      console.log(`[Channel Invite] Socket events sent for user ${currentUser.id} joining channel ${invitation.channelId}`);
    } catch (socketError) {
      console.error('[Channel Invite] Failed to emit socket events:', socketError);
      // Socket 이벤트 실패해도 API는 성공으로 처리
    }

    return NextResponse.json({
      success: true,
      channel: result.channel,
      message: '채널에 성공적으로 참여했습니다.'
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
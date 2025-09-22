import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';

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

    // 상태가 pending인지 확인 (이미 위에서 체크했지만 추가 안전장치)

    // 트랜잭션으로 초대 수락 처리
    const result = await prisma.$transaction(async (tx) => {
      // 초대 상태 업데이트
      const updatedInvite = await tx.channelInvite.update({
        where: { id: params.id },
        data: {
          status: 'accepted'
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
          userId: currentUser.id,
          content: `${currentUser.nickname}님이 채널에 참여했습니다.`
        }
      });

      // 알림 생성 (초대한 사람에게)
      await tx.notification.create({
        data: {
          userId: invitation.inviterId,
          type: 'channel_invite_accepted',
          title: '채널 초대 수락',
          message: `${currentUser.nickname}님이 #${invitation.channel.name} 채널 초대를 수락했습니다.`
        }
      });

      return membership;
    });

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
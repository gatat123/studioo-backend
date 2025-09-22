import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';

// POST: 초대 거절
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
        channel: {
          select: {
            name: true
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

    // 초대 거절
    await prisma.channelInvite.update({
      where: { id: params.id },
      data: { status: 'rejected' }
    });

    // 알림 생성 (초대한 사람에게)
    await prisma.notification.create({
      data: {
        userId: invitation.inviterId,
        type: 'channel_invite_rejected',
        title: '채널 초대 거절',
        message: `${currentUser.nickname}님이 #${invitation.channel.name} 채널 초대를 거절했습니다.`
      }
    });

    return NextResponse.json({ 
      success: true,
      message: '초대를 거절했습니다.'
    });
  } catch (error) {
    console.error('Error rejecting invitation:', error);
    return NextResponse.json({ error: 'Failed to reject invitation' }, { status: 500 });
  }
}
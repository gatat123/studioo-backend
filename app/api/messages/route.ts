import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { z } from 'zod';

// GET: 특정 사용자와의 메시지 내역 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const friendId = searchParams.get('friendId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!friendId) {
      return NextResponse.json({ error: 'Friend ID is required' }, { status: 400 });
    }

    // 친구 관계 확인
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: currentUser.id, user2Id: friendId },
          { user1Id: friendId, user2Id: currentUser.id }
        ]
      }
    });

    if (!friendship) {
      return NextResponse.json({ error: 'Not friends with this user' }, { status: 403 });
    }

    // 메시지 조회
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUser.id, receiverId: friendId },
          { senderId: friendId, receiverId: currentUser.id }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        receiver: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // 읽지 않은 메시지를 읽음 처리
    await prisma.message.updateMany({
      where: {
        senderId: friendId,
        receiverId: currentUser.id,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return NextResponse.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST: 메시지 전송
const sendMessageSchema = z.object({
  receiverId: z.string().uuid(),
  content: z.string().min(1).max(1000)
});

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = sendMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { receiverId, content } = validation.data;

    // 친구 관계 확인
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: currentUser.id, user2Id: receiverId },
          { user1Id: receiverId, user2Id: currentUser.id }
        ]
      }
    });

    if (!friendship) {
      return NextResponse.json({ error: 'Not friends with this user' }, { status: 403 });
    }

    // 메시지 생성
    const message = await prisma.message.create({
      data: {
        senderId: currentUser.id,
        receiverId,
        content
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        receiver: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        }
      }
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

// PUT: 메시지 읽음 처리
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { messageIds } = body;

    if (!Array.isArray(messageIds)) {
      return NextResponse.json({ error: 'Message IDs must be an array' }, { status: 400 });
    }

    // 본인에게 온 메시지만 읽음 처리
    await prisma.message.updateMany({
      where: {
        id: { in: messageIds },
        receiverId: currentUser.id,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json({ error: 'Failed to mark messages as read' }, { status: 500 });
  }
}
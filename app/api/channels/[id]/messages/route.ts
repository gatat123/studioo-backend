import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/jwt';
import { z } from 'zod';

// GET: 채널 메시지 내역 조회
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const cursor = searchParams.get('cursor'); // For pagination

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

    // 메시지 조회
    const messages = await prisma.channelMessage.findMany({
      where: {
        channelId: params.id,
        ...(cursor ? { sentAt: { lt: new Date(cursor) } } : {})
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        }
      },
      orderBy: { sentAt: 'desc' },
      take: limit
    });

    return NextResponse.json({
      messages: messages.reverse(),
      hasMore: messages.length === limit,
      nextCursor: messages.length > 0 ? messages[0].sentAt.toISOString() : null
    });
  } catch (error) {
    console.error('Error fetching channel messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST: 채널에 메시지 전송
const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  type: z.enum(['text', 'image', 'file']).default('text'),
  metadata: z.any().optional()
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

    const body = await request.json();
    const validation = sendMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { content, type, metadata } = validation.data;

    // 메시지 생성
    const message = await prisma.channelMessage.create({
      data: {
        channelId: params.id,
        userId: currentUser.id,
        content
      },
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
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET /api/messages/conversations - Get all conversations with last message
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = currentUser.id;

    // Get all messages grouped by conversation
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
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
      orderBy: {
        sentAt: 'desc'
      }
    });

    // Group messages by conversation
    const conversationMap = new Map();
    
    for (const message of messages) {
      const friendId = message.senderId === userId ? message.receiverId : message.senderId;
      const friend = message.senderId === userId ? message.receiver : message.sender;
      
      if (!conversationMap.has(friendId)) {
        // Count unread messages
        const unreadCount = await prisma.message.count({
          where: {
            senderId: friendId,
            receiverId: userId,
            isRead: false
          }
        });

        // Check if friend is online (you might want to implement a proper online status system)
        const friendUser = await prisma.user.findUnique({
          where: { id: friendId },
          select: { lastLoginAt: true }
        });

        const isActive = friendUser?.lastLoginAt ? 
          new Date().getTime() - new Date(friendUser.lastLoginAt).getTime() < 5 * 60 * 1000 : // 5 minutes
          false;

        conversationMap.set(friendId, {
          friend: {
            ...friend,
            isActive
          },
          lastMessage: message,
          unreadCount
        });
      }
    }

    const conversations = Array.from(conversationMap.values());

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
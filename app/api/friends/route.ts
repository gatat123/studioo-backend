import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { verifyAccessToken } from '@/lib/jwt';
import { handleOptions, withCORS } from '@/lib/utils/cors';
import { z } from 'zod';
import { getSocketInstance } from '@/lib/socket/server';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// GET - Get friend list and friend requests
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Auth error: No valid authorization header');
      return withCORS(NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      ), request);
    }
    
    const token = authHeader.substring(7);
    
    if (!token || token === 'undefined' || token === 'null') {
      console.error('Auth error: Invalid token format:', token);
      return withCORS(NextResponse.json(
        { success: false, error: 'Invalid token format' },
        { status: 401 }
      ), request);
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
      console.error('Auth error: Token verification failed');
      return withCORS(NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      ), request);
    }

    // Get friends where user is either user1 or user2
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { user1Id: decoded.userId },
          { user2Id: decoded.userId }
        ]
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
            isActive: true,
            lastLoginAt: true,
            bio: true,
          }
        },
        user2: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
            isActive: true,
            lastLoginAt: true,
            bio: true,
          }
        }
      }
    });

    // Format friends list with online status and memo
    const friends = friendships.map(friendship => {
      const friend = friendship.user1Id === decoded.userId 
        ? friendship.user2 
        : friendship.user1;
      
      // Get memo with safe fallback
      const memo = friendship.user1Id === decoded.userId 
        ? (friendship as any).user1Memo || null
        : (friendship as any).user2Memo || null;
      
      // 5분 이내 활동을 온라인으로 간주
      const isOnline = friend.lastLoginAt && 
        new Date(friend.lastLoginAt) > new Date(Date.now() - 5 * 60 * 1000);
      
      return {
        id: friendship.id,
        friend: {
          ...friend,
          isOnline // 온라인 상태 추가
        },
        memo, // 메모 추가 (없으면 null)
        createdAt: friendship.createdAt
      };
    });

    // Get pending friend requests received
    const receivedRequests = await prisma.friendRequest.findMany({
      where: {
        receiverId: decoded.userId,
        status: 'pending'
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get pending friend requests sent
    const sentRequests = await prisma.friendRequest.findMany({
      where: {
        senderId: decoded.userId,
        status: 'pending'
      },
      include: {
        receiver: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return withCORS(NextResponse.json({
      success: true,
      friends,
      receivedRequests,
      sentRequests
    }), request);

  } catch (error) {
    console.error('Get friends error:', error);
    return withCORS(NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    ), request);
  }
}

// DELETE - Remove friend
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return withCORS(NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      ), request);
    }
    
    const token = authHeader.substring(7);
    
    if (!token || token === 'undefined' || token === 'null') {
      return withCORS(NextResponse.json(
        { success: false, error: 'Invalid token format' },
        { status: 401 }
      ), request);
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      ), request);
    }

    const { searchParams } = new URL(request.url);
    const friendId = searchParams.get('friendId');

    if (!friendId) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Friend ID is required' },
        { status: 400 }
      ), request);
    }

    // Find and delete friendship
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: decoded.userId, user2Id: friendId },
          { user1Id: friendId, user2Id: decoded.userId }
        ]
      }
    });

    if (!friendship) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Friendship not found' },
        { status: 404 }
      ), request);
    }

    await prisma.friendship.delete({
      where: { id: friendship.id }
    });

    // Send real-time notification via Socket.io
    try {
      const io = getSocketInstance();
      if (io) {
        const activeConnections = (io as any).activeConnections as Map<string, Set<string>>;
        const friendSockets = activeConnections?.get(friendId);
        
        if (friendSockets && friendSockets.size > 0) {
          friendSockets.forEach((socketId) => {
            io.to(socketId).emit('friend_removed', {
              removedBy: decoded.userId,
              timestamp: new Date()
            });
          });
        }
      }
    } catch (socketError) {
      console.error('Socket notification error:', socketError);
    }

    return withCORS(NextResponse.json({
      success: true,
      message: 'Friend removed successfully'
    }), request);

  } catch (error) {
    console.error('Remove friend error:', error);
    return withCORS(NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    ), request);
  }
}
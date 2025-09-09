import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { verifyAccessToken } from '@/lib/jwt';
import { handleOptions, withCORS } from '@/lib/utils/cors';
import { z } from 'zod';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// GET - Get friend list and friend requests
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return withCORS(NextResponse.json(
        { success: false, error: 'No token provided' },
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
          }
        }
      }
    });

    // Format friends list
    const friends = friendships.map(friendship => {
      const friend = friendship.user1Id === decoded.userId 
        ? friendship.user2 
        : friendship.user1;
      return {
        id: friendship.id,
        friend,
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
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return withCORS(NextResponse.json(
        { success: false, error: 'No token provided' },
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
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { verifyAccessToken } from '@/lib/jwt';
import { handleOptions, withCORS } from '@/lib/utils/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// GET - Search users by nickname
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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Search query must be at least 2 characters' },
        { status: 400 }
      ), request);
    }

    // Search users by nickname (partial match)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            nickname: {
              contains: query
            }
          },
          {
            id: {
              not: decoded.userId // Exclude current user
            }
          },
          {
            isActive: true // Only active users
          }
        ]
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        profileImageUrl: true,
      },
      take: 20 // Limit results
    });

    // Check friendship status for each user
    const usersWithStatus = await Promise.all(users.map(async (user) => {
      // Check if already friends
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { user1Id: decoded.userId, user2Id: user.id },
            { user1Id: user.id, user2Id: decoded.userId }
          ]
        }
      });

      // Check if there's a pending request
      const pendingRequest = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId: decoded.userId, receiverId: user.id, status: 'pending' },
            { senderId: user.id, receiverId: decoded.userId, status: 'pending' }
          ]
        }
      });

      let status = 'none';
      if (friendship) {
        status = 'friend';
      } else if (pendingRequest) {
        status = pendingRequest.senderId === decoded.userId ? 'request_sent' : 'request_received';
      }

      return {
        ...user,
        friendStatus: status
      };
    }));

    return withCORS(NextResponse.json({
      success: true,
      users: usersWithStatus
    }), request);

  } catch (error) {
    console.error('Search users error:', error);
    return withCORS(NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    ), request);
  }
}
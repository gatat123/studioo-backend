import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { verifyAccessToken } from '@/lib/jwt';
import { handleOptions, withCORS } from '@/lib/utils/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// GET - Search users
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Search API auth error: No valid authorization header');
      return withCORS(NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      ), request);
    }
    
    const token = authHeader.substring(7);
    
    if (!token || token === 'undefined' || token === 'null') {
      console.error('Search API auth error: Invalid token format:', token);
      return withCORS(NextResponse.json(
        { success: false, error: 'Invalid token format' },
        { status: 401 }
      ), request);
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
      console.error('Search API auth error: Token verification failed');
      return withCORS(NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      ), request);
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Query must be at least 2 characters' },
        { status: 400 }
      ), request);
    }

    // Search users by username, nickname, or email
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: decoded.userId } }, // Exclude current user
          {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { nickname: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } }
            ]
          }
        ]
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        profileImageUrl: true,
        bio: true
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

      // Check for pending requests
      const pendingRequest = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId: decoded.userId, receiverId: user.id, status: 'pending' },
            { senderId: user.id, receiverId: decoded.userId, status: 'pending' }
          ]
        }
      });

      return {
        ...user,
        status: friendship ? 'friends' : 
                pendingRequest ? (pendingRequest.senderId === decoded.userId ? 'request_sent' : 'request_received') : 
                'none',
        requestId: pendingRequest?.id
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
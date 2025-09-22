import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { verifyAccessToken } from '@/lib/jwt';
import { handleOptions, withCORS } from '@/lib/utils/cors';
import { z } from 'zod';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// Schema for friend request
const friendRequestSchema = z.object({
  nickname: z.string().min(1).max(100),
});

// POST - Send friend request
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validationResult = friendRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      ), request);
    }

    const { nickname } = validationResult.data;

    // Find user by nickname
    const targetUser = await prisma.user.findUnique({
      where: { nickname }
    });

    if (!targetUser) {
      return withCORS(NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      ), request);
    }

    // Can't send request to yourself
    if (targetUser.id === decoded.userId) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Cannot send friend request to yourself' },
        { status: 400 }
      ), request);
    }

    // Check if already friends
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: decoded.userId, user2Id: targetUser.id },
          { user1Id: targetUser.id, user2Id: decoded.userId }
        ]
      }
    });

    if (existingFriendship) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Already friends with this user' },
        { status: 400 }
      ), request);
    }

    // Check if request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: decoded.userId, receiverId: targetUser.id, status: 'pending' },
          { senderId: targetUser.id, receiverId: decoded.userId, status: 'pending' }
        ]
      }
    });

    if (existingRequest) {
      if (existingRequest.senderId === decoded.userId) {
        return withCORS(NextResponse.json(
          { success: false, error: 'Friend request already sent' },
          { status: 400 }
        ), request);
      } else {
        // Auto-accept if the other user already sent a request
        await prisma.$transaction([
          // Update request status
          prisma.friendRequest.update({
            where: { id: existingRequest.id },
            data: {
              status: 'accepted'
            }
          }),
          // Create friendship
          prisma.friendship.create({
            data: {
              user1Id: existingRequest.senderId,
              user2Id: existingRequest.receiverId
            }
          }),
          // Create notification for the original sender
          prisma.notification.create({
            data: {
              userId: targetUser.id,
              type: 'friend_request_accepted',
              title: '친구 요청 수락됨',
              message: `${(await prisma.user.findUnique({ where: { id: decoded.userId } }))?.nickname}님이 친구 요청을 수락했습니다.`
            }
          })
        ]);

        return withCORS(NextResponse.json({
          success: true,
          message: 'Friend request accepted automatically'
        }), request);
      }
    }

    // Create new friend request
    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId: decoded.userId,
        receiverId: targetUser.id,
        status: 'pending'
      },
      include: {
        sender: {
          select: {
            nickname: true,
            username: true
          }
        }
      }
    });

    // Create notification for receiver
    await prisma.notification.create({
      data: {
        userId: targetUser.id,
        type: 'friend_request',
        title: '새로운 친구 요청',
        message: `${friendRequest.sender.nickname}님이 친구 요청을 보냈습니다.`
      }
    });

    return withCORS(NextResponse.json({
      success: true,
      message: 'Friend request sent successfully',
      request: friendRequest
    }), request);

  } catch (error) {
    console.error('Send friend request error:', error);
    return withCORS(NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    ), request);
  }
}

// PATCH - Accept or reject friend request
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { requestId, action } = body;

    if (!requestId || !action || !['accept', 'reject'].includes(action)) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      ), request);
    }

    // Find the friend request
    const friendRequest = await prisma.friendRequest.findFirst({
      where: {
        id: requestId,
        receiverId: decoded.userId,
        status: 'pending'
      },
      include: {
        sender: {
          select: {
            id: true,
            nickname: true
          }
        }
      }
    });

    if (!friendRequest) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Friend request not found' },
        { status: 404 }
      ), request);
    }

    if (action === 'accept') {
      // Accept the request and create friendship
      await prisma.$transaction([
        // Update request status
        prisma.friendRequest.update({
          where: { id: requestId },
          data: {
            status: 'accepted',
          }
        }),
        // Create friendship (always store smaller ID as user1 for consistency)
        prisma.friendship.create({
          data: {
            user1Id: decoded.userId < friendRequest.senderId ? decoded.userId : friendRequest.senderId,
            user2Id: decoded.userId < friendRequest.senderId ? friendRequest.senderId : decoded.userId
          }
        }),
        // Notify the sender
        prisma.notification.create({
          data: {
            userId: friendRequest.senderId,
            type: 'friend_request_accepted',
            title: '친구 요청 수락됨',
            message: `${(await prisma.user.findUnique({ where: { id: decoded.userId } }))?.nickname}님이 친구 요청을 수락했습니다.`
          }
        })
      ]);

      return withCORS(NextResponse.json({
        success: true,
        message: 'Friend request accepted'
      }), request);

    } else {
      // Reject the request
      await prisma.friendRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected',
        }
      });

      return withCORS(NextResponse.json({
        success: true,
        message: 'Friend request rejected'
      }), request);
    }

  } catch (error) {
    console.error('Handle friend request error:', error);
    return withCORS(NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    ), request);
  }
}

// DELETE - Cancel sent friend request
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
    const requestId = searchParams.get('requestId');

    if (!requestId) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Request ID is required' },
        { status: 400 }
      ), request);
    }

    // Find and cancel the request
    const friendRequest = await prisma.friendRequest.findFirst({
      where: {
        id: requestId,
        senderId: decoded.userId,
        status: 'pending'
      }
    });

    if (!friendRequest) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Friend request not found' },
        { status: 404 }
      ), request);
    }

    await prisma.friendRequest.update({
      where: { id: requestId },
      data: {
        status: 'cancelled',
      }
    });

    return withCORS(NextResponse.json({
      success: true,
      message: 'Friend request cancelled'
    }), request);

  } catch (error) {
    console.error('Cancel friend request error:', error);
    return withCORS(NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    ), request);
  }
}
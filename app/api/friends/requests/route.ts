import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { verifyAccessToken } from '@/lib/jwt';
import { handleOptions, withCORS } from '@/lib/utils/cors';
import { z } from 'zod';
import { getSocketInstance } from '@/lib/socket/server';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

const sendRequestSchema = z.object({
  receiverId: z.string().uuid()
});

// POST - Send friend request
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validation = sendRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return withCORS(NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      ), request);
    }

    const { receiverId } = validation.data;

    // Check if the receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId }
    });

    if (!receiver) {
      return withCORS(NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      ), request);
    }

    // Check if they're already friends
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: decoded.userId, user2Id: receiverId },
          { user1Id: receiverId, user2Id: decoded.userId }
        ]
      }
    });

    if (existingFriendship) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Already friends with this user' },
        { status: 400 }
      ), request);
    }

    // Check if there's already a pending request
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: decoded.userId, receiverId, status: 'pending' },
          { senderId: receiverId, receiverId: decoded.userId, status: 'pending' }
        ]
      }
    });

    if (existingRequest) {
      if (existingRequest.senderId === receiverId) {
        // Auto-accept if the other user already sent a request
        await prisma.$transaction([
          prisma.friendRequest.update({
            where: { id: existingRequest.id },
            data: {
              status: 'accepted'
            }
          }),
          prisma.friendship.create({
            data: {
              user1Id: decoded.userId < receiverId ? decoded.userId : receiverId,
              user2Id: decoded.userId < receiverId ? receiverId : decoded.userId
            }
          })
        ]);

        return withCORS(NextResponse.json({
          success: true,
          message: 'Friend request accepted automatically'
        }), request);
      }

      return withCORS(NextResponse.json(
        { success: false, error: 'Friend request already pending' },
        { status: 400 }
      ), request);
    }

    // Get sender information
    const sender = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        nickname: true,
        profileImageUrl: true
      }
    });

    // Create new friend request
    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId: decoded.userId,
        receiverId,
        status: 'pending'
      },
      include: {
        receiver: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        sender: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        }
      }
    });

    // Create notification for receiver
    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'friend_request',
        title: 'New Friend Request',
        message: `${sender?.nickname || 'Someone'} sent you a friend request`,
      }
    });

    // Send real-time notification via Socket.io
    try {
      const io = getSocketInstance();
      if (io) {
        // Find receiver's socket connections
        const activeConnections = (io as any).activeConnections as Map<string, Set<string>>;
        const receiverSockets = activeConnections?.get(receiverId);
        
        if (receiverSockets && receiverSockets.size > 0) {
          receiverSockets.forEach((socketId) => {
            io.to(socketId).emit('friend_request_received', {
              request: friendRequest,
              sender: friendRequest.sender,
              timestamp: new Date()
            });
          });
        }
      }
    } catch (socketError) {
      console.error('Socket notification error:', socketError);
      // Continue even if socket notification fails
    }

    return withCORS(NextResponse.json({
      success: true,
      friendRequest
    }), request);

  } catch (error) {
    console.error('Send friend request error:', error);
    return withCORS(NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    ), request);
  }
}

const respondRequestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['accept', 'reject'])
});

// PUT - Accept or reject friend request
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const validation = respondRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return withCORS(NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      ), request);
    }

    const { requestId, action } = validation.data;

    // Find the friend request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
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

    if (friendRequest.receiverId !== decoded.userId) {
      return withCORS(NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      ), request);
    }

    if (friendRequest.status !== 'pending') {
      return withCORS(NextResponse.json(
        { success: false, error: 'Request already responded' },
        { status: 400 }
      ), request);
    }

    if (action === 'accept') {
      // Get receiver information
      const receiver = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          nickname: true,
          profileImageUrl: true
        }
      });

      // Accept the request and create friendship
      await prisma.$transaction([
        prisma.friendRequest.update({
          where: { id: requestId },
          data: {
            status: 'accepted'
          }
        }),
        prisma.friendship.create({
          data: {
            user1Id: friendRequest.senderId < decoded.userId ? friendRequest.senderId : decoded.userId,
            user2Id: friendRequest.senderId < decoded.userId ? decoded.userId : friendRequest.senderId
          }
        }),
        prisma.notification.create({
          data: {
            userId: friendRequest.senderId,
            type: 'friend_request_accepted',
            title: 'Friend Request Accepted',
            message: `${receiver?.nickname || 'Someone'} accepted your friend request`,
          }
        })
      ]);

      // Send real-time notification via Socket.io
      try {
        const io = getSocketInstance();
        if (io) {
          const activeConnections = (io as any).activeConnections as Map<string, Set<string>>;
          const senderSockets = activeConnections?.get(friendRequest.senderId);
          
          if (senderSockets && senderSockets.size > 0) {
            senderSockets.forEach((socketId) => {
              io.to(socketId).emit('friend_request_accepted', {
                receiver,
                requestId,
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
        message: 'Friend request accepted'
      }), request);
    } else {
      // Reject the request
      await prisma.friendRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected'
        }
      });

      // Send real-time notification via Socket.io
      try {
        const io = getSocketInstance();
        if (io) {
          const activeConnections = (io as any).activeConnections as Map<string, Set<string>>;
          const senderSockets = activeConnections?.get(friendRequest.senderId);
          
          if (senderSockets && senderSockets.size > 0) {
            senderSockets.forEach((socketId) => {
              io.to(socketId).emit('friend_request_rejected', {
                requestId,
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
        message: 'Friend request rejected'
      }), request);
    }

  } catch (error) {
    console.error('Respond to friend request error:', error);
    return withCORS(NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    ), request);
  }
}
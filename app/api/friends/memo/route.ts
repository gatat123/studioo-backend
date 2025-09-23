import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { verifyAccessToken } from '@/lib/jwt';
import { handleOptions, withCORS } from '@/lib/utils/cors';
import { z } from 'zod';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

const updateMemoSchema = z.object({
  friendId: z.string().uuid(),
  memo: z.string().max(500).optional()
});

// PUT - Update friend memo
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
    const validation = updateMemoSchema.safeParse(body);
    
    if (!validation.success) {
      return withCORS(NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      ), request);
    }

    const { friendId, memo } = validation.data;

    // Find the friendship
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

    // Update the memo based on which user is updating
    const updateData: any = friendship.user1Id === decoded.userId 
      ? { user1Memo: memo || null }
      : { user2Memo: memo || null };

    try {
      const updatedFriendship = await prisma.friendship.update({
        where: { id: friendship.id },
        data: updateData
      });

      return withCORS(NextResponse.json({
        success: true,
        message: 'Memo updated successfully',
        memo: friendship.user1Id === decoded.userId ? (updatedFriendship as any).user1Memo : (updatedFriendship as any).user2Memo
      }), request);
    } catch (dbError: any) {
      // If memo columns don't exist, return success but indicate feature is not available
      if (dbError.code === 'P2022') {
        console.log('Memo columns not yet added to database');
        return withCORS(NextResponse.json({
          success: true,
          message: 'Memo feature pending database update',
          memo: null
        }), request);
      }
      throw dbError;
    }

  } catch (error) {
    console.error('Update friend memo error:', error);
    return withCORS(NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    ), request);
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { verifyAccessToken } from '@/lib/jwt';
import { handleOptions, withCORS } from '@/lib/utils/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return withCORS(NextResponse.json(
        {
          success: false,
          error: 'No token provided',
          user: null
        },
        { status: 401 }
      ), request);
    }

    try {
      const decoded = verifyAccessToken(token);

      if (!decoded || !decoded.userId) {
        return withCORS(NextResponse.json(
          {
            success: false,
            error: 'Invalid token',
            user: null
          },
          { status: 401 }
        ), request);
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          email: true,
          nickname: true,
          profileImageUrl: true,
          isAdmin: true,
          studio: {
            select: {
              id: true,
              name: true,
              description: true,
            }
          }
        }
      });

      if (!user) {
        return withCORS(NextResponse.json(
          {
            success: false,
            error: 'User not found',
            user: null
          },
          { status: 404 }
        ), request);
      }

      return withCORS(NextResponse.json({
        success: true,
        user,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
      }), request);

    } catch (error) {
      console.error('Token verification error:', error);
      return withCORS(NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired token',
          user: null
        },
        { status: 401 }
      ), request);
    }
  } catch (error) {
    console.error('Auth me error:', error);
    return withCORS(NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        user: null
      },
      { status: 500 }
    ), request);
  }
}
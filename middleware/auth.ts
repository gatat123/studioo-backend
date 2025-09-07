import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { verifyToken } from '@/lib/utils/jwt';
import { prisma } from '@/lib/prisma';

export interface AuthenticatedRequest extends NextRequest {
  user: {
    userId: string;
    isAdmin: boolean;
  };
}

export async function withAuth(
  handler: (req: AuthenticatedRequest, ...params: string[]) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: { params: any }) => {
    // Add CORS headers to all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
        ? 'https://studioo-production-eb03.up.railway.app' 
        : '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };

    const session = await getServerSession(authOptions);
    let userId: string;
    let isAdmin = false;
    
    if (!session?.user?.id) {
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }

      try {
        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        userId = payload.userId;
        
        // Get user admin status
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { isAdmin: true }
        });
        isAdmin = user?.isAdmin || false;
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Invalid token' },
          { status: 401, headers: corsHeaders }
        );
      }
    } else {
      userId = session.user.id;
      isAdmin = session.user.isAdmin || false;
    }

    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = { userId, isAdmin };

    // Handle parameters from dynamic routes
    const params = context?.params || {};
    const paramValues = Object.values(params);
    
    const response = await handler(authenticatedRequest, ...paramValues);
    
    // Add CORS headers to successful responses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  };
}

export async function withProjectAccess(
  handler: (req: AuthenticatedRequest, projectId: string) => Promise<NextResponse>
) {
  return withAuth(async (req: AuthenticatedRequest, projectId: string) => {
    try {
      // Check if user has access to the project
      const hasAccess = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { creatorId: req.user.userId },
            { 
              participants: {
                some: { userId: req.user.userId }
              }
            }
          ]
        }
      });

      if (!hasAccess && !req.user.isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Project access denied' },
          { status: 403 }
        );
      }

      return handler(req, projectId);
    } catch (error) {
      console.error('Project access check error:', error);
      return NextResponse.json(
        { success: false, error: 'Access check failed' },
        { status: 500 }
      );
    }
  });
}

export async function withSceneAccess(
  handler: (req: AuthenticatedRequest, sceneId: string) => Promise<NextResponse>
) {
  return withAuth(async (req: AuthenticatedRequest, sceneId: string) => {
    try {
      // Check if user has access to the scene through project
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          project: {
            include: {
              participants: true
            }
          }
        }
      });

      if (!scene) {
        return NextResponse.json(
          { success: false, error: 'Scene not found' },
          { status: 404 }
        );
      }

      const hasAccess = scene.project.creatorId === req.user.userId ||
        scene.project.participants.some(p => p.userId === req.user.userId) ||
        req.user.isAdmin;

      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: 'Scene access denied' },
          { status: 403 }
        );
      }

      return handler(req, sceneId);
    } catch (error) {
      console.error('Scene access check error:', error);
      return NextResponse.json(
        { success: false, error: 'Access check failed' },
        { status: 500 }
      );
    }
  });
}

export async function withAdminAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(async (req: AuthenticatedRequest) => {
    if (!req.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    return handler(req);
  });
}
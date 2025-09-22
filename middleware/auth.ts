import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { verifyToken } from '@/lib/utils/jwt';
import { prisma } from '@/lib/prisma';

export interface AuthenticatedRequest extends NextRequest {
  user: {
    userId: string;
    isAdmin: boolean;
    roles?: string[];
    permissions?: string[];
  };
}

export function withAuth(
  handler: (req: AuthenticatedRequest, context: { params: any }) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: { params: Promise<any> }) => {
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

    // Await params if it's a Promise (Next.js 15.5+)
    const resolvedParams = await context.params;
    
    const response = await handler(authenticatedRequest, { params: resolvedParams });
    
    // Add CORS headers to successful responses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  };
}

export function withProjectAccess(
  handler: (req: AuthenticatedRequest, context: { params: { id: string } }) => Promise<NextResponse>
) {
  return withAuth(async (req: AuthenticatedRequest, context: { params: any }) => {
    try {
      const projectId = context.params.id;
      if (!projectId) {
        return NextResponse.json(
          { success: false, error: 'Project ID is required' },
          { status: 400 }
        );
      }
      
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

      return handler(req, { params: { id: projectId } });
    } catch (error) {
      console.error('Project access check error:', error);
      return NextResponse.json(
        { success: false, error: 'Access check failed' },
        { status: 500 }
      );
    }
  });
}

export function withSceneAccess(
  handler: (req: AuthenticatedRequest, sceneId: string) => Promise<NextResponse>
) {
  return withAuth(async (req: AuthenticatedRequest, context: { params: any }) => {
    const sceneId = context.params.id;
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

// ============================================================================
// RBAC MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * Get user's roles and permissions from database
 */
async function getUserPermissions(userId: string): Promise<{
  roles: string[];
  permissions: string[];
}> {
  try {
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    const roles = userRoles.map(ur => ur.role.name);
    const permissionSet = new Set<string>();

    userRoles.forEach(ur => {
      ur.role.permissions.forEach(rp => {
        permissionSet.add(rp.permission.name);
      });
    });

    return {
      roles,
      permissions: Array.from(permissionSet)
    };
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return { roles: [], permissions: [] };
  }
}

/**
 * Enhanced auth middleware that loads user roles and permissions
 */
export function withRoleAuth(
  handler: (req: AuthenticatedRequest, context: { params: any }) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: { params: Promise<any> }) => {
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

    // Get user roles and permissions
    const { roles, permissions } = await getUserPermissions(userId);

    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = {
      userId,
      isAdmin,
      roles,
      permissions
    };

    // Await params if it's a Promise (Next.js 15.5+)
    const resolvedParams = await context.params;

    const response = await handler(authenticatedRequest, { params: resolvedParams });

    // Add CORS headers to successful responses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user: AuthenticatedRequest['user'], permission: string): boolean {
  if (user.isAdmin) return true;
  return user.permissions?.includes(permission) || false;
}

/**
 * Check if user has specific role
 */
export function hasRole(user: AuthenticatedRequest['user'], role: string): boolean {
  if (user.isAdmin && role === 'admin') return true;
  return user.roles?.includes(role) || false;
}

/**
 * Middleware that requires specific permission
 */
export function withPermission(
  requiredPermission: string,
  handler: (req: AuthenticatedRequest, context: { params: any }) => Promise<NextResponse>
) {
  return withRoleAuth(async (req: AuthenticatedRequest, context: { params: any }) => {
    if (!hasPermission(req.user, requiredPermission)) {
      return NextResponse.json(
        {
          success: false,
          error: `Permission '${requiredPermission}' required`,
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }

    return handler(req, context);
  });
}

/**
 * Middleware that requires specific role
 */
export function withRole(
  requiredRole: string,
  handler: (req: AuthenticatedRequest, context: { params: any }) => Promise<NextResponse>
) {
  return withRoleAuth(async (req: AuthenticatedRequest, context: { params: any }) => {
    if (!hasRole(req.user, requiredRole)) {
      return NextResponse.json(
        {
          success: false,
          error: `Role '${requiredRole}' required`,
          code: 'INSUFFICIENT_ROLE'
        },
        { status: 403 }
      );
    }

    return handler(req, context);
  });
}

/**
 * Middleware that requires ANY of the specified permissions
 */
export function withAnyPermission(
  permissions: string[],
  handler: (req: AuthenticatedRequest, context: { params: any }) => Promise<NextResponse>
) {
  return withRoleAuth(async (req: AuthenticatedRequest, context: { params: any }) => {
    const hasAnyPermission = permissions.some(permission => hasPermission(req.user, permission));

    if (!hasAnyPermission) {
      return NextResponse.json(
        {
          success: false,
          error: `One of the following permissions required: ${permissions.join(', ')}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }

    return handler(req, context);
  });
}

/**
 * Middleware for admin-level permissions (system management)
 */
export function withAdminPermission(
  handler: (req: AuthenticatedRequest, context: { params: any }) => Promise<NextResponse>
) {
  return withPermission('admin:system', handler);
}
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminPermission } from '@/middleware/auth';

// GET /api/admin/permissions
export const GET = withAdminPermission(async (req) => {
  try {
    const url = new URL(req.url);
    const resource = url.searchParams.get('resource');
    const action = url.searchParams.get('action');
    const search = url.searchParams.get('search');
    const groupByResource = url.searchParams.get('groupByResource') === 'true';

    const where: any = {};

    if (resource) {
      where.resource = resource;
    }

    if (action) {
      where.action = action;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } }
      ];
    }

    const permissions = await prisma.permission.findMany({
      where,
      include: {
        _count: {
          select: {
            roles: true
          }
        }
      },
      orderBy: [
        { resource: 'asc' },
        { action: 'asc' },
        { name: 'asc' }
      ]
    });

    let responseData: any = permissions;

    if (groupByResource) {
      const grouped = permissions.reduce((acc, permission) => {
        const resource = permission.resource;
        if (!acc[resource]) {
          acc[resource] = [];
        }
        acc[resource].push(permission);
        return acc;
      }, {} as Record<string, typeof permissions>);

      responseData = grouped;
    }

    // Get resource and action options
    const resources = await prisma.permission.findMany({
      select: { resource: true },
      distinct: ['resource'],
      orderBy: { resource: 'asc' }
    });

    const actions = await prisma.permission.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: {
        permissions: responseData,
        meta: {
          availableResources: resources.map(r => r.resource),
          availableActions: actions.map(a => a.action),
          total: permissions.length
        }
      }
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch permissions',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});

// POST /api/admin/permissions
export const POST = withAdminPermission(async (req) => {
  try {
    const body = await req.json();
    const { resource, action, description } = body;

    if (!resource || !action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Resource and action are required'
        },
        { status: 400 }
      );
    }

    const resourceTrimmed = resource.trim().toLowerCase();
    const actionTrimmed = action.trim().toLowerCase();
    const permissionName = `${resourceTrimmed}:${actionTrimmed}`;

    // Check if permission already exists
    const existingPermission = await prisma.permission.findUnique({
      where: {
        resource_action: {
          resource: resourceTrimmed,
          action: actionTrimmed
        }
      }
    });

    if (existingPermission) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission with this resource and action already exists'
        },
        { status: 409 }
      );
    }

    const permission = await prisma.permission.create({
      data: {
        name: permissionName,
        resource: resourceTrimmed,
        action: actionTrimmed,
        description: description?.trim() || null,
      },
      include: {
        _count: {
          select: {
            roles: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: permission
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create permission',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});

// PUT /api/admin/permissions
export const PUT = withAdminPermission(async (req) => {
  try {
    const body = await req.json();
    const { permissionId, resource, action, description } = body;

    if (!permissionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission ID is required'
        },
        { status: 400 }
      );
    }

    // Check if permission exists and is not a system permission
    const existingPermission = await prisma.permission.findUnique({
      where: { id: permissionId }
    });

    if (!existingPermission) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission not found'
        },
        { status: 404 }
      );
    }

    if (existingPermission.isSystem) {
      return NextResponse.json(
        {
          success: false,
          error: 'System permissions cannot be modified'
        },
        { status: 403 }
      );
    }

    const updateData: any = {};

    if (resource !== undefined) {
      updateData.resource = resource.trim().toLowerCase();
    }

    if (action !== undefined) {
      updateData.action = action.trim().toLowerCase();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    // Update name if resource or action changed
    if (updateData.resource || updateData.action) {
      const newResource = updateData.resource || existingPermission.resource;
      const newAction = updateData.action || existingPermission.action;
      updateData.name = `${newResource}:${newAction}`;

      // Check if new combination already exists
      if (newResource !== existingPermission.resource || newAction !== existingPermission.action) {
        const conflictingPermission = await prisma.permission.findFirst({
          where: {
            resource: newResource,
            action: newAction,
            id: { not: permissionId }
          }
        });

        if (conflictingPermission) {
          return NextResponse.json(
            {
              success: false,
              error: 'Permission with this resource and action already exists'
            },
            { status: 409 }
          );
        }
      }
    }

    const permission = await prisma.permission.update({
      where: { id: permissionId },
      data: updateData,
      include: {
        _count: {
          select: {
            roles: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: permission
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update permission',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/permissions
export const DELETE = withAdminPermission(async (req) => {
  try {
    const url = new URL(req.url);
    const permissionId = url.searchParams.get('permissionId');

    if (!permissionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission ID is required'
        },
        { status: 400 }
      );
    }

    // Check if permission exists and is not a system permission
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        _count: {
          select: {
            roles: true
          }
        }
      }
    });

    if (!permission) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission not found'
        },
        { status: 404 }
      );
    }

    if (permission.isSystem) {
      return NextResponse.json(
        {
          success: false,
          error: 'System permissions cannot be deleted'
        },
        { status: 403 }
      );
    }

    if (permission._count.roles > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete permission. It is currently assigned to ${permission._count.roles} role(s).`,
          code: 'PERMISSION_IN_USE'
        },
        { status: 409 }
      );
    }

    // Delete permission
    await prisma.permission.delete({
      where: { id: permissionId }
    });

    return NextResponse.json({
      success: true,
      message: 'Permission deleted successfully'
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete permission',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});
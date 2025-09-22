import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminPermission } from '@/middleware/auth';

// GET /api/admin/roles
export const GET = withAdminPermission(async (req) => {
  try {
    const url = new URL(req.url);
    const includePermissions = url.searchParams.get('includePermissions') === 'true';
    const includeUserCount = url.searchParams.get('includeUserCount') === 'true';
    const search = url.searchParams.get('search');

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const roles = await prisma.role.findMany({
      where,
      include: {
        permissions: includePermissions ? {
          include: {
            permission: true
          }
        } : false,
        _count: includeUserCount ? {
          select: {
            userRoles: {
              where: {
                isActive: true,
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } }
                ]
              }
            }
          }
        } : false
      },
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json({
      success: true,
      data: roles
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch roles',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});

// POST /api/admin/roles
export const POST = withAdminPermission(async (req) => {
  try {
    const body = await req.json();
    const { name, description, permissions = [] } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role name is required'
        },
        { status: 400 }
      );
    }

    // Check if role already exists
    const existingRole = await prisma.role.findUnique({
      where: { name: name.trim() }
    });

    if (existingRole) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role with this name already exists'
        },
        { status: 409 }
      );
    }

    // Create role with permissions in a transaction
    const role = await prisma.$transaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
        }
      });

      // Add permissions if provided
      if (permissions.length > 0) {
        // Verify all permissions exist
        const existingPermissions = await tx.permission.findMany({
          where: {
            id: {
              in: permissions
            }
          }
        });

        if (existingPermissions.length !== permissions.length) {
          throw new Error('One or more permissions do not exist');
        }

        // Create role-permission relationships
        await tx.rolePermission.createMany({
          data: permissions.map((permissionId: string) => ({
            roleId: newRole.id,
            permissionId
          }))
        });
      }

      // Return role with permissions
      return tx.role.findUnique({
        where: { id: newRole.id },
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      });
    });

    return NextResponse.json({
      success: true,
      data: role
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create role',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});

// PUT /api/admin/roles (bulk update or general update)
export const PUT = withAdminPermission(async (req) => {
  try {
    const body = await req.json();
    const { roleId, name, description, permissions } = body;

    if (!roleId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role ID is required'
        },
        { status: 400 }
      );
    }

    // Check if role exists and is not a system role
    const existingRole = await prisma.role.findUnique({
      where: { id: roleId }
    });

    if (!existingRole) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role not found'
        },
        { status: 404 }
      );
    }

    if (existingRole.isSystem) {
      return NextResponse.json(
        {
          success: false,
          error: 'System roles cannot be modified'
        },
        { status: 403 }
      );
    }

    const role = await prisma.$transaction(async (tx) => {
      // Update role basic info
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;

      if (Object.keys(updateData).length > 0) {
        await tx.role.update({
          where: { id: roleId },
          data: updateData
        });
      }

      // Update permissions if provided
      if (permissions !== undefined) {
        // Remove existing permissions
        await tx.rolePermission.deleteMany({
          where: { roleId }
        });

        // Add new permissions
        if (permissions.length > 0) {
          // Verify all permissions exist
          const existingPermissions = await tx.permission.findMany({
            where: {
              id: {
                in: permissions
              }
            }
          });

          if (existingPermissions.length !== permissions.length) {
            throw new Error('One or more permissions do not exist');
          }

          await tx.rolePermission.createMany({
            data: permissions.map((permissionId: string) => ({
              roleId,
              permissionId
            }))
          });
        }
      }

      // Return updated role with permissions
      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      });
    });

    return NextResponse.json({
      success: true,
      data: role
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update role',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/roles
export const DELETE = withAdminPermission(async (req) => {
  try {
    const url = new URL(req.url);
    const roleId = url.searchParams.get('roleId');

    if (!roleId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role ID is required'
        },
        { status: 400 }
      );
    }

    // Check if role exists and is not a system role
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: {
            userRoles: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    if (!role) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role not found'
        },
        { status: 404 }
      );
    }

    if (role.isSystem) {
      return NextResponse.json(
        {
          success: false,
          error: 'System roles cannot be deleted'
        },
        { status: 403 }
      );
    }

    if (role._count.userRoles > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete role. ${role._count.userRoles} users are currently assigned to this role.`,
          code: 'ROLE_IN_USE'
        },
        { status: 409 }
      );
    }

    // Delete role (cascade will handle permissions)
    await prisma.role.delete({
      where: { id: roleId }
    });

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully'
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete role',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});
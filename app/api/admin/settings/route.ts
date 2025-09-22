import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminPermission } from '@/middleware/auth';

// GET /api/admin/settings
export const GET = withAdminPermission(async (req) => {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const key = url.searchParams.get('key');
    const isPublic = url.searchParams.get('public') === 'true';
    const search = url.searchParams.get('search');

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (key) {
      where.key = key;
    }

    if (isPublic !== undefined) {
      where.isPublic = isPublic;
    }

    if (search) {
      where.OR = [
        { key: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { value: { contains: search, mode: 'insensitive' } }
      ];
    }

    const settings = await prisma.systemSetting.findMany({
      where,
      include: {
        updatedByUser: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      },
      orderBy: [
        { category: 'asc' },
        { key: 'asc' }
      ]
    });

    // Get categories for filtering
    const categories = await prisma.systemSetting.findMany({
      select: { category: true },
      distinct: ['category'],
      where: { category: { not: null } },
      orderBy: { category: 'asc' }
    });

    // Group by category if requested
    const groupByCategory = url.searchParams.get('groupByCategory') === 'true';
    let responseData: any = settings;

    if (groupByCategory) {
      const grouped = settings.reduce((acc, setting) => {
        const category = setting.category || 'uncategorized';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(setting);
        return acc;
      }, {} as Record<string, typeof settings>);

      responseData = grouped;
    }

    return NextResponse.json({
      success: true,
      data: {
        settings: responseData,
        meta: {
          availableCategories: categories.map(c => c.category).filter(Boolean),
          total: settings.length
        }
      }
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch settings',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});

// POST /api/admin/settings
export const POST = withAdminPermission(async (req) => {
  try {
    const body = await req.json();
    const { key, value, type = 'string', description, isPublic = false, category } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Key and value are required'
        },
        { status: 400 }
      );
    }

    const validTypes = ['string', 'number', 'boolean', 'json'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Type must be one of: ${validTypes.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validate value based on type
    let processedValue = value;
    try {
      switch (type) {
        case 'number':
          processedValue = String(Number(value));
          if (isNaN(Number(processedValue))) {
            throw new Error('Invalid number');
          }
          break;
        case 'boolean':
          processedValue = String(Boolean(value));
          break;
        case 'json':
          if (typeof value !== 'object') {
            JSON.parse(value); // Validate JSON string
          }
          processedValue = typeof value === 'object' ? JSON.stringify(value) : value;
          break;
        default:
          processedValue = String(value);
      }
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid value for type ${type}`
        },
        { status: 400 }
      );
    }

    // Check if setting already exists
    const existingSetting = await prisma.systemSetting.findUnique({
      where: { key: key.trim() }
    });

    if (existingSetting) {
      return NextResponse.json(
        {
          success: false,
          error: 'Setting with this key already exists'
        },
        { status: 409 }
      );
    }

    const setting = await prisma.systemSetting.create({
      data: {
        key: key.trim(),
        value: processedValue,
        type,
        description: description?.trim() || null,
        isPublic: Boolean(isPublic),
        category: category?.trim() || null,
        updatedBy: req.user.userId
      },
      include: {
        updatedByUser: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: setting
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create setting',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});

// PUT /api/admin/settings
export const PUT = withAdminPermission(async (req) => {
  try {
    const body = await req.json();
    const { settingId, key, value, type, description, isPublic, category } = body;

    if (!settingId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Setting ID is required'
        },
        { status: 400 }
      );
    }

    // Check if setting exists
    const existingSetting = await prisma.systemSetting.findUnique({
      where: { id: settingId }
    });

    if (!existingSetting) {
      return NextResponse.json(
        {
          success: false,
          error: 'Setting not found'
        },
        { status: 404 }
      );
    }

    const updateData: any = {
      updatedBy: req.user.userId
    };

    if (key !== undefined) {
      updateData.key = key.trim();

      // Check if new key conflicts with existing settings
      if (key.trim() !== existingSetting.key) {
        const conflictingSetting = await prisma.systemSetting.findUnique({
          where: { key: key.trim() }
        });

        if (conflictingSetting) {
          return NextResponse.json(
            {
              success: false,
              error: 'Setting with this key already exists'
            },
            { status: 409 }
          );
        }
      }
    }

    if (type !== undefined) {
      const validTypes = ['string', 'number', 'boolean', 'json'];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          {
            success: false,
            error: `Type must be one of: ${validTypes.join(', ')}`
          },
          { status: 400 }
        );
      }
      updateData.type = type;
    }

    if (value !== undefined) {
      const valueType = type || existingSetting.type;
      let processedValue = value;

      try {
        switch (valueType) {
          case 'number':
            processedValue = String(Number(value));
            if (isNaN(Number(processedValue))) {
              throw new Error('Invalid number');
            }
            break;
          case 'boolean':
            processedValue = String(Boolean(value));
            break;
          case 'json':
            if (typeof value !== 'object') {
              JSON.parse(value); // Validate JSON string
            }
            processedValue = typeof value === 'object' ? JSON.stringify(value) : value;
            break;
          default:
            processedValue = String(value);
        }
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid value for type ${valueType}`
          },
          { status: 400 }
        );
      }

      updateData.value = processedValue;
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (isPublic !== undefined) {
      updateData.isPublic = Boolean(isPublic);
    }

    if (category !== undefined) {
      updateData.category = category?.trim() || null;
    }

    const setting = await prisma.systemSetting.update({
      where: { id: settingId },
      data: updateData,
      include: {
        updatedByUser: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: setting
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update setting',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/settings
export const DELETE = withAdminPermission(async (req) => {
  try {
    const url = new URL(req.url);
    const settingId = url.searchParams.get('settingId');
    const key = url.searchParams.get('key');

    if (!settingId && !key) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either settingId or key is required'
        },
        { status: 400 }
      );
    }

    const where: any = {};
    if (settingId) {
      where.id = settingId;
    } else if (key) {
      where.key = key;
    }

    // Check if setting exists
    const setting = await prisma.systemSetting.findFirst({ where });

    if (!setting) {
      return NextResponse.json(
        {
          success: false,
          error: 'Setting not found'
        },
        { status: 404 }
      );
    }

    // Delete setting
    await prisma.systemSetting.delete({ where });

    return NextResponse.json({
      success: true,
      message: 'Setting deleted successfully'
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete setting',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});
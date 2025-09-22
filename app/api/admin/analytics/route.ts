import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminPermission } from '@/middleware/auth';

// GET /api/admin/analytics
export const GET = withAdminPermission(async (req) => {
  try {
    const url = new URL(req.url);
    const metric = url.searchParams.get('metric');
    const aggregation = url.searchParams.get('aggregation') || 'daily';
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    // Build where clause
    const where: any = {
      aggregation,
    };

    if (metric) {
      where.metric = metric;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Get analytics data
    const analytics = await prisma.analytics.findMany({
      where,
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
    });

    // Get summary statistics
    const summary = await prisma.analytics.groupBy({
      by: ['metric'],
      _avg: {
        value: true
      },
      _sum: {
        value: true
      },
      _count: {
        id: true
      },
      where,
    });

    // Get unique metrics
    const metrics = await prisma.analytics.findMany({
      select: {
        metric: true
      },
      distinct: ['metric'],
      orderBy: {
        metric: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        analytics,
        summary,
        availableMetrics: metrics.map(m => m.metric),
        total: analytics.length
      }
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics data',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});

// POST /api/admin/analytics
export const POST = withAdminPermission(async (req) => {
  try {
    const body = await req.json();
    const { metric, value, metadata, aggregation = 'daily' } = body;

    if (!metric || value === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Metric and value are required'
        },
        { status: 400 }
      );
    }

    const analyticsEntry = await prisma.analytics.create({
      data: {
        metric,
        value: parseFloat(value),
        metadata: metadata || null,
        aggregation,
      }
    });

    return NextResponse.json({
      success: true,
      data: analyticsEntry
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create analytics entry',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/analytics
export const DELETE = withAdminPermission(async (req) => {
  try {
    const url = new URL(req.url);
    const metric = url.searchParams.get('metric');
    const before = url.searchParams.get('before');

    if (!metric && !before) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either metric or before date is required for deletion'
        },
        { status: 400 }
      );
    }

    const where: any = {};
    if (metric) {
      where.metric = metric;
    }
    if (before) {
      where.timestamp = { lt: new Date(before) };
    }

    const result = await prisma.analytics.deleteMany({
      where
    });

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: result.count
      }
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete analytics data',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});
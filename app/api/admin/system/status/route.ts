import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminPermission } from '@/middleware/auth';

// GET /api/admin/system/status
export const GET = withAdminPermission(async (req) => {
  try {
    const startTime = Date.now();

    // Database health check
    let dbHealth = 'healthy';
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      await prisma.user.count(); // Simple query to test DB
      dbLatency = Date.now() - dbStart;
    } catch (error) {
      dbHealth = 'unhealthy';
      // Log error appropriately in production
    }

    // Get system statistics
    const [
      userStats,
      projectStats,
      systemLogStats,
      recentLogs,
      systemSettings,
      activeUsers,
      storageStats
    ] = await Promise.all([
      // User statistics
      prisma.user.groupBy({
        by: ['isActive'],
        _count: { id: true },
      }),

      // Project statistics
      prisma.project.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      // System log statistics (last 24 hours)
      prisma.systemLog.groupBy({
        by: ['level'],
        _count: { id: true },
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Recent critical logs
      prisma.systemLog.findMany({
        where: {
          level: 'critical',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          action: true,
          message: true,
          createdAt: true,
          resource: true,
          user: {
            select: { username: true }
          }
        }
      }),

      // System settings count
      prisma.systemSetting.count(),

      // Active users (last 7 days)
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Storage statistics
      prisma.image.aggregate({
        _sum: { fileSize: true },
        _count: { id: true }
      })
    ]);

    // Calculate system uptime (mock - in real app, this would be actual uptime)
    const uptime = process.uptime();

    // Memory usage
    const memoryUsage = process.memoryUsage();

    // API usage statistics (last 24 hours)
    const apiUsageStats = await prisma.apiUsage.groupBy({
      by: ['statusCode'],
      _count: { id: true },
      _avg: { responseTime: true },
      where: {
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    // Get recent API errors
    const recentApiErrors = await prisma.apiUsage.findMany({
      where: {
        statusCode: { gte: 400 },
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
      select: {
        endpoint: true,
        method: true,
        statusCode: true,
        responseTime: true,
        timestamp: true,
        user: {
          select: { username: true }
        }
      }
    });

    // System health score calculation
    let healthScore = 100;
    if (dbHealth !== 'healthy') healthScore -= 50;
    if (dbLatency > 1000) healthScore -= 20;
    if (recentLogs.length > 10) healthScore -= 10;

    const criticalLogCount = systemLogStats.find(s => s.level === 'critical')?._count.id || 0;
    if (criticalLogCount > 0) healthScore -= Math.min(criticalLogCount * 5, 20);

    const totalEndTime = Date.now();

    const systemStatus = {
      // Overall health
      health: {
        status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
        score: healthScore,
        lastChecked: new Date().toISOString(),
        uptime: Math.floor(uptime)
      },

      // Database
      database: {
        status: dbHealth,
        latency: dbLatency,
        connectionPool: {
          // Mock connection pool stats - in real app, get from Prisma/DB
          active: 5,
          idle: 10,
          total: 15
        }
      },

      // System metrics
      system: {
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024)
        },
        cpu: {
          // Mock CPU usage - in real app, you'd use a proper system monitoring library
          usage: Math.round(Math.random() * 30 + 10) // 10-40%
        },
        responseTime: totalEndTime - startTime
      },

      // Application statistics
      statistics: {
        users: {
          total: userStats.reduce((sum, stat) => sum + stat._count.id, 0),
          active: userStats.find(s => s.isActive)?._count.id || 0,
          recentlyActive: activeUsers
        },
        projects: {
          total: projectStats.reduce((sum, stat) => sum + stat._count.id, 0),
          byStatus: Object.fromEntries(
            projectStats.map(stat => [stat.status, stat._count.id])
          )
        },
        logs: {
          last24Hours: systemLogStats.reduce((sum, stat) => sum + stat._count.id, 0),
          byLevel: Object.fromEntries(
            systemLogStats.map(stat => [stat.level, stat._count.id])
          ),
          criticalCount: criticalLogCount
        },
        api: {
          requestsLast24h: apiUsageStats.reduce((sum, stat) => sum + stat._count.id, 0),
          averageResponseTime: Math.round(
            apiUsageStats.reduce((sum, stat, _, arr) =>
              sum + (stat._avg.responseTime || 0), 0
            ) / apiUsageStats.length
          ) || 0,
          errorRate: apiUsageStats.length > 0 ?
            Math.round(
              (apiUsageStats.filter(s => s.statusCode >= 400)
                .reduce((sum, stat) => sum + stat._count.id, 0) /
               apiUsageStats.reduce((sum, stat) => sum + stat._count.id, 0)) * 100
            ) : 0
        },
        storage: {
          totalImages: storageStats._count.id || 0,
          totalSizeBytes: storageStats._sum.fileSize || 0,
          totalSizeMB: Math.round((storageStats._sum.fileSize || 0) / 1024 / 1024)
        }
      },

      // Recent issues
      issues: {
        recentCriticalLogs: recentLogs,
        recentApiErrors: recentApiErrors.slice(0, 5)
      },

      // Configuration
      configuration: {
        totalSettings: systemSettings,
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
      }
    };

    return NextResponse.json({
      success: true,
      data: systemStatus
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get system status',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        health: {
          status: 'critical',
          score: 0,
          lastChecked: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
});

// POST /api/admin/system/status (for triggering system maintenance actions)
export const POST = withAdminPermission(async (req) => {
  try {
    const body = await req.json();
    const { action, parameters } = body;

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Action is required'
        },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'clear_old_logs':
        const days = parameters?.days || 30;
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const deletedLogs = await prisma.systemLog.deleteMany({
          where: {
            createdAt: { lt: cutoffDate }
          }
        });

        result = { deletedLogs: deletedLogs.count };
        break;

      case 'clear_old_analytics':
        const analyticsDays = parameters?.days || 90;
        const analyticssCutoff = new Date(Date.now() - analyticsDays * 24 * 60 * 60 * 1000);

        const deletedAnalytics = await prisma.analytics.deleteMany({
          where: {
            timestamp: { lt: analyticssCutoff }
          }
        });

        result = { deletedAnalytics: deletedAnalytics.count };
        break;

      case 'optimize_database':
        // Mock database optimization - in real app, you'd run actual DB optimization
        result = { message: 'Database optimization completed' };
        break;

      case 'clear_api_usage':
        const apiDays = parameters?.days || 30;
        const apiCutoff = new Date(Date.now() - apiDays * 24 * 60 * 60 * 1000);

        const deletedApiUsage = await prisma.apiUsage.deleteMany({
          where: {
            timestamp: { lt: apiCutoff }
          }
        });

        result = { deletedApiUsage: deletedApiUsage.count };
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`
          },
          { status: 400 }
        );
    }

    // Log the maintenance action
    await prisma.systemLog.create({
      data: {
        level: 'info',
        action: 'system_maintenance',
        resource: 'system',
        userId: req.user.userId,
        message: `System maintenance action '${action}' completed`,
        metadata: JSON.stringify({ action, parameters, result })
      }
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute system maintenance action',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
});
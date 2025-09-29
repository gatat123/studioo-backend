import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET /api/admin/stats - Get dashboard statistics (Admin only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get basic statistics
    const [
      totalUsers,
      activeUsers,
      totalProjects,
      activeProjects,
      totalScenes,
      totalComments,
      totalWorkTasks,
      totalSubTasks
    ] = await Promise.all([
      // Total users count
      prisma.user.count(),

      // Active users (logged in within last 30 days)
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Total projects count
      prisma.project.count(),

      // Active projects count
      prisma.project.count({
        where: {
          status: 'active'
        }
      }),

      // Total scenes count
      prisma.scene.count(),

      // Total comments count
      prisma.comment.count({
        where: {
          isDeleted: false
        }
      }),

      // Total work tasks count
      prisma.workTask.count(),

      // Total sub tasks count
      prisma.subTask.count()
    ]);

    // Get recent activities (last 7 days)
    const recentDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      recentUsers,
      recentProjects,
      recentWorkTasks,
      recentSubTasks
    ] = await Promise.all([
      prisma.user.count({
        where: {
          createdAt: {
            gte: recentDate
          }
        }
      }),

      prisma.project.count({
        where: {
          createdAt: {
            gte: recentDate
          }
        }
      }),

      prisma.workTask.count({
        where: {
          createdAt: {
            gte: recentDate
          }
        }
      }),

      prisma.subTask.count({
        where: {
          createdAt: {
            gte: recentDate
          }
        }
      })
    ]);

    // SubTask status distribution
    const subTaskStatusStats = await prisma.subTask.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    // WorkTask priority distribution
    const workTaskPriorityStats = await prisma.workTask.groupBy({
      by: ['priority'],
      _count: {
        id: true
      }
    });

    const stats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        recent: recentUsers
      },
      projects: {
        total: totalProjects,
        active: activeProjects,
        recent: recentProjects
      },
      scenes: {
        total: totalScenes
      },
      comments: {
        total: totalComments
      },
      workTasks: {
        total: totalWorkTasks,
        recent: recentWorkTasks,
        byPriority: workTaskPriorityStats.reduce((acc, item) => {
          acc[item.priority] = item._count.id;
          return acc;
        }, {} as Record<string, number>)
      },
      subTasks: {
        total: totalSubTasks,
        recent: recentSubTasks,
        byStatus: subTaskStatusStats.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
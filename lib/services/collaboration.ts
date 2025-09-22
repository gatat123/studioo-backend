import { prisma } from "@/lib/prisma";

type ActionType = string;

export interface CollaborationLogData {
  projectId: string;
  userId: string;
  action?: string;
  actionType?: ActionType; // backward compatibility
  details?: string;
  description?: string; // backward compatibility
  // Removed fields that don't exist in the new schema
  // targetType, targetId, sceneId, metadata
}

export interface ActivityFilters {
  projectId?: string;
  sceneId?: string;
  userId?: string;
  actionTypes?: ActionType[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface UserPresenceData {
  userId: string;
  projectId: string;
  sceneId?: string;
  imageId?: string;
  status: "active" | "idle" | "away" | "offline";
  cursorPosition?: {
    x: number;
    y: number;
  };
  currentTool?: string;
  metadata?: Record<string, any>;
}

export class CollaborationService {
  /**
   * 협업 로그 기록
   */
  static async logActivity(data: CollaborationLogData) {
    try {
      return await prisma.collaborationLog.create({
        data: {
          projectId: data.projectId,
          userId: data.userId,
          action: data.actionType || data.action || 'unknown',
          details: data.description || data.details || '',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
        },
      });
    } catch (error) {
      console.error("Failed to log collaboration activity:", error);
      throw error;
    }
  }

  /**
   * 활동 히스토리 조회
   */
  static async getActivityHistory(filters: ActivityFilters = {}) {
    try {
      const {
        projectId,
        sceneId,
        userId,
        actionTypes,
        startDate,
        endDate,
        limit = 50,
        offset = 0,
      } = filters;

      const where: any = {};

      if (projectId) where.projectId = projectId;
      if (sceneId) where.sceneId = sceneId;
      if (userId) where.userId = userId;
      if (actionTypes && actionTypes.length > 0) {
        where.actionType = { in: actionTypes };
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const [activities, total] = await Promise.all([
        prisma.collaborationLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.collaborationLog.count({ where }),
      ]);

      return {
        activities,
        total,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      console.error("Failed to get activity history:", error);
      throw error;
    }
  }

  /**
   * 사용자 프레젠스 업데이트
   */
  static async updateUserPresence(data: UserPresenceData) {
    try {
      return await prisma.userPresence.upsert({
        where: {
          userId: data.userId,
        },
        update: {
          status: data.status,
          lastSeen: new Date(),
        },
        create: {
          userId: data.userId,
          status: data.status,
          lastSeen: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
        },
      });
    } catch (error) {
      console.error("Failed to update user presence:", error);
      throw error;
    }
  }

  /**
   * 프로젝트의 현재 활성 사용자 조회
   */
  static async getActiveUsers(projectId: string, sceneId?: string) {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // UserPresence 모델에 projectId가 없으므로, 모든 활성 사용자를 반환
      const where: any = {
        lastSeen: {
          gte: fiveMinutesAgo,
        },
        status: {
          in: ["active", "idle"],
        },
      };

      return await prisma.userPresence.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
        },
        orderBy: { lastSeen: "desc" },
      });
    } catch (error) {
      console.error("Failed to get active users:", error);
      throw error;
    }
  }

  /**
   * 사용자 프레젠스 제거 (로그아웃/연결 해제)
   */
  static async removeUserPresence(userId: string, projectId: string) {
    try {
      await prisma.userPresence.delete({
        where: {
          userId: userId,
        },
      });
    } catch (error: any) {
      // 이미 존재하지 않는 경우는 무시
      if (error?.code !== "P2025") {
        console.error("Failed to remove user presence:", error);
      }
    }
  }

  /**
   * 프로젝트 통계 조회
   */
  static async getProjectStatistics(projectId: string, days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 활동 통계
      const activityStats = await prisma.collaborationLog.groupBy({
        by: ["action"],
        where: {
          projectId,
          createdAt: {
            gte: startDate,
          },
        },
        _count: {
          action: true,
        },
      });

      // 참여자별 활동
      const userActivityStats = await prisma.collaborationLog.groupBy({
        by: ["userId"],
        where: {
          projectId,
          createdAt: {
            gte: startDate,
          },
        },
        _count: {
          userId: true,
        },
      });

      // 일별 활동 통계
      const dailyActivity = await prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as activities
        FROM collaboration_logs 
        WHERE project_id = ${projectId} 
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `;

      // 씬별 활동은 CollaborationLog에 targetType/targetId가 없어서 제공할 수 없음
      const sceneStats: any[] = [];

      // 전체 통계
      const totalStats = await prisma.collaborationLog.aggregate({
        where: {
          projectId,
          createdAt: {
            gte: startDate,
          },
        },
        _count: {
          id: true,
        },
      });

      return {
        period: { days, startDate, endDate: new Date() },
        totalActivities: totalStats._count.id,
        activityByType: activityStats.map(stat => ({
          type: stat.action,
          count: stat._count.action,
        })),
        activityByUser: userActivityStats.map(stat => ({
          userId: stat.userId,
          count: stat._count.userId,
        })),
        dailyActivity,
        sceneActivity: sceneStats,
      };
    } catch (error) {
      console.error("Failed to get project statistics:", error);
      throw error;
    }
  }

  /**
   * 사용자별 기여도 분석
   */
  static async getUserContributions(projectId: string, userId?: string, days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const where: any = {
        projectId,
        createdAt: {
          gte: startDate,
        },
      };

      if (userId) {
        where.userId = userId;
      }

      const contributions = await prisma.collaborationLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // 사용자별 기여도 분석
      const userContributions = contributions.reduce((acc, log) => {
        const userId = log.userId;
        if (!acc[userId]) {
          acc[userId] = {
            user: log.user,
            totalActivities: 0,
            activities: {},
            firstActivity: log.createdAt,
            lastActivity: log.createdAt,
          };
        }

        acc[userId].totalActivities++;
        acc[userId].activities[log.action] = (acc[userId].activities[log.action] || 0) + 1;
        
        if (log.createdAt < acc[userId].firstActivity) {
          acc[userId].firstActivity = log.createdAt;
        }
        if (log.createdAt > acc[userId].lastActivity) {
          acc[userId].lastActivity = log.createdAt;
        }

        return acc;
      }, {} as Record<string, any>);

      return {
        period: { days, startDate, endDate: new Date() },
        contributions: Object.values(userContributions),
        totalContributors: Object.keys(userContributions).length,
      };
    } catch (error) {
      console.error("Failed to get user contributions:", error);
      throw error;
    }
  }

  /**
   * 최근 중요 활동 조회
   */
  static async getRecentImportantActivity(projectId: string, limit: number = 10) {
    try {
      const importantActionTypes: ActionType[] = [
        "create_project",
        "create_scene",
        "upload_image",
        "create_annotation",
        "resolve_annotation",
        "invite_user",
        "join_project",
      ];

      return await prisma.collaborationLog.findMany({
        where: {
          projectId,
          action: { in: importantActionTypes },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    } catch (error) {
      console.error("Failed to get recent important activity:", error);
      throw error;
    }
  }

  /**
   * 충돌 감지 및 해결
   */
  static async detectConflicts(projectId: string, sceneId: string) {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // 활동 중인 사용자들 (UserPresence에는 projectId, sceneId가 없음)
      const activeUsers = await prisma.userPresence.findMany({
        where: {
          lastSeen: {
            gte: fiveMinutesAgo,
          },
          status: "active",
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
      });

      // 최근 동시 편집 활동 (CollaborationLog는 단순 action/details 구조)
      const recentActivities = await prisma.collaborationLog.findMany({
        where: {
          projectId,
          createdAt: {
            gte: fiveMinutesAgo,
          },
          action: {
            in: ["update_annotation", "create_annotation", "create_comment"],
          },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // 단순화된 충돌 감지 로직 (targetType, targetId가 없으므로)
      const potentialConflicts = [];
      const userActivities = new Map();

      for (const activity of recentActivities) {
        const userId = activity.userId;
        if (!userActivities.has(userId)) {
          userActivities.set(userId, []);
        }
        userActivities.get(userId).push(activity);
      }

      // 여러 사용자가 같은 시간대에 활동하는 경우를 감지
      if (recentActivities.length > 1) {
        const uniqueUsers = new Set(recentActivities.map(a => a.userId));
        if (uniqueUsers.size > 1) {
          potentialConflicts.push({
            type: "concurrent_editing",
            target: `project:${projectId}`,
            users: Array.from(uniqueUsers).map(userId =>
              recentActivities.find(a => a.userId === userId)?.user
            ),
            activities: recentActivities.slice(0, 5),
          });
        }
      }

      return {
        activeUsers,
        recentActivities: recentActivities.slice(0, 20),
        potentialConflicts,
        riskLevel: potentialConflicts.length > 0 ? "medium" : "low",
      };
    } catch (error) {
      console.error("Failed to detect conflicts:", error);
      throw error;
    }
  }

  /**
   * 활동 요약 생성
   */
  static async generateActivitySummary(projectId: string, days: number = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const activities = await prisma.collaborationLog.findMany({
        where: {
          projectId,
          createdAt: {
            gte: startDate,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const summary = {
        period: `${days}일간`,
        totalActivities: activities.length,
        activeUsers: new Set(activities.map(a => a.userId)).size,
        mostActiveUser: null as any,
        topActivities: {} as Record<string, number>,
        timeline: [] as any[],
      };

      // 사용자별 활동 수 계산
      const userActivityCount = activities.reduce((acc, activity) => {
        acc[activity.userId] = (acc[activity.userId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 가장 활발한 사용자
      const mostActiveUserId = Object.keys(userActivityCount).reduce((a, b) =>
        userActivityCount[a] > userActivityCount[b] ? a : b
      );

      if (mostActiveUserId) {
        summary.mostActiveUser = {
          ...activities.find(a => a.userId === mostActiveUserId)?.user,
          activityCount: userActivityCount[mostActiveUserId],
        };
      }

      // 활동 타입별 통계
      summary.topActivities = activities.reduce((acc, activity) => {
        acc[activity.action] = (acc[activity.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 일별 타임라인
      const dailyActivities = activities.reduce((acc, activity) => {
        const date = activity.createdAt.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, count: 0, activities: [] };
        }
        acc[date].count++;
        acc[date].activities.push(activity);
        return acc;
      }, {} as Record<string, any>);

      summary.timeline = Object.values(dailyActivities)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return summary;
    } catch (error) {
      console.error("Failed to generate activity summary:", error);
      throw error;
    }
  }
}

export default CollaborationService;
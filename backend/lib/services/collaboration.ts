import { prisma } from "@/lib/prisma";

type ActionType = string;

export interface CollaborationLogData {
  projectId: string;
  userId: string;
  actionType: ActionType;
  targetType: "project" | "scene" | "image" | "comment" | "annotation" | "invite" | "user";
  targetId: string;
  sceneId?: string;
  description: string;
  metadata?: Record<string, any>;
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
      const log = await prisma.collaborationLog.create({
        data: {
          projectId: data.projectId,
          userId: data.userId,
          actionType: data.actionType,
          targetType: data.targetType,
          targetId: data.targetId,
          description: data.description,
          metadata: data.metadata,
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

      return log;
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
      const presence = await prisma.userPresence.upsert({
        where: {
          userId_projectId: {
            userId: data.userId,
            projectId: data.projectId,
          },
        },
        update: {
          sceneId: data.sceneId,
          status: data.status,
          cursorX: data.cursorPosition?.x,
          cursorY: data.cursorPosition?.y,
          lastActivity: new Date(),
        },
        create: {
          userId: data.userId,
          projectId: data.projectId,
          sceneId: data.sceneId,
          status: data.status,
          cursorX: data.cursorPosition?.x,
          cursorY: data.cursorPosition?.y,
          lastActivity: new Date(),
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

      return presence;
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

      const where: any = {
        projectId,
        lastActivity: {
          gte: fiveMinutesAgo,
        },
        status: {
          in: ["active", "idle"],
        },
      };

      if (sceneId) {
        where.sceneId = sceneId;
      }

      const activeUsers = await prisma.userPresence.findMany({
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
        orderBy: { lastActivity: "desc" },
      });

      return activeUsers;
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
          userId_projectId: {
            userId,
            projectId,
          },
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
        by: ["actionType"],
        where: {
          projectId,
          createdAt: {
            gte: startDate,
          },
        },
        _count: {
          actionType: true,
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

      // 씬별 활동 - targetType이 'scene'인 경우만 필터링
      const sceneActivity = await prisma.collaborationLog.findMany({
        where: {
          projectId,
          targetType: 'scene',
          createdAt: {
            gte: startDate,
          },
        },
        select: {
          targetId: true,
          actionType: true,
        },
      });

      // targetId(sceneId)로 그룹화
      const sceneStats = sceneActivity.reduce((acc, activity) => {
        const sceneId = activity.targetId;
        if (sceneId) {
          if (!acc[sceneId]) {
            acc[sceneId] = {
              sceneId,
              count: 0,
            };
          }
          acc[sceneId].count++;
        }
        return acc;
      }, {} as Record<string, any>);

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
          type: stat.actionType,
          count: stat._count.actionType,
        })),
        activityByUser: userActivityStats.map(stat => ({
          userId: stat.userId,
          count: stat._count.userId,
        })),
        dailyActivity,
        sceneActivity: Object.values(sceneStats),
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
        acc[userId].activities[log.actionType] = (acc[userId].activities[log.actionType] || 0) + 1;
        
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

      const activities = await prisma.collaborationLog.findMany({
        where: {
          projectId,
          actionType: { in: importantActionTypes },
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

      return activities;
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

      // 같은 씬에서 활동 중인 사용자들
      const activeUsers = await prisma.userPresence.findMany({
        where: {
          projectId,
          sceneId,
          lastActivity: {
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

      // 최근 동시 편집 활동
      const recentActivities = await prisma.collaborationLog.findMany({
        where: {
          projectId,
          targetType: 'scene',
          targetId: sceneId,
          createdAt: {
            gte: fiveMinutesAgo,
          },
          actionType: {
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

      // 잠재적 충돌 감지 로직
      const potentialConflicts = [];
      const userActivities = new Map();

      for (const activity of recentActivities) {
        const userId = activity.userId;
        if (!userActivities.has(userId)) {
          userActivities.set(userId, []);
        }
        userActivities.get(userId).push(activity);
      }

      // 같은 타겟에 대한 동시 작업 감지
      const targetActivities = new Map();
      for (const activity of recentActivities) {
        const key = `${activity.targetType}:${activity.targetId}`;
        if (!targetActivities.has(key)) {
          targetActivities.set(key, []);
        }
        targetActivities.get(key).push(activity);
      }

      for (const [target, activities] of targetActivities) {
        if (activities.length > 1) {
          const uniqueUsers = new Set(activities.map((a: any) => a.userId));
          if (uniqueUsers.size > 1) {
            potentialConflicts.push({
              type: "concurrent_editing",
              target,
              users: Array.from(uniqueUsers).map(userId => 
                activities.find((a: any) => a.userId === userId)?.user
              ),
              activities: activities.slice(0, 5), // 최근 5개만
            });
          }
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
        acc[activity.actionType] = (acc[activity.actionType] || 0) + 1;
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